# 🚀 Deployment Guide - Vercel Production

## Prerequisites
✅ Railway PostgreSQL database already configured and working
✅ GitHub account for OAuth
✅ Vercel account

## Step-by-Step Deployment

### 1. Prepare GitHub Repository
```bash
# Commit all changes
git add .
git commit -m "feat: enterprise UI redesign and production setup"
git push origin main
```

### 2. Generate Production Secrets
```bash
# Generate NEXTAUTH_SECRET
openssl rand -base64 32

# Generate WEBAPP_ENC_KEY
openssl rand -base64 32

# Generate IRC_ENCRYPTION_KEY
openssl rand -hex 16
```

### 3. Configure GitHub OAuth for Production
1. Go to: https://github.com/settings/developers
2. Click "New OAuth App"
3. Fill in:
   - **Application name**: IRC Community App (Production)
   - **Homepage URL**: `https://your-app-name.vercel.app`
   - **Authorization callback URL**: `https://your-app-name.vercel.app/api/auth/callback/github`
4. Save and copy:
   - Client ID
   - Client Secret

### 4. Deploy to Vercel

#### Option A: Via Vercel Dashboard (Recommended)
1. Go to: https://vercel.com/new
2. Import your GitHub repository
3. Configure project:
   - **Framework Preset**: Next.js
   - **Build Command**: `prisma generate && next build`
   - **Output Directory**: `.next`
   - **Install Command**: `npm install`

4. Add Environment Variables (click "Environment Variables"):

```bash
# Database (same as Railway)
DATABASE_URL=postgresql://postgres:xhxsMdQxreKLpQEozhlEIlgeEaViTcXg@mainline.proxy.rlwy.net:44341/railway

# NextAuth
NEXTAUTH_SECRET=<paste generated secret>
NEXTAUTH_URL=https://your-app-name.vercel.app

# Admin
ADMIN_USERNAME=admin
ADMIN_PASSWORD=<strong password>
ADMIN_EMAIL=admin@yourdomain.com

# GitHub OAuth
GITHUB_CLIENT_ID=<from GitHub OAuth app>
GITHUB_CLIENT_SECRET=<from GitHub OAuth app>

# Encryption Keys
WEBAPP_ENC_KEY=<paste generated key>
IRC_ENCRYPTION_KEY=<paste generated key>

# IRC Config
IRC_MAX_MESSAGE_LENGTH=1000
IRC_RATE_LIMIT_MESSAGES=10
IRC_RATE_LIMIT_WINDOW=60000

# Bridge Bot
WEBAPP_HOST=https://your-app-name.vercel.app

# Production mode
DEV_AUTH_BYPASS=false
```

5. Click **Deploy**

#### Option B: Via Vercel CLI
```bash
# Install Vercel CLI
npm i -g vercel

# Login to Vercel
vercel login

# Deploy
vercel

# Follow the prompts:
# - Link to existing project? No
# - What's your project's name? ircapp
# - In which directory is your code located? ./
# - Want to override the settings? No

# Add environment variables
vercel env add DATABASE_URL production
# Paste: postgresql://postgres:xhxsMdQxreKLpQEozhlEIlgeEaViTcXg@mainline.proxy.rlwy.net:44341/railway

vercel env add NEXTAUTH_SECRET production
# Paste your generated secret

vercel env add NEXTAUTH_URL production
# Paste: https://your-app-name.vercel.app

# Add remaining env vars...

# Deploy to production
vercel --prod
```

### 5. Post-Deployment Configuration

#### Update GitHub OAuth App
1. Go back to GitHub OAuth app settings
2. Update **Authorization callback URL** with your actual Vercel URL:
   ```
   https://your-actual-domain.vercel.app/api/auth/callback/github
   ```

#### Run Database Migrations
```bash
# The postinstall script will run prisma generate automatically
# If you need to run migrations manually:
vercel env pull .env.production
npx prisma migrate deploy
```

#### Test the Deployment
1. Visit: `https://your-app-name.vercel.app`
2. Test login with GitHub
3. Check channel creation
4. Send messages
5. Test admin panel

### 6. Custom Domain (Optional)
1. In Vercel dashboard, go to your project
2. Settings → Domains
3. Add your custom domain
4. Update DNS records as instructed
5. Update environment variables:
   - `NEXTAUTH_URL=https://yourdomain.com`
6. Update GitHub OAuth callback URL

### 7. Monitoring

#### Vercel Dashboard
- Deployments: Check build logs
- Analytics: Monitor traffic
- Logs: Real-time function logs

#### Railway Dashboard
- Database metrics
- Connection count
- Query performance

## Troubleshooting

### Build Fails with Prisma Error
```bash
# Make sure postinstall runs prisma generate
# Check package.json has: "postinstall": "prisma generate"
```

### Database Connection Issues
```bash
# Verify DATABASE_URL is correct
# Check Railway database is accessible
# Whitelist Vercel IPs if needed (Railway should allow all by default)
```

### OAuth Redirect Mismatch
```bash
# Make sure GitHub OAuth callback URL matches exactly:
# https://your-domain.vercel.app/api/auth/callback/github
# 
# Update NEXTAUTH_URL to match your domain
```

### WebSocket/Socket.io Issues
```bash
# Vercel Serverless Functions don't support persistent WebSockets
# You may need to deploy the IRC server separately on Railway
# Or use a different provider for real-time features
```

## Important Notes

### IRC Server Considerations
⚠️ **Vercel doesn't support long-running processes or WebSockets in serverless functions**

You have 2 options:

#### Option 1: Separate IRC Server (Recommended)
Deploy the IRC server on Railway:
1. Create new Railway service
2. Deploy `src/irc-server` and `src/bridge/webapp-bot.js`
3. Update `WEBAPP_HOST` to point to Railway IRC service
4. Keep Next.js frontend on Vercel

#### Option 2: Hybrid Approach
- Frontend: Vercel
- IRC Server + Bridge: Railway
- Database: Railway PostgreSQL

This is the most scalable approach for production.

## Production Checklist
- [ ] All environment variables set in Vercel
- [ ] GitHub OAuth configured with production URLs
- [ ] NEXTAUTH_SECRET is strong and unique
- [ ] DEV_AUTH_BYPASS is set to false
- [ ] Admin password is strong
- [ ] Encryption keys are generated and secure
- [ ] Database migrations are up to date
- [ ] Custom domain configured (optional)
- [ ] IRC server deployed separately (if needed)
- [ ] Bridge bot configured with production URLs
- [ ] Test login flow
- [ ] Test message sending
- [ ] Test admin features
- [ ] Monitor logs for errors

## Next Steps
1. Set up monitoring (Sentry, LogRocket, etc.)
2. Configure CDN and caching
3. Set up CI/CD pipeline
4. Add uptime monitoring
5. Configure backup strategy
