# 🚂 Railway Deployment Guide - Complete Setup

## Perché Railway?

✅ **Tutto in un unico posto**:
- Frontend Next.js
- IRC Server con WebSocket
- Bridge Bot
- Database PostgreSQL (già configurato!)

✅ **Deploy automatico da GitHub**
✅ **Supporto completo per processi long-running**
✅ **Nessuna limitazione su WebSocket**

---

## 📋 Pre-requisiti

- [x] Account Railway (https://railway.app)
- [x] Database PostgreSQL su Railway (già attivo ✅)
- [x] Repository GitHub
- [x] Codice pronto (build passa ✅)

---

## 🚀 Step-by-Step Deployment

### 1. Preparazione Locale

#### Genera i Secrets di Produzione
```bash
cd /Users/thatrooster/Sites/localhost/IRCapp
./scripts/generate-secrets.sh
```

Salva questi valori - li userai nelle variabili d'ambiente Railway.

#### Commit e Push su GitHub
```bash
git add .
git commit -m "feat: production ready - Railway full deployment"
git push origin main
```

---

### 2. Setup Railway Dashboard

#### A. Crea Nuovo Progetto
1. Vai su: https://railway.app/dashboard
2. Click **"New Project"**
3. Seleziona **"Deploy from GitHub repo"**
4. Scegli il repository `datRooster/ircapp`
5. Railway inizierà il primo deploy automaticamente

#### B. Configura il Service
Il progetto verrà creato con un service principale. Ora configuriamolo:

1. Click sul service creato
2. Vai su **Settings** → **General**
3. Configura:
   - **Service Name**: `ircapp-web`
   - **Start Command**: `npm run railway:all`
   - **Health Check Path**: `/` (opzionale)

---

### 3. Variabili d'Ambiente

Vai su **Variables** nel tuo service e aggiungi:

#### Database (usa il tuo esistente)
```bash
# Copia dal tuo .env.local
DATABASE_URL=postgresql://postgres:xhxsMdQxreKLpQEozhlEIlgeEaViTcXg@mainline.proxy.rlwy.net:44341/railway
```

#### NextAuth Configuration
```bash
NEXTAUTH_SECRET=<genera con: openssl rand -base64 32>
NEXTAUTH_URL=${{RAILWAY_PUBLIC_DOMAIN}}
# Railway sostituirà automaticamente con il dominio pubblico
```

#### Admin Configuration
```bash
ADMIN_USERNAME=admin
ADMIN_PASSWORD=<password-forte-sicura>
ADMIN_EMAIL=admin@yourdomain.com
```

#### Encryption Keys
```bash
WEBAPP_ENC_KEY=<genera con: openssl rand -base64 32>
IRC_ENCRYPTION_KEY=<genera con: openssl rand -hex 16>
```

#### IRC Configuration
```bash
IRC_MAX_MESSAGE_LENGTH=1000
IRC_RATE_LIMIT_MESSAGES=10
IRC_RATE_LIMIT_WINDOW=60000
```

#### Bot Configuration
```bash
# Railway fornirà automaticamente il dominio
WEBAPP_HOST=${{RAILWAY_PUBLIC_DOMAIN}}
```

#### GitHub OAuth (configuralo dopo il primo deploy)
```bash
GITHUB_CLIENT_ID=<your-github-client-id>
GITHUB_CLIENT_SECRET=<your-github-client-secret>
```

#### Production Mode
```bash
DEV_AUTH_BYPASS=false
NODE_ENV=production
PORT=3000
```

---

### 4. Configurazione Porte

Railway assegna automaticamente le porte. Il tuo setup:

- **Next.js Web**: Porta dinamica di Railway (automatica)
- **IRC Server**: Porta 6667 (interna)
- **Bridge Bot**: Porta 4000 (interna)

Railway gestisce automaticamente il routing esterno.

---

### 5. GitHub OAuth Setup

Dopo il primo deploy, Railway ti fornirà un URL tipo:
```
https://ircapp-production-xxxx.up.railway.app
```

#### Configura GitHub OAuth:
1. Vai su: https://github.com/settings/developers
2. Click **"New OAuth App"** o modifica quello esistente
3. Configura:
   - **Application name**: IRC Community App (Production)
   - **Homepage URL**: `https://your-railway-domain.up.railway.app`
   - **Authorization callback URL**: `https://your-railway-domain.up.railway.app/api/auth/callback/github`
4. Salva e copia Client ID e Secret
5. Aggiungili alle variabili Railway

---

### 6. Deploy!

#### Primo Deploy
Railway farà automaticamente il primo deploy quando colleghi il repo.

#### Re-deploy
Ogni push su `main` triggerera un nuovo deploy automatico.

#### Deploy Manuale
Nel dashboard Railway:
- Vai sul service
- Click **"Deploy"** → **"Redeploy"**

---

## 🔍 Monitoraggio

### Logs
1. Nel dashboard Railway, vai sul tuo service
2. Click su **"Deployments"**
3. Seleziona il deployment attivo
4. Vedrai i log in tempo reale di:
   - Next.js server
   - IRC server
   - Bridge bot

### Metriche
Railway fornisce:
- CPU usage
- Memory usage
- Network traffic
- Request counts

---

## 🧪 Testing

### 1. Verifica il Deploy
```bash
# Controlla che il sito sia attivo
curl https://your-railway-domain.up.railway.app

# Dovrebbe rispondere con la pagina HTML
```

### 2. Test Login
1. Visita il tuo URL Railway
2. Click su "Login with GitHub"
3. Autorizza l'applicazione
4. Verifica che il login funzioni

### 3. Test IRC Features
1. Prova a creare un canale (se admin)
2. Invia messaggi
3. Verifica che i messaggi siano persistiti
4. Controlla i logs Railway per vedere l'IRC server funzionare

---

## 🔧 Troubleshooting

### Build Fails

**Problema**: "npm install failed"
```bash
# Soluzione: Verifica che package.json sia valido
# Railway logs mostrerà l'errore esatto
```

**Problema**: "Prisma generate failed"
```bash
# Verifica che DATABASE_URL sia impostata
# Controlla railway.toml buildCommand
```

### Runtime Errors

**Problema**: "Cannot connect to database"
```bash
# Verifica DATABASE_URL nelle variabili
# Assicurati che il database Railway sia attivo
# Controlla che l'URL sia completo e corretto
```

**Problema**: "IRC Server not starting"
```bash
# Controlla i logs Railway
# Verifica che il comando railway:all sia configurato
# Controlla che tsx sia nelle dependencies (non devDependencies)
```

**Problema**: "GitHub OAuth redirect mismatch"
```bash
# Aggiorna il callback URL su GitHub
# Deve matchare esattamente il dominio Railway
# Formato: https://your-domain.up.railway.app/api/auth/callback/github
```

### Port Issues

**Problema**: "Port already in use"
```bash
# Railway gestisce le porte automaticamente
# Assicurati che lo script start usi: -p ${PORT:-3000}
# Railway imposterà $PORT automaticamente
```

---

## 📊 Architettura su Railway

```
┌─────────────────────────────────────────────────────┐
│ Railway Project: ircapp                             │
├─────────────────────────────────────────────────────┤
│                                                     │
│  ┌───────────────────────────────────────────┐    │
│  │ Service: ircapp-web                       │    │
│  ├───────────────────────────────────────────┤    │
│  │ Process 1: Next.js (PORT: dynamic)        │    │
│  │ Process 2: IRC Server (PORT: 6667)        │    │
│  │ Process 3: Bridge Bot (PORT: 4000)        │    │
│  └───────────────────────────────────────────┘    │
│                        │                            │
│                        ↓                            │
│  ┌───────────────────────────────────────────┐    │
│  │ Database: PostgreSQL                      │    │
│  │ (Already existing)                        │    │
│  └───────────────────────────────────────────┘    │
│                                                     │
│  Public URL: https://ircapp-xxxx.up.railway.app   │
└─────────────────────────────────────────────────────┘
```

---

## 💰 Costi Railway

### Free Tier
- $5 di credito al mese
- Sufficiente per testing e piccoli progetti
- 500 ore di esecuzione

### Hobby Plan ($5/mese)
- $5 di credito + costi uso
- Ottimo per progetti personali
- Unlimited execution time

### Stima Costi per IRC App
```
Web Service:    ~$3-5/mese
Database:       $5/mese (se nuovo, il tuo è già attivo)
Totale stimato: ~$5-10/mese
```

---

## 🎯 Checklist Deployment

- [ ] Secrets generati con `generate-secrets.sh`
- [ ] Codice committato e pushato su GitHub
- [ ] Progetto Railway creato
- [ ] Repository GitHub collegato
- [ ] Tutte le variabili d'ambiente impostate
- [ ] GitHub OAuth configurato con URL Railway
- [ ] Primo deploy completato con successo
- [ ] Test login GitHub funzionante
- [ ] Test creazione canali
- [ ] Test invio messaggi
- [ ] Logs IRC server verificati
- [ ] Monitoring attivo

---

## 🚀 Comandi Railway CLI (Opzionale)

### Installazione
```bash
npm i -g @railway/cli
railway login
```

### Comandi Utili
```bash
# Link al progetto
railway link

# Deploy manuale
railway up

# Logs in tempo reale
railway logs

# Variabili d'ambiente
railway variables

# Esegui comandi nel container
railway run npm run db:migrate
```

---

## 🔄 CI/CD Automatico

Railway fa automaticamente:
1. ✅ Pull del nuovo codice da GitHub
2. ✅ Install dependencies
3. ✅ Run build script
4. ✅ Run Prisma migrations
5. ✅ Deploy new version
6. ✅ Zero-downtime rollout

---

## 🎉 Deployment Completato!

Una volta che hai completato tutti gli step, avrai:

✅ **Frontend Next.js** in produzione
✅ **IRC Server** funzionante con WebSocket
✅ **Bridge Bot** che sincronizza webapp ↔ IRC
✅ **Database PostgreSQL** connesso
✅ **GitHub OAuth** configurato
✅ **Deploy automatico** ad ogni push
✅ **Monitoring e logs** in tempo reale

---

## 📞 Supporto

- **Railway Docs**: https://docs.railway.app
- **Railway Discord**: https://discord.gg/railway
- **Railway Status**: https://status.railway.app

---

**Pronto per il deploy! 🚂**

Tempo stimato deployment: 10-15 minuti
