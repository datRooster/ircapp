/**
 * Componente MessageList - Enterprise Professional Design
 * Lista messaggi con design system moderno e icone Lucide
 */

'use client'

import { useRef, useEffect } from 'react'
import { Shield, Lock, X, Check } from 'lucide-react'
import { MessageWithPending, User } from '../types'
import AnnouncementMessage from './AnnouncementMessage'

interface MessageListProps {
  messages: MessageWithPending[]
  currentUser: User
  selectedMessages: Set<string>
  isAdminOrMod: boolean
  onSelectMessage: (id: string) => void
  onDeleteMessage: (id: string) => void
}

export default function MessageList({
  messages,
  currentUser,
  selectedMessages,
  isAdminOrMod,
  onSelectMessage,
  onDeleteMessage
}: MessageListProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Auto-scroll al nuovo messaggio
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  return (
    <div className="flex-1 overflow-y-auto bg-white dark:bg-gray-900">
      <div className="max-w-5xl mx-auto px-6 py-4 space-y-1">
        {messages.map((message, idx) => {
          // Render speciale per annunci
          if (message.type === 'announcement') {
            return (
              <AnnouncementMessage
                key={message.id}
                id={message.id}
                content={message.content}
                timestamp={message.timestamp}
              />
            )
          }

          // Nascondi echo bot duplicato
          if (
            message.user.username === 'webapp' &&
            idx > 0 &&
            messages[idx - 1].userId === currentUser.id &&
            message.content === `[${currentUser.username}] ${messages[idx - 1].content}`
          ) {
            return null
          }

          const isWebappBot = message.user.username === 'webapp'
          const canDelete = isAdminOrMod

          return (
            <div
              key={message.id}
              className={`flex items-start gap-4 px-4 py-3 rounded-lg transition-colors group
                ${selectedMessages.has(message.id) 
                  ? 'bg-blue-50 dark:bg-blue-900/20 ring-2 ring-blue-500/50' 
                  : 'hover:bg-gray-50 dark:hover:bg-gray-800/50'
                }`}
            >
              {/* Checkbox selezione (solo admin/mod) */}
              {isAdminOrMod && (
                <input
                  type="checkbox"
                  checked={selectedMessages.has(message.id)}
                  onChange={() => onSelectMessage(message.id)}
                  className="mt-1.5 w-4 h-4 rounded border-gray-300 dark:border-gray-600
                           text-blue-600 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
                           cursor-pointer transition-colors"
                  title="Select message"
                />
              )}

              {/* Avatar professionale */}
              <div className="shrink-0">
                <div className="w-10 h-10 rounded-lg bg-linear-to-br from-blue-500 to-blue-600 
                              flex items-center justify-center text-white font-semibold text-sm
                              shadow-sm">
                  {message.user.username.charAt(0).toUpperCase()}
                </div>
              </div>

              {/* Contenuto messaggio */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <span className="font-semibold text-gray-900 dark:text-white">
                    {message.user.username}
                  </span>
                  
                  {isWebappBot && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium
                                   bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300
                                   rounded-md border border-blue-200 dark:border-blue-700">
                      <Shield className="w-3 h-3" />
                      <span>WebApp</span>
                    </span>
                  )}

                  <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
                    {new Date(message.timestamp).toLocaleTimeString('it-IT', {
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </span>

                  {(message as any).secure && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium
                                   bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300
                                   rounded-md">
                      <Check className="w-3 h-3" />
                      <span>Verified</span>
                    </span>
                  )}

                  {(message as any).encrypted && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium
                                   bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300
                                   rounded-md">
                      <Lock className="w-3 h-3" />
                      <span>Encrypted</span>
                    </span>
                  )}

                  {/* Pulsante elimina con icona professionale */}
                  {canDelete && (
                    <button
                      onClick={() => onDeleteMessage(message.id)}
                      title="Delete message"
                      className="ml-auto opacity-0 group-hover:opacity-100 p-1.5 rounded-md
                               text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20
                               transition-all focus:outline-none focus:ring-2 focus:ring-red-500"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>

                <p className="text-gray-700 dark:text-gray-200 text-sm leading-relaxed wrap-break-word">
                  {message.content}
                </p>
              </div>
            </div>
          )
        })}
        <div ref={messagesEndRef} />
      </div>
    </div>
  )
}
