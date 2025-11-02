import { PrismaClient } from '@prisma/client'
import { IRCClient } from './irc-client'

export class UserManager {
  private prisma: PrismaClient
  private clients: Map<string, IRCClient> = new Map() // nickname -> client
  private nicknames: Map<string, string> = new Map() // clientId -> nickname

  constructor(prisma: PrismaClient) {
    this.prisma = prisma
  }

  addClient(client: IRCClient) {
    if (client.nickname) {
      this.clients.set(client.nickname.toLowerCase(), client)
      this.nicknames.set(client.id, client.nickname.toLowerCase())
    }
  }

  removeClient(client: IRCClient) {
    if (client.nickname) {
      this.clients.delete(client.nickname.toLowerCase())
    }
    this.nicknames.delete(client.id)
  }

  updateNickname(client: IRCClient, oldNick: string | undefined, newNick: string) {
    // Rimuovi vecchio nickname se presente
    if (oldNick) {
      this.clients.delete(oldNick.toLowerCase())
    }
    
    // Aggiungi nuovo nickname
    this.clients.set(newNick.toLowerCase(), client)
    this.nicknames.set(client.id, newNick.toLowerCase())
  }

  getClientByNickname(nickname: string): IRCClient | undefined {
    return this.clients.get(nickname.toLowerCase())
  }

  getClientById(id: string): IRCClient | undefined {
    const nickname = this.nicknames.get(id)
    if (nickname) {
      return this.clients.get(nickname)
    }
    return undefined
  }

  isNicknameInUse(nickname: string): boolean {
    return this.clients.has(nickname.toLowerCase())
  }

  getAllConnectedUsers(): IRCClient[] {
    return Array.from(this.clients.values())
  }

  getConnectedUserCount(): number {
    return this.clients.size
  }

  getNicknameByClientId(clientId: string): string | undefined {
    return this.nicknames.get(clientId)
  }

  // Database operations
  async authenticateUser(nickname: string, _password?: string): Promise<any> {
    try {
      const user = await this.prisma.user.findUnique({
        where: { username: nickname },
        select: {
          id: true,
          username: true,
          password: true,
          roles: true,
          primaryRole: true,
          isBanned: true,
          bannedUntil: true
        }
      })

      if (!user) {
        return null // User doesn't exist
      }

      if (user.isBanned) {
        const now = new Date()
        if (user.bannedUntil && user.bannedUntil > now) {
          throw new Error(`User is banned until ${user.bannedUntil}`)
        } else if (user.isBanned && !user.bannedUntil) {
          throw new Error('User is permanently banned')
        }
      }

      // For IRC, we might want to allow passwordless login for registered users
      // or implement a different auth mechanism
      return user

    } catch (error) {
      console.error('Error authenticating user:', error)
      throw error
    }
  }

  async updateUserLastSeen(userId: string) {
    try {
      await this.prisma.user.update({
        where: { id: userId },
        data: { 
          lastSeen: new Date(),
          isOnline: true
        }
      })
    } catch (error) {
      console.error('Error updating user last seen:', error)
    }
  }

  async setUserOffline(userId: string) {
    try {
      await this.prisma.user.update({
        where: { id: userId },
        data: { isOnline: false }
      })
    } catch (error) {
      console.error('Error setting user offline:', error)
    }
  }

  // IRC specific operations
  async getUserInfo(nickname: string) {
    try {
      const user = await this.prisma.user.findUnique({
        where: { username: nickname },
        select: {
          id: true,
          username: true,
          email: true,
          roles: true,
          createdAt: true,
          lastSeen: true,
          isOnline: true
        }
      })

      return user
    } catch (error) {
      console.error('Error getting user info:', error)
      return null
    }
  }

  async getUserChannels(nickname: string): Promise<string[]> {
    try {
      const user = await this.prisma.user.findUnique({
        where: { username: nickname },
        include: {
          channelMembers: {
            include: {
              channel: {
                select: {
                  name: true
                }
              }
            }
          }
        }
      })

      if (!user) return []

      return user.channelMembers.map(member => `#${member.channel.name}`)
    } catch (error) {
      console.error('Error getting user channels:', error)
      return []
    }
  }

  // Admin operations
  async banUser(nickname: string, reason?: string, duration?: number) {
    try {
      const banUntil = duration ? new Date(Date.now() + duration * 1000) : null

      await this.prisma.user.update({
        where: { username: nickname },
        data: {
          isBanned: true,
          banReason: reason,
          bannedUntil: banUntil
        }
      })

      // Disconnect user if online
      const client = this.getClientByNickname(nickname)
      if (client) {
        client.send(`ERROR :You have been banned${reason ? `: ${reason}` : ''}`)
        client.disconnect()
      }

      console.log(`🔨 User ${nickname} banned${reason ? ` for: ${reason}` : ''}`)
    } catch (error) {
      console.error('Error banning user:', error)
      throw error
    }
  }

  async unbanUser(nickname: string) {
    try {
      await this.prisma.user.update({
        where: { username: nickname },
        data: {
          isBanned: false,
          banReason: null,
          bannedUntil: null
        }
      })

      console.log(`✅ User ${nickname} unbanned`)
    } catch (error) {
      console.error('Error unbanning user:', error)
      throw error
    }
  }

  async promoteUser(nickname: string, role: 'moderator' | 'admin') {
    try {
      const user = await this.prisma.user.findUnique({
        where: { username: nickname },
        select: { roles: true }
      })

      if (!user) {
        throw new Error('User not found')
      }

      const newRoles = [...user.roles]
      if (!newRoles.includes(role)) {
        newRoles.push(role)
      }

      await this.prisma.user.update({
        where: { username: nickname },
        data: {
          roles: newRoles,
          primaryRole: role === 'admin' ? 'ADMIN' : 'MODERATOR'
        }
      })

      // Update client roles if online
      const client = this.getClientByNickname(nickname)
      if (client) {
        client.roles = newRoles
      }

      console.log(`⬆️ User ${nickname} promoted to ${role}`)
    } catch (error) {
      console.error('Error promoting user:', error)
      throw error
    }
  }

  async demoteUser(nickname: string, role: 'moderator' | 'admin') {
    try {
      const user = await this.prisma.user.findUnique({
        where: { username: nickname },
        select: { roles: true }
      })

      if (!user) {
        throw new Error('User not found')
      }

      const newRoles = user.roles.filter(r => r !== role)
      const primaryRole = newRoles.includes('admin') ? 'ADMIN' : 
                         newRoles.includes('moderator') ? 'MODERATOR' : 'USER'

      await this.prisma.user.update({
        where: { username: nickname },
        data: {
          roles: newRoles,
          primaryRole
        }
      })

      // Update client roles if online
      const client = this.getClientByNickname(nickname)
      if (client) {
        client.roles = newRoles
      }

      console.log(`⬇️ User ${nickname} demoted from ${role}`)
    } catch (error) {
      console.error('Error demoting user:', error)
      throw error
    }
  }

  // Statistics
  getStatistics() {
    return {
      connectedUsers: this.getConnectedUserCount(),
      totalClients: this.clients.size,
      nicknames: Array.from(this.clients.keys())
    }
  }

  // Cleanup
  async cleanup() {
    // Set all currently tracked users as offline
    const connectedUsers = this.getAllConnectedUsers()
    for (const client of connectedUsers) {
      if (client.userId) {
        await this.setUserOffline(client.userId)
      }
    }
    
    this.clients.clear()
    this.nicknames.clear()
  }
}