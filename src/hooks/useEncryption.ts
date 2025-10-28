import { useState, useEffect, useRef } from 'react'

type Maybe<T> = T | null

let cachedKey: Maybe<string> = null

function b64ToUint8Array(b64: string) {
  const binary = atob(b64)
  const len = binary.length
  const bytes = new Uint8Array(len)
  for (let i = 0; i < len; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

function uint8ArrayToB64(arr: Uint8Array) {
  let binary = ''
  for (let i = 0; i < arr.byteLength; i++) binary += String.fromCharCode(arr[i])
  return btoa(binary)
}

export function useEncryption() {
  const [available, setAvailable] = useState<boolean>(true)
  const subtleRef = useRef<any | null>(null)

  useEffect(() => {
    try {
      const hasWindow = typeof window !== 'undefined'
      if (!hasWindow) {
        setAvailable(false)
        return
      }
      const cryptoObj: any = (window as any).crypto || (window as any).msCrypto
      const subtle = cryptoObj && (cryptoObj.subtle || cryptoObj.webkitSubtle)
      subtleRef.current = subtle || null
      setAvailable(!!subtle)
    } catch (err) {
      setAvailable(false)
      subtleRef.current = null
    }
  }, [])

  async function fetchKeyIfNeeded(channelId?: string) {
    if (cachedKey) return cachedKey
    try {
      const url = `/api/keys?clientSupportsSubtle=true${channelId ? `&channelId=${encodeURIComponent(channelId)}` : ''}`
      const res = await fetch(url)
      if (!res.ok) throw new Error('no key')
      const json = await res.json()
      cachedKey = json.key
      return cachedKey
    } catch (err) {
      return null
    }
  }

  async function encrypt(plaintext: string, channelId?: string) {
    // if subtle available try client-side
    if (subtleRef.current) {
      const keyBase64 = await fetchKeyIfNeeded(channelId)
      if (!keyBase64) throw new Error('No client key available')
      const keyBytes = b64ToUint8Array(keyBase64)
      const cryptoKey = await subtleRef.current.importKey('raw', keyBytes, 'AES-GCM', false, ['encrypt'])
      const iv = crypto.getRandomValues(new Uint8Array(12))
      const enc = new TextEncoder().encode(plaintext)
      const ct = await subtleRef.current.encrypt({ name: 'AES-GCM', iv }, cryptoKey, enc)
      const ivB64 = uint8ArrayToB64(iv)
      const ctB64 = uint8ArrayToB64(new Uint8Array(ct))
      return { content: ctB64, iv: ivB64 }
    }

    // fallback: server-side encrypt
    const res = await fetch('/api/keys/encrypt', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ plaintext })
    })
    if (!res.ok) throw new Error('server encrypt failed')
    return await res.json()
  }

  async function decrypt(content: string, iv: string, channelId?: string) {
    if (subtleRef.current) {
      const keyBase64 = await fetchKeyIfNeeded(channelId)
      if (!keyBase64) throw new Error('No client key available')
      const keyBytes = b64ToUint8Array(keyBase64)
      const cryptoKey = await subtleRef.current.importKey('raw', keyBytes, 'AES-GCM', false, ['decrypt'])
      const ivBytes = b64ToUint8Array(iv)
      const combined = b64ToUint8Array(content)
      const plainBuf = await subtleRef.current.decrypt({ name: 'AES-GCM', iv: ivBytes }, cryptoKey, combined)
      return new TextDecoder().decode(new Uint8Array(plainBuf))
    }

    // fallback server-side
    const res = await fetch('/api/keys/decrypt', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content, iv })
    })
    if (!res.ok) throw new Error('server decrypt failed')
    const json = await res.json()
    return json.plaintext
  }

  function clearCachedKey() {
    cachedKey = null
  }

  return {
    available,
    encrypt,
    decrypt,
    fetchKeyIfNeeded,
    clearCachedKey,
  }
}

export default useEncryption
