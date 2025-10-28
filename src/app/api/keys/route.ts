import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'

export async function GET(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Only return raw key to clients that declare Web Crypto support.
    // This reduces accidental exposure to clients that cannot perform client-side crypto.
    const url = new URL(req.url)
    const clientSupportsSubtle = url.searchParams.get('clientSupportsSubtle') === 'true'

    const key = process.env.WEBAPP_ENC_KEY || null
    if (!key) {
      return NextResponse.json({ error: 'Encryption key not configured' }, { status: 500 })
    }

    if (!clientSupportsSubtle) {
      return NextResponse.json({ error: 'Client does not declare SubtleCrypto support' }, { status: 400 })
    }

    return NextResponse.json({ key })
  } catch (err) {
    console.error('❌ Key API error', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
