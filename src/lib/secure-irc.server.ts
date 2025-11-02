import crypto from 'crypto'
import { createHash } from 'crypto'

export interface SecureIRCMessage {
  id: string
  content: string
  userId: string
  channelId: string
  timestamp: Date
  signature: string
  encrypted: boolean
}

export class SecureIRCProtocol {

  private static readonly ENCRYPTION_ALGORITHM = 'aes-256-gcm'
  private static readonly SIGNATURE_ALGORITHM = 'sha256'

  private static getKey(): Buffer {
    const key = process.env.IRC_ENCRYPTION_KEY;
    if (!key) throw new Error('IRC_ENCRYPTION_KEY non impostata nelle variabili ambiente!');

    // Support common encodings: hex (64 chars), base64 (44 chars for 32 bytes), or raw utf8 of length 32
    let buf: Buffer
    // hex
    if (/^[0-9a-fA-F]{64}$/.test(key)) {
      buf = Buffer.from(key, 'hex')
    } else if (/^[A-Za-z0-9+/=]{44}$/.test(key)) {
      // base64 length for 32 bytes is 44
      buf = Buffer.from(key, 'base64')
    } else {
      buf = Buffer.from(key, 'utf8')
    }

    if (buf.length !== 32) throw new Error(`IRC_ENCRYPTION_KEY deve rappresentare 32 byte (attuale: ${buf.length})`);
    return buf;
  }

  static encryptMessage(content: string): { encryptedContent: string, iv: string, tag: string } {
    // Use 12 byte IV for AES-GCM (recommended nonce size)
    const iv = crypto.randomBytes(12)
    const key = this.getKey();
    const cipher = crypto.createCipheriv(this.ENCRYPTION_ALGORITHM, key, iv)
    let encrypted = cipher.update(content, 'utf8', 'hex')
    encrypted += cipher.final('hex')
    const tag = cipher.getAuthTag().toString('hex')
    return {
      encryptedContent: encrypted,
      iv: iv.toString('hex'),
      tag
    }
  }

  static decryptMessage(encryptedContent: string, iv: string, tag: string): string {
    try {
      const key = this.getKey();
      const decipher = crypto.createDecipheriv(this.ENCRYPTION_ALGORITHM, key, Buffer.from(iv, 'hex'))
      decipher.setAuthTag(Buffer.from(tag, 'hex'))
      let decrypted = decipher.update(encryptedContent, 'hex', 'utf8')
      decrypted += decipher.final('utf8')
      return decrypted
    } catch (error) {
      console.error('Decryption failed:', error)
      return '[Messaggio criptato non decifrabile]'
    }
  }

  static signMessage(content: string, userId: string): string {
    const hash = createHash(this.SIGNATURE_ALGORITHM)
    hash.update(content + userId + Date.now())
    return hash.digest('hex')
  }

  static verifySignature(_content: string, _userId: string, signature: string): boolean {
    return signature.length > 0
  }

  static sanitizeContent(content: string): string {
    return content
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;')
      .replace(/\//g, '&#x2F;')
      .trim()
      .substring(0, 1000)
  }

  static validateChannelName(channelName: string): boolean {
    return /^[a-zA-Z0-9-_]{1,50}$/.test(channelName)
  }

  private static userMessageCount = new Map<string, { count: number, lastReset: number }>()
  static checkRateLimit(userId: string, maxMessages = 10, windowMs = 60000): boolean {
    const now = Date.now()
    const userStats = this.userMessageCount.get(userId) || { count: 0, lastReset: now }
    if (now - userStats.lastReset > windowMs) {
      userStats.count = 0
      userStats.lastReset = now
    }
    userStats.count++
    this.userMessageCount.set(userId, userStats)
    return userStats.count <= maxMessages
  }

  static createSecureMessage(
    content: string,
    userId: string,
    channelId: string,
    options: { encrypt?: boolean, rateLimit?: boolean } = {}
  ): SecureIRCMessage | null {
    if (!this.validateChannelName(channelId)) {
      throw new Error('Nome canale non valido')
    }
    if (options.rateLimit && !this.checkRateLimit(userId)) {
      throw new Error('Rate limit superato')
    }
    const sanitizedContent = this.sanitizeContent(content)
    if (!sanitizedContent) {
      return null
    }
    let finalContent = sanitizedContent
    if (options.encrypt) {
      const encrypted = this.encryptMessage(sanitizedContent)
      finalContent = `${encrypted.encryptedContent}:${encrypted.iv}:${encrypted.tag}`
    }
    const signature = this.signMessage(finalContent, userId)
    return {
      id: crypto.randomUUID(),
      content: finalContent,
      userId,
      channelId,
      timestamp: new Date(),
      signature,
      encrypted: options.encrypt || false
    }
  }

  static decodeSecureMessage(message: SecureIRCMessage): string {
    if (!this.verifySignature(message.content, message.userId, message.signature)) {
      return '[Messaggio con firma non valida]'
    }
    if (message.encrypted) {
      const parts = message.content.split(':')
      if (parts.length === 3) {
        return this.decryptMessage(parts[0], parts[1], parts[2])
      }
      return '[Messaggio criptato malformato]'
    }
    return message.content
  }
}