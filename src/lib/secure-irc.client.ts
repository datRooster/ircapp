/**
 * Client-side stub for SecureIRCProtocol
 * Browser environments should NOT use Node.js crypto module
 * Use Web Crypto API or delegate encryption to backend
 */

export class SecureIRCProtocol {
  static encryptMessage(): never {
    throw new Error(
      'SecureIRCProtocol.encryptMessage is not available in browser. ' +
      'Use Web Crypto API or delegate to backend via API routes.'
    )
  }

  static decryptMessage(): never {
    throw new Error(
      'SecureIRCProtocol.decryptMessage is not available in browser. ' +
      'Use Web Crypto API or delegate to backend via API routes.'
    )
  }

  static decodeSecureMessage(): never {
    throw new Error(
      'SecureIRCProtocol.decodeSecureMessage is not available in browser. ' +
      'Use Web Crypto API or delegate to backend via API routes.'
    )
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
}
