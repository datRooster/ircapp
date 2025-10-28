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
    // POST verso l'API della webapp SOLO se il messaggio arriva da IRC esterno (cioè non da webapp)
    if (from !== 'webapp') {
      const webappHost = process.env.WEBAPP_HOST || process.env.NEXTAUTH_URL || 'http://localhost:3000';
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
    }
  } catch (err) {
    console.error('[BOT] Errore notifica webapp:', err);
  }
}

// Quando riceve un messaggio da IRC (da altri utenti), lo inoltra alla webapp
client.on('message', async (event) => {
  const { nick, target, message } = event;
  console.log('[BOT][DEBUG] EVENTO IRC message:', { nick, target, message });
  // Ignora i messaggi del bot stesso
  if (nick === IRC_NICK) return;
  // Solo canali pubblici
  if (target && target.startsWith('#')) {
    // Echo detection robusta: se il messaggio è stato appena inviato dalla webapp, NON notificare la webapp/API
    const hash = hashForMatch(message)
    const key = `${target}|${hash}`
    const record = recentForwards.get(key)
    if (record) {
      if (Date.now() < record.expires) {
        // Echo di un messaggio webapp: non notificare la webapp/API
        console.log(`[BOT] Detected echo for forwarded message on ${target}, skipping notifyWebapp (origId=${record.originalMessageId})`)
        recentForwards.delete(key)
        return
      }
      recentForwards.delete(key)
    }
    // Solo messaggi realmente nuovi da IRC esterno vengono notificati e salvati nel DB
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

app.post('/send-irc', async (req, res) => {
  const { channel, message, from, originalMessageId, encrypted, iv } = req.body;
  if (!channel || !message || !from) {
    return res.status(400).json({ error: 'channel, message, from sono obbligatori' });
  }
  console.log(`[BOT] Ricevuto messaggio da webapp per ${channel} da ${from} (encrypted: ${!!encrypted}) message preview: ${message.slice(0,120)}`);
  // Decifra se già cifrato, altrimenti cifra ora
  let plaintext = message;
  let wasEncrypted = false;
  try {
    if (encrypted && iv) {
      if (!process.env.WEBAPP_ENC_KEY) {
        console.warn('[BOT] Incoming message marked encrypted but no WEBAPP_ENC_KEY is set in bot process')
        return res.status(500).json({ error: 'Server misconfigured: missing encryption key' })
      }
      const key = Buffer.from(process.env.WEBAPP_ENC_KEY, 'base64')
      const ivBuf = Buffer.from(iv, 'base64')
      const combined = Buffer.from(message, 'base64')
      const tag = combined.slice(combined.length - 16)
      const ciphertext = combined.slice(0, combined.length - 16)
      const decipher = crypto.createDecipheriv('aes-256-gcm', key, ivBuf)
      decipher.setAuthTag(tag)
      plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8')
      wasEncrypted = true;
      console.log(`[BOT] Decrypted incoming webapp message from ${from} (preview): ${plaintext.slice(0,120)}`)
    }
  } catch (err) {
    console.error('[BOT] Decrypt failed for incoming webapp message:', err)
    return res.status(500).json({ error: 'Decrypt failed' })
  }

  // Prepara messaggio per IRC (aggiungi [username] ... SOLO per IRC)
  const ircMsg = `[${from}] ${plaintext}`;
  // record this forwarded message (full ircMsg) so that when IRC echoes it back possiamo evitare echo
  try {
    const hash = hashForMatch(ircMsg)
    const key = `${channel}|${hash}`
    recentForwards.set(key, { originalMessageId: originalMessageId || null, expires: Date.now() + 10000 })
  } catch (e) {
    // ignore
  }
  const chanObj = client.channel(channel);
  if (chanObj && chanObj.joined) {
    client.say(channel, ircMsg);
    console.log(`[BOT] Inviato su ${channel}:`, ircMsg);
    // NON notificare la webapp/API: il messaggio è già stato gestito dalla pipeline webapp→API→DB
    return res.json({ ok: true });
  } else {
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

// Funzione di utilità per hash "debole" di un testo, per individuare facilmente duplicati (evita echo)
function hashForMatch(str) {
  // Usa SHA1 e prendi i primi 8 caratteri hex
  return crypto.createHash('sha1').update(str).digest('hex').substring(0, 8);
}