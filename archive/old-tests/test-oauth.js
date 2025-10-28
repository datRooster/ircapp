#!/usr/bin/env node
// Archived test: test-oauth.js
// Original file moved to /archive/old-tests for repository cleanup.
// See README.md for current testing and setup instructions.

// Original contents preserved below for reference:
// -----------------------------
// Script per testare la configurazione OAuth
async function testOAuthConfig() {
  console.log('🔐 Testing OAuth Configuration')
  console.log('=' .repeat(40))
  
  const BASE_URL = 'http://localhost:3000';
  
  try {
    // Test API providers endpoint
    console.log('📡 Testing providers endpoint...')
    const response = await fetch(`${BASE_URL}/api/auth/providers`)
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }
    
    const providers = await response.json()
    console.log('✅ Providers endpoint accessible')
    
    // Check each OAuth provider
    const oauthProviders = ['github'] // Solo GitHub configurato
    
    for (const provider of oauthProviders) {
      const isConfigured = providers[provider] && 
                          process.env[`${provider.toUpperCase()}_CLIENT_ID`] &&
                          process.env[`${provider.toUpperCase()}_CLIENT_SECRET`]
      
      if (isConfigured) {
        console.log(`✅ ${provider}: Configured`)
      } else {
        console.log(`❌ ${provider}: Missing credentials`)
        console.log(`   Need: ${provider.toUpperCase()}_CLIENT_ID and ${provider.toUpperCase()}_CLIENT_SECRET`)
      }
    }
    
    // Test callback URLs
    console.log('\n🔗 OAuth Callback URLs:')
    for (const provider of oauthProviders) {
      console.log(`   ${provider}: ${BASE_URL}/api/auth/callback/${provider}`)
    }
    
    console.log('\n📋 Environment Status:')
    console.log(`   NEXTAUTH_URL: ${process.env.NEXTAUTH_URL || 'NOT SET'}`)
    console.log(`   NEXTAUTH_SECRET: ${process.env.NEXTAUTH_SECRET ? 'SET' : 'NOT SET'}`)
    console.log(`   DATABASE_URL: ${process.env.DATABASE_URL ? 'SET' : 'NOT SET'}`)
    
  } catch (error) {
    console.error('❌ Test failed:', error.message)
    console.log('\n🔧 Troubleshooting:')
    console.log('1. Make sure the server is running: npm run dev')
    console.log('2. Check .env.local configuration')
    console.log('3. Verify OAuth apps are created with correct callback URLs')
  }
}

// Run test if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  testOAuthConfig()
}
