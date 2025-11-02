// Crea l'utente bot IRC "webapp" nel database tramite Prisma
// Esegui: npx tsx create-bot-user.ts

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const id = 'webapp'
  const username = 'webapp'
  const now = new Date()
  await prisma.user.upsert({
    where: { id },
    update: {},
    create: {
      id,
      username,
      roles: ['user'],
      primaryRole: 'USER',
      isOnline: false,
      createdAt: now,
      updatedAt: now,
    },
  })
  console.log('Utente bot IRC creato/già esistente!')
  await prisma.$disconnect()
}

main().catch(e => {
  console.error(e)
  process.exit(1)
})
