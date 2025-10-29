const crypto = require('crypto')

function parseKeyFromEnv(envName) {
  const key = process.env[envName]
  if (!key) throw new Error(`${envName} non impostata`)
  // accept hex (64), base64 (44) or raw utf8 32
  let buf
  if (/^[0-9a-fA-F]{64}$/.test(key)) {
    buf = Buffer.from(key, 'hex')
  } else if (/^[A-Za-z0-9+/=]{44}$/.test(key)) {
    buf = Buffer.from(key, 'base64')
  } else {
    buf = Buffer.from(key, 'utf8')
  }
  if (buf.length !== 32) throw new Error(`${envName} must represent 32 bytes, got ${buf.length}`)
  return buf
}

function decryptMessage(encryptedContent, iv, tag) {
  // Support multiple encodings and formats
  try {
    // If iv and tag are provided separately and look hex -> treat as hex
    if (iv && tag && /^[0-9a-fA-F]+$/.test(encryptedContent)) {
      const key = parseKeyFromEnv('WEBAPP_ENC_KEY')
      const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(iv, 'hex'))
      decipher.setAuthTag(Buffer.from(tag, 'hex'))
      let dec = decipher.update(encryptedContent, 'hex', 'utf8')
      dec += decipher.final('utf8')
      return dec
    }

    // If content looks base64 combined (ciphertext + tag), and iv is base64
    if (iv && /^[A-Za-z0-9+/=]+$/.test(encryptedContent)) {
      const key = parseKeyFromEnv('WEBAPP_ENC_KEY')
      const combined = Buffer.from(encryptedContent, 'base64')
      // tag is last 16 bytes
      if (combined.length < 16) throw new Error('combined too short')
      const tagBuf = combined.slice(combined.length - 16)
      const cipherBuf = combined.slice(0, combined.length - 16)
      const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(iv, 'base64'))
      decipher.setAuthTag(tagBuf)
      let dec = decipher.update(cipherBuf, undefined, 'utf8')
      dec += decipher.final('utf8')
      return dec
    }

    // Fallback: try interpreting everything as utf8 plaintext
    return String(encryptedContent)
  } catch (err) {
    console.error('secure-irc.server.js decryptMessage error:', err)
    throw err
  }
}

function encryptMessage(plaintext, envName = 'IRC_ENCRYPTION_KEY') {
  try {
    const key = parseKeyFromEnv(envName)
    const iv = crypto.randomBytes(12)
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv)
    const ciphertext = Buffer.concat([cipher.update(String(plaintext), 'utf8'), cipher.final()])
    const tag = cipher.getAuthTag()
    // Return hex representation to match server-side format
    return {
      encryptedContent: ciphertext.toString('hex'),
      iv: iv.toString('hex'),
      tag: tag.toString('hex')
    }
  } catch (err) {
    console.error('encryptMessage error:', err)
    throw err
  }
}

function decryptMessage(encryptedContent, iv, tag, envName = 'IRC_ENCRYPTION_KEY') {
  // Expect hex encoded values
  try {
    const key = parseKeyFromEnv(envName)
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(iv, 'hex'))
    decipher.setAuthTag(Buffer.from(tag, 'hex'))
    let dec = decipher.update(encryptedContent, 'hex', 'utf8')
    dec += decipher.final('utf8')
    return dec
  } catch (err) {
    console.error('decryptMessage error:', err)
    throw err
  }
}

const SecureIRCProtocol = { parseKeyFromEnv, encryptMessage, decryptMessage }

module.exports = { SecureIRCProtocol }
