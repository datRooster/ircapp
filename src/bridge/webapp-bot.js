// webapp-bot.js
// Bot IRC bridge: riceve messaggi dalla webapp via HTTP e li inoltra su IRC come vero utente

// Carica variabili d'ambiente PRIMA di tutto
require('dotenv').config();

console.log('[BOT] ===== WEBAPP BOT STARTING =====');

const irc = require('irc-framework');
const express = require('express');
// Use the server-side secure protocol implementation (Node)
const { SecureIRCProtocol } = require('../lib/secure-irc.server');
const bodyParser = require('body-parser');
const crypto = require('crypto');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const IRC_SERVER = 'localhost';
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

let isConnected = false;
let reconnectTimer = null;

function connectToIRC() {
  console.log(`[BOT] Attempting to connect to IRC server ${IRC_SERVER}:${IRC_PORT} as ${IRC_NICK}`);
  
  client.connect({
    host: IRC_SERVER,
    port: IRC_PORT,
    nick: IRC_NICK,
    username: IRC_USER,
    realname: IRC_REALNAME,
    auto_reconnect: false, // Gestiamo manualmente la riconnessione
  });
}

// Funzione per riconnessione con backoff
function scheduleReconnect(delay = 2000) {
  if (reconnectTimer) return; // Già schedulata
  
  console.log(`[BOT] Will retry connection in ${delay}ms...`);
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    connectToIRC();
  }, delay);
}

// Log whether encryption key is available to the bot process
const BOT_ENC_AVAILABLE = !!process.env.WEBAPP_ENC_KEY
console.log('[BOT] WEBAPP_ENC_KEY present:', BOT_ENC_AVAILABLE)

// Eventi di connessione per debug
client.on('socket close', () => {
  console.log('[BOT] Socket closed');
  isConnected = false;
  if (!reconnectTimer) {
    scheduleReconnect();
  }
});

client.on('socket connected', () => {
  console.log('[BOT] Socket connected to IRC server');
});

client.on('close', () => {
  console.log('[BOT] IRC connection closed');
  isConnected = false;
  if (!reconnectTimer) {
    scheduleReconnect();
  }
});

client.on('raw', (message) => {
  // Log solo messaggi importanti per non intasare i log
  if (message.command === 'NOTICE' || message.command === 'ERROR') {
    console.log('[BOT][RAW]', message);
  }
});

// Avvia connessione iniziale
connectToIRC();

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
      // Usa sempre localhost per comunicazione bot<->webapp in locale
      // In produzione, usa WEBAPP_HOST se diverso
      const webappHost = process.env.WEBAPP_HOST || 'http://localhost:3000';
      console.log('[BOT][DEBUG] WEBAPP_HOST from env:', process.env.WEBAPP_HOST, '-> using:', webappHost);
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

// Log quando il bot si connette al server IRC
client.on('registered', () => {
  console.log(`[BOT] Successfully registered on IRC server as ${IRC_NICK}`);
  isConnected = true;
  // Cancella timer di riconnessione se presente
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
});

client.on('error', (err) => {
  console.error('[BOT] IRC client error:', err);
});

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

// Helper: risolve l'ID di un canale al suo nome IRC reale
async function resolveChannelName(channelInput) {
  // Se inizia con #, rimuovi il prefisso
  const channelId = channelInput.startsWith('#') ? channelInput.slice(1) : channelInput;
  
  // Se è già un nome semplice (non un ID cuid), usalo direttamente
  if (channelId === 'lobby' || !channelId.match(/^c[a-z0-9]{24}$/i)) {
    return `#${channelId}`;
  }
  
  // Altrimenti cerca nel database
  try {
    const channel = await prisma.channel.findUnique({
      where: { id: channelId },
      select: { name: true }
    });
    
    if (channel && channel.name) {
      console.log(`[BOT] Resolved channel ID ${channelId} -> #${channel.name}`);
      return `#${channel.name}`;
    }
    
    // Fallback: usa l'ID originale
    console.warn(`[BOT] Could not resolve channel ID ${channelId}, using as-is`);
    return `#${channelId}`;
  } catch (err) {
    console.error(`[BOT] Error resolving channel name for ${channelId}:`, err);
    return `#${channelId}`;
  }
}

// 2. Avvia il server HTTP per ricevere messaggi dalla webapp
const app = express();

// Middleware di logging per debug
app.use((req, res, next) => {
  console.log(`[BOT][HTTP] ${req.method} ${req.url}`);
  next();
});

app.use(bodyParser.json());

// Debug bodyParser errors
app.use((err, req, res, next) => {
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    console.error('[BOT][ERROR] JSON parse error:', err);
    return res.status(400).json({ error: 'Invalid JSON' });
  }
  next();
});

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
  const { channel, message, from, iv, keyId, tag, encrypted } = req.body;
  
  // Debug: log cosa riceve il bot
  console.log('[BOT][DEBUG] Received payload:', JSON.stringify({ 
    channel, 
    messagePreview: message?.slice(0, 50), 
    from, 
    iv: iv?.slice(0, 20), 
    keyId: keyId?.slice(0, 20),
    tag: tag?.slice(0, 20),
    encrypted 
  }));
  
  if (!channel || !message || !from) {
    return res.status(400).json({ error: 'channel, message e from sono obbligatori' });
  }
  
  // Risolvi l'ID del canale al nome reale IRC
  const ircChannel = await resolveChannelName(channel);
  // Support two modes: encrypted payload (with iv+keyId/tag) or plaintext
  let plaintext;
  try {
    // keyId è l'alias per tag (GCM auth tag)
    const authTag = keyId || tag;
    
    if (encrypted || (iv && authTag)) {
      // Expect message to be ciphertext and iv/tag to be provided
      plaintext = SecureIRCProtocol.decryptMessage(message, iv, authTag);
      console.log(`[BOT] Decrypted incoming webapp message from ${from} (preview): ${plaintext.slice(0,120)}`);
    } else {
      // Plaintext path: accept raw message from webapp
      plaintext = String(message);
      console.log(`[BOT] Received plaintext incoming webapp message from ${from} (preview): ${plaintext.slice(0,120)}`);
    }
  } catch (err) {
    console.error('[BOT] Decrypt failed for incoming webapp message:', err);
    return res.status(500).json({ error: 'Decrypt failed' });
  }
  // Prepara messaggio per IRC (aggiungi [username] ... SOLO per IRC)
  const ircMsg = `[${from}] ${plaintext}`;
  // record this forwarded message (full ircMsg) so that when IRC echoes it back possiamo evitare echo
  try {
    const hash = hashForMatch(ircMsg)
    const key = `${ircChannel}|${hash}`
    recentForwards.set(key, { originalMessageId: null, expires: Date.now() + 10000 })
  } catch (e) {
    // ignore
  }
  // Verifica se il bot è nel canale, altrimenti fai JOIN
  const chanObj = client.channel(ircChannel);
  const isInChannel = chanObj && chanObj.joined;
  
  if (!isInChannel) {
    console.log(`[BOT] Not in channel ${ircChannel}, joining first...`);
    client.join(ircChannel);
    
    // Aspetta che il JOIN sia completato prima di inviare
    // Usa una Promise per aspettare l'evento JOIN
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('JOIN timeout'));
      }, 5000);
      
      const onJoin = (event) => {
        if (event.channel === ircChannel && event.nick === IRC_NICK) {
          clearTimeout(timeout);
          client.off('join', onJoin);
          console.log(`[BOT] Successfully joined ${ircChannel}`);
          resolve();
        }
      };
      
      client.on('join', onJoin);
    }).catch(err => {
      console.error(`[BOT] Failed to join ${ircChannel}:`, err);
      // Prova comunque a inviare
    });
  }
  
  try {
    console.log(`[BOT] Sending message to ${ircChannel}: ${ircMsg}`)
    client.say(ircChannel, ircMsg);
    console.log(`[BOT] Message sent to ${ircChannel}`)
    return res.json({ ok: true });
  } catch (err) {
    console.error(`[BOT] Failed to send message to ${ircChannel}:`, err)
    return res.status(500).json({ error: 'Send failed' })
  }
});

// Quando il bot entra in un canale, invia tutti i messaggi in attesa
client.on('join', (event) => {
  const { channel, nick } = event;
  console.log(`[BOT] JOIN event: ${nick} joined ${channel}`)
  if (nick === IRC_NICK && pendingMessages.has(channel)) {
    const queue = pendingMessages.get(channel);
    console.log(`[BOT] Processing ${queue.length} queued messages for ${channel}`)
    for (const { ircMsg } of queue) {
      try {
        console.log(`[BOT] Sending queued message to ${channel}: ${ircMsg}`)
        client.say(channel, ircMsg);
        console.log(`[BOT] Successfully sent queued message to ${channel}`);
      } catch (err) {
        console.warn('[BOT] queued client.say failed, falling back to raw PRIVMSG', err)
        try {
          client.raw(`PRIVMSG ${channel} :${ircMsg}`)
          console.log('[BOT] Successfully sent via raw PRIVMSG')
        } catch (err2) {
          console.error('[BOT] queued raw PRIVMSG failed:', err2)
        }
      }
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