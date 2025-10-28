import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import crypto from 'crypto'

export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json()
    const { content, iv } = body
    if (typeof content !== 'string' || typeof iv !== 'string') {
      return NextResponse.json({ error: 'content and iv are required' }, { status: 400 })
    }

    const keyBase64 = process.env.WEBAPP_ENC_KEY
    if (!keyBase64) return NextResponse.json({ error: 'Encryption key not configured' }, { status: 500 })

    try {
      const key = Buffer.from(keyBase64, 'base64')
      const ivBuf = Buffer.from(iv, 'base64')
      const combined = Buffer.from(content, 'base64')
      const tag = combined.slice(combined.length - 16)
      const ciphertext = combined.slice(0, combined.length - 16)
      const decipher = crypto.createDecipheriv('aes-256-gcm', key, ivBuf)
      decipher.setAuthTag(tag)
      const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8')
      return NextResponse.json({ plaintext })
    } catch (err) {
      console.error('❌ decrypt failed', err)
      return NextResponse.json({ error: 'Decrypt failed' }, { status: 500 })
    }
  } catch (err) {
    console.error('❌ /api/keys/decrypt error', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
