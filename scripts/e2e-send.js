const fs = require('fs');
const env = fs.readFileSync('.env', 'utf8');
const m = env.match(/WEBAPP_ENC_KEY=\"?([^\"\n]+)\"?/);
if (!m) {
  console.error('no key in .env');
  process.exit(1);
}
const key = m[1];
const crypto = require('crypto');
const keyBuf = Buffer.from(key, 'base64');
const iv = crypto.randomBytes(12);
const plaintext = process.argv[2] || 'echo-e2e-test from-cli';
const cipher = crypto.createCipheriv('aes-256-gcm', keyBuf, iv);
const ct = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
const tag = cipher.getAuthTag();
const combined = Buffer.concat([ct, tag]).toString('base64');
const ivB64 = iv.toString('base64');
const postBody = (obj) => JSON.stringify(obj);

const doPost = (bodyStr, extraHeaders = {}) => new Promise((resolve, reject) => {
  const http = require('http')
  const options = {
    hostname: '127.0.0.1',
    port: 3002,
    path: '/api/socketio',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(bodyStr),
      ...(process.env.DEV_AUTH_BYPASS_TOKEN ? { 'x-dev-bypass': process.env.DEV_AUTH_BYPASS_TOKEN } : {}),
      ...extraHeaders,
    }
  }
  const req = http.request(options, (res) => {
    let data = ''
    res.on('data', chunk => data += chunk)
    res.on('end', () => resolve({ statusCode: res.statusCode, body: data }))
  })
  req.on('error', (e) => reject(e))
  req.write(bodyStr)
  req.end()
})

const get = (path) => new Promise((resolve, reject) => {
  const http = require('http')
  const options = {
    hostname: '127.0.0.1',
    port: 3002,
    path,
    method: 'GET',
    headers: {
      ...(process.env.DEV_AUTH_BYPASS_TOKEN ? { 'x-dev-bypass': process.env.DEV_AUTH_BYPASS_TOKEN } : {}),
    }
  }
  const req = http.request(options, (res) => {
    let data = ''
    res.on('data', chunk => data += chunk)
    res.on('end', () => resolve({ statusCode: res.statusCode, body: data, headers: res.headers }))
  })
  req.on('error', (e) => reject(e))
  req.end()
})

const postForm = (path, formObj) => new Promise((resolve, reject) => {
  const http = require('http')
  const qs = Object.keys(formObj).map(k => `${encodeURIComponent(k)}=${encodeURIComponent(formObj[k])}`).join('&')
  const options = {
    hostname: '127.0.0.1',
    port: 3002,
    path,
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Content-Length': Buffer.byteLength(qs),
      ...(process.env.DEV_AUTH_BYPASS_TOKEN ? { 'x-dev-bypass': process.env.DEV_AUTH_BYPASS_TOKEN } : {}),
    }
  }
  const req = http.request(options, (res) => {
    let data = ''
    res.on('data', chunk => data += chunk)
    res.on('end', () => resolve({ statusCode: res.statusCode, body: data, headers: res.headers }))
  })
  req.on('error', (e) => reject(e))
  req.write(qs)
  req.end()
})

;(async () => {
  try {
    // Authenticate as admin to get a session cookie
    console.log('Fetching CSRF token...')
    const csrfRes = await get('/api/auth/csrf')
    let csrfToken = null
    try {
      const parsed = JSON.parse(csrfRes.body)
      csrfToken = parsed?.csrfToken
    } catch (e) {
      // ignore
    }
    if (!csrfToken) {
      console.log('Failed to obtain csrf token, continuing without login (may hit auth)')
    } else {
      console.log('CSRF token received, signing in as admin...')
      const signin = await postForm('/api/auth/callback/credentials', {
        csrfToken,
        username: process.env.E2E_ADMIN_USERNAME || 'admin',
        password: process.env.E2E_ADMIN_PASSWORD || 'admin123',
        callbackUrl: '/'
      })
      console.log('Sign-in HTTP', signin.statusCode)
      // collect cookies from sign-in (may be set on redirect)
      const setCookies = signin.headers['set-cookie'] || signin.headers['Set-Cookie'] || []
      let cookies = Array.isArray(setCookies) ? setCookies.map(c => c.split(';')[0]) : (setCookies ? [setCookies.split(';')[0]] : [])
      // If no cookies yet, follow redirect location (NextAuth may set cookies on redirect)
      if (!cookies.length && signin.statusCode >= 300 && signin.statusCode < 400 && signin.headers.location) {
        try {
          const loc = signin.headers.location
          const url = new URL(loc, 'http://127.0.0.1:3002')
          const follow = await get(url.pathname + url.search)
          const followSet = follow.headers['set-cookie'] || follow.headers['Set-Cookie'] || []
          cookies = Array.isArray(followSet) ? followSet.map(c => c.split(';')[0]) : (followSet ? [followSet.split(';')[0]] : [])
        } catch (e) {
          // ignore
        }
      }
      if (cookies.length) {
        console.log('Got cookies from sign-in:', cookies)
        // use authenticated cookie for subsequent requests
        const initPayload = {
          action: 'irc-message',
          channelId: 'linkedin',
          content: '[cli-init] init',
          from: 'cli-test',
          encrypted: false,
        }
        const initRes = await doPost(postBody(initPayload), { cookie: cookies.join('; ') })
        console.log('INIT HTTP', initRes.statusCode)
        console.log(initRes.body)
        let userId = null
        try {
          const parsed = JSON.parse(initRes.body)
          if (parsed?.message?.user?.id) {
            userId = parsed.message.user.id
            console.log('Created/found user id:', userId)
          }
        } catch (e) {
          // ignore parse error
        }

        if (userId) {
          // send the encrypted message authenticated
          const sendPayload = {
            action: 'send-message',
            channelId: 'linkedin',
            userId,
            content: combined,
            encrypted: true,
            iv: ivB64,
            username: 'cli-test'
          }
          const sendRes = await doPost(postBody(sendPayload), { cookie: cookies.join('; ') })
          console.log('HTTP', sendRes.statusCode)
          console.log(sendRes.body)
          return
        }
      } else {
        console.log('Sign-in did not return cookies even after following redirect; falling back to unauthenticated send')
      }
    }
    // end auth flow

    const sendPayload = {
      action: 'send-message',
      channelId: 'linkedin',
      // no userId: rely on username-based creation in the API
      content: combined,
      encrypted: true,
      iv: ivB64,
      username: 'cli-test'
    }

    const sendRes = await doPost(postBody(sendPayload))
    console.log('HTTP', sendRes.statusCode)
    console.log(sendRes.body)
  } catch (err) {
    console.error('request failed', err);
    process.exit(1);
  }
})();
