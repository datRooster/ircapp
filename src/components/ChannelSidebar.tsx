'use client'

import { useState } from 'react'
import { Channel } from '../types'
import { 
  Hash, 
  Crown, 
  Lock, 
  Plus,
  X,
  Shield
} from 'lucide-react'

interface ChannelSidebarProps {
  channels: Channel[]
  currentChannel: string | null
  onChannelSelect: (channelId: string) => void
  userRole?: string
  username?: string
  onOpenAdminPanel?: () => void
}

export default function ChannelSidebar({ 
  channels, 
  currentChannel, 
  onChannelSelect, 
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
    <div className="w-72 bg-gray-50 dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 flex flex-col">
      {/* Server Header - Enterprise */}
      <div className="px-4 py-5 border-b border-gray-200 dark:border-gray-800">
        <h1 className="text-lg font-bold text-gray-900 dark:text-white">
          IRC Community
        </h1>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
          Enterprise Communication
        </p>
      </div>

      {/* Channels List - Enterprise Style */}
      <div className="flex-1 overflow-y-auto">
        <div className="px-3 py-4">
          <div className="flex items-center justify-between mb-3 px-2">
            <h2 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              Channels
            </h2>
            <button
              onClick={() => setIsCreateModalOpen(true)}
              className="p-1.5 rounded-md text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 
                       hover:bg-gray-200 dark:hover:bg-gray-800 transition-colors"
              title="Create new channel"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
          
          <div className="space-y-0.5">
            {channels.map((channel) => {
              const isActive = currentChannel === channel.id
              const isLobby = channel.id === 'lobby'
              
              return (
                <button
                  key={channel.id}
                  onClick={() => onChannelSelect(channel.id)}
                  className={`w-full group flex items-center gap-3 px-3 py-2.5 rounded-lg 
                            text-sm font-medium transition-all
                            ${isActive 
                              ? 'bg-blue-600 text-white shadow-sm' 
                              : 'text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-800'
                            }
                            ${channel.isReadOnly ? 'border-l-2 border-amber-500' : ''}`}
                >
                  {/* Icon */}
                  <div className={`shrink-0 ${isActive ? 'text-white' : 'text-gray-400 dark:text-gray-500'}`}>
                    {isLobby ? (
                      <Crown className="w-4 h-4" />
                    ) : (
                      <Hash className="w-4 h-4" />
                    )}
                  </div>
                  
                  {/* Channel Name */}
                  <span className="flex-1 text-left truncate">
                    {channel.name}
                  </span>
                  
                  {/* Badges */}
                  <div className="flex items-center gap-1">
                    {channel.isReadOnly && (
                      <Lock className={`w-3.5 h-3.5 ${isActive ? 'text-white' : 'text-amber-500'}`} />
                    )}
                  </div>
                </button>
              )
            })}
          </div>
        </div>
        
        {/* Admin Panel Access - Enterprise */}
        {(userRole === 'admin' || userRole === 'moderator') && onOpenAdminPanel && (
          <div className="px-3 pb-4">
            <div className="pt-4 border-t border-gray-200 dark:border-gray-800">
              <button
                onClick={onOpenAdminPanel}
                className="w-full px-3 py-2 rounded-lg 
                   bg-linear-to-r from-amber-500 to-orange-500 text-white
                   hover:from-amber-600 hover:to-orange-600 
                   transition-all duration-200 flex items-center justify-center gap-2
                   font-medium shadow-lg hover:shadow-xl"
              >
                <Shield className="w-4 h-4" />
                <span>Pannello Admin</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* User Info - Enterprise Profile Card */}
      <div className="px-4 py-4 border-t border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="w-10 h-10 rounded-lg bg-linear-to-br from-blue-500 to-blue-600 
                          flex items-center justify-center text-white font-semibold text-sm shadow-sm">
              {username.charAt(0).toUpperCase()}
            </div>
            {/* Online indicator */}
            <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-green-500 
                          border-2 border-white dark:border-gray-950 rounded-full"></div>
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm text-gray-900 dark:text-white truncate">
              {username}
            </p>
            <div className="flex items-center gap-1.5 mt-0.5">
              {(userRole === 'admin' || userRole === 'moderator') && (
                <Shield className="w-3 h-3 text-amber-500" />
              )}
              <p className="text-xs text-gray-500 dark:text-gray-400 capitalize">
                {userRole}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Create Channel Modal - Enterprise */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-md">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Create New Channel
              </h3>
              <button
                onClick={() => setIsCreateModalOpen(false)}
                className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-300
                         hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            {/* Modal Body */}
            <form onSubmit={handleCreateChannel} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Channel Name
                </label>
                <input
                  type="text"
                  value={newChannelName}
                  onChange={(e) => setNewChannelName(e.target.value)}
                  placeholder="e.g. general-discussion"
                  className="w-full px-4 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600
                           bg-white dark:bg-gray-700 text-gray-900 dark:text-white
                           placeholder-gray-400 dark:placeholder-gray-500
                           focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
                           transition-shadow"
                  autoFocus
                />
                <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                  Use lowercase letters, numbers, and hyphens
                </p>
              </div>
              
              {/* Modal Footer */}
              <div className="flex items-center justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300
                           hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!newChannelName.trim()}
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700
                           disabled:bg-gray-300 dark:disabled:bg-gray-700 disabled:cursor-not-allowed
                           rounded-lg transition-colors shadow-sm"
                >
                  Create Channel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}