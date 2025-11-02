'use client'

import { useState, useEffect } from 'react'
import { useSession, signOut } from 'next-auth/react'
import ChannelSidebar from '../components/ChannelSidebar'
import ChatWindow from '../components/ChatWindow'
import AdminPanel from '../components/AdminPanel'
import { Channel, User } from '../types'

export default function Home() {
  const { data: session, status } = useSession()
  const [channels, setChannels] = useState<Channel[]>([])
  const [currentChannel, setCurrentChannel] = useState<string | null>(null)
  const [showAdminPanel, setShowAdminPanel] = useState(false)

  // Carica canali dal database o mostra guest/help se guest
  const loadChannels = async () => {
    try {
      let data
      if (session?.user) {
        const response = await fetch('/api/channels')
        if (response.ok) {
          data = await response.json()
        }
      } else {
        // Guest: mostra solo canali guest e help
        const response = await fetch('/api/channels?guest=1')
        if (response.ok) {
          data = await response.json()
        }
      }
      setChannels(data?.channels || [])
      // Se guest, seleziona canale guest di default
      if (!session?.user && data?.channels?.length) {
        const guestChan = data.channels.find((c:any) => c.name === 'guest')
        setCurrentChannel(guestChan?.id || data.channels[0].id)
      } else if (session?.user && data?.channels?.length) {
        setCurrentChannel('lobby')
      }
    } catch (error) {
      console.error('Error loading channels:', error)
    }
  }

  useEffect(() => {
    loadChannels()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session])

  // Utente dalla sessione o guest
  const isGuest = !session?.user
  const currentUser: User = {
    id: session?.user?.id || 'guest',
    username: (session?.user as any)?.username || session?.user?.name || 'Guest',
    email: session?.user?.email || undefined,
    isOnline: true,
    joinedAt: new Date(),
    roles: isGuest ? ['guest'] : ((session?.user as any)?.roles || ['user'])
  }

  // Loading state
  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-white text-xl">Caricamento...</div>
      </div>
    )
  }

  const handleChannelSelect = (channelId: string) => {
    setCurrentChannel(channelId)
  }

  const handleOpenAdminPanel = () => {
    setShowAdminPanel(true)
  }

  const handleCloseAdminPanel = () => {
    setShowAdminPanel(false)
  }

  const getCurrentChannel = () => {
    return channels.find(channel => channel.id === currentChannel) || null
  }

  return (
    <div className="flex h-screen bg-gray-900">
      {/* Header con info utente */}
      <div className="fixed top-0 right-0 z-50 p-4">
        <div className="flex items-center space-x-4 bg-gray-800 rounded-lg px-4 py-2">
          <div className="text-white">
            <span className="text-sm text-gray-400">Connesso come:</span>
            <div className="font-semibold">
              {session?.user ? (
                <a href="/profile" className="hover:underline text-blue-300">{currentUser.username}</a>
              ) : (
                currentUser.username
              )}
              {session?.user && ((session?.user as any)?.roles?.includes('admin')) && (
                <span className="ml-2 text-xs bg-yellow-500 text-black px-2 py-1 rounded">ADMIN</span>
              )}
            </div>
          </div>
          <button
            onClick={() => signOut()}
            className="text-gray-400 hover:text-white text-sm px-3 py-1 border border-gray-600 rounded hover:border-gray-500"
          >
            Logout
          </button>
        </div>
      </div>

      <ChannelSidebar
        channels={channels}
        currentChannel={currentChannel}
        onChannelSelect={handleChannelSelect}
        userRole={currentUser.roles.includes('admin') ? 'admin' : currentUser.roles.includes('moderator') ? 'moderator' : isGuest ? 'guest' : 'user'}
        username={currentUser.username}
        onOpenAdminPanel={handleOpenAdminPanel}
      />
      
      <div className="flex-1 flex flex-col">
        {getCurrentChannel() ? (
          <ChatWindow
            key={getCurrentChannel()!.id}
            channel={getCurrentChannel()!}
            currentUser={currentUser}
            isGuest={isGuest}
          />
        ) : (
          <div className="flex-1 flex items-center justify-center bg-gray-900 text-white">
            <div className="text-center">
              <h2 className="text-2xl font-bold mb-4">Benvenuto in IRC Community</h2>
              <p className="text-gray-400">Seleziona un canale per iniziare a chattare</p>
            </div>
          </div>
        )}
      </div>
      
      {/* Admin Panel */}
      {showAdminPanel && (
        <AdminPanel
          userRole={currentUser.roles.includes('admin') ? 'admin' : currentUser.roles.includes('moderator') ? 'moderator' : 'user'}
          onClose={handleCloseAdminPanel}
        />
      )}
    </div>
  )
}
