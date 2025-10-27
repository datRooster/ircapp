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

      // 3. Salva messaggio nel database
      const message = await prisma.message.create({
        data: {
          content: content,
          userId: user.id,
          channelId: channelId,
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
      // 1. Verifica utente
      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (!user) {
        return NextResponse.json({ error: 'User not found' }, { status: 404 });
      }

      // 2. Verifica/crea canale
      let channel = await prisma.channel.findUnique({ where: { id: channelId } });
      if (!channel) {
        channel = await prisma.channel.create({
          data: {
            id: channelId,
            name: channelId,
            description: `Canale ${channelId}`,
            isPrivate: false,
            creator: { connect: { id: userId } },
          },
        });
      }

      // 3. Salva messaggio nel database
      const message = await prisma.message.create({
        data: {
          content,
          userId,
          channelId,
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
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}