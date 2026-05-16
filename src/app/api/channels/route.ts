import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'

export async function GET() {
  try {
    const session = await auth()
    const isGuest = typeof session?.user === 'undefined'
    const now = new Date()
    // guestParam: fallback solo su sessione
    // Se guest, mostra solo guest/help
    if (isGuest) {
      const channels = await prisma.channel.findMany({
        where: {
          isArchived: false,
          AND: [
            {
              OR: [
                { expiresAt: null },
                { expiresAt: { gt: now } }
              ]
            },
            {
              OR: [
                { category: 'GUEST' },
                { category: 'HELP' }
              ]
            }
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
        inviteOnly: channel.inviteOnly,
        isTemporary: channel.isTemporary,
        expiresAt: channel.expiresAt,
        requiredRole: channel.requiredRole,
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
      select: {
        roles: true,
        primaryRole: true,
        channelMembers: {
          select: {
            channelId: true
          }
        }
      }
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Carica canali in base ai permessi dell'utente
    const userRoles = user.roles
    // const isAdmin = userRoles.includes('admin')
    // const isModerator = userRoles.includes('moderator')


    // Tutti vedono tutti i canali non archiviati
    const memberChannelIds = user.channelMembers.map((member) => member.channelId)

    const channels = await prisma.channel.findMany({
      where: {
        isArchived: false,
        AND: [
          {
            OR: [
              { expiresAt: null },
              { expiresAt: { gt: now } }
            ]
          },
          userRoles.includes('admin') || userRoles.includes('moderator')
            ? {}
            : {
                OR: [
                  { isPrivate: false },
                  ...(memberChannelIds.length > 0 ? [{ id: { in: memberChannelIds } }] : [])
                ]
              }
        ]
      },
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
      if (channel.id === 'lobby' || channel.name === 'lobby') {
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
        inviteOnly: channel.inviteOnly,
        isTemporary: channel.isTemporary,
        expiresAt: channel.expiresAt,
        requiredRole: channel.requiredRole,
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

export async function POST(req: NextRequest) {
  try {
    const session = await auth()

    if (!session?.user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        id: true,
        username: true,
        roles: true
      }
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const body = await req.json()
    const {
      name,
      description,
      isPrivate = false,
      inviteOnly = false,
      isTemporary = true,
      ttlMinutes,
      requiredRole = 'user',
      maxMembers,
      channelPassword
    } = body

    const normalizedName = String(name || '').trim().toLowerCase().replace(/^#/, '')
    if (normalizedName.length < 2 || !/^[a-z0-9_-]+$/.test(normalizedName)) {
      return NextResponse.json({ error: 'Invalid channel name' }, { status: 400 })
    }

    const normalizedRoles = user.roles.map((role) => role.toLowerCase())
    const isAdmin = normalizedRoles.includes('admin')
    const isModerator = normalizedRoles.includes('moderator')
    const isGuest = normalizedRoles.includes('guest') && !isAdmin && !isModerator

    if (isGuest) {
      return NextResponse.json({ error: 'Guests cannot create channels' }, { status: 403 })
    }

    if (!isAdmin && !isModerator) {
      if (isPrivate || inviteOnly || !isTemporary || requiredRole !== 'user') {
        return NextResponse.json({
          error: 'Members can create only public temporary channels'
        }, { status: 403 })
      }
    }

    if (!isAdmin && requiredRole === 'admin') {
      return NextResponse.json({ error: 'Only admins can create admin-only channels' }, { status: 403 })
    }

    const existingChannel = await prisma.channel.findUnique({
      where: { name: normalizedName },
      select: { id: true, isArchived: true }
    })

    if (existingChannel && !existingChannel.isArchived) {
      return NextResponse.json({ error: 'Channel name already in use' }, { status: 400 })
    }

    const resolvedCategory = isPrivate
      ? 'PRIVATE'
      : requiredRole === 'admin'
        ? 'ADMIN'
        : requiredRole === 'moderator'
          ? 'MODERATION'
          : requiredRole === 'guest'
            ? 'GUEST'
            : 'GENERAL'

    const expiresAt = isTemporary
      ? new Date(Date.now() + Math.max(Number(ttlMinutes) || 720, 5) * 60 * 1000)
      : null

    const channel = await prisma.channel.create({
      data: {
        name: normalizedName,
        description: description?.trim() || `Channel #${normalizedName}`,
        category: resolvedCategory,
        requiredRole,
        isPrivate,
        inviteOnly,
        isTemporary,
        expiresAt,
        maxMembers: maxMembers ? Number(maxMembers) : null,
        channelKeyHash: channelPassword ? await bcrypt.hash(channelPassword, 10) : null,
        createdBy: user.id
      },
      include: {
        _count: {
          select: {
            members: true,
            messages: true
          }
        }
      }
    })

    await prisma.channelMember.create({
      data: {
        userId: user.id,
        channelId: channel.id,
        role: isAdmin ? 'admin' : isModerator ? 'moderator' : 'owner',
        canRead: true,
        canWrite: true,
        canInvite: true,
        canKick: isAdmin || isModerator,
        canBan: isAdmin
      }
    })

    return NextResponse.json({
      success: true,
      channel: {
        id: channel.id,
        name: channel.name,
        topic: channel.topic || channel.description,
        description: channel.description,
        isPrivate: channel.isPrivate,
        inviteOnly: channel.inviteOnly,
        isTemporary: channel.isTemporary,
        expiresAt: channel.expiresAt,
        requiredRole: channel.requiredRole,
        isReadOnly: false,
        allowedRoles: requiredRole === 'admin'
          ? ['admin']
          : requiredRole === 'moderator'
            ? ['admin', 'moderator']
            : requiredRole === 'guest'
              ? ['admin', 'moderator', 'user', 'guest']
              : ['admin', 'moderator', 'user'],
        users: [],
        createdAt: channel.createdAt,
        updatedAt: channel.updatedAt,
        category: channel.category,
        parentId: channel.parentId,
        memberCount: channel._count.members,
        messageCount: channel._count.messages
      }
    })
  } catch (error) {
    console.error('Error creating channel from web UI:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
