// Archived test: test-db.js
// Original file moved to /archive/old-tests for repository cleanup.
// See README.md for current testing and setup instructions.

// Original contents preserved below for reference:
// -----------------------------
const { PrismaClient } = require('@prisma/client')
const bcrypt = require('bcryptjs')

const prisma = new PrismaClient()

async function testDatabase() {
  try {
    console.log('🔍 Testing database connection...')
    
    // Test connessione
    await prisma.$connect()
    console.log('✅ Database connected successfully!')
    
    // Controlla se esistono utenti
    const userCount = await prisma.user.count()
    console.log(`📊 Current users in database: ${userCount}`)
    
    // Crea utente admin se non esiste
    const adminExists = await prisma.user.findUnique({
      where: { username: 'admin' }
    })
    
    if (!adminExists) {
      console.log('👑 Creating admin user...')
      const hashedPassword = await bcrypt.hash('admin123', 12)
      
      const admin = await prisma.user.create({
        data: {
          username: 'admin',
          email: 'admin@ircommunity.local',
          password: hashedPassword,
          roles: ['admin', 'user'],
          isOnline: false
        }
      })
      
      console.log('✅ Admin user created:', admin.username)
    } else {
      console.log('👑 Admin user already exists')
    }
    
    // Crea canale lobby se non esiste
    const lobbyExists = await prisma.channel.findUnique({
      where: { id: 'lobby' }
    })
    
    if (!lobbyExists) {
      console.log('🏠 Creating lobby channel...')
      const lobby = await prisma.channel.create({
        data: {
          id: 'lobby',
          name: 'lobby',
          description: 'Canale principale della community',
          isPrivate: false
        }
      })
      console.log('✅ Lobby channel created:', lobby.name)
    } else {
      console.log('🏠 Lobby channel already exists')
    }
    
    // Lista tutti gli utenti
    const users = await prisma.user.findMany({
      select: {
        id: true,
        username: true,
        email: true,
        roles: true,
        createdAt: true
      }
    })
    
    console.log('👥 Users in database:')
    users.forEach(user => {
      console.log(`  - ${user.username} (${user.email}) - Roles: ${user.roles.join(', ')}`)
    })
    
    // Lista tutti i canali
    const channels = await prisma.channel.findMany({
      select: {
        id: true,
        name: true,
        description: true,
        isPrivate: true
      }
    })
    
    console.log('📺 Channels in database:')
    channels.forEach(channel => {
      console.log(`  - #${channel.name} (${channel.description}) - Private: ${channel.isPrivate}`)
    })
    
    console.log('🎉 Database test completed successfully!')
    
  } catch (error) {
    console.error('❌ Database test failed:', error)
  } finally {
    await prisma.$disconnect()
  }
}

testDatabase()
