#!/usr/bin/env node

import * as os from 'os'
import { execSync } from 'child_process'

console.log('🌐 IRC Server Network Configuration')
console.log('=' .repeat(50))

// 1. IP locali
console.log('\n📍 LOCAL IP ADDRESSES:')
const interfaces = os.networkInterfaces()
for (const name of Object.keys(interfaces)) {
  const nets = interfaces[name]
  if (nets) {
    for (const net of nets) {
      if (net.family === 'IPv4') {
        const type = net.internal ? '(localhost)' : '(network)'
        console.log(`   ${name}: ${net.address} ${type}`)
      }
    }
  }
}

// 2. IP pubblico
console.log('\n🌍 PUBLIC IP ADDRESS:')
try {
  const publicIP = execSync('curl -s ifconfig.me', { timeout: 5000 }).toString().trim()
  console.log(`   External: ${publicIP}`)
} catch (error) {
  console.log('   External: Unable to determine (check internet connection)')
}

// 3. Porte in uso
console.log('\n📡 PORT STATUS:')
try {
  const netstat = execSync('lsof -i :6667', { timeout: 3000 }).toString()
  if (netstat.includes('6667')) {
    console.log('   Port 6667: ✅ IN USE (IRC Server running)')
  }
} catch (error) {
  console.log('   Port 6667: ❌ FREE (IRC Server not running)')
}

// 4. Firewall (macOS)
console.log('\n🔒 FIREWALL STATUS:')
try {
  const firewallStatus = execSync('sudo pfctl -s info 2>/dev/null || echo "Unable to check"', { timeout: 3000 }).toString()
  if (firewallStatus.includes('Status: Enabled')) {
    console.log('   macOS Firewall: ⚠️ ENABLED (may block external connections)')
  } else {
    console.log('   macOS Firewall: ✅ DISABLED or not blocking')
  }
} catch (error) {
  console.log('   macOS Firewall: ❓ Unable to determine')
}

console.log('\n🔧 TROUBLESHOOTING:')
console.log('1. Local connections should work with: localhost:6667')
console.log('2. Network connections require:')
console.log('   - Use your local IP (192.168.x.x)')
console.log('   - Ensure macOS firewall allows port 6667')
console.log('3. External connections require:')
console.log('   - Router port forwarding: 6667 → your-local-ip:6667')
console.log('   - ISP allows incoming connections')
console.log('   - Use your public IP')

console.log('\n💡 QUICK TESTS:')
console.log('• Local test:    telnet localhost 6667')
console.log('• Network test:  telnet <local-ip> 6667')
console.log('• External test: telnet <public-ip> 6667')