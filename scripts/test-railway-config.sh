#!/bin/bash

# 🧪 Test Railway Configuration Locally
# Simula l'ambiente Railway prima del deploy

echo "🧪 Testing Railway Configuration..."
echo ""

# Check required files
echo "📁 Checking required files..."
FILES=("railway.toml" "Procfile" "package.json" ".env.local")
for file in "${FILES[@]}"; do
  if [ -f "$file" ]; then
    echo "  ✅ $file exists"
  else
    echo "  ❌ $file missing"
    exit 1
  fi
done
echo ""

# Check npm scripts
echo "📦 Checking npm scripts..."
SCRIPTS=("build" "start" "irc:start" "bot:start" "railway:all")
for script in "${SCRIPTS[@]}"; do
  if grep -q "\"$script\"" package.json; then
    echo "  ✅ npm run $script defined"
  else
    echo "  ❌ npm run $script missing"
    exit 1
  fi
done
echo ""

# Check environment variables
echo "🔐 Checking environment variables..."
ENV_VARS=("DATABASE_URL" "NEXTAUTH_SECRET" "WEBAPP_ENC_KEY" "IRC_ENCRYPTION_KEY")
for var in "${ENV_VARS[@]}"; do
  if grep -q "$var" .env.local; then
    echo "  ✅ $var is set"
  else
    echo "  ⚠️  $var not found in .env.local"
  fi
done
echo ""

# Test build
echo "🔨 Testing build..."
if npm run build > /dev/null 2>&1; then
  echo "  ✅ Build successful"
else
  echo "  ❌ Build failed"
  echo "  Run 'npm run build' to see errors"
  exit 1
fi
echo ""

# Check Prisma
echo "🗄️  Checking Prisma..."
if npx prisma generate > /dev/null 2>&1; then
  echo "  ✅ Prisma client generated"
else
  echo "  ❌ Prisma generate failed"
  exit 1
fi
echo ""

# Check ports
echo "🔌 Checking port availability..."
PORT_WEB=3000
PORT_BOT=4000
PORT_IRC=6667

if lsof -Pi :$PORT_WEB -sTCP:LISTEN -t >/dev/null ; then
  echo "  ⚠️  Port $PORT_WEB is in use (expected if dev server running)"
else
  echo "  ✅ Port $PORT_WEB available"
fi

if lsof -Pi :$PORT_BOT -sTCP:LISTEN -t >/dev/null ; then
  echo "  ⚠️  Port $PORT_BOT is in use"
else
  echo "  ✅ Port $PORT_BOT available"
fi

if lsof -Pi :$PORT_IRC -sTCP:LISTEN -t >/dev/null ; then
  echo "  ⚠️  Port $PORT_IRC is in use"
else
  echo "  ✅ Port $PORT_IRC available"
fi
echo ""

# Summary
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ Railway Configuration Test Complete!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📝 Next Steps:"
echo "  1. Generate secrets: ./scripts/generate-secrets.sh"
echo "  2. Commit changes: git add . && git commit -m 'feat: railway deployment'"
echo "  3. Push to GitHub: git push origin main"
echo "  4. Deploy on Railway: https://railway.app"
echo ""
echo "📖 See RAILWAY_DEPLOYMENT.md for detailed instructions"
