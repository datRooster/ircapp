#!/usr/bin/env node

import { IRCServer } from './irc-server'
import * as os from 'os'

// IRC usa sempre IRC_PORT, ignora la variabile PORT di Railway
const PORT = parseInt(process.env.IRC_PORT || '6667')
const HOSTNAME = process.env.IRC_HOSTNAME || 'irc.ircapp.community'

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

async function startIRCServer() {
  console.log('🚀 Starting IRC Server...')
  
  const server = new IRCServer(PORT, HOSTNAME)
  
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
    console.log('')
    console.log('🔌 CONNECTION OPTIONS:')
    console.log(`   Local:    /server localhost ${PORT}`)
    console.log(`   Local:    /server 127.0.0.1 ${PORT}`)
    
    if (localIPs.length > 0) {
      console.log('   Network:')
      localIPs.forEach(ip => {
        console.log(`             /server ${ip} ${PORT}`)
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