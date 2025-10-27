import { prisma } from '@/lib/prisma'

export async function seedGuestAndHelpChannels() {
  // Crea canale guest se non esiste
  const guest = await prisma.channel.upsert({
    where: { name: 'guest' },
    update: {},
    create: {
      name: 'guest',
      topic: 'Chat per utenti ospiti',
      description: 'Canale dedicato agli utenti guest. Qui puoi chiedere informazioni o socializzare come ospite.',
      isPrivate: false,
      category: 'GUEST',
      requiredRole: 'guest',
      createdBy: 'system',
    },
  })
  // Crea canale help se non esiste
  const help = await prisma.channel.upsert({
    where: { name: 'help' },
    update: {},
    create: {
      name: 'help',
      topic: 'Supporto e aiuto',
      description: 'Canale per richieste di supporto e aiuto tecnico.',
      isPrivate: false,
      category: 'HELP',
      requiredRole: 'guest',
      createdBy: 'system',
    },
  })
  return { guest, help }
}
