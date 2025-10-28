// Archived test: test-github-oauth.js
// Original file moved to /archive/old-tests for repository cleanup.
// See README.md for current testing and setup instructions.

// Original contents preserved below for reference:
// -----------------------------
// Test GitHub OAuth configuration
import dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

async function testGitHubOAuth() {
  console.log('🔍 Testing GitHub OAuth Configuration...')
  
  const clientId = process.env.GITHUB_CLIENT_ID
  const clientSecret = process.env.GITHUB_CLIENT_SECRET
  
  console.log(`📋 Client ID: ${clientId}`)
  console.log(`🔑 Client Secret: ${clientSecret ? 'SET' : 'NOT SET'}`)
  
  // Test GitHub API with client credentials
  try {
    const response = await fetch(`https://api.github.com/applications/${clientId}/token`, {
      method: 'GET',
      headers: {
        'Authorization': `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
        'Accept': 'application/vnd.github+json'
      }
    })
    
    console.log(`📡 GitHub Response Status: ${response.status}`)
    
    if (response.status === 404) {
      console.log('❌ GitHub App non trovata - verifica Client ID')
    } else if (response.status === 401) {
      console.log('❌ Credenziali non valide - verifica Client Secret')
    } else {
      console.log('✅ GitHub OAuth app configurata correttamente')
    }
    
  } catch (error) {
    console.error('❌ Error testing GitHub:', error.message)
  }
  
  // Test callback URL
  const callbackUrl = 'http://localhost:3000/api/auth/callback/github'
  console.log(`🔗 Callback URL configurato: ${callbackUrl}`)
  console.log('📝 Verifica che questo URL sia configurato nella tua GitHub App')
}

testGitHubOAuth()
