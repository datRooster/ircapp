#!/usr/bin/env node

import * as fs from 'fs'
import * as os from 'os'

const LOCAL_IP = '192.168.0.102' // Dalla configurazione di rete
const PORT = '3000'

function getNetworkInterfaces() {
  const interfaces = os.networkInterfaces()
  const ips = []
  
  for (const name of Object.keys(interfaces)) {
    const nets = interfaces[name]
    if (nets) {
      for (const net of nets) {
        if (net.family === 'IPv4' && !net.internal) {
          ips.push(net.address)
        }
      }
    }
  }
  
  return ips
}

function updateEnvFile(mode) {
  const envPath = '.env.local'
  let content = fs.readFileSync(envPath, 'utf8')
  
  const localIPs = getNetworkInterfaces()
  const primaryIP = localIPs[0] || LOCAL_IP
  
  switch (mode) {
    case 'local':
      content = content.replace(
        /NEXTAUTH_URL="[^"]*"/,
        `NEXTAUTH_URL="http://localhost:${PORT}"`
      )
      console.log(`✅ Configured for LOCAL access: http://localhost:${PORT}`)
      break
      
    case 'network':
      content = content.replace(
        /NEXTAUTH_URL="[^"]*"/,
        `NEXTAUTH_URL="http://${primaryIP}:${PORT}"`
      )
      console.log(`✅ Configured for NETWORK access: http://${primaryIP}:${PORT}`)
      console.log(`📱 Mobile/other devices can connect to: http://${primaryIP}:${PORT}`)
      break
      
    default:
      console.log('Usage: node setup-network.js [local|network]')
      console.log('')
      console.log('Modes:')
      console.log('  local   - Access only from this computer (localhost)')
      console.log('  network - Access from local network (mobile, other devices)')
      console.log('')
      console.log('Current network IPs:', localIPs.join(', '))
      return
  }
  
  fs.writeFileSync(envPath, content)
  console.log('🔄 Please restart the development server: npm run dev')
}

const mode = process.argv[2]
updateEnvFile(mode)