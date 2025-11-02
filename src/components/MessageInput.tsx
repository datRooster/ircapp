/**
 * Componente MessageInput - Enterprise Professional Design
 * Input messaggi con design system moderno e icone Lucide
 */

'use client'

import { useState, FormEvent } from 'react'
import { Send, Lock, AlertCircle } from 'lucide-react'
import { Channel, User } from '../types'

interface MessageInputProps {
  channel: Channel
  currentUser: User
  isGuest?: boolean
  onSendMessage: (content: string) => void
}

export default function MessageInput({
  channel,
  currentUser,
  isGuest,
  onSendMessage
}: MessageInputProps) {
  const [newMessage, setNewMessage] = useState('')

  // Verifica permessi scrittura
  const canWrite = (() => {
    // Guest: solo in guest/help
    if (isGuest && !['guest', 'help'].includes(channel.name)) {
      return false
    }

    // Canali read-only: solo ruoli autorizzati
    if (channel.isReadOnly) {
      const userRoles = currentUser.roles || ['user']
      const allowedRoles = channel.allowedRoles || ['admin']
      return userRoles.some((role: string) => allowedRoles.includes(role))
    }

    return true
  })()

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    
    if (!newMessage.trim()) return
    if (!canWrite) return

    onSendMessage(newMessage)
    setNewMessage('')
  }

  // Guest non può scrivere - Enterprise Alert
  if (isGuest && !['guest', 'help'].includes(channel.name)) {
    return (
      <div className="bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 px-6 py-4">
        <div className="max-w-5xl mx-auto">
          <div className="flex items-start gap-3 p-4 rounded-lg bg-amber-50 dark:bg-amber-900/20 
                        border border-amber-200 dark:border-amber-800">
            <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
            <div>
              <h3 className="font-semibold text-amber-900 dark:text-amber-100 mb-1">
                Registration Required
              </h3>
              <p className="text-sm text-amber-800 dark:text-amber-200">
                As a guest, you can only write in <strong>#guest</strong> and <strong>#help</strong> channels.
                Register or sign in to participate in other conversations.
              </p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Canale read-only - Enterprise Alert
  if (!canWrite) {
    return (
      <div className="bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 px-6 py-4">
        <div className="max-w-5xl mx-auto">
          <div className="flex items-start gap-3 p-4 rounded-lg bg-blue-50 dark:bg-blue-900/20 
                        border border-blue-200 dark:border-blue-800">
            <Lock className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5 shrink-0" />
            <div>
              <h3 className="font-semibold text-blue-900 dark:text-blue-100 mb-1">
                Read-Only Channel
              </h3>
              <p className="text-sm text-blue-800 dark:text-blue-200">
                Only administrators can write in this channel. 
                Select another channel from the sidebar to join conversations.
              </p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Form Input Enterprise
  return (
    <div className="bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 px-6 py-4">
      <form onSubmit={handleSubmit} className="max-w-5xl mx-auto">
        {/* Security Badge */}
        <div className="mb-3 flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
          <Lock className="w-4 h-4 text-green-600 dark:text-green-400" />
          <span className="font-medium">Messages are end-to-end encrypted</span>
        </div>
        
        {/* Input Group */}
        <div className="flex gap-3">
          <input
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder={`Message #${channel.name}...`}
            className="flex-1 px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600
                     bg-white dark:bg-gray-700 text-gray-900 dark:text-white
                     placeholder-gray-500 dark:placeholder-gray-400
                     focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
                     transition-shadow"
            maxLength={1000}
            autoFocus
          />
          
          <button
            type="submit"
            disabled={!newMessage.trim()}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-lg font-medium
                     bg-blue-600 text-white hover:bg-blue-700
                     disabled:bg-gray-300 dark:disabled:bg-gray-700 disabled:text-gray-500 dark:disabled:text-gray-400
                     disabled:cursor-not-allowed
                     focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
                     transition-colors shadow-sm"
          >
            <Send className="w-4 h-4" />
            <span>Send</span>
          </button>
        </div>
      </form>
    </div>
  )
}
