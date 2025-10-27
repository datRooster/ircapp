// webapp-bot.js
// Bot IRC bridge: riceve messaggi dalla webapp via HTTP e li inoltra su IRC come vero utente

const irc = require('irc-framework');
const express = require('express');
const bodyParser = require('body-parser');

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

// Funzione per notificare la webapp di un nuovo messaggio IRC
async function notifyWebappFromIRC({ channel, from, message }) {
  try {
    // POST verso l'API della webapp per inserire il messaggio nel DB e notificare i client
    await fetch('http://localhost:3000/api/socketio', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'irc-message',
        channelId: channel.replace('#', ''),
        content: message,
        from,
        type: 'irc',
      })
    })
  } catch (err) {
    console.error('[BOT] Errore notifica webapp:', err)
  }
}

client.on('registered', () => {
  console.log('[BOT] Connesso al server IRC come', IRC_NICK);

  // All'avvio: join e sincronizza topic/messaggi lobby
  client.join(LOBBY_CHANNEL);
});

// Flag per evitare di reimpostare il topic più volte per canale
const topicSetForChannel = {};

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

app.post('/send-irc', (req, res) => {
  const { channel, message, from } = req.body;
  if (!channel || !message || !from) {
    return res.status(400).json({ error: 'channel, message, from sono obbligatori' });
  }
  const ircMsg = `[${from}] ${message}`;
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
