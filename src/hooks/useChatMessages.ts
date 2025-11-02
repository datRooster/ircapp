/**
 * Custom hook per gestire la logica dei messaggi della chat
 * Estrae la business logic dal componente ChatWindow
 */

'use client'

import { useState, useEffect, useCallback } from 'react'
import { Message, Channel, MessageWithPending } from '../types'
import { useSocket } from './useSocket'

interface UseChatMessagesOptions {
  channel: Channel
  currentUserId: string
}

export function useChatMessages({ channel, currentUserId }: UseChatMessagesOptions) {
  const [messages, setMessages] = useState<MessageWithPending[]>([])
  const [isLoaded, setIsLoaded] = useState(false)
  const socket = useSocket()

  // Carica messaggi del canale
  const loadMessages = useCallback(async () => {
    console.log(`🔄 Loading messages for channel: ${channel.id}`)
    
    try {
      // Lobby ha messaggi speciali
      if (channel.id === 'lobby') {
        const { createLobbyMessages } = await import('../lib/lobby-messages')
        const lobbyMessages = createLobbyMessages(channel)
        setMessages(lobbyMessages)
        console.log(`✅ Loaded ${lobbyMessages.length} lobby messages`)
        return
      }

      // Carica messaggi dal server
      const response = await fetch('/api/socketio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'get-messages', channelId: channel.id })
      })

      const result = await response.json()
      const existingMessages = result.messages || []

      // Aggiungi messaggio di benvenuto
      const welcomeMessage: Message = {
        id: `welcome-${channel.id}`,
        content: `Benvenuto nel canale #${channel.name}! ${
          existingMessages.length > 0 
            ? `Ci sono ${existingMessages.length} messaggi precedenti.` 
            : 'Inizia la conversazione!'
        }`,
        userId: 'system',
        user: {
          id: 'system',
          username: 'Sistema',
          isOnline: true,
          joinedAt: new Date(),
          roles: ['system']
        },
        channelId: channel.id,
        channel: channel,
        timestamp: new Date(),
        type: 'notice'
      }

      setMessages([welcomeMessage, ...existingMessages])
      console.log(`✅ Loaded ${existingMessages.length} messages for #${channel.name}`)
    } catch (error) {
      console.error('❌ Error loading messages:', error)
      
      // Fallback welcome message
      const welcomeMessage: Message = {
        id: `welcome-${channel.id}`,
        content: `Benvenuto nel canale #${channel.name}! Prova a inviare un messaggio.`,
        userId: 'system',
        user: {
          id: 'system',
          username: 'Sistema',
          isOnline: true,
          joinedAt: new Date(),
          roles: ['system']
        },
        channelId: channel.id,
        channel: channel,
        timestamp: new Date(),
        type: 'notice'
      }
      setMessages([welcomeMessage])
    }
  }, [channel.id, channel.name])

  // Handler per nuovi messaggi
  const handleNewMessage = useCallback((message: Message) => {
    console.log('📨 Received message for channel check:', message.channelId, 'current:', channel.id)

    // Solo messaggi per il canale corrente
    if (message.channelId !== channel.id) {
      console.log('ℹ️ Message is for different channel, ignoring')
      return
    }

    // Non mostrare messaggi cifrati
    if (message.encrypted) {
      console.log('⏩ Messaggio cifrato ignorato in chat window')
      return
    }

    setMessages(prev => {
      // Sostituisci echo ottimistico se presente
      const idx = prev.findIndex(
        m => (m as any).pending && m.content === message.content && m.userId === message.userId
      )

      if (idx !== -1) {
        const newArr = [...prev]
        newArr[idx] = { ...message }
        return deduplicateMessages(newArr)
      }

      // Rimuovi pending duplicati e aggiungi nuovo messaggio
      const filtered = prev.filter(
        m => !((m as any).pending && m.content === message.content && m.userId === message.userId)
      )

      // Non aggiungere se già presente
      if (filtered.find(m => m.id === message.id)) {
        return deduplicateMessages(filtered)
      }

      return deduplicateMessages([...filtered, { ...message }])
    })
  }, [channel.id])

  // Aggiungi messaggio ottimistico
  const addOptimisticMessage = useCallback((content: string, username: string) => {
    const optimisticMsg: MessageWithPending = {
      id: `pending-${Date.now()}`,
      content,
      userId: currentUserId,
      channelId: channel.id,
      timestamp: new Date(),
      user: {
        id: currentUserId,
        username,
        isOnline: true,
        joinedAt: new Date(),
        roles: ['user']
      },
      channel: channel,
      type: 'message',
      pending: true
    }

    setMessages(prev => [...prev, optimisticMsg])
  }, [currentUserId, channel])

  // Rimuovi messaggio
  const removeMessage = useCallback((messageId: string) => {
    setMessages(prev => prev.filter(m => m.id !== messageId))
  }, [])

  // Setup listeners socket
  useEffect(() => {
    if (!socket || !socket.connected) {
      console.log('⏳ Socket not ready yet...')
      return
    }

    console.log(`🏠 Joining channel: ${channel.id}`)
    socket.emit('join-channel', channel.id)

    const handleMessageError = (error: string) => {
      console.error('❌ Message error:', error)
      alert(`Errore invio messaggio: ${error}`)
    }

    socket.on('new-message', handleNewMessage)
    socket.on('message-error', handleMessageError)

    return () => {
      console.log(`🚪 Leaving channel: ${channel.id}`)
      socket.off('new-message', handleNewMessage)
      socket.off('message-error', handleMessageError)
    }
  }, [socket, socket?.connected, channel.id, handleNewMessage])

  // Carica messaggi al mount
  useEffect(() => {
    loadMessages()
    setIsLoaded(true)
  }, [loadMessages])

  return {
    messages,
    isLoaded,
    addOptimisticMessage,
    removeMessage,
    socket
  }
}

// Utility per deduplicare messaggi per ID
function deduplicateMessages(messages: MessageWithPending[]): MessageWithPending[] {
  const seen = new Set<string>()
  return messages.filter(m => {
    if (seen.has(m.id)) return false
    seen.add(m.id)
    return true
  })
}
