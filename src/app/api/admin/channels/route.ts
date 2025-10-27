import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    const session = await auth()
    
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Controlla se l'utente è admin o moderatore
    const user = await prisma.user.findUnique({
      where: { id: session.user.id }
    })

    if (!user || !user.roles.some(role => ['admin', 'moderator'].includes(role))) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    // Carica tutti i canali con informazioni aggiuntive
    const channels = await prisma.channel.findMany({
      include: {
        creator: {
          select: {
            username: true,
            roles: true
          }
        },
        parent: {
          select: {
            id: true,
            name: true
          }
        },
        children: {
          select: {
            id: true,
            name: true,
            description: true,
            category: true,
            isPrivate: true,
            isArchived: true
          }
        },
        _count: {
          select: {
            members: true,
            messages: true
          }
        }
      },
      orderBy: [
        { category: 'asc' },
        { name: 'asc' }
      ]
    })

    return NextResponse.json({ channels })

  } catch (error) {
    console.error('Error fetching channels:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id }
    })

    if (!user || !user.roles.some(role => ['admin', 'moderator'].includes(role))) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    const { name, description, category, requiredRole, isPrivate, parentId, maxMembers } = await req.json()

    // Validazioni
    if (!name || name.length < 2) {
      return NextResponse.json({ error: 'Nome canale deve essere di almeno 2 caratteri' }, { status: 400 })
    }

    // Solo admin può creare canali ADMIN
    if (category === 'ADMIN' && !user.roles.includes('admin')) {
      return NextResponse.json({ error: 'Solo gli admin possono creare canali ADMIN' }, { status: 403 })
    }

    // Controlla se il nome canale è già in uso
    const existingChannel = await prisma.channel.findUnique({
      where: { name: name.toLowerCase() }
    })

    if (existingChannel) {
      return NextResponse.json({ error: 'Nome canale già in uso' }, { status: 400 })
    }

    // Verifica canale padre se specificato
    if (parentId) {
      const parentChannel = await prisma.channel.findUnique({
        where: { id: parentId }
      })

      if (!parentChannel) {
        return NextResponse.json({ error: 'Canale padre non trovato' }, { status: 400 })
      }
    }

    // Crea il canale
    const channel = await prisma.channel.create({
      data: {
        name: name.toLowerCase(),
        description,
        category,
        requiredRole,
        isPrivate: isPrivate || false,
        parentId: parentId || null,
        maxMembers: maxMembers || null,
        createdBy: user.id
      },
      include: {
        creator: {
          select: {
            username: true
          }
        },
        _count: {
          select: {
            members: true,
            messages: true
          }
        }
      }
    })

    // Aggiunge automaticamente il creatore come membro con permessi completi
    await prisma.channelMember.create({
      data: {
        userId: user.id,
        channelId: channel.id,
        role: user.roles.includes('admin') ? 'admin' : 'moderator',
        canWrite: true,
        canRead: true,
        canInvite: true,
        canKick: user.roles.includes('admin') || user.roles.includes('moderator'),
        canBan: user.roles.includes('admin')
      }
    })

    console.log(`✅ Channel created: #${channel.name} by ${user.username}`)

    return NextResponse.json({ channel, message: 'Canale creato con successo' })

  } catch (error) {
    console.error('Error creating channel:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const session = await auth()
    
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id }
    })

    if (!user || !user.roles.includes('admin')) {
      return NextResponse.json({ error: 'Solo gli admin possono eliminare canali' }, { status: 403 })
    }

    const { channelId } = await req.json()

    // Non permettere eliminazione del lobby
    if (channelId === 'lobby') {
      return NextResponse.json({ error: 'Non è possibile eliminare il canale lobby' }, { status: 400 })
    }

    // Controlla se il canale esiste
    const channel = await prisma.channel.findUnique({
      where: { id: channelId },
      include: {
        children: true
      }
    })

    if (!channel) {
      return NextResponse.json({ error: 'Canale non trovato' }, { status: 404 })
    }

    // Se ha sottocanali, spostali al livello superiore o eliminali
    if (channel.children.length > 0) {
      await prisma.channel.updateMany({
        where: { parentId: channelId },
        data: { parentId: channel.parentId }
      })
    }

    // Elimina il canale (cascade eliminerà messaggi e membri)
    await prisma.channel.delete({
      where: { id: channelId }
    })

    console.log(`🗑️ Channel deleted: #${channel.name} by ${user.username}`)

    return NextResponse.json({ message: 'Canale eliminato con successo' })

  } catch (error) {
    console.error('Error deleting channel:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const user = await prisma.user.findUnique({ where: { id: session.user.id } })
    if (!user || !user.roles.some(role => ['admin', 'moderator'].includes(role))) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }
    const { channelId, description, category, requiredRole, isPrivate, parentId, maxMembers } = await req.json()
    // Solo admin può modificare canali ADMIN
    if (category === 'ADMIN' && !user.roles.includes('admin')) {
      return NextResponse.json({ error: 'Solo gli admin possono modificare canali ADMIN' }, { status: 403 })
    }
    // Aggiorna il canale
    const updated = await prisma.channel.update({
      where: { id: channelId },
      data: {
        description,
        category,
        requiredRole,
        isPrivate,
        parentId: parentId || null,
        maxMembers: maxMembers || null
      }
    })
    return NextResponse.json({ channel: updated, message: 'Canale aggiornato con successo' })
  } catch (error) {
    console.error('Error updating channel:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}