// Wrapper client: lancia errore se usato lato browser
export class SecureIRCProtocol {
  static encryptMessage() {
    throw new Error('SecureIRCProtocol.encryptMessage non è disponibile lato client/browser. Usare la Web Crypto API o delegare al backend.')
  }
  static decryptMessage() {
    throw new Error('SecureIRCProtocol.decryptMessage non è disponibile lato client/browser. Usare la Web Crypto API o delegare al backend.')
  }
  static decodeSecureMessage() {
    throw new Error('SecureIRCProtocol.decodeSecureMessage non è disponibile lato client/browser. Usare la Web Crypto API o delegare al backend.')
  }
}