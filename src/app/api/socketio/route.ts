import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  return NextResponse.json({ status: 'Socket.io mock with Prisma ready' })
}

export async function POST(req: NextRequest) {
  try {
    const data = await req.json();
    const { content, userId, channelId, action, encrypted } = data;

    // Handle IRC-originated messages (bot -> webapp)
  if (action === 'irc-message') {
      // Messaggio proveniente da IRC esterno (via bot)
      const from = data.from || 'irc-guest';

      // If this irc-message is actually an echo of a webapp-originated message,
      // the bot can pass originalMessageId so we avoid re-creating the same message.
      if (data.originalMessageId) {
        // Found an echo: skip creating duplicate
        return NextResponse.json({ success: true, skipped: true, originalMessageId: data.originalMessageId })
      }

      // 1. Trova o crea utente "irc-<from>"
      let user = await prisma.user.findUnique({ where: { username: from } });
      if (!user) {
        user = await prisma.user.create({
          data: {
            username: from,
            email: `${from}@irc.local`,
            isOnline: false,
            roles: ['irc'],
          },
        });
      }

      // 2. Trova o crea canale
      let channel = await prisma.channel.findUnique({ where: { id: channelId } });
      if (!channel) {
        // maybe a channel exists with the same name but different id (unique name constraint)
        channel = await prisma.channel.findUnique({ where: { name: channelId } });
        if (!channel) {
          channel = await prisma.channel.create({
            data: {
              id: channelId,
              name: channelId,
              description: `Canale ${channelId}`,
              isPrivate: false,
              creator: { connect: { id: user.id } },
            },
          });
        }
      }

      // 3. Evita duplicati: se un messaggio identico (o echo del bot) è stato creato pochi
      // secondi prima dalla webapp, non reinserirlo. Questo previene l'echo webapp->IRC->webapp.
      const fiveSecAgo = new Date(Date.now() - 5000);
      // Se il messaggio arriva nel formato "[username] originalMessage", prova a
      // verificare se esiste già un messaggio con content == originalMessage inviato
      // dallo stesso username nella finestra temporale.
      if (typeof content === 'string') {
        const echoMatch = content.match(/^\[([^\]]+)\]\s*(.*)$/);
        if (echoMatch) {
          const originalUser = echoMatch[1];
          const originalText = echoMatch[2];
          const original = await prisma.user.findUnique({ where: { username: originalUser } });
          if (original) {
            const dup = await prisma.message.findFirst({
              where: {
                channelId,
                userId: original.id,
                content: originalText,
                timestamp: { gte: fiveSecAgo }
              }
            });
            if (dup) {
              // Skippa la creazione: è molto probabile un echo del bot
              return NextResponse.json({ success: true, skipped: true })
            }
          }
        }

        // Controllo duplicato generico (stesso contenuto nello stesso canale in 5s)
        const dupExact = await prisma.message.findFirst({
          where: {
            channelId,
            content,
            timestamp: { gte: fiveSecAgo }
          }
        });
        if (dupExact) {
          return NextResponse.json({ success: true, skipped: true })
        }
      }

      // 4. Salva messaggio nel database (nessun duplicato rilevato)
  const message = await (prisma as any).message.create({
        data: {
          content: content,
          encrypted: !!data.encrypted,
          iv: typeof data.iv === 'string' ? data.iv : null,
          keyId: typeof data.keyId === 'string' ? data.keyId : null,
          userId: user.id,
          channelId: channel.id,
          type: 'MESSAGE',
        },
        include: {
          user: { select: { id: true, username: true, avatar: true, roles: true } },
          channel: { select: { id: true, name: true } },
        },
      });

      return NextResponse.json({
        success: true,
        message: {
          id: message.id,
          content: message.content,
          userId: message.userId,
          channelId: message.channelId,
          timestamp: message.timestamp,
          user: message.user,
          channel: message.channel,
          type: message.type,
        }
      })
    }

    // Handle webapp-originated messages (webapp -> bot)
  if (action === 'send-message') {
        // 1. Verifica utente: supporta userId oppure username (dev-friendly)
        let user = null as any
        if (userId) {
          user = await prisma.user.findUnique({ where: { id: userId } })
        }
        // se non c'è userId o l'utente non esiste, prova a usare `username` per trovare/creare
        if (!user && typeof data.username === 'string') {
          user = await prisma.user.findUnique({ where: { username: data.username } })
          if (!user) {
            user = await prisma.user.create({
              data: {
                username: data.username,
                email: `${data.username}@local`,
                isOnline: true,
                roles: ['user'],
              }
            })
          }
        }

        if (!user) {
          return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }

      // 2. Verifica/crea canale
      let channel = await prisma.channel.findUnique({ where: { id: channelId } });
      if (!channel) {
        channel = await prisma.channel.findUnique({ where: { name: channelId } });
        if (!channel) {
          channel = await prisma.channel.create({
            data: {
              id: channelId,
              name: channelId,
              description: `Canale ${channelId}`,
              isPrivate: false,
              creator: { connect: { id: user.id } },
            },
          });
        }
      }

      // 3. Salva messaggio nel database
      const authorId = user.id
      const message = await (prisma as any).message.create({
        data: {
          content,
          encrypted: !!encrypted,
          iv: typeof data.iv === 'string' ? data.iv : null,
          keyId: typeof data.keyId === 'string' ? data.keyId : null,
          userId: authorId,
          channelId: channel.id,
          type: 'MESSAGE',
        },
        include: {
          user: { select: { id: true, username: true, avatar: true, roles: true } },
          channel: { select: { id: true, name: true } },
        },
      });

      // 4. Inoltra al bot HTTP bridge
      try {
        const channelName = channel.name.startsWith('#') ? channel.name : `#${channel.name}`;
        const res = await fetch('http://localhost:4000/send-irc', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
              channel: channelName,
              message: content,
              from: user.username,
          encrypted: !!encrypted,
          iv: typeof data.iv === 'string' ? data.iv : undefined,
          keyId: typeof data.keyId === 'string' ? data.keyId : undefined,
          // include original message id so the bot can correlate echoes
          originalMessageId: message.id,
            }),
        });
        if (!res.ok) {
          const errText = await res.text();
          console.error('❌ Bridge webapp→IRC HTTP error:', errText);
        } else {
          console.log('[BRIDGE] Messaggio inoltrato al bot bridge HTTP');
        }
      } catch (err) {
        console.error('❌ Bridge webapp→IRC HTTP error:', err);
      }

      return NextResponse.json({
        success: true,
        message: {
          id: message.id,
          content: message.content,
          userId: message.userId,
          channelId: message.channelId,
          timestamp: message.timestamp,
          user: message.user,
          channel: message.channel,
          type: message.type,
          encrypted: encrypted || false,
        }
      })
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
      return NextResponse.json({
        messages: messages.map(msg => ({
          id: msg.id,
          content: msg.content,
          userId: msg.userId,
          channelId: msg.channelId,
          timestamp: msg.timestamp,
          user: msg.user,
          channel: msg.channel,
          type: msg.type,
        })),
      })
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