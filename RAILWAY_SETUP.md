# Railway Setup Guide per IRC Community

## 🚀 Deployment su Railway con PostgreSQL

### 1. Preparazione del Progetto

```bash
# Installa Railway CLI
npm install -g @railway/cli

# Login a Railway
railway login
```

### 2. Configurazione Database

1. **Crea nuovo progetto su Railway:**
   ```bash
   railway new ircommunity
   ```

2. **Aggiungi PostgreSQL:**
   ```bash
   railway add postgresql
   ```

3. **Ottieni la connection string:**
   ```bash
   railway variables
   # Copia DATABASE_URL
   ```

### 3. Setup Environment Variables

Configura le seguenti variabili su Railway:

```env
# Database
DATABASE_URL=postgresql://...

# NextAuth
NEXTAUTH_SECRET=your-super-secret-key-here-change-in-production
NEXTAUTH_URL=https://your-app.railway.app

# OAuth Providers
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret

GITHUB_CLIENT_ID=your-github-client-id  
GITHUB_CLIENT_SECRET=your-github-client-secret

DISCORD_CLIENT_ID=your-discord-client-id
DISCORD_CLIENT_SECRET=your-discord-client-secret

# Admin Configuration
ADMIN_USERNAME=admin
ADMIN_PASSWORD=your-secure-admin-password
ADMIN_EMAIL=admin@yourdomain.com
```

### 4. Setup OAuth Providers

#### Google OAuth:
1. Vai su [Google Cloud Console](https://console.cloud.google.com/)
2. Crea nuovo progetto o seleziona esistente
3. Abilita Google+ API
4. Crea credenziali OAuth 2.0
5. Aggiungi redirect URI: `https://your-app.railway.app/api/auth/callback/google`

#### GitHub OAuth:
1. Vai su GitHub Settings > Developer settings > OAuth Apps
2. Crea New OAuth App
3. Authorization callback URL: `https://your-app.railway.app/api/auth/callback/github`

#### Discord OAuth:
1. Vai su [Discord Developer Portal](https://discord.com/developers/applications)
2. Crea New Application
3. OAuth2 > Add Redirect: `https://your-app.railway.app/api/auth/callback/discord`

### 5. Deploy

```bash
# Deploy su Railway
railway up

# Run migrations (dopo primo deploy)
railway run npx prisma migrate deploy
railway run npx prisma generate
```

### 6. Database Migrations

```bash
# Crea migration
npx prisma migrate dev --name init

# Deploy in produzione
railway run npx prisma migrate deploy
```

## 🔧 Comandi Utili

```bash
# Visualizza logs
railway logs

# Apri database console
railway shell

# Visualizza variabili
railway variables

# Redeploy
railway up --detach
```

## 📋 Checklist Post-Deploy

- [ ] Database PostgreSQL creato
- [ ] Variabili ambiente configurate
- [ ] OAuth providers configurati
- [ ] Migrations eseguite
- [ ] App accessibile su HTTPS
- [ ] Login social funzionante
- [ ] Admin account accessible

## 🚨 Note di Sicurezza

1. **Cambia NEXTAUTH_SECRET** in produzione
2. **Usa password sicura per admin**
3. **Abilita HTTPS only** per OAuth
4. **Monitora logs per errori**
5. **Backup database regolari**

## 📱 Features Abilitate

✅ **Autenticazione Social** - Google, GitHub, Discord
✅ **Database PostgreSQL** - Persistenza dati
✅ **Admin Panel** - Controllo amministrativo
✅ **Messaggi Crittografati** - Sicurezza comunicazioni
✅ **Canali Multipli** - Organizzazione chat
✅ **Real-time** - Messaggi istantanei

---

**Supporto:** Per problemi consulta [Railway Docs](https://docs.railway.app/) o apri issue nel repository.