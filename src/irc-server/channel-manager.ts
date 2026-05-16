import bcrypt from 'bcryptjs'
import { PrismaClient, Channel, ChannelCategory, ChannelMember as PrismaChannelMember } from '@prisma/client'
import { IRCClient } from './irc-client'

export interface ChannelMember {
  nickname: string
  username: string
  hostname: string
  role: string
  joinedAt: Date
}

type JoinDecision =
  | { allowed: true; existingMembership: PrismaChannelMember | null }
  | { allowed: false; numeric: number; message: string }

interface CreateChannelOptions {
  isPrivate?: boolean
  inviteOnly?: boolean
  isTemporary?: boolean
  ttlMinutes?: number | null
  requiredRole?: string
  description?: string
  topic?: string
  maxMembers?: number | null
  category?: ChannelCategory
  channelKey?: string | null
}

export class ChannelManager {
  private prisma: PrismaClient
  private activeChannels: Map<string, Set<string>> = new Map()

  constructor(prisma: PrismaClient) {
    this.prisma = prisma
  }

  private normalizeChannelName(channelName: string) {
    return channelName.toLowerCase()
  }

  private stripChannelPrefix(channelName: string) {
    return this.normalizeChannelName(channelName).replace(/^#/, '')
  }

  private getChannelLabel(channelName: string) {
    return channelName.startsWith('#') ? channelName : `#${channelName}`
  }

  private getDefaultTemporaryDurationMinutes() {
    const raw = Number(process.env.IRC_TEMP_CHANNEL_TTL_MINUTES || 720)
    return Number.isFinite(raw) && raw > 0 ? raw : 720
  }

  private getExpiryDate(ttlMinutes?: number | null) {
    const ttl = ttlMinutes && ttlMinutes > 0 ? ttlMinutes : this.getDefaultTemporaryDurationMinutes()
    return new Date(Date.now() + ttl * 60 * 1000)
  }

  private roleMatches(client: IRCClient, requiredRole: string) {
    switch ((requiredRole || 'user').toLowerCase()) {
      case 'guest':
        return true
      case 'user':
        return !client.roles.includes('guest')
      case 'moderator':
        return client.isModerator()
      case 'admin':
        return client.isAdmin()
      default:
        return true
    }
  }

  private getDefaultCategory(isPrivate: boolean, requiredRole: string): ChannelCategory {
    if (isPrivate) return 'PRIVATE'
    if (requiredRole === 'admin') return 'ADMIN'
    if (requiredRole === 'moderator') return 'MODERATION'
    if (requiredRole === 'guest') return 'GUEST'
    return 'GENERAL'
  }

  private getUserRoleInChannel(client: IRCClient, channel: Channel): string {
    if (client.userId && channel.createdBy === client.userId) return 'owner'
    if (client.hasRole('admin')) return 'admin'
    if (client.hasRole('moderator')) return 'moderator'
    return 'member'
  }

  private async archiveExpiredChannels() {
    await this.prisma.channel.updateMany({
      where: {
        isArchived: false,
        isTemporary: true,
        expiresAt: {
          lte: new Date()
        }
      },
      data: {
        isArchived: true
      }
    })
  }

  private async getMembership(userId: string | undefined, channelId: string) {
    if (!userId) {
      return null
    }

    return this.prisma.channelMember.findUnique({
      where: {
        userId_channelId: {
          userId,
          channelId
        }
      }
    })
  }

  private async canCreateChannel(client: IRCClient, options: CreateChannelOptions) {
    const requiredRole = (options.requiredRole || 'user').toLowerCase()
    const wantsPrivate = !!options.isPrivate
    const wantsInviteOnly = !!options.inviteOnly
    const wantsPermanent = !options.isTemporary

    if (client.roles.includes('guest')) {
      return { allowed: false, reason: 'Gli ospiti non possono creare canali.' }
    }

    if (client.isAdmin()) {
      return { allowed: true as const }
    }

    if (client.isModerator()) {
      if (requiredRole === 'admin') {
        return { allowed: false, reason: 'Solo gli admin possono creare canali riservati agli admin.' }
      }

      return { allowed: true as const }
    }

    if (wantsPrivate || wantsInviteOnly || wantsPermanent || requiredRole !== 'user') {
      return {
        allowed: false,
        reason: 'I membri possono creare solo canali pubblici temporanei.'
      }
    }

    return { allowed: true as const }
  }

  private async ensureMembershipForJoin(client: IRCClient, channel: Channel) {
    const role = this.getUserRoleInChannel(client, channel)
    const canWrite = channel.name === 'lobby'
      ? client.hasRole('admin') || client.hasRole('moderator')
      : this.roleMatches(client, channel.requiredRole)

    await this.prisma.channelMember.upsert({
      where: {
        userId_channelId: {
          userId: client.userId || 'anonymous',
          channelId: channel.id
        }
      },
      update: {
        role,
        canRead: true,
        canWrite,
        canInvite: role === 'owner' || client.isModerator(),
        canKick: role === 'owner' || client.isModerator(),
        canBan: role === 'owner' || client.isAdmin()
      },
      create: {
        userId: client.userId || 'anonymous',
        channelId: channel.id,
        role,
        canRead: true,
        canWrite,
        canInvite: role === 'owner' || client.isModerator(),
        canKick: role === 'owner' || client.isModerator(),
        canBan: role === 'owner' || client.isAdmin()
      }
    })
  }

  private async canJoinChannel(client: IRCClient, channel: Channel, providedKey?: string): Promise<JoinDecision> {
    if (channel.isArchived) {
      return { allowed: false, numeric: 403, message: 'Channel archiviato o scaduto' }
    }

    if (!this.roleMatches(client, channel.requiredRole)) {
      return { allowed: false, numeric: 473, message: `Accesso limitato ai ruoli ${channel.requiredRole}+` }
    }

    const existingMembership = await this.getMembership(client.userId, channel.id)
    const isPrivileged = client.isAdmin() || client.isModerator()

    if (channel.maxMembers) {
      const memberCount = await this.prisma.channelMember.count({
        where: { channelId: channel.id }
      })

      if (memberCount >= channel.maxMembers && !existingMembership && !isPrivileged) {
        return { allowed: false, numeric: 471, message: 'Canale pieno' }
      }
    }

    const hasValidKey = channel.channelKeyHash && providedKey
      ? await bcrypt.compare(providedKey, channel.channelKeyHash)
      : false

    if (channel.inviteOnly && !existingMembership && !isPrivileged && !hasValidKey) {
      return { allowed: false, numeric: 473, message: 'Canale solo su invito (+i)' }
    }

    if ((channel.isPrivate || channel.channelKeyHash) && !existingMembership && !isPrivileged && !hasValidKey) {
      return { allowed: false, numeric: 475, message: 'Password canale non valida o accesso privato (+k/+p)' }
    }

    return { allowed: true, existingMembership }
  }

  async createChannel(client: IRCClient, channelName: string, options: CreateChannelOptions = {}) {
    await this.archiveExpiredChannels()

    const normalizedName = this.stripChannelPrefix(channelName)
    const label = this.getChannelLabel(channelName)

    const existing = await this.prisma.channel.findUnique({
      where: { name: normalizedName }
    })

    if (existing && !existing.isArchived) {
      throw new Error(`Il canale ${label} esiste già`)
    }

    const permission = await this.canCreateChannel(client, options)
    if (!permission.allowed) {
      throw new Error(permission.reason)
    }

    const requiredRole = (options.requiredRole || 'user').toLowerCase()
    const isPrivate = !!options.isPrivate
    const inviteOnly = !!options.inviteOnly
    const isTemporary = options.isTemporary ?? !client.isModerator()
    const expiresAt = isTemporary ? this.getExpiryDate(options.ttlMinutes) : null
    const channelKeyHash = options.channelKey ? await bcrypt.hash(options.channelKey, 10) : null

    const channel = await this.prisma.channel.create({
      data: {
        name: normalizedName,
        topic: options.topic || null,
        description: options.description || `Channel ${label}`,
        isPrivate,
        inviteOnly,
        channelKeyHash,
        isTemporary,
        expiresAt,
        category: options.category || this.getDefaultCategory(isPrivate, requiredRole),
        createdBy: client.userId || 'system',
        maxMembers: options.maxMembers || null,
        requiredRole
      }
    })

    await this.prisma.channelMember.create({
      data: {
        userId: client.userId || 'anonymous',
        channelId: channel.id,
        role: 'owner',
        canRead: true,
        canWrite: true,
        canInvite: true,
        canKick: true,
        canBan: client.isAdmin()
      }
    })

    return channel
  }

  async joinChannel(client: IRCClient, channelName: string, key?: string): Promise<Channel | null> {
    const normalizedName = this.normalizeChannelName(channelName)

    await this.archiveExpiredChannels()

    try {
      let channel = await this.prisma.channel.findUnique({
        where: { name: this.stripChannelPrefix(channelName) }
      })

      if (!channel) {
        if (client.roles.includes('guest')) {
          client.sendNumeric(482, `${channelName} :Gli ospiti non possono creare nuovi canali`)
          return null
        }

        channel = await this.createChannel(client, channelName, {
          isPrivate: false,
          inviteOnly: false,
          isTemporary: true,
          requiredRole: 'user',
          description: `Canale temporaneo creato da ${client.nickname}`
        })
      }

      const access = await this.canJoinChannel(client, channel, key)
      if (!access.allowed) {
        client.sendNumeric(access.numeric, `${channelName} :${access.message}`)
        return null
      }

      if (client.isInChannel(channelName)) {
        return channel
      }

      if (!this.activeChannels.has(normalizedName)) {
        this.activeChannels.set(normalizedName, new Set())
      }
      this.activeChannels.get(normalizedName)!.add(client.id)

      await this.ensureMembershipForJoin(client, channel)
      client.joinChannel(channelName)

      console.log(`✅ ${client.nickname} joined ${channelName}`)
      return channel
    } catch (error) {
      console.error(`Error joining channel ${channelName}:`, error)
      throw error
    }
  }

  async partChannel(client: IRCClient, channelName: string): Promise<Channel | null> {
    const normalizedName = this.normalizeChannelName(channelName)

    try {
      const channel = await this.prisma.channel.findUnique({
        where: { name: this.stripChannelPrefix(channelName) }
      })

      if (!channel || !client.isInChannel(channelName)) {
        return null
      }

      const activeMembers = this.activeChannels.get(normalizedName)
      if (activeMembers) {
        activeMembers.delete(client.id)
        if (activeMembers.size === 0) {
          this.activeChannels.delete(normalizedName)
        }
      }

      client.partChannel(channelName)

      console.log(`👋 ${client.nickname} left ${channelName}`)
      return channel
    } catch (error) {
      console.error(`Error leaving channel ${channelName}:`, error)
      throw error
    }
  }

  async getChannel(channelName: string) {
    await this.archiveExpiredChannels()

    try {
      return await this.prisma.channel.findUnique({
        where: { name: this.stripChannelPrefix(channelName) },
        include: {
          _count: {
            select: {
              members: true,
              messages: true
            }
          }
        }
      })
    } catch (error) {
      console.error(`Error getting channel ${channelName}:`, error)
      return null
    }
  }

  async getPublicChannels(viewer?: IRCClient) {
    await this.archiveExpiredChannels()

    try {
      const membershipIds = viewer?.userId
        ? await this.prisma.channelMember.findMany({
            where: { userId: viewer.userId },
            select: { channelId: true }
          })
        : []

      const visibleIds = new Set(membershipIds.map((member) => member.channelId))
      const where = viewer?.isAdmin() || viewer?.isModerator()
        ? { isArchived: false }
        : {
            isArchived: false,
            OR: [
              { isPrivate: false },
              ...(visibleIds.size > 0 ? [{ id: { in: Array.from(visibleIds) } }] : [])
            ]
          }

      return await this.prisma.channel.findMany({
        where,
        select: {
          id: true,
          name: true,
          description: true,
          topic: true,
          category: true,
          inviteOnly: true,
          isPrivate: true,
          isTemporary: true,
          expiresAt: true,
          requiredRole: true,
          _count: {
            select: {
              members: true
            }
          }
        },
        orderBy: {
          name: 'asc'
        }
      })
    } catch (error) {
      console.error('Error getting public channels:', error)
      return []
    }
  }

  async getChannelMembers(channelName: string): Promise<ChannelMember[]> {
    await this.archiveExpiredChannels()

    try {
      const channel = await this.prisma.channel.findUnique({
        where: { name: this.stripChannelPrefix(channelName) }
      })

      if (!channel) return []

      const members = await this.prisma.channelMember.findMany({
        where: { channelId: channel.id },
        include: {
          user: {
            select: {
              username: true
            }
          }
        },
        orderBy: [
          { role: 'asc' },
          { joinedAt: 'asc' }
        ]
      })

      return members.map((member) => ({
        nickname: member.user.username,
        username: member.user.username,
        hostname: 'localhost',
        role: member.role,
        joinedAt: member.joinedAt
      }))
    } catch (error) {
      console.error(`Error getting channel members for ${channelName}:`, error)
      return []
    }
  }

  async getChannelMemberCount(channelName: string): Promise<number> {
    const members = await this.getChannelMembers(channelName)
    return members.length
  }

  async isUserInChannel(client: IRCClient, channelName: string): Promise<boolean> {
    return client.isInChannel(channelName)
  }

  async canWriteToChannel(client: IRCClient, channelName: string) {
    const channel = await this.prisma.channel.findUnique({
      where: { name: this.stripChannelPrefix(channelName) }
    })

    if (!channel) {
      return false
    }

    if (client.isAdmin() || client.isModerator()) {
      return true
    }

    const membership = await this.getMembership(client.userId, channel.id)
    return membership?.canWrite ?? false
  }

  async canSetTopic(client: IRCClient, channelName: string): Promise<boolean> {
    const channel = await this.prisma.channel.findUnique({
      where: { name: this.stripChannelPrefix(channelName) }
    })

    if (!channel) return false
    if (client.isAdmin() || client.isModerator()) return true
    return !!client.userId && channel.createdBy === client.userId
  }

  async setTopic(channelName: string, topic: string) {
    try {
      await this.prisma.channel.update({
        where: { name: this.stripChannelPrefix(channelName) },
        data: { topic }
      })
    } catch (error) {
      console.error(`Error setting topic for ${channelName}:`, error)
      throw error
    }
  }

  async inviteUser(inviter: IRCClient, targetNickname: string, channelName: string) {
    const channel = await this.prisma.channel.findUnique({
      where: { name: this.stripChannelPrefix(channelName) }
    })

    if (!channel) {
      throw new Error('Canale non trovato')
    }

    const membership = await this.getMembership(inviter.userId, channel.id)
    const canInvite = inviter.isAdmin() || inviter.isModerator() || membership?.canInvite || channel.createdBy === inviter.userId

    if (!canInvite) {
      throw new Error('Non hai i permessi per invitare utenti in questo canale')
    }

    const targetUser = await this.prisma.user.upsert({
      where: { username: targetNickname },
      update: {
        lastSeen: new Date()
      },
      create: {
        username: targetNickname,
        name: targetNickname,
        roles: ['user']
      }
    })

    await this.prisma.channelMember.upsert({
      where: {
        userId_channelId: {
          userId: targetUser.id,
          channelId: channel.id
        }
      },
      update: {
        canRead: true,
        canWrite: true
      },
      create: {
        userId: targetUser.id,
        channelId: channel.id,
        role: 'member',
        canRead: true,
        canWrite: true,
        canInvite: false,
        canKick: false,
        canBan: false
      }
    })
  }

  async canManageChannel(client: IRCClient, channelName: string) {
    const channel = await this.prisma.channel.findUnique({
      where: { name: this.stripChannelPrefix(channelName) }
    })

    if (!channel) return false
    if (client.isAdmin() || client.isModerator()) return true
    return !!client.userId && channel.createdBy === client.userId
  }

  async setInviteOnly(channelName: string, enabled: boolean) {
    return this.prisma.channel.update({
      where: { name: this.stripChannelPrefix(channelName) },
      data: { inviteOnly: enabled }
    })
  }

  async setPrivateVisibility(channelName: string, enabled: boolean) {
    return this.prisma.channel.update({
      where: { name: this.stripChannelPrefix(channelName) },
      data: {
        isPrivate: enabled,
        category: enabled ? 'PRIVATE' : 'GENERAL'
      }
    })
  }

  async setChannelKey(channelName: string, password: string) {
    const hash = await bcrypt.hash(password, 10)
    return this.prisma.channel.update({
      where: { name: this.stripChannelPrefix(channelName) },
      data: { channelKeyHash: hash }
    })
  }

  async clearChannelKey(channelName: string) {
    return this.prisma.channel.update({
      where: { name: this.stripChannelPrefix(channelName) },
      data: { channelKeyHash: null }
    })
  }

  async setTemporaryChannel(channelName: string, ttlMinutes?: number | null) {
    return this.prisma.channel.update({
      where: { name: this.stripChannelPrefix(channelName) },
      data: {
        isTemporary: true,
        expiresAt: this.getExpiryDate(ttlMinutes)
      }
    })
  }

  async persistChannel(channelName: string) {
    return this.prisma.channel.update({
      where: { name: this.stripChannelPrefix(channelName) },
      data: {
        isTemporary: false,
        expiresAt: null
      }
    })
  }

  async getChannelModes(channelName: string) {
    const channel = await this.prisma.channel.findUnique({
      where: { name: this.stripChannelPrefix(channelName) }
    })

    if (!channel) {
      throw new Error('Canale non trovato')
    }

    let modes = '+n'
    if (channel.isPrivate) modes += 'p'
    if (channel.inviteOnly) modes += 'i'
    if (channel.channelKeyHash) modes += 'k'
    if (channel.isTemporary) modes += 'T'

    return {
      channel,
      modes
    }
  }

  async removeClientFromAllChannels(client: IRCClient) {
    for (const channelName of client.getChannels()) {
      await this.partChannel(client, channelName)
    }
  }

  getActiveChannels(): string[] {
    return Array.from(this.activeChannels.keys())
  }

  getActiveChannelMembers(channelName: string): string[] {
    const members = this.activeChannels.get(this.normalizeChannelName(channelName))
    return members ? Array.from(members) : []
  }
}
