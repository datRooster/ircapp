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

    // Handle IRC-originated messages (bot -> webapp)
  if (action === 'irc-message') {
    // Log di debug solo dentro il blocco dove data, user e content sono disponibili
    console.log('[API][DEBUG] Payload ricevuto:', JSON.stringify(data))
      // Messaggio proveniente da IRC esterno (via bot)

      // Usa realFrom per il mapping utente (mittente reale)
      const realFrom = data.realFrom || data.from || 'irc-guest';
      if (data.originalMessageId) {
        // Found an echo: skip creating duplicate
        return NextResponse.json({ success: true, skipped: true, originalMessageId: data.originalMessageId })
      }
      // 1. Trova o crea utente reale (no "irc-" prefix)
      let user = await prisma.user.findUnique({ where: { username: realFrom } });
      if (!user) {
        user = await prisma.user.create({
          data: {
            username: realFrom,
            email: `${realFrom}@irc.local`,
            isOnline: false,
            roles: ['irc'],
          },
        });
      }
      // Log di debug dopo che user e data sono disponibili
      if (user && data && typeof data.content !== 'undefined') {
        console.log('[API][DEBUG] Salvo messaggio: content=', data.content, 'user=', user.username, 'encrypted:', true)
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

      // 4. Salva messaggio cifrato nel database
      console.log('[API][DEBUG] Salvo messaggio: content=', data.content, 'user=', user?.username, 'encrypted:', true)
      const message = await (prisma as any).message.create({
        data: {
          content: data.content, // deve essere base64 cifrato
          encrypted: true,
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
    // La webapp non salva più il messaggio nel DB, ma lo inoltra solo al bot bridge
    // (il messaggio verrà salvato solo quando il bot lo notificherà come irc-message)
    // 1. Inoltra al bot HTTP bridge
    try {
      const res = await fetch('http://localhost:4000/send-irc', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          channel: channelId.startsWith('#') ? channelId : `#${channelId}`,
          message: content,
          from: data.username,
          encrypted: !!encrypted,
          iv: typeof data.iv === 'string' ? data.iv : undefined,
          keyId: typeof data.keyId === 'string' ? data.keyId : undefined
        }),
      });
      if (!res.ok) {
        const errText = await res.text();
        console.error('❌ Bridge webapp→IRC HTTP error:', errText);
        return NextResponse.json({ error: 'Bridge error', details: errText }, { status: 500 });
      } else {
        console.log('[BRIDGE] Messaggio inoltrato al bot bridge HTTP');
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