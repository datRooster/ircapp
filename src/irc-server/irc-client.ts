import * as net from 'net'
import { EventEmitter } from 'events'
import { IRCMessage, IRCMessageParser } from './irc-message'

export class IRCClient extends EventEmitter {
  public readonly id: string
  public socket: net.Socket
  public server: any // IRCServer reference
  
  // Client state
  public nickname?: string
  public username?: string
  public realname?: string
  public hostname: string
  public registered: boolean = false
  public userId?: string
  public roles: string[] = ['user']
  
  // Connection info
  public connectedAt: Date
  public lastPing: number = Date.now()
  public lastPong: number = Date.now()
  
  // Channels the client is in
  public channels: Set<string> = new Set()
  
  private buffer: string = ''

  constructor(socket: net.Socket, server: any) {
    super()
    
    this.id = `${socket.remoteAddress}:${socket.remotePort}:${Date.now()}`
    this.socket = socket
    this.server = server
    this.hostname = socket.remoteAddress || 'unknown'
    this.connectedAt = new Date()
    
    this.setupSocket()
  }

  private setupSocket() {
    this.socket.setEncoding('utf8')
    
    this.socket.on('data', (data: string) => {
      this.handleData(data)
    })
    
    this.socket.on('close', () => {
      this.emit('disconnect')
    })
    
    this.socket.on('error', (error) => {
      console.error(`IRC Client ${this.id} error:`, error)
      this.disconnect()
    })
    
    // Setup ping timer
    this.startPingTimer()
  }

  private handleData(data: string) {
    this.buffer += data
    
    // Process complete lines
    const lines = this.buffer.split('\r\n')
    this.buffer = lines.pop() || '' // Keep incomplete line in buffer
    
    for (const line of lines) {
      if (line.length > 0) {
        try {
          const message = IRCMessageParser.parse(line)
          this.emit('message', message)
        } catch (error) {
          console.error(`Error parsing IRC message from ${this.id}:`, error)
        }
      }
    }
  }

  private startPingTimer() {
    setInterval(() => {
      const now = Date.now()
      
      // Send PING every 60 seconds
      if (now - this.lastPing > 60000) {
        this.send(`PING :${this.server.hostname}`)
        this.lastPing = now
      }
      
      // Disconnect if no PONG for 120 seconds
      if (now - this.lastPong > 120000) {
        console.log(`⏰ IRC Client ${this.nickname || this.id} timed out`)
        this.disconnect()
      }
    }, 30000) // Check every 30 seconds
  }

  public send(message: string) {
    if (this.socket && !this.socket.destroyed) {
      this.socket.write(message + '\r\n')
      console.log(`📤 [${this.nickname || this.id}] ${message}`)
    }
  }

  public sendNumeric(code: number, message: string) {
    const nickname = this.nickname || '*'
    const hostname = this.server?.hostname || 'localhost'
    const formatted = `${code.toString().padStart(3, '0')} ${nickname} ${message}`
    this.send(`:${hostname} ${formatted}`)
  }

  public isRegistered(): boolean {
    return !!(this.nickname && this.username && !this.registered)
  }

  public getFullName(): string {
    return `${this.nickname}!${this.username}@${this.hostname}`
  }

  public hasRole(role: string): boolean {
    return this.roles.includes(role) || this.roles.includes('admin')
  }

  public isAdmin(): boolean {
    return this.roles.includes('admin')
  }

  public isModerator(): boolean {
    return this.roles.includes('moderator') || this.isAdmin()
  }

  // Channel management
  public joinChannel(channelName: string) {
    this.channels.add(channelName.toLowerCase())
  }

  public partChannel(channelName: string) {
    this.channels.delete(channelName.toLowerCase())
  }

  public isInChannel(channelName: string): boolean {
    return this.channels.has(channelName.toLowerCase())
  }

  public getChannels(): string[] {
    return Array.from(this.channels)
  }

  // Broadcasting
  public broadcast(message: string) {
    // Send to all channels this user is in
    for (const channelName of this.channels) {
      this.broadcastToChannel(channelName, message, true)
    }
  }

  public broadcastToChannel(channelName: string, message: string, excludeSelf: boolean = true) {
    if (!this.server) return
    
    const channelManager = this.server.getChannelManager()
    const userManager = this.server.getUserManager()
    
    // Get all clients in this channel
    channelManager.getChannelMembers(channelName).then((members: any[]) => {
      for (const member of members) {
        const client = userManager.getClientByNickname(member.nickname)
        if (client && (!excludeSelf || client.id !== this.id)) {
          client.send(message)
        }
      }
    }).catch((error: any) => {
      console.error('Error broadcasting to channel:', error)
    })
  }

  public disconnect() {
    if (this.socket && !this.socket.destroyed) {
      this.socket.destroy()
    }
    this.emit('disconnect')
  }

  // Utility methods
  public getInfo() {
    return {
      id: this.id,
      nickname: this.nickname,
      username: this.username,
      hostname: this.hostname,
      realname: this.realname,
      registered: this.registered,
      connectedAt: this.connectedAt,
      channels: Array.from(this.channels),
      roles: this.roles
    }
  }

  public toString(): string {
    return `IRCClient{${this.nickname || this.id}@${this.hostname}}`
  }
}