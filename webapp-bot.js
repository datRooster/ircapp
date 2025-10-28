// webapp-bot.js
// Bot IRC bridge: riceve messaggi dalla webapp via HTTP e li inoltra su IRC come vero utente

const irc = require('irc-framework');
const express = require('express');
const bodyParser = require('body-parser');
const crypto = require('crypto');

const IRC_SERVER = '127.0.0.1';
const IRC_PORT = 6667;
const IRC_NICK = 'webapp';
const IRC_USER = 'webapp';
const IRC_REALNAME = 'WebApp Bridge Bot';

const HTTP_PORT = 4000; // Porta su cui il bot ascolta richieste dalla webapp

// 1. Avvia il client IRC

const LOBBY_CHANNEL = '#lobby';
const LOBBY_TOPIC = [
  'Benvenuto nella community IRC! Qui puoi leggere le ultime novità, chiedere aiuto e conoscere nuovi utenti.',
  'Regole: 1. Rispetta tutti i membri e non fare spam. 2. Usa un linguaggio appropriato. 3. Segui le indicazioni di admin/mod. 4. Per aiuto usa #help.',
  'Comandi: /join #canale | /msg utente | /list | /help',
  'Solo admin possono scrivere in questa lobby. Supporto: supporto@irccommunity.local'
].join(' | ');

const client = new irc.Client();

client.connect({
  host: IRC_SERVER,
  port: IRC_PORT,
  nick: IRC_NICK,
  username: IRC_USER,
  realname: IRC_REALNAME,
  auto_reconnect: true,
});

// Log whether encryption key is available to the bot process
const BOT_ENC_AVAILABLE = !!process.env.WEBAPP_ENC_KEY
console.log('[BOT] WEBAPP_ENC_KEY present:', BOT_ENC_AVAILABLE)

// Funzione per notificare la webapp di un nuovo messaggio IRC
async function notifyWebappFromIRC({ channel, from, message, originalMessageId }) {
  try {
    // Estrai realFrom se il messaggio è nel formato [username] messaggio
    let realFrom = from;
    const match = message.match(/^\[([^\]]+)\]/);
    if (match) {
      realFrom = match[1];
    }
    // Forza cifratura SEMPRE
    const encKey = process.env.WEBAPP_ENC_KEY;
    if (!encKey) {
      throw new Error('WEBAPP_ENC_KEY non impostata nel bot');
    }
    const key = Buffer.from(encKey, 'base64');
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    const ciphertext = Buffer.concat([cipher.update(message, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    const combined = Buffer.concat([ciphertext, tag]).toString('base64');
    console.log('[BOT][DEBUG] INVIO content cifrato base64:', combined);
    // POST verso l'API della webapp per inserire il messaggio nel DB e notificare i client
    const webappHost = process.env.WEBAPP_HOST || process.env.NEXTAUTH_URL || 'http://localhost:3002';
    const url = `${webappHost.replace(/\/$/, '')}/api/socketio`;
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'irc-message',
        channelId: channel.replace('#', ''),
        content: combined, // SOLO cifrato
        from,
        realFrom,
        type: 'irc',
        encrypted: true,
        iv: iv.toString('base64'),
        originalMessageId: originalMessageId || undefined
      })
    });
  } catch (err) {
    console.error('[BOT] Errore notifica webapp:', err);
  }
}

client.on('registered', () => {
  console.log('[BOT] Connesso al server IRC come', IRC_NICK);

  // All'avvio: join e sincronizza topic/messaggi lobby
  client.join(LOBBY_CHANNEL);
});

// Flag per evitare di reimpostare il topic più volte per canale
const topicSetForChannel = {};

function normalizeForMatch(str) {
  // Trim, collapse whitespace, remove control characters
  return String(str).replace(/\s+/g, ' ').trim();
}

function hashForMatch(str) {
  const normalized = normalizeForMatch(str);
  return crypto.createHash('sha256').update(normalized, 'utf8').digest('hex');
}

client.on('join', (event) => {
  const { channel, nick } = event;
  if (nick === IRC_NICK && channel === LOBBY_CHANNEL) {
    if (!topicSetForChannel[channel]) {
      // Imposta solo il topic (nessun messaggio in chat)
      client.raw(`TOPIC ${LOBBY_CHANNEL} :${LOBBY_TOPIC}`);
      // Imposta canale moderato (read-only)
      setTimeout(() => {
        client.raw(`MODE ${LOBBY_CHANNEL} +m`);
      }, 1500);
      topicSetForChannel[channel] = true;
    }
  }
});

client.on('error', (err) => {
  console.error('[BOT] IRC error:', err);
});

// Quando riceve un messaggio da IRC (da altri utenti), lo inoltra alla webapp
client.on('message', async (event) => {
  const { nick, target, message } = event;
  // Ignora i messaggi del bot stesso
  if (nick === IRC_NICK) return;
  // Solo canali pubblici
  if (target && target.startsWith('#')) {
    // check recent forwards to avoid reposting echoes of messages we just forwarded
    // Use a hash-based key to be resilient against small formatting differences
    const hash = hashForMatch(message)
    const key = `${target}|${hash}`
    const record = recentForwards.get(key)
    if (record) {
      if (Date.now() < record.expires) {
        // Se il messaggio è un echo di un messaggio originato dalla webapp, NON notificare la webapp (niente echo)
        console.log(`[BOT] Detected echo for forwarded message on ${target}, skipping notifyWebapp (origId=${record.originalMessageId})`)
        recentForwards.delete(key)
        return
      }
      recentForwards.delete(key)
    }

    await notifyWebappFromIRC({ channel: target, from: nick, message });
    console.log(`[BOT] Messaggio IRC da ${nick} su ${target} inoltrato alla webapp.`);
  }
});

// 2. Avvia il server HTTP per ricevere messaggi dalla webapp
const app = express();

app.use(bodyParser.json());

// Endpoint per impostare il topic di un canale via HTTP
app.post('/set-topic', (req, res) => {
  const { channel, topic } = req.body;
  if (!channel || !topic) {
    return res.status(400).json({ error: 'channel e topic sono obbligatori' });
  }
  client.raw(`TOPIC ${channel} :${topic}`);
  console.log(`[BOT] Topic di ${channel} impostato via API admin.`);
  res.json({ ok: true });
});

// POST /send-irc { channel: '#general', message: 'testo', from: 'usernameWebapp' }
// Gestione join asincrono: coda di messaggi in attesa per canale
const pendingMessages = new Map(); // channel -> array di { ircMsg, res }
// Recent forwarded plaintexts to detect echoes from the IRC server and avoid reposting
const recentForwards = new Map(); // key -> { originalMessageId, expires }

app.post('/send-irc', (req, res) => {
  const { channel, message, from, originalMessageId } = req.body;
  if (!channel || !message || !from) {
    return res.status(400).json({ error: 'channel, message, from sono obbligatori' });
  }
  // If message is encrypted, attempt decryption with key from env
  let plaintext = message
  try {
    if (req.body.encrypted) {
      if (!process.env.WEBAPP_ENC_KEY) {
        console.warn('[BOT] Incoming message marked encrypted but no WEBAPP_ENC_KEY is set in bot process')
        // refuse to forward ciphertext to IRC
        return res.status(500).json({ error: 'Server misconfigured: missing encryption key' })
      }
      const key = Buffer.from(process.env.WEBAPP_ENC_KEY, 'base64')
      const iv = Buffer.from(req.body.iv, 'base64')
      const combined = Buffer.from(message, 'base64')
      // last 16 bytes are auth tag
      const tag = combined.slice(combined.length - 16)
      const ciphertext = combined.slice(0, combined.length - 16)
      const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv)
      decipher.setAuthTag(tag)
      plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8')
      console.log(`[BOT] Decrypted incoming webapp message from ${from} (preview): ${plaintext.slice(0,120)}`)
    }
  } catch (err) {
    console.error('[BOT] Decrypt failed for incoming webapp message:', err)
    // Do NOT forward ciphertext to IRC. Return error so sender can retry or admin can inspect.
    return res.status(500).json({ error: 'Decrypt failed' })
  }

    const ircMsg = `[${from}] ${plaintext}`;
  // record this forwarded message (full ircMsg) so that when IRC echoes it back we can detect and skip
  try {
    const hash = hashForMatch(ircMsg)
    const key = `${channel}|${hash}`
    recentForwards.set(key, { originalMessageId: originalMessageId || null, expires: Date.now() + 10000 })
  } catch (e) {
    // ignore
  }
  const chanObj = client.channel(channel);
  if (chanObj && chanObj.joined) {
    // Già dentro, invia subito
    client.say(channel, ircMsg);
    console.log(`[BOT] Inviato su ${channel}:`, ircMsg);
    return res.json({ ok: true });
  } else {
    // Non ancora dentro: accoda e fai join
    if (!pendingMessages.has(channel)) {
      pendingMessages.set(channel, []);
      client.join(channel);
    }
    pendingMessages.get(channel).push({ ircMsg, res });
    // La risposta HTTP verrà gestita nell'evento 'join'
  }
});

// Quando il bot entra in un canale, invia tutti i messaggi in attesa
client.on('join', (event) => {
  const { channel, nick } = event;
  if (nick === IRC_NICK && pendingMessages.has(channel)) {
    const queue = pendingMessages.get(channel);
    for (const { ircMsg, res } of queue) {
      client.say(channel, ircMsg);
      console.log(`[BOT] Inviato su ${channel}:`, ircMsg);
      if (res && !res.headersSent) res.json({ ok: true });
    }
    pendingMessages.delete(channel);
  }
});

app.listen(HTTP_PORT, () => {
  console.log(`[BOT] HTTP bridge in ascolto su http://localhost:${HTTP_PORT}/send-irc`);
});
