#!/usr/bin/env node

import { IRCServer } from './irc-server'
import * as os from 'os'
import * as fs from 'fs'
import * as tls from 'tls'

// IRC usa sempre IRC_PORT, ignora la variabile PORT di Railway
const PORT = parseInt(process.env.IRC_PORT || '6667')
const HOSTNAME = process.env.IRC_HOSTNAME || 'irc.ircapp.community'
const TLS_ENABLED = process.env.IRC_TLS_ENABLED === 'true'

// Funzione per ottenere IP locale
function getLocalIPs(): string[] {
  const interfaces = os.networkInterfaces()
  const ips: string[] = []
  
  for (const name of Object.keys(interfaces)) {
    const nets = interfaces[name]
    if (nets) {
      for (const net of nets) {
        // Skip over non-IPv4 and internal (i.e. 127.0.0.1) addresses
        if (net.family === 'IPv4' && !net.internal) {
          ips.push(net.address)
        }
      }
    }
  }
  
  return ips
}

function readPemFromEnvOrFile(
  directEnv: string | undefined,
  base64Env: string | undefined,
  filePathEnv: string | undefined
): string | undefined {
  if (directEnv) {
    return directEnv.replace(/\\n/g, '\n')
  }

  if (base64Env) {
    return Buffer.from(base64Env, 'base64').toString('utf8')
  }

  if (filePathEnv) {
    return fs.readFileSync(filePathEnv, 'utf8')
  }

  return undefined
}

function loadTlsOptions(): tls.TlsOptions | null {
  if (!TLS_ENABLED) {
    return null
  }

  const key = readPemFromEnvOrFile(
    process.env.IRC_TLS_KEY,
    process.env.IRC_TLS_KEY_BASE64,
    process.env.IRC_TLS_KEY_PATH
  )

  const cert = readPemFromEnvOrFile(
    process.env.IRC_TLS_CERT,
    process.env.IRC_TLS_CERT_BASE64,
    process.env.IRC_TLS_CERT_PATH
  )

  const ca = readPemFromEnvOrFile(
    process.env.IRC_TLS_CA,
    process.env.IRC_TLS_CA_BASE64,
    process.env.IRC_TLS_CA_PATH
  )

  if (!key || !cert) {
    throw new Error('IRC_TLS_ENABLED=true ma mancano certificato o chiave privata')
  }

  return {
    key,
    cert,
    ca,
    minVersion: 'TLSv1.2'
  }
}

async function startIRCServer() {
  console.log('🚀 Starting IRC Server...')

  const tlsOptions = loadTlsOptions()
  const server = new IRCServer(PORT, HOSTNAME, tlsOptions)
  
  // Handle graceful shutdown
  process.on('SIGINT', async () => {
    console.log('\n💾 Shutting down IRC Server...')
    await server.stop()
    process.exit(0)
  })
  
  process.on('SIGTERM', async () => {
    console.log('\n💾 Shutting down IRC Server...')
    await server.stop()
    process.exit(0)
  })
  
  try {
    await server.start()
    
    const localIPs = getLocalIPs()
    
    console.log(`🎉 IRC Server started successfully!`)
    console.log(`📡 Port: ${PORT}`)
    console.log(`🔐 TLS: ${TLS_ENABLED ? 'enabled' : 'disabled'}`)
    console.log('')
    console.log('🔌 CONNECTION OPTIONS:')
    console.log(`   Local:    /server localhost ${PORT}${TLS_ENABLED ? ' (TLS)' : ''}`)
    console.log(`   Local:    /server 127.0.0.1 ${PORT}${TLS_ENABLED ? ' (TLS)' : ''}`)
    
    if (localIPs.length > 0) {
      console.log('   Network:')
      localIPs.forEach(ip => {
        console.log(`             /server ${ip} ${PORT}${TLS_ENABLED ? ' (TLS)' : ''}`)
      })
    }
    
    console.log('')
    console.log('🌍 EXTERNAL ACCESS:')
    console.log('   1. Check your IP: curl ifconfig.me')
    console.log('   2. Open port in firewall/router')
    console.log('   3. Connect: /server <your-public-ip> 6667')
    console.log('')
    console.log('📺 Available channels:')
    console.log('  #lobby - Main channel with announcements')
    console.log('  #general - General discussion')
    console.log('  #tech - Technical discussions')
    console.log('')
    console.log('Admin users can create more channels via web interface.')
    console.log('Press Ctrl+C to stop the server.')
    
  } catch (error) {
    console.error('❌ Failed to start IRC Server:', error)
    process.exit(1)
  }
}

// Start the server
startIRCServer().catch(console.error)
