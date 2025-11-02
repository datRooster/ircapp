import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    const session = await auth()
    const isGuest = typeof session?.user === 'undefined'
    // guestParam: fallback solo su sessione
    // Se guest, mostra solo guest/help
    if (isGuest) {
      const channels = await prisma.channel.findMany({
        where: {
          isArchived: false,
          OR: [
            { category: 'GUEST' },
            { category: 'HELP' }
          ]
        },
        orderBy: [
          { category: 'asc' },
          { name: 'asc' }
        ]
      })
      const transformedChannels = channels.map(channel => ({
        id: channel.id,
        name: channel.name,
        topic: channel.topic || channel.description,
        description: channel.description,
        isPrivate: channel.isPrivate,
        isReadOnly: false,
        allowedRoles: ['guest', 'user', 'admin', 'moderator'],
        users: [],
        createdAt: channel.createdAt,
        updatedAt: channel.updatedAt,
        category: channel.category,
        parentId: channel.parentId,
        memberCount: 0,
        messageCount: 0
      }))
      return NextResponse.json({ channels: transformedChannels })
    }

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { roles: true, primaryRole: true }
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Carica canali in base ai permessi dell'utente
    const userRoles = user.roles
    // const isAdmin = userRoles.includes('admin')
    // const isModerator = userRoles.includes('moderator')


    // Tutti vedono tutti i canali non archiviati
    const channels = await prisma.channel.findMany({
      where: { isArchived: false },
      include: {
        parent: { select: { id: true, name: true } },
        children: { select: { id: true, name: true } },
        _count: { select: { members: true, messages: true } }
      },
      orderBy: [ { category: 'asc' }, { name: 'asc' } ]
    })

    // allowedRoles: chi può scrivere (basato su requiredRole)
    const transformedChannels = channels.map(channel => {
      let allowedRoles: string[] = []
      // Forza la lobby come solo admin scrivibile
      if (channel.name === '#lobby') {
        allowedRoles = ['admin']
      } else if (channel.requiredRole === 'admin') allowedRoles = ['admin']
      else if (channel.requiredRole === 'moderator') allowedRoles = ['admin', 'moderator']
      else if (channel.requiredRole === 'user') allowedRoles = ['admin', 'moderator', 'user']
      else if (channel.requiredRole === 'guest') allowedRoles = ['admin', 'moderator', 'user', 'guest']
      else allowedRoles = ['admin', 'moderator', 'user']
      return {
        id: channel.id,
        name: channel.name,
        topic: channel.topic || channel.description,
        description: channel.description,
        isPrivate: channel.isPrivate,
        isReadOnly: !allowedRoles.some(r => userRoles.includes(r)),
        allowedRoles,
        users: [],
        createdAt: channel.createdAt,
        updatedAt: channel.updatedAt,
        category: channel.category,
        parentId: channel.parentId,
        memberCount: channel._count.members,
        messageCount: channel._count.messages
      }
    })

    return NextResponse.json({ channels: transformedChannels })

  } catch (error) {
    console.error('Error fetching channels:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}