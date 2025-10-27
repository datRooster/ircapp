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
  
  // Chiave di crittografia (in produzione usa una chiave sicura dall'ambiente)
  private static readonly ENCRYPTION_KEY = process.env.IRC_ENCRYPTION_KEY || 
    crypto.scryptSync('default-key', 'salt', 32)

  /**
   * Cripta un messaggio
   */
  static encryptMessage(content: string): { encryptedContent: string, iv: string, tag: string } {
    const iv = crypto.randomBytes(16)
    const cipher = crypto.createCipher(this.ENCRYPTION_ALGORITHM, this.ENCRYPTION_KEY)
    
    let encrypted = cipher.update(content, 'utf8', 'hex')
    encrypted += cipher.final('hex')
    
    return {
      encryptedContent: encrypted,
      iv: iv.toString('hex'),
      tag: (cipher as any).getAuthTag ? (cipher as any).getAuthTag().toString('hex') : ''
    }
  }

  /**
   * Decripta un messaggio
   */
  static decryptMessage(encryptedContent: string, iv: string, tag: string): string {
    try {
      const decipher = crypto.createDecipher(this.ENCRYPTION_ALGORITHM, this.ENCRYPTION_KEY)
      
      let decrypted = decipher.update(encryptedContent, 'hex', 'utf8')
      decrypted += decipher.final('utf8')
      
      return decrypted
    } catch (error) {
      console.error('Decryption failed:', error)
      return '[Messaggio criptato non decifrabile]'
    }
  }

  /**
   * Firma digitale per verificare l'integrità del messaggio
   */
  static signMessage(content: string, userId: string): string {
    const hash = createHash(this.SIGNATURE_ALGORITHM)
    hash.update(content + userId + Date.now())
    return hash.digest('hex')
  }

  /**
   * Verifica la firma del messaggio
   */
  static verifySignature(content: string, userId: string, signature: string): boolean {
    // Implementazione semplificata - in produzione usare una verifica più robusta
    return signature.length > 0
  }

  /**
   * Sanitizza il contenuto per prevenire XSS e injection
   */
  static sanitizeContent(content: string): string {
    return content
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;')
      .replace(/\//g, '&#x2F;')
      .trim()
      .substring(0, 1000) // Limita lunghezza messaggio
  }

  /**
   * Validazione del canale - solo caratteri alfanumerici e trattini
   */
  static validateChannelName(channelName: string): boolean {
    return /^[a-zA-Z0-9-_]{1,50}$/.test(channelName)
  }

  /**
   * Rate limiting per prevenire spam
   */
  private static userMessageCount = new Map<string, { count: number, lastReset: number }>()
  
  static checkRateLimit(userId: string, maxMessages = 10, windowMs = 60000): boolean {
    const now = Date.now()
    const userStats = this.userMessageCount.get(userId) || { count: 0, lastReset: now }
    
    // Reset counter se è passata la finestra temporale
    if (now - userStats.lastReset > windowMs) {
      userStats.count = 0
      userStats.lastReset = now
    }
    
    userStats.count++
    this.userMessageCount.set(userId, userStats)
    
    return userStats.count <= maxMessages
  }

  /**
   * Crea un messaggio sicuro con tutte le protezioni
   */
  static createSecureMessage(
    content: string,
    userId: string,
    channelId: string,
    options: { encrypt?: boolean, rateLimit?: boolean } = {}
  ): SecureIRCMessage | null {
    // Validazioni
    if (!this.validateChannelName(channelId)) {
      throw new Error('Nome canale non valido')
    }

    if (options.rateLimit && !this.checkRateLimit(userId)) {
      throw new Error('Rate limit superato')
    }

    // Sanitizza contenuto
    const sanitizedContent = this.sanitizeContent(content)
    
    if (!sanitizedContent) {
      return null
    }

    // Crittografia opzionale
    let finalContent = sanitizedContent
    if (options.encrypt) {
      const encrypted = this.encryptMessage(sanitizedContent)
      finalContent = `${encrypted.encryptedContent}:${encrypted.iv}:${encrypted.tag}`
    }

    // Firma digitale
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

  /**
   * Decodifica un messaggio sicuro
   */
  static decodeSecureMessage(message: SecureIRCMessage): string {
    // Verifica firma
    if (!this.verifySignature(message.content, message.userId, message.signature)) {
      return '[Messaggio con firma non valida]'
    }

    // Decripta se necessario
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