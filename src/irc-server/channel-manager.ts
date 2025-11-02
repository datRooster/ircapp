import { PrismaClient } from '@prisma/client'
import { IRCClient } from './irc-client'

export interface ChannelMember {
  nickname: string
  username: string
  hostname: string
  role: string
  joinedAt: Date
}

export class ChannelManager {
  private prisma: PrismaClient
  private activeChannels: Map<string, Set<string>> = new Map() // channelName -> Set of client IDs

  constructor(prisma: PrismaClient) {
    this.prisma = prisma
  }

  async joinChannel(client: IRCClient, channelName: string, _key?: string): Promise<any> {
    const normalizedName = channelName.toLowerCase()
    
    try {
      // Trova o crea il canale nel database
      let channel = await this.prisma.channel.findUnique({
        where: { name: normalizedName.replace('#', '') }
      })

      if (!channel) {
        // Crea canale automaticamente se non esiste
        channel = await this.prisma.channel.create({
          data: {
            name: normalizedName.replace('#', ''),
            description: `Channel ${channelName}`,
            category: 'GENERAL',
            requiredRole: 'user',
            isPrivate: false,
            createdBy: client.userId || 'system'
          }
        })
      }

      // Permetti sempre l'accesso a #lobby (mai +i)
      if (channel.name === 'lobby') {
        // Nessun blocco
      } else if (!await this.canJoinChannel(client, channel)) {
        client.sendNumeric(473, `${channelName} :Cannot join channel (+i)`)
        return null
      }

      // Controlla se è già nel canale
      if (client.isInChannel(channelName)) {
        return channel
      }

      // Aggiungi al canale attivo
      if (!this.activeChannels.has(normalizedName)) {
        this.activeChannels.set(normalizedName, new Set())
      }
      this.activeChannels.get(normalizedName)!.add(client.id)

      // Aggiorna membership nel database
      await this.prisma.channelMember.upsert({
        where: {
          userId_channelId: {
            userId: client.userId || 'anonymous',
            channelId: channel.id
          }
        },
        update: {
          role: this.getUserRoleInChannel(client, channel),
          canWrite: channel.name === 'lobby' ? (client.hasRole('admin') || client.hasRole('moderator')) : true
        },
        create: {
          userId: client.userId || 'anonymous',
          channelId: channel.id,
          role: this.getUserRoleInChannel(client, channel),
          canWrite: channel.name === 'lobby' ? (client.hasRole('admin') || client.hasRole('moderator')) : true,
          canRead: true,
          canInvite: false,
          canKick: client.hasRole('moderator'),
          canBan: client.hasRole('admin')
        }
      })

      client.joinChannel(channelName)
      
      console.log(`✅ ${client.nickname} joined ${channelName}`)
      return channel

    } catch (error) {
      console.error(`Error joining channel ${channelName}:`, error)
      throw error
    }
  }

  async partChannel(client: IRCClient, channelName: string): Promise<any> {
    const normalizedName = channelName.toLowerCase()

    try {
      const channel = await this.prisma.channel.findUnique({
        where: { name: normalizedName.replace('#', '') }
      })

      if (!channel || !client.isInChannel(channelName)) {
        return null
      }

      // Rimuovi dal canale attivo
      const activeMembers = this.activeChannels.get(normalizedName)
      if (activeMembers) {
        activeMembers.delete(client.id)
        if (activeMembers.size === 0) {
          this.activeChannels.delete(normalizedName)
        }
      }

      // Rimuovi membership dal database (opzionale - potresti voler mantenere la storia)
      // await this.prisma.channelMember.delete({
      //   where: {
      //     userId_channelId: {
      //       userId: client.userId || 'anonymous',
      //       channelId: channel.id
      //     }
      //   }
      // })

      client.partChannel(channelName)
      
      console.log(`👋 ${client.nickname} left ${channelName}`)
      return channel

    } catch (error) {
      console.error(`Error leaving channel ${channelName}:`, error)
      throw error
    }
  }

  async getChannel(channelName: string) {
    const normalizedName = channelName.toLowerCase()
    
    try {
      return await this.prisma.channel.findUnique({
        where: { name: normalizedName.replace('#', '') },
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

  async getPublicChannels() {
    try {
      return await this.prisma.channel.findMany({
        where: {
          isPrivate: false,
          isArchived: false
        },
        select: {
          name: true,
          description: true,
          topic: true,
          category: true,
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
    const normalizedName = channelName.toLowerCase()
    
    try {
      const channel = await this.prisma.channel.findUnique({
        where: { name: normalizedName.replace('#', '') }
      })

      if (!channel) return []

      const members = await this.prisma.channelMember.findMany({
        where: { channelId: channel.id },
        include: {
          user: {
            select: {
              username: true,
              roles: true
            }
          }
        }
      })

      return members.map(member => ({
        nickname: member.user.username,
        username: member.user.username,
        hostname: 'localhost', // TODO: Get real hostname
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

  async canJoinChannel(client: IRCClient, channel: any): Promise<boolean> {
    // Controlli di base
    if (channel.isPrivate && !client.hasRole('admin')) {
      // TODO: Controlla se invitato o ha key
      return false
    }

    // Controlla ruolo richiesto
    switch (channel.requiredRole) {
      case 'admin':
        return client.hasRole('admin')
      case 'moderator':
        return client.isModerator()
      default:
        return true
    }
  }

  async canSetTopic(client: IRCClient, _channelName: string): Promise<boolean> {
    // Solo moderatori e admin possono impostare topic
    return client.isModerator()
  }

  async setTopic(channelName: string, topic: string) {
    const normalizedName = channelName.toLowerCase()
    
    try {
      await this.prisma.channel.update({
        where: { name: normalizedName.replace('#', '') },
        data: { topic }
      })
    } catch (error) {
      console.error(`Error setting topic for ${channelName}:`, error)
      throw error
    }
  }

  private getUserRoleInChannel(client: IRCClient, _channel: any): string {
    if (client.hasRole('admin')) return 'admin'
    if (client.hasRole('moderator')) return 'moderator'
    return 'member'
  }

  // Cleanup methods
  async removeClientFromAllChannels(client: IRCClient) {
    for (const channelName of client.getChannels()) {
      await this.partChannel(client, channelName)
    }
  }

  getActiveChannels(): string[] {
    return Array.from(this.activeChannels.keys())
  }

  getActiveChannelMembers(channelName: string): string[] {
    const normalizedName = channelName.toLowerCase()
    const members = this.activeChannels.get(normalizedName)
    return members ? Array.from(members) : []
  }
}