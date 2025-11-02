# IRC Community Web App

Una moderna applicazione web per community IRC costruita con le ultime tecnologie web standard.

## ✅ Stato dell'Implementazione - Aggiornamento del 23/10/2025

### 🎉 **FUNZIONALITÀ COMPLETATE E OPERATIVE:**

#### ✅ **Sistema di Chat Multi-Canale**
- **Chat separata per canale**: Ogni canale ha la propria cronologia messaggi
- **Cambio canale dinamico**: I messaggi si aggiornano automaticamente quando si cambia canale  
- **Messaggi persistenti**: I messaggi vengono salvati e ricaricati per ogni canale
- **Indicatori visivi**: Stato connessione e canale attivo chiaramente visibili

#### ✅ **Interfaccia Utente Moderna**
- **Design responsive**: Ottimizzato per desktop e mobile
- **Sidebar canali**: Navigazione intuitiva tra #general e #tech
- **Chat window**: Finestra chat con messaggi scrollabili
- **Indicatori stato**: Connessione Socket.io e crittografia visibili
- **Messaggi di sistema**: Benvenuto automatico per ogni canale

#### ✅ **Sistema di Messaggistica**
- **Invio messaggi funzionante**: I messaggi vengono inviati e visualizzati correttamente
- **Mock Socket.io**: Sistema di polling che simula WebSocket per evitare problemi di connessione
- **Validazione messaggi**: Controllo lunghezza e contenuto
- **Timestamp**: Ora di invio per ogni messaggio
- **Avatar utenti**: Iniziali colorate per identificazione rapida

#### ✅ **Sicurezza di Base**
- **Sanitizzazione input**: Protezione XSS e injection
- **Validazione dati**: Controllo rigoroso dei parametri
```markdown
# IRC Community Web App

> **Applicazione web moderna per community IRC con interfaccia Next.js e bridge IRC personalizzato**

[![Next.js](https://img.shields.io/badge/Next.js-16-black)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-blue)](https://www.typescriptlang.org/)
[![Prisma](https://img.shields.io/badge/Prisma-5-brightgreen)](https://www.prisma.io/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-Latest-blue)](https://www.postgresql.org/)

Questo progetto combina:
- **Frontend moderno**: Next.js 16 + React 19 + Tailwind CSS
- **IRC Server custom**: TypeScript implementation con canali e permessi
- **Bridge HTTP→IRC**: Bot Node.js che sincronizza webapp ↔ IRC
- **Database**: PostgreSQL con Prisma ORM
- **Autenticazione**: NextAuth.js v5 (GitHub OAuth + Credentials)
- **Cifratura**: AES-256-GCM end-to-end per messaggi

📖 **[Leggi l'architettura completa →](./ARCHITECTURE.md)**

---

## 🚀 Quick Start

### Prerequisiti

- Node.js 20+
- PostgreSQL 14+
- Git

### Installazione

```bash
# 1. Clona repository
git clone https://github.com/datRooster/ircapp.git
cd ircapp

# 2. Installa dipendenze
npm install

# 3. Configura database
createdb ircapp  # Crea database PostgreSQL
cp .env.example .env.local  # Copia e configura variabili ambiente

# 4. Esegui migrazioni Prisma
npx prisma migrate deploy
npx prisma generate

# 5. (Opzionale) Seed database iniziale
npx tsx prisma/seed-guest-help.ts
npm run create-bot  # Crea utente bot IRC
```

### Configurazione Variabili Ambiente

Crea `.env.local` con:

```env
DATABASE_URL="postgresql://user:password@localhost:5432/ircapp"
NEXTAUTH_SECRET="genera-con-openssl-rand-base64-32"
NEXTAUTH_URL="http://localhost:3000"
GITHUB_CLIENT_ID="your-github-oauth-id"
GITHUB_CLIENT_SECRET="your-github-oauth-secret"
IRC_ENCRYPTION_KEY="genera-con-openssl-rand-base64-32"
WEBAPP_ENC_KEY="stesso-valore-di-IRC_ENCRYPTION_KEY"
ADMIN_USERNAME="admin"
ADMIN_PASSWORD="cambiami123"
ADMIN_EMAIL="admin@localhost"
```

---

## 🎮 Comandi Principali

```bash
# Sviluppo
npm run dev              # Avvia webapp Next.js (port 3000)
npm run irc:start        # Avvia IRC server (port 6667)
npm run irc:dev          # IRC server con watch mode
npm run bot:start        # Avvia bridge bot (port 4000)
npm run dev:full         # Webapp + IRC server insieme
npm run dev:all          # Webapp + IRC + bot insieme

# Database
npm run db:migrate       # Esegui migrazioni Prisma
npm run db:studio        # GUI Prisma Studio
npm run create-bot       # Crea utente bot IRC nel DB

# Build & Production
npm run build            # Build produzione Next.js
npm run start            # Start produzione

# Linting
npm run lint             # ESLint check
```

### Sviluppo Locale - Consigliato

**Opzione 1**: Tutto in un comando
```bash
npm run dev:all
```

**Opzione 2**: Terminali separati (debug migliore)
```bash
# Terminal 1: Webapp
npm run dev

# Terminal 2: IRC Server
npm run irc:start

# Terminal 3: Bridge Bot
npm run bot:start
```

---

## 🏗️ Architettura Semplificata

```
Webapp (Next.js) → API Routes → Bridge Bot → IRC Server ⇄ Client IRC Esterni
       ↑                                            ↓
       └────────────← Polling (ogni 2s) ←──────────┘
```

**Flusso messaggi**:
1. Utente scrive in webapp
2. POST `/api/socketio` → Bridge bot
3. Bot invia a IRC server
4. IRC server broadcast a tutti
5. Bot riceve echo, cifra e salva in DB
6. Webapp polling carica nuovi messaggi

📖 **[Dettagli architettura completa →](./ARCHITECTURE.md)**

---

## 🌍 Deployment Produzione

### Webapp → Vercel

```bash
# 1. Push su GitHub
git push origin main

# 2. Connetti repository su Vercel
# 3. Configura variabili ambiente (vedi sotto)
# 4. Deploy automatico ✅
```

### Bot Bridge → Railway/Heroku/VPS

```bash
# Railway
railway up
railway variables set WEBAPP_HOST="https://your-app.vercel.app"

# VPS
pm2 start npm --name "irc-bot" -- run bot:start
pm2 save
```

### Variabili Ambiente Produzione

```env
# Database
DATABASE_URL="postgresql://user:pass@host:5432/dbname"

# Auth
NEXTAUTH_SECRET="openssl-rand-base64-32"
NEXTAUTH_URL="https://your-domain.com"

# OAuth
GITHUB_CLIENT_ID="..."
GITHUB_CLIENT_SECRET="..."

# Cifratura
IRC_ENCRYPTION_KEY="base64-32-bytes"
WEBAPP_ENC_KEY="same-as-above"

# Admin
ADMIN_USERNAME="admin"
ADMIN_PASSWORD="secure-password"
ADMIN_EMAIL="admin@domain.com"

# Bot (solo se separato dalla webapp)
WEBAPP_HOST="https://your-webapp-url.com"
```

**Post-deploy checklist**:
```bash
npx prisma migrate deploy  # Applica migrazioni
npx prisma generate        # Genera Prisma Client
npm run create-bot         # Crea utente bot IRC
```

---

## 🔒 Sicurezza & Cifratura

I messaggi sono cifrati at-rest usando **AES-256-GCM**:

- ✅ Cifratura automatica prima del salvataggio DB
- ✅ Decifratura server-side prima dell'invio a frontend
- ✅ IV e Tag unici per ogni messaggio

**Genera chiave cifratura**:
```bash
openssl rand -base64 32
```

Imposta in `.env.local`:
```env
IRC_ENCRYPTION_KEY="output-comando-sopra"
WEBAPP_ENC_KEY="stesso-valore"
```

⚠️ **Nota**: Questo è "bot-decrypt", non E2E puro. Il bot può leggere i messaggi. Per vera E2E servirebbero chiavi per utente.

📖 **[Dettagli cifratura →](./ARCHITECTURE.md#-sistema-di-cifratura)**


---

## 🧪 Testing

### Test Client IRC

```bash
# Connetti con client IRC esterno (es. irssi, weechat, hexchat)
/server localhost 6667
/nick your-nickname
/join #general
```

Invia messaggi e verifica sincronizzazione bidirezionale webapp ↔ IRC.

### Debug

```bash
# Logs realtime
npm run dev        # Webapp logs nel terminal
npm run irc:dev    # IRC server logs con watch
npm run bot:start  # Bot bridge logs

# Database GUI
npm run db:studio  # Prisma Studio su http://localhost:5555
```

---

## 📖 Documentazione

- **[ARCHITECTURE.md](./ARCHITECTURE.md)** - Architettura tecnica completa
- **[LICENSE](./LICENSE)** - Licenza MIT

---

## 🤝 Contributing

Contributi benvenuti! Steps:

1. Fork del repository
2. Crea feature branch (`git checkout -b feature/amazing`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push al branch (`git push origin feature/amazing`)
5. Apri Pull Request

---

## 📝 Developer Notes

- **TypeScript strict mode**: Tutti i file sono type-safe
- **Modularità**: Logica separata in hooks e services
- **Clean code**: ESLint configurato, segui le convenzioni
- **Auth checks**: Sempre server-side tramite `src/lib/auth.ts`
- **Sicurezza**: Mai esporre chiavi cifratura in frontend

---

## 🛠️ Troubleshooting

**Bot non riceve messaggi?**
- Verifica `http://localhost:4000/send-irc` risponde
- Check `WEBAPP_ENC_KEY` impostata correttamente

**Messaggi non appaiono in webapp?**
- Apri DevTools → Network → verifica polling `/api/socketio`
- Check database: `npm run db:studio`

**Client IRC non riceve?**
- Bot connesso? Controlla log "User connected"
- Porta 6667 aperta? `netstat -an | grep 6667`

📖 **[Troubleshooting completo →](./ARCHITECTURE.md#-troubleshooting)**

---

## � Production Deployment

### Quick Deploy to Vercel

```bash
# 1. Generate production secrets
./scripts/generate-secrets.sh

# 2. Push to GitHub
git push origin main

# 3. Deploy to Vercel
# Visit https://vercel.com/new and import your repository
```

### Environment Variables

Configura queste variabili su Vercel:

```bash
DATABASE_URL=<your-railway-postgres-url>
NEXTAUTH_SECRET=<generate-with-openssl>
NEXTAUTH_URL=https://your-app.vercel.app
GITHUB_CLIENT_ID=<your-github-oauth-id>
GITHUB_CLIENT_SECRET=<your-github-oauth-secret>
WEBAPP_ENC_KEY=<generate-with-openssl>
IRC_ENCRYPTION_KEY=<generate-with-openssl>
```

📖 **[Guida completa deployment →](./DEPLOYMENT.md)**

---

## �📜 License

MIT License - vedi [LICENSE](./LICENSE)

---

**Progetto sviluppato da [@datRooster](https://github.com/datRooster)**  
Portfolio: [www.webrooster.it](https://www.webrooster.it)

_Ultimo aggiornamento: 2 novembre 2025_

```
- **Autenticazione utenti**: NextAuth configurato
