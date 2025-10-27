'use client'

import { useState, useEffect } from 'react'
import { Channel } from '../types'
import { 
  FaCrown, 
  FaHashtag, 
  FaLock, 
  FaStar, 
  FaPlus,
  FaUsers,
  FaCog
} from 'react-icons/fa'

interface ChannelSidebarProps {
  channels: Channel[]
  currentChannel: string | null
  onChannelSelect: (channelId: string) => void
  onCreateChannel: () => void
  userRole?: string
  username?: string
  onOpenAdminPanel?: () => void
}

export default function ChannelSidebar({ 
  channels, 
  currentChannel, 
  onChannelSelect, 
  onCreateChannel,
  userRole = 'user',
  username = 'Usuario',
  onOpenAdminPanel
}: ChannelSidebarProps) {
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [newChannelName, setNewChannelName] = useState('')

  const handleCreateChannel = (e: React.FormEvent) => {
    e.preventDefault()
    if (!newChannelName.trim()) return

    // TODO: Implement channel creation
    console.log('Creating channel:', newChannelName)
    setNewChannelName('')
    setIsCreateModalOpen(false)
  }

  return (
    <div className="w-64 bg-gray-800 text-white flex flex-col">
      {/* Server Header */}
      <div className="p-4 border-b border-gray-700">
        <h1 className="text-xl font-bold">IRC Community</h1>
      </div>

      {/* Channels List */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">
              Canali
            </h2>
            <button
              onClick={() => setIsCreateModalOpen(true)}
              className="text-gray-400 hover:text-white transition-colors"
              title="Crea nuovo canale"
            >
              <FaPlus className="text-sm" />
            </button>
          </div>
          
          <div className="space-y-1">
            {channels.map((channel) => (
              <button
                key={channel.id}
                onClick={() => onChannelSelect(channel.id)}
                className={`w-full text-left px-2 py-1 rounded hover:bg-gray-700 transition-colors ${
                  currentChannel === channel.id ? 'bg-blue-600 hover:bg-blue-700' : ''
                } ${channel.isReadOnly ? 'border-l-2 border-yellow-500' : ''}`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <span className="text-gray-400">
                      {channel.id === 'lobby' ? (
                        <FaCrown className="text-yellow-400" />
                      ) : (
                        <FaHashtag />
                      )}
                    </span>
                    <span>{channel.name}</span>
                  </div>
                  {channel.isReadOnly && (
                    <div className="flex items-center space-x-1">
                      <FaLock className="text-yellow-400 text-xs" title="Solo lettura" />
                      {channel.id === 'lobby' && (
                        <FaStar className="text-blue-400 text-xs" title="Canale amministrativo" />
                      )}
                    </div>
                  )}
                </div>
              </button>
            ))}
          </div>
        </div>
        
        {/* Admin Panel Access */}
        {(userRole === 'admin' || userRole === 'moderator') && onOpenAdminPanel && (
          <div className="p-4 border-t border-gray-700">
            <button
              onClick={onOpenAdminPanel}
              className="w-full flex items-center space-x-3 p-2 rounded hover:bg-gray-700 transition-colors text-yellow-400 hover:text-yellow-300"
            >
              <FaCog className="text-lg" />
              <span className="font-medium">Pannello Admin</span>
            </button>
          </div>
        )}
      </div>

      {/* User Info */}
      <div className="p-4 border-t border-gray-700">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center">
            <div className="w-2 h-2 bg-white rounded-full"></div>
          </div>
          <div className="flex-1">
            <p className="font-semibold">{username}</p>
            <p className="text-xs text-gray-400 capitalize">{userRole}</p>
          </div>
        </div>
      </div>

      {/* Create Channel Modal */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-lg p-6 w-96">
            <h3 className="text-xl font-bold mb-4">Crea nuovo canale</h3>
            <form onSubmit={handleCreateChannel}>
              <input
                type="text"
                value={newChannelName}
                onChange={(e) => setNewChannelName(e.target.value)}
                placeholder="Nome del canale"
                className="w-full bg-gray-700 text-white rounded px-3 py-2 mb-4 focus:outline-none focus:ring-2 focus:ring-blue-500"
                autoFocus
              />
              <div className="flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-4 py-2 text-gray-400 hover:text-white"
                >
                  Annulla
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded"
                >
                  Crea
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}