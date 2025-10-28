// lib/secure-irc.ts
// Utility modulare per cifratura/decifratura AES-GCM compatibile sia con Node.js che browser
// Usa la chiave base64 da process.env.WEBAPP_ENC_KEY

import crypto from 'crypto';

const ENC_KEY = process.env.WEBAPP_ENC_KEY;
if (!ENC_KEY) throw new Error('WEBAPP_ENC_KEY non definita');

const KEY = Buffer.from(ENC_KEY, 'base64'); // 32 bytes per AES-256
const IV_LENGTH = 12; // AES-GCM standard

export function encryptMessage(plainText: string): string {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv('aes-256-gcm', KEY, iv);
  const encrypted = Buffer.concat([
    cipher.update(plainText, 'utf8'),
    cipher.final()
  ]);
  const tag = cipher.getAuthTag();
  // Restituisce base64(iv + tag + encrypted)
  return Buffer.concat([iv, tag, encrypted]).toString('base64');
}

export function decryptMessage(cipherText: string): string {
  const data = Buffer.from(cipherText, 'base64');
  const iv = data.slice(0, IV_LENGTH);
  const tag = data.slice(IV_LENGTH, IV_LENGTH + 16);
  const encrypted = data.slice(IV_LENGTH + 16);
  const decipher = crypto.createDecipheriv('aes-256-gcm', KEY, iv);
  decipher.setAuthTag(tag);
  const decrypted = Buffer.concat([
    decipher.update(encrypted),
    decipher.final()
  ]);
  return decrypted.toString('utf8');
}
