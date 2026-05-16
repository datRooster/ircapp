import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'
import { IRCClient } from './irc-client'

type IRCAuthResult =
  | { status: 'guest' }
  | { status: 'ok'; user: { id: string; username: string; password: string | null; roles: string[]; primaryRole: string; isBanned: boolean; bannedUntil: Date | null } }
  | { status: 'missing-password'; user: { username: string } }
  | { status: 'invalid-password'; user: { username: string } }

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
  async authenticateUser(nickname: string, password?: string): Promise<IRCAuthResult> {
    try {
      const user = await this.prisma.user.findUnique({
        where: { username: nickname },
        select: {
          id: true,
          username: true,
          email: true,
          password: true,
          roles: true,
          primaryRole: true,
          isBanned: true,
          bannedUntil: true
        }
      })

      if (!user) {
        return { status: 'guest' } // User doesn't exist
      }

      if (user.isBanned) {
        const now = new Date()
        if (user.bannedUntil && user.bannedUntil > now) {
          throw new Error(`User is banned until ${user.bannedUntil}`)
        } else if (user.isBanned && !user.bannedUntil) {
          throw new Error('User is permanently banned')
        }
      }

      const hasExternalIdentity = !!user.email
      const isServiceUser = ['webapp', 'system'].includes(user.username.toLowerCase())

      if (user.password) {
        if (!password) {
          return { status: 'missing-password', user: { username: user.username } }
        }

        const isValid = await bcrypt.compare(password, user.password)
        if (!isValid) {
          return { status: 'invalid-password', user: { username: user.username } }
        }

        return { status: 'ok', user }
      }

      // Account creati solo come placeholder IRC possono continuare a collegarsi senza PASS.
      // Per account reali web/OAuth richiediamo invece una credenziale vera per evitare impersonation.
      if (!hasExternalIdentity || isServiceUser) {
        return { status: 'ok', user }
      }

      return { status: 'missing-password', user: { username: user.username } }

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

  async registerNickname(nickname: string, password: string, email?: string | null) {
    const normalizedNickname = nickname.trim()
    const normalizedEmail = email?.trim() || null

    if (normalizedNickname.length < 3) {
      throw new Error('Username deve essere di almeno 3 caratteri')
    }

    if (password.length < 6) {
      throw new Error('Password deve essere di almeno 6 caratteri')
    }

    const existingUser = await this.prisma.user.findUnique({
      where: { username: normalizedNickname },
      select: {
        id: true,
        username: true,
        email: true,
        password: true,
        roles: true,
        primaryRole: true
      }
    })

    if (existingUser?.password) {
      throw new Error('Questo nickname è già registrato')
    }

    if (normalizedEmail) {
      const emailOwner = await this.prisma.user.findUnique({
        where: { email: normalizedEmail },
        select: { id: true }
      })

      if (emailOwner && emailOwner.id !== existingUser?.id) {
        throw new Error('Questa email è già associata a un altro account')
      }
    }

    const hashedPassword = await bcrypt.hash(password, 10)
    const nextRoles = existingUser
      ? Array.from(new Set([...existingUser.roles.filter((role) => role !== 'guest'), 'user']))
      : ['user']
    const nextPrimaryRole = nextRoles.includes('admin')
      ? 'ADMIN'
      : nextRoles.includes('moderator')
        ? 'MODERATOR'
        : 'USER'

    const user = existingUser
      ? await this.prisma.user.update({
          where: { id: existingUser.id },
          data: {
            password: hashedPassword,
            email: normalizedEmail,
            name: normalizedNickname,
            roles: nextRoles,
            primaryRole: nextPrimaryRole
          },
          select: {
            id: true,
            username: true,
            email: true,
            roles: true,
            primaryRole: true
          }
        })
      : await this.prisma.user.create({
          data: {
            username: normalizedNickname,
            email: normalizedEmail,
            password: hashedPassword,
            name: normalizedNickname,
            roles: nextRoles,
            primaryRole: nextPrimaryRole
          },
          select: {
            id: true,
            username: true,
            email: true,
            roles: true,
            primaryRole: true
          }
        })

    return user
  }

  async loginUser(username: string, password: string) {
    const authResult = await this.authenticateUser(username, password)

    if (authResult.status === 'missing-password') {
      throw new Error('Password richiesta per questo account')
    }

    if (authResult.status === 'invalid-password') {
      throw new Error('Password non valida')
    }

    if (authResult.status === 'guest') {
      throw new Error('Account non trovato')
    }

    await this.updateUserLastSeen(authResult.user.id)
    return authResult.user
  }

  async getOrCreatePlaceholderUser(nickname: string) {
    const existingUser = await this.prisma.user.findUnique({
      where: { username: nickname },
      select: {
        id: true,
        email: true,
        password: true,
        roles: true,
        primaryRole: true
      }
    })

    if (existingUser) {
      const isGuestPlaceholder =
        !existingUser.email &&
        !existingUser.password &&
        !existingUser.roles.some((role) => ['admin', 'moderator'].includes(role))

      return this.prisma.user.update({
        where: { id: existingUser.id },
        data: {
          name: nickname,
          isOnline: true,
          lastSeen: new Date(),
          ...(isGuestPlaceholder
            ? {
                roles: existingUser.roles.includes('user') ? existingUser.roles : ['guest'],
                primaryRole: existingUser.primaryRole || 'USER'
              }
            : {})
        }
      })
    }

    return this.prisma.user.create({
      data: {
        username: nickname,
        name: nickname,
        password: null,
        email: null,
        isOnline: true,
        roles: ['guest'],
        primaryRole: 'USER'
      }
    })
  }

  async syncConfiguredAdmins() {
    const configuredAdmins = (process.env.IRC_SERVER_ADMINS || '')
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean)

    if (configuredAdmins.length === 0) {
      return []
    }

    const synced: string[] = []

    for (const username of configuredAdmins) {
      const user = await this.prisma.user.upsert({
        where: { username },
        update: {},
        create: {
          username,
          name: username,
          roles: ['admin', 'user'],
          primaryRole: 'ADMIN'
        },
        select: { roles: true }
      })

      const roles = Array.from(new Set([...user.roles, 'admin', 'user']))

      await this.prisma.user.update({
        where: { username },
        data: {
          roles,
          primaryRole: 'ADMIN'
        }
      })

      const client = this.getClientByNickname(username)
      if (client) {
        client.roles = roles
      }

      synced.push(username)
    }

    return synced
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
