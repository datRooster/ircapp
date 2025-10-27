// Test database connection
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function testDatabase() {
  try {
    console.log('🔍 Testing database connection...')
    
    // Test connessione
    await prisma.$connect()
    console.log('✅ Database connected successfully')
    
    // Conta utenti
    const userCount = await prisma.user.count()
    console.log(`👥 Users in database: ${userCount}`)
    
    // Conta canali
    const channelCount = await prisma.channel.count()
    console.log(`📺 Channels in database: ${channelCount}`)
    
    // Conta account OAuth
    const oauthCount = await prisma.account.count()
    console.log(`🔐 OAuth accounts: ${oauthCount}`)
    
    // Lista utenti recenti
    const recentUsers = await prisma.user.findMany({
      take: 3,
      orderBy: { createdAt: 'desc' },
      select: {
        username: true,
        email: true,
        roles: true,
        createdAt: true
      }
    })
    
    console.log('\n📋 Recent users:')
    recentUsers.forEach(user => {
      console.log(`  • ${user.username} (${user.email}) - ${user.roles.join(', ')}`)
    })
    
    await prisma.$disconnect()
    console.log('\n✅ Database test completed')
    
  } catch (error) {
    console.error('❌ Database error:', error)
    process.exit(1)
  }
}

testDatabase()