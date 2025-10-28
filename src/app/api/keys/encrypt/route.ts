import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import crypto from 'crypto'

export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json()
    const { plaintext } = body
    if (typeof plaintext !== 'string') return NextResponse.json({ error: 'plaintext required' }, { status: 400 })

    const keyBase64 = process.env.WEBAPP_ENC_KEY
    if (!keyBase64) return NextResponse.json({ error: 'Encryption key not configured' }, { status: 500 })

    const key = Buffer.from(keyBase64, 'base64')
    const iv = crypto.randomBytes(12)
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv)
    const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
    const tag = cipher.getAuthTag()
    const combined = Buffer.concat([ciphertext, tag]).toString('base64')

    return NextResponse.json({ content: combined, iv: iv.toString('base64') })
  } catch (err) {
    console.error('❌ /api/keys/encrypt error', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
