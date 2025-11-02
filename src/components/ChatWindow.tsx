'use client'

/**
 * ChatWindow Component - Enterprise Professional Design
 * 
 * Componente principale per la visualizzazione e gestione della chat
 * Design system professionale con Lucide React icons
 */

import { Hash, Circle, CheckSquare, Square, Trash2 } from 'lucide-react'
import { Channel, User } from '../types'
import { useChatMessages } from '../hooks/useChatMessages'
import { useMessageSelection } from '../hooks/useMessageSelection'
import { sendMessage, deleteMessage } from '../services/api'
import MessageList from './MessageList'
import MessageInput from './MessageInput'

interface ChatWindowProps {
  channel: Channel
  currentUser: User
  isGuest?: boolean
}

export default function ChatWindow({ channel, currentUser, isGuest }: ChatWindowProps) {
  // Hooks personalizzati per gestione messaggi e selezione
  const { messages, addOptimisticMessage, removeMessage, socket } = useChatMessages({
    channel,
    currentUserId: currentUser.id
  })

  const {
    selectedMessages,
    selectAll,
    handleSelectMessage,
    handleSelectAll,
    handleDeleteSelected
  } = useMessageSelection(messages)

  // Verifica permessi admin/moderatore
  const isAdminOrMod = (currentUser.roles || []).includes('admin') || 
                       (currentUser.roles || []).includes('moderator')

  // Handler invio messaggio
  const handleSendMessage = async (content: string) => {
    const channelName = channel.name.startsWith('#') ? channel.name : `#${channel.name}`

    // Echo ottimistico
    addOptimisticMessage(content, currentUser.username)

    // Invia al server tramite service
    try {
      await sendMessage({
        content,
        userId: currentUser.id,
        channelId: channel.id,
        channelName,
        username: currentUser.username
      })
    } catch (error) {
      console.error('❌ Errore invio messaggio:', error)
      alert('Errore durante l\'invio del messaggio')
    }
  }

  // Handler eliminazione singolo messaggio
  const handleDeleteMessage = async (messageId: string) => {
    if (!window.confirm('Sei sicuro di voler eliminare questo messaggio?')) {
      return
    }

    const result = await deleteMessage(messageId)
    
    if (result.success) {
      removeMessage(messageId)
    } else {
      alert(result.error || 'Errore eliminazione messaggio')
    }
  }

  // Handler eliminazione multipla
  const handleBulkDelete = () => {
    handleDeleteSelected((deletedIds) => {
      deletedIds.forEach(id => removeMessage(id))
    })
  }

  return (
    <div className="flex flex-col h-full bg-white dark:bg-gray-900">
      {/* Channel Header - Enterprise Style */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-blue-50 dark:bg-blue-900/30">
              <Hash className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                {channel.name}
              </h2>
              {channel.description && (
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                  {channel.description}
                </p>
              )}
            </div>
          </div>
          
          <div className="flex items-center space-x-2">
            <Circle 
              className={`w-2 h-2 ${socket?.connected ? 'fill-green-500 text-green-500' : 'fill-red-500 text-red-500'}`}
            />
            <span className="text-xs font-medium text-gray-600 dark:text-gray-300">
              {socket?.connected ? 'Connected' : 'Disconnected'}
            </span>
          </div>
        </div>
      </div>

      {/* Admin Actions Bar - Enterprise Style */}
      {isAdminOrMod && messages.length > 0 && (
        <div className="sticky top-0 z-10 bg-gray-50 dark:bg-gray-800/95 border-b border-gray-200 dark:border-gray-700 px-6 py-3">
          <div className="flex items-center gap-3">
            <button
              onClick={handleSelectAll}
              type="button"
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors
                       bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600
                       text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-600
                       focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
              title={selectAll ? 'Deselect all messages' : 'Select all messages'}
            >
              {selectAll ? (
                <CheckSquare className="w-4 h-4" />
              ) : (
                <Square className="w-4 h-4" />
              )}
              <span>{selectAll ? 'Deselect All' : 'Select All'}</span>
            </button>
            
            <button
              onClick={handleBulkDelete}
              type="button"
              disabled={selectedMessages.size === 0}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors
                       disabled:opacity-50 disabled:cursor-not-allowed
                       bg-red-600 text-white hover:bg-red-700
                       focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
              title="Delete selected messages"
            >
              <Trash2 className="w-4 h-4" />
              <span>Delete Selected</span>
              {selectedMessages.size > 0 && (
                <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-red-800">
                  {selectedMessages.size}
                </span>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Lista messaggi */}
      <MessageList
        messages={messages}
        currentUser={currentUser}
        selectedMessages={selectedMessages}
        isAdminOrMod={isAdminOrMod}
        onSelectMessage={handleSelectMessage}
        onDeleteMessage={handleDeleteMessage}
      />

      {/* Input messaggio */}
      <MessageInput
        channel={channel}
        currentUser={currentUser}
        isGuest={isGuest}
        onSendMessage={handleSendMessage}
      />
    </div>
  )
}
