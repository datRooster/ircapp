import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

const botBridgeBaseUrl = (process.env.BOT_BRIDGE_URL || 'http://localhost:4000').replace(/\/$/, '')
const bridgeSharedSecret = process.env.BRIDGE_SHARED_SECRET || process.env.IRC_ENCRYPTION_KEY || ''

function roleSatisfiesRequirement(roles: string[], requiredRole: string) {
  const normalizedRoles = roles.map((role) => role.toLowerCase())
  const requirement = (requiredRole || 'user').toLowerCase()

  switch (requirement) {
    case 'guest':
      return true
    case 'user':
      return !normalizedRoles.includes('guest')
    case 'moderator':
      return normalizedRoles.includes('moderator') || normalizedRoles.includes('admin')
    case 'admin':
      return normalizedRoles.includes('admin')
    default:
      return true
  }
}

async function resolveChannel(channelId: string) {
  if (!channelId) return null

  return prisma.channel.findFirst({
    where: {
      OR: [
        { id: channelId },
        { name: channelId.replace(/^#/, '').trim().toLowerCase() }
      ]
    },
    select: {
      id: true,
      name: true,
      category: true,
      isPrivate: true,
      inviteOnly: true,
      channelKeyHash: true,
      isArchived: true,
      expiresAt: true,
      requiredRole: true
    }
  })
}

export async function GET() {
  return NextResponse.json({ status: 'Socket.io mock with Prisma ready' })
}

export async function POST(req: NextRequest) {
  // RIMOSSI log su variabili non ancora dichiarate
  try {
    const data = await req.json();
    const { content, channelId, action } = data;
    const session = await auth()

    // Webapp -> bot flow handled below (forward to bot bridge). We don't save plaintext/encrypted message here

    // Handle webapp-originated messages (webapp -> bot)
    if (action === 'send-message') {
      const dbChannel = await resolveChannel(channelId)
      if (!dbChannel) {
        return NextResponse.json({ error: 'Channel not found' }, { status: 404 })
      }

      if (dbChannel.isArchived || (dbChannel.expiresAt && dbChannel.expiresAt <= new Date())) {
        return NextResponse.json({ error: 'Channel expired or archived' }, { status: 403 })
      }

      const isGuest = !session?.user
      let requesterRoles = ['guest']
      let membership = null

      if (!isGuest) {
        const dbUser = await prisma.user.findUnique({
          where: { id: session.user.id },
          select: { roles: true }
        })

        if (!dbUser) {
          return NextResponse.json({ error: 'User not found' }, { status: 404 })
        }

        requesterRoles = dbUser.roles
        membership = await prisma.channelMember.findUnique({
          where: {
            userId_channelId: {
              userId: session.user.id,
              channelId: dbChannel.id
            }
          },
          select: {
            canRead: true,
            canWrite: true
          }
        })
      }

      const isPrivileged = requesterRoles.includes('admin') || requesterRoles.includes('moderator')
      const canRead = isGuest
        ? ['GUEST', 'HELP'].includes(dbChannel.category)
        : (
            roleSatisfiesRequirement(requesterRoles, dbChannel.requiredRole) &&
            (
              !dbChannel.isPrivate ||
              isPrivileged ||
              !!membership
            )
          )

      if (!canRead) {
        return NextResponse.json({ error: 'Access denied for this channel' }, { status: 403 })
      }

      const canWrite = isGuest
        ? ['guest', 'help'].includes(dbChannel.name)
        : (
            isPrivileged ||
            (
              dbChannel.name !== 'lobby' &&
              roleSatisfiesRequirement(requesterRoles, dbChannel.requiredRole) &&
              (
                !dbChannel.isPrivate && !dbChannel.inviteOnly && !dbChannel.channelKeyHash ||
                membership?.canWrite
              )
            )
          )

      if (!canWrite) {
        return NextResponse.json({ error: 'You cannot write to this channel' }, { status: 403 })
      }

      // La webapp non salva più il messaggio nel DB, ma lo inoltra solo al bot bridge
      // (il messaggio verrà salvato solo quando il bot lo notificherà come irc-message)
      // 1. Inoltra al bot HTTP bridge
      try {
        // Inoltra al bot HTTP bridge con timeout. Se il bridge non risponde, fall back a salvarlo localmente
        const bridgeUrl = `${botBridgeBaseUrl}/send-irc`
        const controller = new AbortController()
        const timeoutMs = 5000
        const timeout = setTimeout(() => controller.abort(), timeoutMs)
        try {
          // Prefer channel name for the bridge; accept channelName from client if present
          const channelForBridge = (data.channelName && typeof data.channelName === 'string')
            ? (data.channelName.startsWith('#') ? data.channelName : `#${data.channelName}`)
            : `#${dbChannel.name}`

          // Cifra il messaggio prima di inviarlo al bot
          const { SecureIRCProtocol } = require('@/lib/secure-irc.server')
          const sanitized = SecureIRCProtocol.sanitizeContent(content)
          const encryptedObj = SecureIRCProtocol.encryptMessage(sanitized)

          // Debug: log dei dati cifrati
          console.log('[API][DEBUG] Sending to bot:', JSON.stringify({
            channel: channelForBridge,
            messagePreview: encryptedObj.encryptedContent?.slice(0, 50),
            from: data.username,
            encrypted: true,
            ivPreview: encryptedObj.iv?.slice(0, 20),
            keyIdPreview: encryptedObj.tag?.slice(0, 20)
          }))

          const res = await fetch(bridgeUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...(bridgeSharedSecret ? { 'x-irc-bridge-key': bridgeSharedSecret } : {})
            },
            body: JSON.stringify({
              channel: channelForBridge,
              message: encryptedObj.encryptedContent,
              from: !isGuest
                ? (
                    ((session.user as { username?: string })?.username) ||
                    session.user?.name ||
                    data.username
                  )
                : (data.username || 'guest'),
              encrypted: true,
              iv: encryptedObj.iv,
              keyId: encryptedObj.tag
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
                userId: !isGuest ? session!.user!.id : (data.userId || 'anonymous'),
                channelId: dbChannel.id,
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
                const bridgeUrl = `${botBridgeBaseUrl}/send-irc`
                const body = JSON.stringify({
                  channel: `#${dbChannel.name}`,
                  message: encryptedObj.encryptedContent,
                  from: !isGuest
                    ? (
                        ((session?.user as { username?: string })?.username) ||
                        session?.user?.name ||
                        data.username
                      )
                    : (data.username || 'guest'),
                  encrypted: true,
                  iv: encryptedObj.iv,
                  keyId: encryptedObj.tag
                })
                const notifyController = new AbortController()
                const notifyTimeout = setTimeout(() => notifyController.abort(), 5000)
                const resNotify = await fetch(bridgeUrl, {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    ...(bridgeSharedSecret ? { 'x-irc-bridge-key': bridgeSharedSecret } : {})
                  },
                  body,
                  signal: notifyController.signal
                })
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
      const dbChannel = await resolveChannel(channelId)
      if (!dbChannel) {
        return NextResponse.json({ error: 'Channel not found' }, { status: 404 })
      }

      if (dbChannel.isArchived || (dbChannel.expiresAt && dbChannel.expiresAt <= new Date())) {
        return NextResponse.json({ error: 'Channel expired or archived' }, { status: 403 })
      }

      const isGuest = !session?.user
      let requesterRoles = ['guest']
      let membership = null

      if (!isGuest) {
        const dbUser = await prisma.user.findUnique({
          where: { id: session.user.id },
          select: { roles: true }
        })

        if (!dbUser) {
          return NextResponse.json({ error: 'User not found' }, { status: 404 })
        }

        requesterRoles = dbUser.roles
        membership = await prisma.channelMember.findUnique({
          where: {
            userId_channelId: {
              userId: session.user.id,
              channelId: dbChannel.id
            }
          },
          select: {
            canRead: true
          }
        })
      }

      const canRead = isGuest
        ? ['GUEST', 'HELP'].includes(dbChannel.category)
        : (
            roleSatisfiesRequirement(requesterRoles, dbChannel.requiredRole) &&
            (
              !dbChannel.isPrivate ||
              requesterRoles.includes('admin') ||
              requesterRoles.includes('moderator') ||
              !!membership
            )
          )

      if (!canRead) {
        return NextResponse.json({ error: 'Access denied for this channel' }, { status: 403 })
      }

      // Carica messaggi dal database
      const messages = await prisma.message.findMany({
        where: { channelId: dbChannel.id },
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
      const providedBridgeSecret = req.headers.get('x-irc-bridge-key') || ''
      if (bridgeSharedSecret && providedBridgeSecret !== bridgeSharedSecret) {
        return NextResponse.json({ error: 'Invalid bridge credentials' }, { status: 403 })
      }

      // Expected fields from bot: channelId, content (encrypted hex), iv (hex), keyId/tag (hex), from, realFrom, encrypted
      try {
        const { SecureIRCProtocol } = require('@/lib/secure-irc.server')
        const channelInput = data.channelId || data.channel || ''
        const normalizedChannel = typeof channelInput === 'string'
          ? channelInput.replace(/^#/, '').trim().toLowerCase()
          : ''
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

        let dbChannel = await prisma.channel.findFirst({
          where: {
            OR: [
              { id: normalizedChannel },
              { name: normalizedChannel }
            ]
          },
          select: { id: true, name: true }
        })

        if (!dbChannel) {
          dbChannel = await prisma.channel.create({
            data: {
              id: normalizedChannel || undefined,
              name: normalizedChannel || 'general',
              description: `Auto-created channel for #${normalizedChannel || 'general'}`,
              category: 'GENERAL',
              requiredRole: 'user',
              isPrivate: false,
              createdBy: 'system'
            },
            select: { id: true, name: true }
          })
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
            channelId: dbChannel.id,
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
