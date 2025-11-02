# 🚀 Setup IRC Server su Railway - Guida Completa

## 📋 Prerequisiti
- Account Railway
- Repository GitHub già connesso
- Database PostgreSQL già configurato

---

## 🏗️ Step 1: Crea Nuovo Servizio IRC su Railway

### 1.1 Dashboard Railway
1. Vai su https://railway.app/dashboard
2. Apri il tuo progetto esistente
3. Click su **"+ New"** → **"GitHub Repo"**
4. Seleziona `datRooster/ircapp` (stesso repository)
5. Dai un nome: **"IRC Server"**

### 1.2 Configurazione Build
Nella dashboard del nuovo servizio IRC:

1. **Settings** → **General**
   - Service Name: `IRC Server`
   
2. **Settings** → **Deploy**
   - Build Command: `npm install && npx prisma generate`
   - Start Command: `npm run irc:start`
   - Watch Paths: `src/irc-server/**`

3. **Settings** → **Networking**
   - Enable: **TCP Proxy**
   - Port: `6667`

---

## ⚙️ Step 2: Configura Variabili d'Ambiente

Nel servizio IRC, vai su **Variables** e aggiungi:

```bash
# Database (usa stesso del web service)
DATABASE_URL=${{postgres.DATABASE_URL}}

# IRC Configuration
IRC_PORT=6667
IRC_HOSTNAME=irc.ircapp.community
NODE_ENV=production

# Encryption (usa stesse chiavi del web service)
IRC_ENCRYPTION_KEY=7edc3eae1c625cbd12dae4d3a3618f0f
WEBAPP_ENC_KEY=pXlAhPOZT3LGrcP3f/74IEsscMWJQS7sdIM3kuc1jcg=

# Node version
NODE_VERSION=20.18.0
```

**Note:**
- `${{postgres.DATABASE_URL}}` - Railway auto-injetta il DATABASE_URL se hai un servizio Postgres collegato
- Se non funziona, copia manualmente il DATABASE_URL dal web service

---

## 🌐 Step 3: Ottieni Indirizzo IRC

Dopo il deploy, Railway ti darà:

### TCP Proxy Domain
```
irc-production-xxxxx.up.railway.app:6667
```

Oppure puoi usare un dominio custom (opzionale):
```
irc.tuodominio.com
```

---

## 🔧 Step 4: Configura Client IRC (Textual)

### Textual per macOS

1. **Apri Textual**
2. **Server → Add Server**

**Configurazione:**
```
Server Name: IRC Community
Server Address: irc-production-xxxxx.up.railway.app
Port: 6667
Use SSL/TLS: ❌ No (per ora)
```

**Opzionale - Autenticazione:**
```
Nickname: tuonickname
Username: tuonickname
Real Name: Tuo Nome
Password: (lascia vuoto se non richiesto)
```

**Auto-Join Channels:**
```
#lobby
#general
#tech
```

3. **Connect**

### Altri Client IRC

#### WeeChat (Terminal)
```bash
/server add ircapp irc-production-xxxxx.up.railway.app/6667
/connect ircapp
/join #lobby
```

#### HexChat (Desktop)
```
Network: IRC Community
Server: irc-production-xxxxx.up.railway.app/6667
```

#### irssi (Terminal)
```
/network add IRCApp
/server add -network IRCApp irc-production-xxxxx.up.railway.app 6667
/connect IRCApp
/join #lobby
```

---

## 🔒 Step 5: Aggiungi SSL/TLS (Opzionale ma Raccomandato)

Per connessioni sicure sulla porta 6697:

### 5.1 Genera Certificati
```bash
# Usa Let's Encrypt o Railway SSL
# Railway può fornire certificati automatici se usi un dominio custom
```

### 5.2 Aggiorna IRC Server
Modifica `src/irc-server/irc-server.ts` per supportare TLS:

```typescript
import * as tls from 'tls'
import * as fs from 'fs'

// In IRCServer constructor:
if (process.env.IRC_USE_TLS === 'true') {
  const options = {
    key: fs.readFileSync(process.env.IRC_TLS_KEY!),
    cert: fs.readFileSync(process.env.IRC_TLS_CERT!)
  }
  this.server = tls.createServer(options)
} else {
  this.server = net.createServer()
}
```

### 5.3 Variabili d'Ambiente
```bash
IRC_USE_TLS=true
IRC_TLS_KEY=/path/to/key.pem
IRC_TLS_CERT=/path/to/cert.pem
```

### 5.4 Client Configuration (con SSL)
```
Server: irc-production-xxxxx.up.railway.app
Port: 6697
Use SSL/TLS: ✅ Yes
```

---

## 🧪 Step 6: Test Connessione

### Test Manuale con netcat
```bash
# Senza SSL
nc irc-production-xxxxx.up.railway.app 6667

# Prova comandi IRC:
NICK testuser
USER testuser 0 * :Test User
JOIN #lobby
PRIVMSG #lobby :Hello from netcat!
QUIT
```

### Test con telnet
```bash
telnet irc-production-xxxxx.up.railway.app 6667
```

---

## 📊 Monitoraggio

### Railway Logs
```bash
# Dashboard Railway → IRC Service → Deployments → View Logs

# Vedrai:
🚀 IRC Server listening on port 6667
🔌 New IRC connection from xxx.xxx.xxx.xxx:xxxxx
📨 IRC Command: NICK from username
```

### Health Check
Aggiungi uno script di health check:

```typescript
// src/irc-server/health-check.ts
import * as net from 'net'

const client = net.connect(6667, 'localhost', () => {
  console.log('✅ IRC Server is healthy')
  client.end()
})

client.on('error', (err) => {
  console.error('❌ IRC Server health check failed:', err)
  process.exit(1)
})
```

---

## 🔐 Sicurezza

### Rate Limiting
Già configurato in `.env`:
```bash
IRC_RATE_LIMIT_MESSAGES=10
IRC_RATE_LIMIT_WINDOW=60000
```

### Firewall Rules (opzionale)
Railway gestisce automaticamente, ma puoi aggiungere IP whitelist se necessario.

---

## 🐛 Troubleshooting

### Problema: "Connection refused"
**Soluzione:**
- Verifica che il servizio sia running su Railway
- Controlla i logs per errori
- Verifica che TCP Proxy sia abilitato

### Problema: "Unable to join channel"
**Soluzione:**
- Assicurati che il canale esista nel database
- Verifica permessi utente
- Controlla logs del server

### Problema: "Nickname already in use"
**Soluzione:**
- Usa un nickname diverso
- Aspetta timeout del vecchio nickname (default 5 minuti)

---

## 📱 App Mobili IRC

### iOS
- **Textual** (pagamento, elegante)
- **Palaver** (gratuito)
- **Mutter** (gratuito)

### Android
- **Revolution IRC** (gratuito)
- **AndroIRC** (gratuito)
- **IRCCloud** (freemium, cloud-based)

**Configurazione identica:**
```
Server: irc-production-xxxxx.up.railway.app
Port: 6667 (o 6697 con SSL)
```

---

## 🌐 Dominio Custom (Opzionale)

Se hai un dominio:

### DNS Configuration
```
Type: A Record
Name: irc
Value: [Railway IP]
TTL: 3600

Oppure:

Type: CNAME
Name: irc
Value: irc-production-xxxxx.up.railway.app
TTL: 3600
```

### Railway Settings
1. Settings → Networking → Custom Domain
2. Aggiungi: `irc.tuodominio.com`
3. Aggiorna `IRC_HOSTNAME=irc.tuodominio.com`

**Client connection:**
```
Server: irc.tuodominio.com
Port: 6667
```

---

## 📚 Comandi IRC Utili

```irc
# Connessione e setup
/connect irc-production-xxxxx.up.railway.app 6667
/nick tuonickname
/join #lobby

# Canali
/list                    # Lista canali disponibili
/names #lobby            # Utenti nel canale
/topic #lobby New Topic  # Cambia topic (se admin)

# Messaggi
/msg #lobby Hello!       # Messaggio pubblico
/msg username Hi!        # Messaggio privato

# Info
/whois username          # Info su utente
/who #lobby              # Lista utenti nel canale

# Disconnessione
/quit Goodbye!
```

---

## 🎯 Next Steps

1. ✅ Deploy servizio IRC su Railway
2. ✅ Ottieni indirizzo TCP
3. ✅ Configura Textual
4. ✅ Test connessione
5. 🔄 (Opzionale) Setup SSL/TLS
6. 🔄 (Opzionale) Dominio custom

---

## 💡 Tips

- **Web + IRC insieme**: Gli utenti possono usare sia il browser che client IRC - i messaggi si sincronizzano automaticamente grazie al bridge bot
- **Mobile-friendly**: Gli utenti mobile dovrebbero usare la web app (più comoda)
- **Desktop power users**: Textual, WeeChat, irssi per chi preferisce client tradizionali
- **Notifiche**: I client IRC hanno spesso notifiche migliori della web app

---

## ❓ Domande?

Se hai problemi o domande durante il setup, fammi sapere! 🚀
