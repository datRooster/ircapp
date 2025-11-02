# 🚂 Railway Quick Start

## In 5 Minuti

### 1️⃣ Prepara Localmente (2 min)

```bash
# Test configurazione
./scripts/test-railway-config.sh

# Genera secrets
./scripts/generate-secrets.sh
# 💾 Salva l'output in un file sicuro!

# Commit
git add .
git commit -m "feat: railway production ready"
git push origin main
```

### 2️⃣ Deploy su Railway (3 min)

1. **Vai su** → https://railway.app/dashboard
2. **Click** → "New Project"
3. **Seleziona** → "Deploy from GitHub repo"
4. **Scegli** → `datRooster/ircapp`
5. **Aspetta** il primo deploy (automatico)

### 3️⃣ Configura Variabili

Nel service Railway → **Variables** → Aggiungi:

```bash
# Database (copia dal tuo .env.local)
DATABASE_URL=postgresql://postgres:xhxs...@mainline.proxy.rlwy.net:44341/railway

# Auth (usa i secrets generati)
NEXTAUTH_SECRET=<dal passo 1>
NEXTAUTH_URL=${{RAILWAY_PUBLIC_DOMAIN}}

# Admin
ADMIN_USERNAME=admin
ADMIN_PASSWORD=<password-forte>
ADMIN_EMAIL=admin@yourdomain.com

# Encryption (dal passo 1)
WEBAPP_ENC_KEY=<dal passo 1>
IRC_ENCRYPTION_KEY=<dal passo 1>

# IRC Config
IRC_MAX_MESSAGE_LENGTH=1000
IRC_RATE_LIMIT_MESSAGES=10
IRC_RATE_LIMIT_WINDOW=60000

# Bot
WEBAPP_HOST=${{RAILWAY_PUBLIC_DOMAIN}}

# GitHub OAuth (configuralo dopo)
GITHUB_CLIENT_ID=<later>
GITHUB_CLIENT_SECRET=<later>

# Production
DEV_AUTH_BYPASS=false
NODE_ENV=production
PORT=3000
```

### 4️⃣ Configura GitHub OAuth

Dopo il primo deploy Railway ti darà un URL tipo:
`https://ircapp-production-xxxx.up.railway.app`

1. **Vai su** → https://github.com/settings/developers
2. **Click** → "New OAuth App"
3. **Configura**:
   - Name: `IRC Community (Production)`
   - Homepage: `https://your-railway-url.up.railway.app`
   - Callback: `https://your-railway-url.up.railway.app/api/auth/callback/github`
4. **Copia** Client ID e Secret
5. **Aggiungi** a Railway Variables

### 5️⃣ Re-deploy

Nel dashboard Railway:
- Click sul service
- Click "Deploy" → "Redeploy"

### ✅ Fatto!

Visita il tuo URL Railway e testa:
- ✅ Login con GitHub
- ✅ Creazione canali
- ✅ Invio messaggi
- ✅ IRC Server logs

---

## 🔍 Debug Rapido

### Controlla Logs
Railway Dashboard → Service → Deployments → Logs

### Problemi Comuni

**"Build failed"**
```bash
# Controlla che prisma generate funzioni
# Verifica DATABASE_URL nelle variabili
```

**"GitHub OAuth error"**
```bash
# Callback URL deve matchare esattamente
# Formato: https://domain/api/auth/callback/github
```

**"IRC Server not starting"**
```bash
# Verifica logs Railway
# Controlla che tsx sia in dependencies (non devDependencies)
```

---

## 📖 Guide Dettagliate

- **Full Guide**: `RAILWAY_DEPLOYMENT.md`
- **Vercel Alternative**: `DEPLOYMENT.md`
- **Troubleshooting**: `RAILWAY_DEPLOYMENT.md` (sezione Troubleshooting)

---

**Tempo totale: ~5-10 minuti** ⏱️

Railway gestisce automaticamente:
- ✅ Build e deploy
- ✅ SSL/HTTPS
- ✅ Monitoring
- ✅ Auto-scaling
- ✅ Zero-downtime deploys
