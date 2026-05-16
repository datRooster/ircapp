import { NextRequest, NextResponse } from 'next/server'

const botBridgeBaseUrl = (process.env.BOT_BRIDGE_URL || 'http://localhost:4000').replace(/\/$/, '')
const bridgeSharedSecret = process.env.BRIDGE_SHARED_SECRET || process.env.IRC_ENCRYPTION_KEY || ''

export async function POST(req: NextRequest) {
  try {
    const { channel, topic } = await req.json();
    // Chiamata HTTP al bot webapp per impostare il topic
    const res = await fetch(`${botBridgeBaseUrl}/set-topic`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(bridgeSharedSecret ? { 'x-irc-bridge-key': bridgeSharedSecret } : {})
      },
      body: JSON.stringify({ channel, topic })
    });
    if (!res.ok) {
      const errText = await res.text();
      return NextResponse.json({ error: errText }, { status: 500 });
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
