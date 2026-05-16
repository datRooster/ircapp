import * as net from 'net'
import * as tls from 'tls'
import { EventEmitter } from 'events'
import { IRCClient } from './irc-client'
import { IRCMessage } from './irc-message'
import { ChannelManager } from './channel-manager'
import { UserManager } from './user-manager'
import { PrismaClient } from '@prisma/client'

export class IRCServer extends EventEmitter {
  private server: net.Server | tls.Server
  private clients: Map<string, IRCClient> = new Map()
  private channels: ChannelManager
  private users: UserManager
  private prisma: PrismaClient
  private port: number
  private hostname: string
  private tlsEnabled: boolean

  constructor(port: number = 6667, hostname: string = 'localhost', tlsOptions?: tls.TlsOptions | null) {
    super()
    this.port = port
    this.hostname = hostname
    this.prisma = new PrismaClient()
    this.channels = new ChannelManager(this.prisma)
    this.users = new UserManager(this.prisma)
    this.tlsEnabled = !!tlsOptions
    this.server = tlsOptions ? tls.createServer(tlsOptions) : net.createServer()
    
    this.setupServer()
  }

  private setupServer() {
    const registerClient = (socket: net.Socket) => {
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
    }

    if (this.tlsEnabled) {
      ;(this.server as tls.Server).on('secureConnection', (socket) => {
        registerClient(socket)
      })

      ;(this.server as tls.Server).on('tlsClientError', (error, socket) => {
        console.error(`TLS client error from ${socket.remoteAddress}:${socket.remotePort}:`, error)
      })
    } else {
      ;(this.server as net.Server).on('connection', (socket) => {
        registerClient(socket)
      })
    }

    this.server.on('error', (error) => {
      console.error('IRC Server error:', error)
    })
  }

  private async handleMessage(client: IRCClient, message: IRCMessage) {
    const { command, params } = message
    
    console.log(`📨 IRC Command: ${command} from ${client.nickname || client.id}`, params)

    try {
      switch (command.toUpperCase()) {
        case 'NICK':
          await this.handleNick(client, params[0])
          break
          
        case 'USER':
          await this.handleUser(client, params)
          break

        case 'PASS':
          this.handlePass(client, params[0])
          break

        case 'CAP':
          this.handleCap(client, params)
          break

        case 'MOTD':
          this.sendMotd(client)
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

        case 'INVITE':
          await this.handleInvite(client, params[0], params[1])
          break
          
        case 'MODE':
          await this.handleMode(client, params)
          break

        case 'HELP':
        case 'HELPOP':
          this.handleHelp(client, params[0])
          break

        case 'REGISTER':
          await this.handleRegister(client, params[0], params[1])
          break

        case 'LOGIN':
          await this.handleLogin(client, params[0], params[1])
          break

        case 'IDENTIFY':
          await this.handleIdentify(client, params[0])
          break

        case 'MKCHAN':
          await this.handleMkchan(client, params)
          break

        case 'TEMPCHAN':
          await this.handleTempchan(client, params[0], params[1])
          break

        case 'PERSIST':
          await this.handlePersist(client, params[0])
          break
          
        default:
          client.sendNumeric(421, `${command} :Unknown command`)
      }
    } catch (error) {
      console.error(`Error handling IRC command ${command}:`, error)
      client.sendNumeric(500, ':Internal server error')
    }
  }

  private handlePass(client: IRCClient, password?: string) {
    if (client.registered) {
      client.sendNumeric(462, ':You may not reregister')
      return
    }

    if (!password) {
      client.sendNumeric(461, 'PASS :Not enough parameters')
      return
    }

    client.pendingPassword = password.replace(/^:/, '')
    client.authenticatedVia = 'pass'
  }

  private handleCap(client: IRCClient, params: string[]) {
    const subcommand = (params[0] || '').toUpperCase()

    switch (subcommand) {
      case 'LS':
        client.send('CAP * LS :')
        break
      case 'END':
        break
      case 'REQ':
        client.send(`CAP * NAK :${params.slice(2).join(' ').replace(/^:/, '')}`)
        break
      default:
        client.send('CAP * LS :')
        break
    }
  }

  private sendNoticeLines(client: IRCClient, lines: string[]) {
    for (const line of lines) {
      client.send(`:irc.webrooster.it NOTICE ${client.nickname || '*'} :${line}`)
    }
  }

  private sendMotd(client: IRCClient) {
    for (const line of this.getMotdLines(client)) {
      client.sendNumeric(372, `:- ${line}`)
    }
    client.sendNumeric(376, ':End of MOTD command')
  }

  private getMotdLines(client: IRCClient) {
    const lines = [
      'Benvenuto nel server IRC della community WebRooster.',
      'Comandi base: /join #canale, /list, /names #canale, /topic #canale',
      'Login rapido account registrato: PASS <password> poi NICK/USER prima di connetterti.',
      'Registrazione da IRC: /quote REGISTER <password> [email]',
      'Login da IRC dopo la connessione: /quote LOGIN <username> <password>',
      'Identifica il nick corrente: /quote IDENTIFY <password>',
      'Creazione rapida canale: /join #nome crea un canale pubblico temporaneo se non esiste.',
      'Creazione avanzata: /quote MKCHAN #nome [public|private] [temporary|permanent] [guest|user|moderator|admin]',
      'Protezione canale: /mode #canale +k <password> per impostare una password, /mode #canale -k per rimuoverla.',
      'Accesso su invito: /mode #canale +i e /invite <nick> #canale',
      'Gestione durata: /quote TEMPCHAN #canale <minuti> oppure /quote PERSIST #canale',
      'Guida completa: /help, /help auth, /help channels, /help security'
    ]

    if (client.isAdmin() || client.isModerator()) {
      lines.push('Ruoli elevati: puoi creare canali privati/permanenti, invitare utenti e moderare i topic.')
    }

    return lines
  }

  private handleHelp(client: IRCClient, section?: string) {
    const topic = (section || 'general').toLowerCase()
    const sections: Record<string, string[]> = {
      general: [
        'HELP general: panoramica comandi essenziali.',
        '  /list -> mostra i canali visibili',
        '  /join #canale -> entra o crea un canale pubblico temporaneo',
        '  /names #canale -> mostra i membri',
        '  /topic #canale -> mostra il topic',
        '  /help auth | channels | security | admin'
      ],
      auth: [
        'HELP auth:',
        '  /quote REGISTER <password> [email] -> registra il nickname corrente',
        '  /quote LOGIN <username> <password> -> collega la sessione all’account web',
        '  /quote IDENTIFY <password> -> autentica il nick corrente',
        '  Prima del login automatico puoi usare PASS <password> prima di NICK/USER.'
      ],
      channels: [
        'HELP channels:',
        '  /join #nome -> crea un canale pubblico temporaneo se non esiste',
        '  /quote MKCHAN #nome [public|private] [temporary|permanent] [guest|user|moderator|admin]',
        '  /mode #canale +i -> solo invito',
        '  /mode #canale +k <password> -> imposta password',
        '  /mode #canale +p -> rende il canale privato',
        '  /quote TEMPCHAN #canale <minuti> -> imposta scadenza',
        '  /quote PERSIST #canale -> rende permanente il canale'
      ],
      security: [
        'HELP security:',
        '  Usa sempre TLS nel client IRC.',
        '  Per canali sensibili usa +i (solo invito) e +k (password).',
        '  Non condividere la password del tuo account web: meglio usare un nick separato o una password dedicata.',
        '  Gli admin/moderatori possono vedere e gestire le policy del canale, ma i messaggi web restano cifrati a livello applicativo.'
      ],
      admin: [
        'HELP admin:',
        '  Gli admin possono creare canali admin/mod, proteggere canali privati e moderare topic/accessi.',
        '  I moderatori possono gestire topic, inviti e canali pubblici/privati senza permessi admin.',
        '  I membri possono creare solo canali pubblici temporanei.',
        '  Gli ospiti possono usare #guest e #help ma non creare canali.'
      ]
    }

    this.sendNoticeLines(client, sections[topic] || sections.general)
  }

  private parseTtlMinutes(raw?: string) {
    if (!raw) return null

    const value = raw.trim().toLowerCase()
    const match = value.match(/^(\d+)(m|h|d)?$/)
    if (!match) return null

    const amount = Number(match[1])
    const unit = match[2] || 'm'

    if (unit === 'h') return amount * 60
    if (unit === 'd') return amount * 60 * 24
    return amount
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

  private async bindClientToUser(client: IRCClient, username: string, password: string) {
    const user = await this.users.loginUser(username, password)
    const previousNickname = client.nickname

    if (previousNickname && previousNickname.toLowerCase() !== user.username.toLowerCase()) {
      if (this.users.isNicknameInUse(user.username)) {
        throw new Error(`Il nickname registrato ${user.username} è già in uso`)
      }

      client.nickname = user.username
      this.users.updateNickname(client, previousNickname, user.username)
      client.broadcast(`:${previousNickname}!${client.username}@${client.hostname} NICK :${user.username}`)
    }

    client.userId = user.id
    client.roles = user.roles
    client.pendingPassword = undefined
    client.authenticatedVia = 'pass'

    return user
  }

  private async handleRegister(client: IRCClient, password?: string, email?: string) {
    if (!client.nickname) {
      client.sendNumeric(431, ':Devi impostare un nickname prima di registrarti')
      return
    }

    if (!password) {
      client.sendNumeric(461, 'REGISTER :Sintassi /quote REGISTER <password> [email]')
      return
    }

    try {
      const user = await this.users.registerNickname(client.nickname, password, email)
      client.userId = user.id
      client.roles = user.roles
      client.send(`:irc.webrooster.it NOTICE ${client.nickname} :Nickname ${user.username} registrato con successo. Per i prossimi accessi usa PASS prima del login oppure /quote LOGIN ${user.username} <password>.`)
    } catch (error) {
      client.sendNumeric(462, `:Registrazione fallita: ${(error as Error).message}`)
    }
  }

  private async handleLogin(client: IRCClient, username?: string, password?: string) {
    if (!username || !password) {
      client.sendNumeric(461, 'LOGIN :Sintassi /quote LOGIN <username> <password>')
      return
    }

    try {
      const user = await this.bindClientToUser(client, username, password)
      client.send(`:irc.webrooster.it NOTICE ${client.nickname} :Autenticazione completata come ${user.username}.`)
    } catch (error) {
      client.sendNumeric(464, `${username} :${(error as Error).message}`)
    }
  }

  private async handleIdentify(client: IRCClient, password?: string) {
    if (!client.nickname) {
      client.sendNumeric(431, ':Devi impostare un nickname prima di identificarti')
      return
    }

    if (!password) {
      client.sendNumeric(461, 'IDENTIFY :Sintassi /quote IDENTIFY <password>')
      return
    }

    await this.handleLogin(client, client.nickname, password)
  }

  private async handleMkchan(client: IRCClient, params: string[]) {
    const channelName = params[0]

    if (!channelName || !channelName.startsWith('#')) {
      client.sendNumeric(461, 'MKCHAN :Sintassi /quote MKCHAN #nome [public|private] [temporary|permanent] [guest|user|moderator|admin]')
      return
    }

    const flags = params.slice(1).map((part) => part.toLowerCase())
    const isPrivate = flags.includes('private')
    const isTemporary = !flags.includes('permanent')
    const requiredRole = flags.find((part) => ['guest', 'user', 'moderator', 'admin'].includes(part)) || 'user'

    try {
      await this.channels.createChannel(client, channelName, {
        isPrivate,
        inviteOnly: false,
        isTemporary,
        requiredRole,
        description: `Canale gestito da ${client.nickname}`
      })

      await this.handleJoin(client, channelName)
      client.send(`:irc.webrooster.it NOTICE ${client.nickname} :Canale ${channelName} creato con successo.`)
    } catch (error) {
      client.sendNumeric(482, `${channelName} :${(error as Error).message}`)
    }
  }

  private async handleTempchan(client: IRCClient, channelName?: string, duration?: string) {
    if (!channelName) {
      client.sendNumeric(461, 'TEMPCHAN :Sintassi /quote TEMPCHAN #canale <minuti|12h|1d>')
      return
    }

    if (!await this.channels.canManageChannel(client, channelName)) {
      client.sendNumeric(482, `${channelName} :Non puoi gestire questo canale`)
      return
    }

    const ttlMinutes = this.parseTtlMinutes(duration)
    if (!ttlMinutes) {
      client.sendNumeric(461, 'TEMPCHAN :Durata non valida. Esempi: 60, 12h, 1d')
      return
    }

    await this.channels.setTemporaryChannel(channelName, ttlMinutes)
    client.send(`:irc.webrooster.it NOTICE ${client.nickname} :${channelName} sarà temporaneo per ${ttlMinutes} minuti.`)
  }

  private async handlePersist(client: IRCClient, channelName?: string) {
    if (!channelName) {
      client.sendNumeric(461, 'PERSIST :Sintassi /quote PERSIST #canale')
      return
    }

    if (!await this.channels.canManageChannel(client, channelName)) {
      client.sendNumeric(482, `${channelName} :Non puoi gestire questo canale`)
      return
    }

    await this.channels.persistChannel(channelName)
    client.send(`:irc.webrooster.it NOTICE ${client.nickname} :${channelName} è ora permanente.`)
  }

  private async handleInvite(client: IRCClient, targetNickname?: string, channelName?: string) {
    if (!targetNickname || !channelName) {
      client.sendNumeric(461, 'INVITE :Sintassi INVITE <nick> #canale')
      return
    }

    try {
      await this.channels.inviteUser(client, targetNickname, channelName)
      client.send(`:irc.webrooster.it NOTICE ${client.nickname} :Invito inviato a ${targetNickname} per ${channelName}.`)

      const targetClient = this.users.getClientByNickname(targetNickname)
      if (targetClient) {
        targetClient.send(`:${client.getFullName()} INVITE ${targetNickname} ${channelName}`)
      }
    } catch (error) {
      client.sendNumeric(482, `${channelName} :${(error as Error).message}`)
    }
  }

  private async completeRegistration(client: IRCClient) {
    // Verifica autenticazione con database
    try {
      const nickname = client.nickname
      if (!nickname) {
        client.sendNumeric(431, ':No nickname given')
        return
      }

      const authResult = await this.users.authenticateUser(nickname, client.pendingPassword)

      if (authResult.status === 'missing-password') {
        client.sendNumeric(464, `${nickname} :Password required for this registered nickname`)
        client.send('ERROR :Authentication required for registered nickname')
        client.disconnect()
        return
      }

      if (authResult.status === 'invalid-password') {
        client.sendNumeric(464, `${nickname} :Password incorrect`)
        client.send('ERROR :Authentication failed')
        client.disconnect()
        return
      }

      if (authResult.status === 'ok') {
        client.userId = authResult.user.id
        client.roles = authResult.user.roles
        await this.users.updateUserLastSeen(authResult.user.id)
      }

      if (authResult.status === 'guest') {
        const placeholderUser = await this.users.getOrCreatePlaceholderUser(nickname)

        client.userId = placeholderUser.id
        client.roles = placeholderUser.roles
      }
    } catch (error) {
      console.error('Database auth error:', error)
      client.sendNumeric(500, ':Authentication backend error')
      client.disconnect()
      return
    }

    client.registered = true
    client.pendingPassword = undefined
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
    this.sendMotd(client)
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
        client.sendNumeric(403, `${channelName} :${(error as Error).message || 'Cannot join channel'}`)
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

      if (!await this.channels.canWriteToChannel(client, target)) {
        client.sendNumeric(404, `${target} :Cannot send to channel`)
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

        // Messaggi provenienti da un client IRC esterno non autenticato alla webapp
        // vanno comunque attribuiti al suo nick, non ad "anonymous".
        if (!saveUserId && client.nickname) {
          try {
            const ircUser = await this.users.getOrCreatePlaceholderUser(client.nickname)
            saveUserId = ircUser.id
            client.userId = ircUser.id
          } catch (e) {
            console.error('Error upserting IRC nickname user:', e)
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

  private handlePong(client: IRCClient, _server: string) {
    client.lastPong = Date.now()
  }

  private async handleList(client: IRCClient, mask?: string) {
    client.sendNumeric(321, 'Channel :Users  Name')
    
    const channels = await this.channels.getPublicChannels(client)
    for (const channel of channels) {
      if (!mask || channel.name.includes(mask)) {
        const userCount = await this.channels.getChannelMemberCount(channel.name)
        const flags = [
          channel.isPrivate ? 'private' : 'public',
          channel.inviteOnly ? 'invite' : null,
          channel.isTemporary ? 'temp' : 'perm',
          channel.requiredRole ? `role:${channel.requiredRole}` : null
        ].filter(Boolean).join(', ')
        client.sendNumeric(322, `#${channel.name} ${userCount} :${channel.description || ''}${flags ? ` [${flags}]` : ''}`)
      }
    }
    
    client.sendNumeric(323, ':End of LIST')
  }

  private async handleNames(client: IRCClient, channelName: string) {
    const members = await this.channels.getChannelMembers(channelName)
    const names = members.map(member => {
      const prefix = member.role === 'owner'
        ? '~'
        : member.role === 'admin'
          ? '@'
          : member.role === 'moderator'
            ? '+'
            : ''
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
    if (mask?.startsWith('#')) {
      const members = await this.channels.getChannelMembers(mask)
      for (const member of members) {
        client.sendNumeric(352, `${mask} ${member.username} ${member.hostname} ${this.hostname} ${member.nickname} H :0 ${member.nickname}`)
      }
    }

    client.sendNumeric(315, `${mask} :End of WHO list`)
  }

  private async handleWhois(client: IRCClient, nickname: string) {
    const targetClient = this.users.getClientByNickname(nickname)
    if (!targetClient) {
      client.sendNumeric(401, `${nickname} :No such nick/channel`)
      return
    }

    client.sendNumeric(311, `${nickname} ${targetClient.username} ${targetClient.hostname} * :${targetClient.realname}`)
    client.sendNumeric(319, `${nickname} :Roles ${targetClient.roles.join(', ')}`)
    client.sendNumeric(318, `${nickname} :End of WHOIS list`)
  }

  private async handleMode(client: IRCClient, params: string[]) {
    const target = params[0]
    if (!target) {
      client.sendNumeric(461, 'MODE :Not enough parameters')
      return
    }

    if (target.startsWith('#')) {
      if (params.length === 1) {
        const { modes } = await this.channels.getChannelModes(target)
        client.sendNumeric(324, `${target} ${modes}`)
        return
      }

      if (!await this.channels.canManageChannel(client, target)) {
        client.sendNumeric(482, `${target} :You're not channel operator`)
        return
      }

      const modeSequence = params[1] || ''
      let sign: '+' | '-' = '+'
      let argIndex = 2

      for (const modeChar of modeSequence) {
        if (modeChar === '+' || modeChar === '-') {
          sign = modeChar
          continue
        }

        switch (modeChar) {
          case 'i':
            await this.channels.setInviteOnly(target, sign === '+')
            break
          case 'p':
            await this.channels.setPrivateVisibility(target, sign === '+')
            break
          case 'k':
            if (sign === '+') {
              const password = params[argIndex++]
              if (!password) {
                client.sendNumeric(461, 'MODE :+k richiede una password')
                return
              }
              await this.channels.setChannelKey(target, password)
            } else {
              await this.channels.clearChannelKey(target)
            }
            break
          default:
            client.sendNumeric(472, `${modeChar} :Mode non supportato`)
            return
        }
      }

      const { modes } = await this.channels.getChannelModes(target)
      client.send(`:${client.getFullName()} MODE ${target} ${modes}`)
      client.broadcastToChannel(target, `:${client.getFullName()} MODE ${target} ${modes}`, true)
    } else {
      client.sendNumeric(221, '+i')
    }
  }

  public start(): Promise<void> {
    return new Promise((resolve, reject) => {
      void (async () => {
        try {
          const syncedAdmins = await this.users.syncConfiguredAdmins()
          if (syncedAdmins.length > 0) {
            console.log(`👑 IRC admins sincronizzati da configurazione: ${syncedAdmins.join(', ')}`)
          }
        } catch (error) {
          console.error('Errore sincronizzazione admin IRC:', error)
        }
      })()

      // Ascolta su tutte le interfacce (0.0.0.0) per accesso esterno
      this.server.listen(this.port, '0.0.0.0', () => {
        console.log(`🚀 IRC Server listening on port ${this.port}`)
        console.log(`🔐 TLS ${this.tlsEnabled ? 'enabled' : 'disabled'}`)
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
