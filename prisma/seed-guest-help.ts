import { prisma } from '@/lib/prisma'

type SeedUser = {
  id: string
  username: string
  name: string
  roles: string[]
  primaryRole: 'USER' | 'ADMIN'
}

type SeedChannel = {
  id: string
  name: string
  topic: string
  description: string
  category: 'GENERAL' | 'GUEST' | 'HELP'
  requiredRole: 'admin' | 'guest' | 'user'
}

const seedUsers: SeedUser[] = [
  {
    id: 'system',
    username: 'system',
    name: 'System',
    roles: ['admin', 'user'],
    primaryRole: 'ADMIN',
  },
  {
    id: 'anonymous',
    username: 'anonymous',
    name: 'Anonymous Guest',
    roles: ['guest'],
    primaryRole: 'USER',
  },
  {
    id: 'webapp',
    username: 'webapp',
    name: 'WebApp Bridge',
    roles: ['user'],
    primaryRole: 'USER',
  },
]

const seedChannels: SeedChannel[] = [
  {
    id: 'lobby',
    name: 'lobby',
    topic: 'Annunci e regole della community',
    description: 'Canale principale della community. Solo admin e moderatori possono scrivere.',
    category: 'GENERAL',
    requiredRole: 'admin',
  },
  {
    id: 'general',
    name: 'general',
    topic: 'Discussione generale',
    description: 'Spazio aperto per chiacchiere generali e socializzazione.',
    category: 'GENERAL',
    requiredRole: 'user',
  },
  {
    id: 'tech',
    name: 'tech',
    topic: 'Supporto tecnico e programmazione',
    description: 'Discussioni tecniche, codice, sicurezza e sviluppo software.',
    category: 'GENERAL',
    requiredRole: 'user',
  },
  {
    id: 'guest',
    name: 'guest',
    topic: 'Chat per utenti ospiti',
    description: 'Canale dedicato agli utenti guest. Qui puoi chiedere informazioni o socializzare come ospite.',
    category: 'GUEST',
    requiredRole: 'guest',
  },
  {
    id: 'help',
    name: 'help',
    topic: 'Supporto e aiuto',
    description: 'Canale per richieste di supporto e aiuto tecnico.',
    category: 'HELP',
    requiredRole: 'guest',
  },
]

async function ensureSeedUsers() {
  for (const user of seedUsers) {
    await prisma.user.upsert({
      where: { id: user.id },
      update: {
        username: user.username,
        name: user.name,
        roles: user.roles,
        primaryRole: user.primaryRole,
        isOnline: false,
      },
      create: {
        id: user.id,
        username: user.username,
        name: user.name,
        roles: user.roles,
        primaryRole: user.primaryRole,
        isOnline: false,
      },
    })
  }
}

export async function seedGuestAndHelpChannels() {
  await ensureSeedUsers()

  const systemUser = await prisma.user.findUnique({
    where: { id: 'system' },
    select: { id: true },
  })

  if (!systemUser) {
    throw new Error('System user not found after seed bootstrap')
  }

  const createdChannels = []

  for (const channel of seedChannels) {
    const created = await prisma.channel.upsert({
      where: { name: channel.name },
      update: {
        topic: channel.topic,
        description: channel.description,
        category: channel.category,
        requiredRole: channel.requiredRole,
        isPrivate: false,
        isArchived: false,
        createdBy: systemUser.id,
      },
      create: {
        id: channel.id,
        name: channel.name,
        topic: channel.topic,
        description: channel.description,
        category: channel.category,
        requiredRole: channel.requiredRole,
        isPrivate: false,
        createdBy: systemUser.id,
      },
    })

    createdChannels.push(created)
  }

  return createdChannels
}

async function main() {
  const channels = await seedGuestAndHelpChannels()
  console.log(`Seed completato: ${channels.length} canali inizializzati`)
  channels.forEach((channel) => {
    console.log(` - #${channel.name} (${channel.id})`)
  })
}

main()
  .catch((error) => {
    console.error('Errore durante il seed iniziale:', error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
