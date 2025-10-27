import { Server as NetServer } from 'http'
import { NextApiRequest, NextApiResponse } from 'next'
import { Server as ServerIO } from 'socket.io'
import { prisma } from './prisma'

export type NextApiResponseServerIO = NextApiResponse & {
  socket: {
    server: NetServer & {
      io: ServerIO
    }
  }
}

export const config = {
  api: {
    bodyParser: false,
  },
}

interface IRCMessage {
  id: string
  content: string
  userId: string
  channelId: string
  type: 'message' | 'join' | 'part' | 'quit' | 'action' | 'notice'
  timestamp: Date
}

export function initSocket(server: NetServer): ServerIO {
  const io = new ServerIO(server, {
    path: '/api/socket/io',
    addTrailingSlash: false,
    cors: {
      origin: process.env.NODE_ENV === 'production' ? false : ['http://localhost:3000'],
      methods: ['GET', 'POST']
    }
  })

  io.on('connection', (socket) => {
    console.log(`User connected: ${socket.id}`)

    // Join a channel
    socket.on('join-channel', async (channelName: string, userId: string) => {
      try {
        socket.join(channelName)
        
        // Update user online status
        await prisma.user.update({
          where: { id: userId },
          data: { isOnline: true }
        })

        // Notify others in the channel
        socket.to(channelName).emit('user-joined', {
          userId,
          channelName,
          timestamp: new Date()
        })

        console.log(`User ${userId} joined channel ${channelName}`)
      } catch (error) {
        console.error('Error joining channel:', error)
      }
    })

    // Leave a channel
    socket.on('leave-channel', async (channelName: string, userId: string) => {
      try {
        socket.leave(channelName)
        
        // Notify others in the channel
        socket.to(channelName).emit('user-left', {
          userId,
          channelName,
          timestamp: new Date()
        })

        console.log(`User ${userId} left channel ${channelName}`)
      } catch (error) {
        console.error('Error leaving channel:', error)
      }
    })

    // Send message
    socket.on('send-message', async (data: {
      content: string
      userId: string
      channelId: string
    }) => {
      try {
        const message = await prisma.message.create({
          data: {
            content: data.content,
            userId: data.userId,
            channelId: data.channelId,
            type: 'MESSAGE'
          },
          include: {
            user: {
              select: {
                id: true,
                username: true,
                avatar: true
              }
            }
          }
        })

        // Broadcast message to all users in the channel
        io.to(data.channelId).emit('new-message', message)

        console.log(`Message sent in channel ${data.channelId}`)
      } catch (error) {
        console.error('Error sending message:', error)
      }
    })

    // Handle disconnect
    socket.on('disconnect', async () => {
      console.log(`User disconnected: ${socket.id}`)
      // Here you might want to update user online status
    })
  })

  return io
}