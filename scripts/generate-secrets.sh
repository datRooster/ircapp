#!/bin/bash

# 🔐 Generate Production Secrets
# Run this script to generate all required secrets for production

echo "🔐 Generating Production Secrets..."
echo ""

echo "📝 NEXTAUTH_SECRET (copy this to Vercel):"
openssl rand -base64 32
echo ""

echo "🔑 WEBAPP_ENC_KEY (copy this to Vercel):"
openssl rand -base64 32
echo ""

echo "🔒 IRC_ENCRYPTION_KEY (copy this to Vercel):"
openssl rand -hex 16
echo ""

echo "✅ Done! Copy these values to your Vercel environment variables."
echo ""
echo "⚠️  IMPORTANT: Keep these secrets secure and never commit them to git!"
