#!/usr/bin/env node

// Script per configurare OAuth providers
import * as fs from 'fs'

const BASE_URL = 'http://192.168.0.102:3000' // URL dalla nostra configurazione di rete

console.log('🔐 OAuth Providers Configuration Guide')
console.log('=' .repeat(50))
console.log('')

console.log('📋 CALLBACK URLs TO USE:')
console.log(`Google:   ${BASE_URL}/api/auth/callback/google`)
console.log(`GitHub:   ${BASE_URL}/api/auth/callback/github`)  
console.log(`Discord:  ${BASE_URL}/api/auth/callback/discord`)
console.log('')

console.log('🌐 AUTHORIZED ORIGINS:')
console.log(`Base URL: ${BASE_URL}`)
console.log(`Local:    http://localhost:3000`)
console.log('')

console.log('📝 STEP-BY-STEP SETUP:')
console.log('')

// Google OAuth Setup
console.log('1️⃣  GOOGLE OAUTH SETUP:')
console.log('   1. Go to: https://console.cloud.google.com/')
console.log('   2. Create new project or select existing')
console.log('   3. Enable Google+ API or Google Identity')
console.log('   4. Go to Credentials > Create Credentials > OAuth 2.0 Client ID')
console.log('   5. Application type: Web application')
console.log(`   6. Authorized origins: ${BASE_URL}`)
console.log(`   7. Authorized redirect URIs: ${BASE_URL}/api/auth/callback/google`)
console.log('   8. Copy Client ID and Client Secret')
console.log('')

// GitHub OAuth Setup  
console.log('2️⃣  GITHUB OAUTH SETUP:')
console.log('   1. Go to: https://github.com/settings/developers')
console.log('   2. Click "New OAuth App"')
console.log('   3. Application name: IRC Community')
console.log(`   4. Homepage URL: ${BASE_URL}`)
console.log(`   5. Authorization callback URL: ${BASE_URL}/api/auth/callback/github`)
console.log('   6. Copy Client ID and generate Client Secret')
console.log('')

// Discord OAuth Setup
console.log('3️⃣  DISCORD OAUTH SETUP:')
console.log('   1. Go to: https://discord.com/developers/applications')
console.log('   2. Click "New Application"')
console.log('   3. Name: IRC Community')
console.log('   4. Go to OAuth2 section')
console.log(`   5. Add redirect: ${BASE_URL}/api/auth/callback/discord`)
console.log('   6. Copy Client ID and Client Secret')
console.log('')

console.log('⚙️  UPDATE ENVIRONMENT VARIABLES:')
console.log('After getting the credentials, update .env.local with:')
console.log('')
console.log('GOOGLE_CLIENT_ID="your-actual-google-client-id"')
console.log('GOOGLE_CLIENT_SECRET="your-actual-google-client-secret"') 
console.log('')
console.log('GITHUB_CLIENT_ID="your-actual-github-client-id"')
console.log('GITHUB_CLIENT_SECRET="your-actual-github-client-secret"')
console.log('')
console.log('DISCORD_CLIENT_ID="your-actual-discord-client-id"')
console.log('DISCORD_CLIENT_SECRET="your-actual-discord-client-secret"')
console.log('')

console.log('🧪 TEST THE CONFIGURATION:')
console.log(`1. Restart the server: npm run dev`)
console.log(`2. Go to: ${BASE_URL}/login`)
console.log('3. Try logging in with each provider')
console.log('')

// Generate a template .env file
const envTemplate = `# OAuth Providers - Replace with actual values
GOOGLE_CLIENT_ID="your-actual-google-client-id"
GOOGLE_CLIENT_SECRET="your-actual-google-client-secret"

GITHUB_CLIENT_ID="your-actual-github-client-id"  
GITHUB_CLIENT_SECRET="your-actual-github-client-secret"

DISCORD_CLIENT_ID="your-actual-discord-client-id"
DISCORD_CLIENT_SECRET="your-actual-discord-client-secret"
`

fs.writeFileSync('.env.oauth.template', envTemplate)
console.log('📄 Template saved to: .env.oauth.template')
console.log('')
console.log('🔄 After configuring, restart the server to apply changes!')