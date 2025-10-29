import * as net from 'net'
import { EventEmitter } from 'events'
import { IRCClient } from './irc-client'
import { IRCMessage } from './irc-message'
import { ChannelManager } from './channel-manager'
import { UserManager } from './user-manager'
import { PrismaClient } from '@prisma/client'

export class IRCServer extends EventEmitter {
  private server: net.Server
  private clients: Map<string, IRCClient> = new Map()
  private channels: ChannelManager
  private users: UserManager
  private prisma: PrismaClient
  private port: number
  private hostname: string

  constructor(port: number = 6667, hostname: string = 'localhost') {
    super()
    this.port = port
    this.hostname = hostname
    this.prisma = new PrismaClient()
    this.channels = new ChannelManager(this.prisma)
    this.users = new UserManager(this.prisma)
    this.server = net.createServer()
    
    this.setupServer()
  }

  private setupServer() {
    this.server.on('connection', (socket) => {
      console.log(`🔌 New IRC connection from ${socket.remoteAddress}:${socket.remotePort}`)
      
      const client = new IRCClient(socket, this)
      this.clients.set(client.id, client)
      
      client.on('disconnect', () => {
        this.clients.delete(client.id)
        this.users.removeClient(client)
        console.log(`👋 IRC client disconnected: ${client.nickname || client.id}`)
      })
      
      client.on('message', (message: IRCMessage) => {
        this.handleMessage(client, message)
      })
    })

    this.server.on('error', (error) => {
      console.error('IRC Server error:', error)
    })
  }

  private async handleMessage(client: IRCClient, message: IRCMessage) {
    const { command, params, prefix } = message
    
    console.log(`📨 IRC Command: ${command} from ${client.nickname || client.id}`, params)

    try {
      switch (command.toUpperCase()) {
        case 'NICK':
          await this.handleNick(client, params[0])
          break
          
        case 'USER':
          await this.handleUser(client, params)
          break
          
        case 'JOIN':
          await this.handleJoin(client, params[0], params[1])
          break
          
        case 'PART':
          await this.handlePart(client, params[0], params.slice(1).join(' '))
          break
          
        case 'PRIVMSG':
          await this.handlePrivmsg(client, params[0], params.slice(1).join(' '))
          break
          
        case 'QUIT':
          await this.handleQuit(client, params.join(' '))
          break
          
        case 'PING':
          this.handlePing(client, params[0])
          break
          
        case 'PONG':
          this.handlePong(client, params[0])
          break
          
        case 'LIST':
          await this.handleList(client, params[0])
          break
          
        case 'NAMES':
          await this.handleNames(client, params[0])
          break
          
        case 'TOPIC':
          await this.handleTopic(client, params[0], params.slice(1).join(' '))
          break
          
        case 'WHO':
          await this.handleWho(client, params[0])
          break
          
        case 'WHOIS':
          await this.handleWhois(client, params[0])
          break
          
        case 'MODE':
          await this.handleMode(client, params)
          break
          
        default:
          client.sendNumeric(421, `${command} :Unknown command`)
      }
    } catch (error) {
      console.error(`Error handling IRC command ${command}:`, error)
      client.sendNumeric(500, ':Internal server error')
    }
  }

  // Gestione comandi IRC
  private async handleNick(client: IRCClient, nickname: string) {
    if (!nickname) {
      client.sendNumeric(431, ':No nickname given')
      return
    }

    if (!/^[a-zA-Z][a-zA-Z0-9_-]{0,15}$/.test(nickname)) {
      client.sendNumeric(432, `${nickname} :Erroneous nickname`)
      return
    }

    if (this.users.isNicknameInUse(nickname) && client.nickname !== nickname) {
      client.sendNumeric(433, `${nickname} :Nickname is already in use`)
      return
    }

    const oldNick = client.nickname
    client.nickname = nickname
    
    if (oldNick) {
      // Notifica cambio nick ai canali
      client.broadcast(`:${oldNick}!${client.username}@${client.hostname} NICK :${nickname}`)
    }
    
    this.users.updateNickname(client, oldNick, nickname)
    
    // Registra il client nel UserManager se non già fatto
    if (!oldNick) {
      this.users.addClient(client)
    }
    
    if (client.nickname && client.username && !client.registered) {
      await this.completeRegistration(client)
    }
  }

  private async handleUser(client: IRCClient, params: string[]) {
    if (params.length < 4) {
      client.sendNumeric(461, 'USER :Not enough parameters')
      return
    }

    client.username = params[0]
    client.realname = params.slice(3).join(' ').replace(/^:/, '')
    client.hostname = client.socket.remoteAddress || 'unknown'
    
    if (client.nickname && client.username && !client.registered) {
      await this.completeRegistration(client)
    }
  }

  private async completeRegistration(client: IRCClient) {
    // Verifica autenticazione con database
    try {
      const user = await this.prisma.user.findUnique({
        where: { username: client.nickname }
      })

      if (user) {
        client.userId = user.id
        client.roles = user.roles
      }
    } catch (error) {
      console.error('Database auth error:', error)
    }

    client.registered = true
    this.sendWelcome(client)
    
    // Auto-join a #lobby
    await this.handleJoin(client, '#lobby')
  }

  private sendWelcome(client: IRCClient) {
    const hostname = this.hostname
    client.sendNumeric(1, `:Welcome to the IRC Community Network ${client.getFullName()}`)
    client.sendNumeric(2, `:Your host is ${hostname}, running IRC Server v1.0`)
    client.sendNumeric(3, `:This server was created ${new Date().toISOString()}`)
    client.sendNumeric(4, `${hostname} IRC-1.0 o o`)
    client.sendNumeric(375, `:- ${hostname} Message of the day -`)
    client.sendNumeric(372, ':- Benvenuto nel server IRC della community!')
    client.sendNumeric(372, ':- Usa /join #canale per entrare in un canale')
    client.sendNumeric(372, ':- Usa /list per vedere i canali disponibili')
    client.sendNumeric(376, ':End of MOTD command')
  }

  private async handleJoin(client: IRCClient, channelNames: string, keys?: string) {
    if (!client.registered) {
      client.sendNumeric(451, ':You have not registered')
      return
    }

    const channels = channelNames.split(',')
    const keyList = keys ? keys.split(',') : []

    for (let i = 0; i < channels.length; i++) {
      const channelName = channels[i].trim()
      const key = keyList[i] || ''

      if (!channelName.startsWith('#')) {
        client.sendNumeric(403, `${channelName} :No such channel`)
        continue
      }

      try {
        const channel = await this.channels.joinChannel(client, channelName, key)
        if (channel) {
          // Notifica join
          const joinMessage = `:${client.getFullName()} JOIN :${channelName}`
          client.send(joinMessage)
          client.broadcastToChannel(channelName, joinMessage, false)

          // Invia topic se presente
          if (channel.topic) {
            client.sendNumeric(332, `${channelName} :${channel.topic}`)
          }

          // Invia lista nomi
          await this.handleNames(client, channelName)
        }
      } catch (error) {
        console.error(`Error joining channel ${channelName}:`, error)
        client.sendNumeric(403, `${channelName} :Cannot join channel`)
      }
    }
  }

  private async handlePart(client: IRCClient, channelName: string, reason?: string) {
    if (!channelName.startsWith('#')) {
      client.sendNumeric(403, `${channelName} :No such channel`)
      return
    }

    const channel = await this.channels.partChannel(client, channelName)
    if (channel) {
      const partMessage = `:${client.getFullName()} PART ${channelName}${reason ? ' :' + reason : ''}`
      client.send(partMessage)
      client.broadcastToChannel(channelName, partMessage, false)
    } else {
      client.sendNumeric(442, `${channelName} :You're not on that channel`)
    }
  }

  private async handlePrivmsg(client: IRCClient, target: string, message: string) {
    if (!message) {
      client.sendNumeric(412, ':No text to send')
      return
    }

    if (target.startsWith('#')) {
      // Messaggio a canale
      const channel = await this.channels.getChannel(target)
      if (!channel) {
        client.sendNumeric(403, `${target} :No such channel`)
        return
      }

      if (!await this.channels.isUserInChannel(client, target)) {
        client.sendNumeric(442, `${target} :You're not on that channel`)
        return
      }

      // Salva messaggio nel database (cifrato a riposo)
      try {
        // Use server-side secure protocol to sanitize and encrypt content
        const { SecureIRCProtocol } = require('@/lib/secure-irc.server')

        // Estrai autore e testo puro se il messaggio arriva dal bot (formato: [username] messaggio)
        let actualContent = message
        let authorUsername: string | undefined = undefined
        // Migliora la regex: accetta spazi, caratteri speciali, unicode
        const match = message.match(/^\s*\[([^\]]+)\]\s*([\s\S]*)$/u)
        if (match && match[2].trim().length > 0) {
          authorUsername = match[1].trim()
          actualContent = match[2].trim()
        }

        // Solo il testo puro viene cifrato e salvato
        const sanitized = SecureIRCProtocol.sanitizeContent(actualContent)

        // Determine userId: prefer extracted author, else the sending client if available
        let saveUserId = client.userId || undefined
        if (authorUsername) {
          try {
            const user = await this.prisma.user.findUnique({ where: { username: authorUsername } })
            if (user) saveUserId = user.id
          } catch (e) {
            // ignore DB lookup errors and fall back to client.userId
            console.error('Error finding user for forwarded author:', e)
          }
        }

        const encrypted = SecureIRCProtocol.encryptMessage(sanitized)

        await this.prisma.message.create({
          data: {
            content: encrypted.encryptedContent,
            iv: encrypted.iv,
            keyId: encrypted.tag,
            encrypted: true,
            userId: saveUserId || (client.userId || 'anonymous'),
            channelId: channel.id,
            type: 'MESSAGE'
          }
        })
      } catch (error) {
        console.error('Error saving message:', error)
      }

      // Broadcast ai membri del canale
      const privmsgMessage = `:${client.getFullName()} PRIVMSG ${target} :${message}`
      client.broadcastToChannel(target, privmsgMessage, true)
    } else {
      // Messaggio privato
      const targetClient = this.users.getClientByNickname(target)
      if (!targetClient) {
        client.sendNumeric(401, `${target} :No such nick/channel`)
        return
      }

      targetClient.send(`:${client.getFullName()} PRIVMSG ${target} :${message}`)
    }
  }

  private async handleQuit(client: IRCClient, reason?: string) {
    const quitMessage = `:${client.getFullName()} QUIT :${reason || 'Client quit'}`
    client.broadcast(quitMessage)
    client.disconnect()
  }

  private handlePing(client: IRCClient, server: string) {
    client.send(`:${this.hostname} PONG ${this.hostname} :${server}`)
  }

  private handlePong(client: IRCClient, server: string) {
    client.lastPong = Date.now()
  }

  private async handleList(client: IRCClient, mask?: string) {
    client.sendNumeric(321, 'Channel :Users  Name')
    
    const channels = await this.channels.getPublicChannels()
    for (const channel of channels) {
      if (!mask || channel.name.includes(mask)) {
        const userCount = await this.channels.getChannelMemberCount(channel.name)
        client.sendNumeric(322, `${channel.name} ${userCount} :${channel.description || ''}`)
      }
    }
    
    client.sendNumeric(323, ':End of LIST')
  }

  private async handleNames(client: IRCClient, channelName: string) {
    const members = await this.channels.getChannelMembers(channelName)
    const names = members.map(member => {
      const client = this.users.getClientByNickname(member.nickname)
      const prefix = member.role === 'admin' ? '@' : member.role === 'moderator' ? '+' : ''
      return prefix + member.nickname
    })

    const namesStr = names.join(' ')
    client.sendNumeric(353, `= ${channelName} :${namesStr}`)
    client.sendNumeric(366, `${channelName} :End of NAMES list`)
  }

  private async handleTopic(client: IRCClient, channelName: string, newTopic?: string) {
    const channel = await this.channels.getChannel(channelName)
    if (!channel) {
      client.sendNumeric(403, `${channelName} :No such channel`)
      return
    }

    if (newTopic !== undefined) {
      // Imposta nuovo topic (solo se autorizzato)
      if (await this.channels.canSetTopic(client, channelName)) {
        await this.channels.setTopic(channelName, newTopic)
        const topicMessage = `:${client.getFullName()} TOPIC ${channelName} :${newTopic}`
        client.send(topicMessage)
        client.broadcastToChannel(channelName, topicMessage, false)
      } else {
        client.sendNumeric(482, `${channelName} :You're not channel operator`)
      }
    } else {
      // Mostra topic corrente
      if (channel.topic) {
        client.sendNumeric(332, `${channelName} :${channel.topic}`)
      } else {
        client.sendNumeric(331, `${channelName} :No topic is set`)
      }
    }
  }

  private async handleWho(client: IRCClient, mask: string) {
    // Implementa WHO command
    client.sendNumeric(315, `${mask} :End of WHO list`)
  }

  private async handleWhois(client: IRCClient, nickname: string) {
    const targetClient = this.users.getClientByNickname(nickname)
    if (!targetClient) {
      client.sendNumeric(401, `${nickname} :No such nick/channel`)
      return
    }

    client.sendNumeric(311, `${nickname} ${targetClient.username} ${targetClient.hostname} * :${targetClient.realname}`)
    client.sendNumeric(318, `${nickname} :End of WHOIS list`)
  }

  private async handleMode(client: IRCClient, params: string[]) {
    // Implementa MODE command (semplificato)
    const target = params[0]
    if (target.startsWith('#')) {
      // Channel mode
      client.sendNumeric(324, `${target} +nt`)
    } else {
      // User mode
      client.sendNumeric(221, '+i')
    }
  }

  public start(): Promise<void> {
    return new Promise((resolve, reject) => {
      // Ascolta su tutte le interfacce (0.0.0.0) per accesso esterno
      this.server.listen(this.port, '0.0.0.0', () => {
        console.log(`🚀 IRC Server listening on port ${this.port}`)
        console.log(`📡 Local access: /server localhost ${this.port}`)
        console.log(`🌐 External access: /server <your-ip> ${this.port}`)
        console.log(`🔒 Make sure port ${this.port} is open in your firewall`)
        resolve()
      })

      this.server.on('error', reject)
    })
  }

  public stop(): Promise<void> {
    return new Promise((resolve) => {
      // Disconnetti tutti i client
      for (const client of this.clients.values()) {
        client.send('ERROR :Server shutting down')
        client.disconnect()
      }
      
      this.server.close(() => {
        console.log('🛑 IRC Server stopped')
        resolve()
      })
    })
  }

  public getConnectedClients(): IRCClient[] {
    return Array.from(this.clients.values())
  }

  public getChannelManager(): ChannelManager {
    return this.channels
  }

  public getUserManager(): UserManager {
    return this.users
  }
}