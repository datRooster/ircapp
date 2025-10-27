'use client'

import { useEffect, useState, useRef } from 'react'

// Simulazione Socket.io con polling semplice
export interface MockSocket {
  connected: boolean
  emit: (event: string, data: any) => void
  on: (event: string, callback: (data: any) => void) => void
  off: (event: string, callback?: (data: any) => void) => void
  close: () => void
  eventHandlers: { [event: string]: ((data: any) => void)[] }
}


export const useSocket = (): MockSocket | null => {
  const [socket, setSocket] = useState<MockSocket | null>(null)
  const [activeChannel, setActiveChannel] = useState<string | null>(null)
  const lastMessageIds = useRef<{ [channelId: string]: string }>({});
  const pollInterval = useRef<NodeJS.Timeout | null>(null);

  // Crea mock socket solo una volta
  useEffect(() => {
    const mockSocket: MockSocket = {
      connected: true,
      emit: async (event: string, data: any) => {
        if (event === 'send-message') {
          try {
            const response = await fetch('/api/socketio', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ ...data, action: 'send-message' })
            })
            const result = await response.json()
            if (result.success && result.message) {
              setTimeout(() => {
                mockSocket.eventHandlers['new-message']?.forEach(handler =>
                  handler(result.message)
                )
              }, 100)
            }
          } catch (error) {
            console.error('❌ Send message error:', error)
          }
        }
        if (event === 'join-channel') {
          setActiveChannel(data);
        }
      },
      on: (event: string, callback: (data: any) => void) => {
        if (!mockSocket.eventHandlers) {
          mockSocket.eventHandlers = {}
        }
        if (!mockSocket.eventHandlers[event]) {
          mockSocket.eventHandlers[event] = []
        }
        mockSocket.eventHandlers[event].push(callback)
      },
      off: (event: string, callback?: (data: any) => void) => {
        if (mockSocket.eventHandlers && mockSocket.eventHandlers[event]) {
          if (callback) {
            const index = mockSocket.eventHandlers[event].indexOf(callback)
            if (index > -1) {
              mockSocket.eventHandlers[event].splice(index, 1)
            }
          } else {
            delete mockSocket.eventHandlers[event]
          }
        }
      },
      close: () => {
        mockSocket.connected = false
      },
      eventHandlers: {} as any
    }
    setSocket(mockSocket)
    return () => {
      if (pollInterval.current) clearInterval(pollInterval.current)
      mockSocket.close()
    }
  }, [])

  // Polling automatico per nuovi messaggi dal server
  useEffect(() => {
    if (!activeChannel) {
      if (pollInterval.current) clearInterval(pollInterval.current)
      return;
    }
    if (pollInterval.current) clearInterval(pollInterval.current)
    pollInterval.current = setInterval(async () => {
      try {
        const response = await fetch('/api/socketio', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'get-messages', channelId: activeChannel })
        });
        const result = await response.json();
        const messages = result.messages || [];
        let lastId = lastMessageIds.current[activeChannel];
        let newMessages = messages;
        if (lastId) {
          const idx = messages.findIndex((m: any) => m.id === lastId);
          if (idx >= 0) newMessages = messages.slice(idx + 1);
        }
        if (newMessages.length > 0 && socket) {
          lastMessageIds.current[activeChannel] = newMessages[newMessages.length - 1].id;
          newMessages.forEach((msg: any) => {
            socket.eventHandlers['new-message']?.forEach(handler => handler(msg));
          });
        }
      } catch (err) {
        // Silenzia errori di polling
      }
    }, 2000);
    return () => {
      if (pollInterval.current) clearInterval(pollInterval.current)
    }
  }, [activeChannel, socket])

  return socket
}