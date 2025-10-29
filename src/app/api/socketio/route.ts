import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  return NextResponse.json({ status: 'Socket.io mock with Prisma ready' })
}

export async function POST(req: NextRequest) {
  // RIMOSSI log su variabili non ancora dichiarate
  try {
    const data = await req.json();
    const { content, userId, channelId, action, encrypted } = data;

    // Webapp -> bot flow handled below (forward to bot bridge). We don't save plaintext/encrypted message here

    // Handle webapp-originated messages (webapp -> bot)
    if (action === 'send-message') {
      // La webapp non salva più il messaggio nel DB, ma lo inoltra solo al bot bridge
      // (il messaggio verrà salvato solo quando il bot lo notificherà come irc-message)
      // 1. Inoltra al bot HTTP bridge
      try {
        // Inoltra al bot HTTP bridge con timeout. Se il bridge non risponde, fall back a salvarlo localmente
        const bridgeUrl = 'http://localhost:4000/send-irc'
        const controller = new AbortController()
        const timeoutMs = 5000
        const timeout = setTimeout(() => controller.abort(), timeoutMs)
        try {
          // Prefer channel name for the bridge; accept channelName from client if present
          const channelForBridge = (data.channelName && typeof data.channelName === 'string')
            ? (data.channelName.startsWith('#') ? data.channelName : `#${data.channelName}`)
            : (channelId && typeof channelId === 'string' && channelId.startsWith('#') ? channelId : `#${channelId}`)

          const res = await fetch(bridgeUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              channel: channelForBridge,
              message: content,
              from: data.username,
              encrypted: !!encrypted,
              iv: typeof data.iv === 'string' ? data.iv : undefined,
              keyId: typeof data.keyId === 'string' ? data.keyId : undefined
            }),
            signal: controller.signal
          });
          clearTimeout(timeout)
          if (!res.ok) {
            const errText = await res.text();
            console.error('❌ Bridge webapp→IRC HTTP error:', errText);
            // fallback to local save
            throw new Error('Bridge returned error')
          }
          // If bridge responded with JSON and a message, propagate it back to the client
          try {
            const json = await res.json()
            if (json && json.message) {
              return NextResponse.json({ success: true, message: json.message })
            }
          } catch (_) {
            // no json — continue to return optimistic success
            console.log('[BRIDGE] Messaggio inoltrato al bot bridge HTTP (no body)')
            return NextResponse.json({ success: true })
          }
        } catch (err) {
          clearTimeout(timeout)
          console.warn('[BRIDGE] Bridge unreachable or timed out, falling back to local save:', String(err))
          // Fallback: save locally (server-side) so the mock socket receive a message
          try {
            const { SecureIRCProtocol } = require('@/lib/secure-irc.server')
            const sanitized = SecureIRCProtocol.sanitizeContent(content)
            const encryptedObj = SecureIRCProtocol.encryptMessage(sanitized)
            const saved = await prisma.message.create({
              data: {
                content: encryptedObj.encryptedContent,
                iv: encryptedObj.iv,
                keyId: encryptedObj.tag,
                encrypted: true,
                userId: data.userId || 'anonymous',
                channelId,
                type: 'MESSAGE'
              },
              include: {
                user: { select: { id: true, username: true, avatar: true } }
              }
            })
            let plaintext = sanitized
            try {
              plaintext = SecureIRCProtocol.decryptMessage(saved.content, saved.iv || '', saved.keyId || '')
            } catch (e) {
              console.error('Error decrypting after local save fallback:', e)
            }
            const emitted = { ...saved, content: plaintext, encrypted: false }

            // Start a background retry to notify the bot bridge in case it was temporarily unreachable
            ;(async function backgroundNotifyBridge(retry = 0) {
              try {
                const bridgeUrl = 'http://localhost:4000/send-irc'
                const body = JSON.stringify({
                  channel: channelId.startsWith('#') ? channelId : `#${channelId}`,
                  message: content,
                  from: data.username,
                  encrypted: true,
                  iv: encryptedObj.iv,
                  tag: encryptedObj.tag
                })
                const notifyController = new AbortController()
                const notifyTimeout = setTimeout(() => notifyController.abort(), 5000)
                const resNotify = await fetch(bridgeUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body, signal: notifyController.signal })
                clearTimeout(notifyTimeout)
                if (!resNotify.ok) throw new Error('Bridge notify failed')
                console.log('[BRIDGE RETRY] Successfully notified bridge after fallback save')
              } catch (err) {
                if (retry < 3) {
                  const backoff = Math.pow(2, retry) * 1000
                  console.warn(`[BRIDGE RETRY] attempt ${retry+1} failed, retrying in ${backoff}ms`) 
                  setTimeout(() => backgroundNotifyBridge(retry + 1), backoff)
                } else {
                  console.error('[BRIDGE RETRY] All retries failed, giving up:', String(err))
                }
              }
            })()

            return NextResponse.json({ success: true, message: emitted })
          } catch (saveErr) {
            console.error('Fallback save failed:', saveErr)
            return NextResponse.json({ error: 'Bridge error and fallback save failed', details: String(saveErr) }, { status: 500 })
          }
        }
      } catch (err) {
        console.error('❌ Bridge webapp→IRC HTTP error:', err);
        return NextResponse.json({ error: 'Bridge error', details: String(err) }, { status: 500 });
      }
      // Risposta "optimistic" per la webapp: il messaggio sarà visibile solo quando torna da IRC
      return NextResponse.json({ success: true });
    }

    if (action === 'get-messages') {
      // Carica messaggi dal database
      const messages = await prisma.message.findMany({
        where: { channelId },
        include: {
          user: { select: { id: true, username: true, avatar: true, roles: true } },
          channel: { select: { id: true, name: true } },
        },
        orderBy: { timestamp: 'asc' },
        take: 100,
      })
      // Decifra lato server se necessario
      const { SecureIRCProtocol } = require('@/lib/secure-irc.server');
      return NextResponse.json({
        messages: messages.map(msg => {
          let content = msg.content;
          if (msg.encrypted) {
            try {
              // Supporta sia formato legacy (content:iv:tag) sia nuovo (campi separati)
              if (msg.iv && msg.keyId) {
                content = SecureIRCProtocol.decryptMessage(msg.content, msg.iv, msg.keyId);
              } else {
                const parts = msg.content.split(':');
                if (parts.length === 3) {
                  content = SecureIRCProtocol.decryptMessage(parts[0], parts[1], parts[2]);
                }
              }
            } catch (e) {
              content = '[Errore decifratura]';
            }
          }
          return {
            id: msg.id,
            content,
            userId: msg.userId,
            channelId: msg.channelId,
            timestamp: msg.timestamp,
            user: msg.user,
            channel: msg.channel,
            type: msg.type,
          };
        }),
      })
    }

    // Handle messages forwarded from the IRC bot (bot -> webapp)
    if (action === 'irc-message') {
      // Expected fields from bot: channelId, content (encrypted hex), iv (hex), keyId/tag (hex), from, realFrom, encrypted
      try {
        const { SecureIRCProtocol } = require('@/lib/secure-irc.server')
        const channel = data.channelId || data.channel || ''
        const enc = !!data.encrypted
        let plaintext = data.content
        if (enc && data.iv && data.keyId) {
          try {
            plaintext = SecureIRCProtocol.decryptMessage(data.content, data.iv, data.keyId)
          } catch (e) {
            console.error('Errore decifratura irc-message:', e)
            return NextResponse.json({ error: 'Decrypt failed' }, { status: 500 })
          }
        }

        // Try to find a matching user by realFrom (username)
        let userId = undefined
        if (data.realFrom) {
          const user = await prisma.user.findUnique({ where: { username: data.realFrom } })
          if (user) userId = user.id
        }
        // If no user found, try to find a generic 'webapp' user, otherwise create a placeholder user for the nick
        if (!userId) {
          const webappUser = await prisma.user.findUnique({ where: { username: 'webapp' } })
          if (webappUser) {
            userId = webappUser.id
          } else if (data.realFrom) {
            // Create a lightweight user record for this nick so messages have an author
            const created = await prisma.user.create({ data: { username: data.realFrom, name: data.realFrom } })
            userId = created.id
          } else {
            userId = data.userId || 'anonymous'
          }
        }

        // Save encrypted content to DB (store as encrypted for at-rest)
        const saved = await prisma.message.create({
          data: {
            content: data.content,
            iv: data.iv || null,
            keyId: data.keyId || null,
            encrypted: enc,
            userId,
            channelId: channel,
            type: 'MESSAGE'
          },
          include: {
            user: { select: { id: true, username: true, avatar: true } },
            channel: { select: { id: true, name: true } }
          }
        })

        // Return the plaintext message so downstream (mock socket) can display immediately
        const emitted = {
          id: saved.id,
          content: plaintext,
          userId: saved.userId,
          channelId: saved.channelId,
          timestamp: saved.timestamp,
          user: saved.user,
          channel: saved.channel,
          type: saved.type
        }
        return NextResponse.json({ success: true, message: emitted })
      } catch (err) {
        console.error('Errore handling irc-message:', err)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
      }
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  } catch (error) {
    console.error('❌ API Error:', error)
    const isDev = process.env.NODE_ENV !== 'production'
    if (isDev) {
      return NextResponse.json({ error: (error as any)?.message || 'Internal server error', stack: (error as any)?.stack || null }, { status: 500 })
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}