import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const apply = process.argv.includes('--apply')

  const duplicates = await prisma.message.findMany({
    where: {
      encrypted: true,
      iv: { not: null },
      keyId: null,
      user: {
        username: 'webapp'
      }
    },
    include: {
      user: {
        select: { id: true, username: true }
      },
      channel: {
        select: { id: true, name: true }
      }
    },
    orderBy: {
      timestamp: 'asc'
    }
  })

  console.log(`Trovati ${duplicates.length} messaggi legacy da ripulire.`)

  if (duplicates.length > 0) {
    for (const msg of duplicates) {
      console.log(
        [
          msg.id,
          `#${msg.channel.name}`,
          msg.timestamp.toISOString(),
          msg.user.username,
          `${msg.content.slice(0, 48)}...`
        ].join(' | ')
      )
    }
  }

  if (!apply) {
    console.log('Dry-run completato. Usa --apply per eliminare i record legacy.')
    return
  }

  const ids = duplicates.map((msg) => msg.id)

  if (ids.length === 0) {
    console.log('Nessun record da eliminare.')
    return
  }

  const result = await prisma.message.deleteMany({
    where: {
      id: { in: ids }
    }
  })

  console.log(`Eliminati ${result.count} messaggi legacy duplicati.`)
}

main()
  .catch((error) => {
    console.error('Cleanup fallita:', error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
