import React, { useState, useEffect } from 'react'
import TopicEditor from './TopicEditor'
import { 
  X, 
  Hash, 
  Users, 
  Shield, 
  Plus, 
  Edit, 
  Trash2, 
  Archive,
  Settings
} from 'lucide-react'

interface Channel {
  id: string
  name: string
  description?: string
  category: 'GENERAL' | 'ADMIN' | 'MODERATION' | 'PRIVATE' | 'ARCHIVED'
  requiredRole: string
  isPrivate: boolean
  isArchived: boolean
  parentId?: string
  maxMembers?: number
  _count?: {
    members: number
    messages: number
  }
  children?: Channel[]
  creator?: {
    username: string
  }
}

interface AdminPanelProps {
  userRole: string
  onClose: () => void
}

const AdminPanel: React.FC<AdminPanelProps> = ({ userRole, onClose }) => {
  const [activeTab, setActiveTab] = useState<'channels' | 'users' | 'security'>('channels')
  const [channels, setChannels] = useState<Channel[]>([])
  const [showCreateChannel, setShowCreateChannel] = useState(false)
  const [loading, setLoading] = useState(true)

  const [newChannel, setNewChannel] = useState({
    name: '',
    description: '',
    category: 'GENERAL' as Channel['category'],
    requiredRole: 'user',
    isPrivate: false,
    parentId: '',
    maxMembers: ''
  })

  // Stato per editing canale
  const [editingChannel, setEditingChannel] = useState<Channel | null>(null)
  const [editData, setEditData] = useState<any>({})

  // Carica canali
  const loadChannels = async () => {
    try {
      const response = await fetch('/api/admin/channels')
      if (response.ok) {
        const data = await response.json()
        setChannels(data.channels || [])
      }
    } catch (error) {
      console.error('Error loading channels:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadChannels()
  }, [])

  // Crea nuovo canale
  const handleCreateChannel = async (e: React.FormEvent) => {
    e.preventDefault()
    
    try {
      const response = await fetch('/api/admin/channels', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...newChannel,
          maxMembers: newChannel.maxMembers ? parseInt(newChannel.maxMembers) : null
        })
      })

      if (response.ok) {
        await loadChannels()
        setShowCreateChannel(false)
        setNewChannel({
          name: '',
          description: '',
          category: 'GENERAL',
          requiredRole: 'user',
          isPrivate: false,
          parentId: '',
          maxMembers: ''
        })
      }
    } catch (error) {
      console.error('Error creating channel:', error)
    }
  }

  // Salva modifiche canale
  const handleEditChannel = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingChannel) return
    try {
      const response = await fetch('/api/admin/channels', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          channelId: editingChannel.id,
          ...editData
        })
      })
      if (response.ok) {
        await loadChannels()
        setEditingChannel(null)
        setEditData({})
      }
    } catch (error) {
      console.error('Errore aggiornamento canale:', error)
    }
  }

  // Renderizza albero dei canali
  const renderChannelTree = (channelList: Channel[], level = 0) => {
    return channelList.map(channel => (
      <div key={channel.id} className={`ml-${level * 4}`}>
        <div className="flex items-center justify-between p-3 bg-gray-800 rounded-lg mb-2">
          <div className="flex items-center space-x-3">
            <div className="flex items-center space-x-2">
              {channel.category === 'ADMIN' && <Settings className="text-amber-500 w-3.5 h-3.5" />}
              {channel.category === 'MODERATION' && <Shield className="text-blue-500 w-3.5 h-3.5" />}
              {channel.isPrivate && <Shield className="text-red-500 w-3.5 h-3.5" />}
              {channel.isArchived && <Archive className="text-gray-400 w-3.5 h-3.5" />}
              <span className="font-medium text-white">#{channel.name}</span>
            </div>
            <div className="text-sm text-gray-400">
              {channel.description && `- ${channel.description}`}
            </div>
          </div>
          
          <div className="flex items-center space-x-2">
            <span className="text-xs bg-gray-700 px-2 py-1 rounded">
              {channel.category}
            </span>
            <span className="text-xs text-gray-400">
              <Users className="inline w-4 h-4 mr-1" />
              {channel._count?.members || 0}
            </span>
            {(userRole === 'admin' || userRole === 'moderator') && (
              <div className="flex space-x-1">
                <button className="p-1 text-blue-400 hover:bg-blue-400/20 rounded" onClick={() => { setEditingChannel(channel); setEditData({}) }}>
                  <Edit className="w-3 h-3" />
                </button>
                <button className="p-1 text-red-400 hover:bg-red-400/20 rounded">
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            )}
          </div>
        </div>
        
        {channel.children && channel.children.length > 0 && (
          <div className="ml-4">
            {renderChannelTree(channel.children, level + 1)}
          </div>
        )}
      </div>
    ))
  }

  const canCreateChannels = userRole === 'admin' || userRole === 'moderator'

  // Access Denied - Enterprise Alert
  if (!['admin', 'moderator'].includes(userRole)) {
    return (
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-md w-full p-6">
          <div className="flex items-start gap-4 mb-4">
            <div className="shrink-0 w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/30 
                          flex items-center justify-center">
              <Shield className="w-6 h-6 text-red-600 dark:text-red-400" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
                Access Denied
              </h2>
              <p className="text-gray-600 dark:text-gray-300">
                You don't have the necessary permissions to access the administration panel.
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="w-full py-2.5 px-4 bg-red-600 hover:bg-red-700 text-white font-medium
                     rounded-lg transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    )
  }

  // Main Admin Panel - Enterprise Design
  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-900 w-full max-w-7xl h-[90vh] rounded-xl shadow-2xl flex flex-col overflow-hidden">
        {/* Header - Enterprise */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-800 
                      bg-linear-to-r from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-lg bg-linear-to-br from-amber-500 to-orange-500 
                          flex items-center justify-center shadow-lg">
              <Settings className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                Administration Panel
              </h2>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Manage channels, users, and security settings
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="px-3 py-1.5 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700
                           text-sm font-medium text-gray-700 dark:text-gray-300 capitalize">
              {userRole}
            </span>
            <button 
              onClick={onClose}
              className="p-2 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-300
                       hover:bg-white dark:hover:bg-gray-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Tabs - Enterprise Navigation */}
        <div className="flex border-b border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-950 px-6">
          <button
            onClick={() => setActiveTab('channels')}
            className={`inline-flex items-center gap-2 px-4 py-3 font-medium text-sm border-b-2 transition-colors
              ${activeTab === 'channels' 
                ? 'border-blue-500 text-blue-600 dark:text-blue-400' 
                : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
              }`}
          >
            <Hash className="w-4 h-4" />
            <span>Channel Management</span>
          </button>
          <button
            onClick={() => setActiveTab('users')}
            className={`inline-flex items-center gap-2 px-4 py-3 font-medium text-sm border-b-2 transition-colors
              ${activeTab === 'users' 
                ? 'border-blue-500 text-blue-600 dark:text-blue-400' 
                : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
              }`}
          >
            <Users className="w-4 h-4" />
            <span>User Management</span>
          </button>
          <button
            onClick={() => setActiveTab('security')}
            className={`inline-flex items-center gap-2 px-4 py-3 font-medium text-sm border-b-2 transition-colors
              ${activeTab === 'security' 
                ? 'border-blue-500 text-blue-600 dark:text-blue-400' 
                : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
              }`}
          >
            <Shield className="w-4 h-4" />
            <span>Security</span>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 p-4 overflow-y-auto">
          {activeTab === 'channels' && (
            <div>
              {/* Header Canali */}
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold text-white">Gestione Canali</h3>
                {canCreateChannels && (
                  <button
                    onClick={() => setShowCreateChannel(true)}
                    className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 
                             text-white font-medium rounded-lg transition-colors shadow-sm"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Create Channel</span>
                  </button>
                )}
              </div>

              {/* Lista Canali */}
              {loading ? (
                <div className="text-center text-gray-400 py-8">Caricamento canali...</div>
              ) : (
                <div className="space-y-2">
                  {renderChannelTree(channels.filter(c => !c.parentId))}
                </div>
              )}

              {/* Form Creazione Canale */}
              {showCreateChannel && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-60">
                  <div className="bg-gray-800 p-6 rounded-lg max-w-md w-full mx-4">
                    <h3 className="text-lg font-bold text-white mb-4">Crea Nuovo Canale</h3>
                    <form onSubmit={handleCreateChannel} className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">
                          Nome Canale
                        </label>
                        <input
                          type="text"
                          value={newChannel.name}
                          onChange={(e) => setNewChannel({...newChannel, name: e.target.value})}
                          className="w-full p-2 bg-gray-700 border border-gray-600 rounded text-white"
                          placeholder="general, aiuto, off-topic..."
                          required
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">
                          Descrizione
                        </label>
                        <input
                          type="text"
                          value={newChannel.description}
                          onChange={(e) => setNewChannel({...newChannel, description: e.target.value})}
                          className="w-full p-2 bg-gray-700 border border-gray-600 rounded text-white"
                          placeholder="Descrizione del canale..."
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">
                          Categoria
                        </label>
                        <select
                          value={newChannel.category}
                          onChange={(e) => setNewChannel({...newChannel, category: e.target.value as Channel['category']})}
                          className="w-full p-2 bg-gray-700 border border-gray-600 rounded text-white"
                        >
                          <option value="GENERAL">Generale</option>
                          <option value="MODERATION">Solo Moderatori</option>
                          {userRole === 'admin' && <option value="ADMIN">Solo Admin</option>}
                          <option value="PRIVATE">Privato</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">
                          Ruolo Richiesto
                        </label>
                        <select
                          value={newChannel.requiredRole}
                          onChange={(e) => setNewChannel({...newChannel, requiredRole: e.target.value})}
                          className="w-full p-2 bg-gray-700 border border-gray-600 rounded text-white"
                        >
                          <option value="user">Utente</option>
                          <option value="moderator">Moderatore</option>
                          {userRole === 'admin' && <option value="admin">Admin</option>}
                        </select>
                      </div>

                      <div className="flex space-x-3">
                        <button
                          type="submit"
                          className="flex-1 bg-green-600 hover:bg-green-700 text-white py-2 px-4 rounded"
                        >
                          Crea Canale
                        </button>
                        <button
                          type="button"
                          onClick={() => setShowCreateChannel(false)}
                          className="flex-1 bg-gray-600 hover:bg-gray-700 text-white py-2 px-4 rounded"
                        >
                          Annulla
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
              )}

              {/* Modale di editing canale */}
              {editingChannel && (
                <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-60">
                  <div className="bg-gray-800 p-6 rounded-lg max-w-md w-full mx-4">
                    <h3 className="text-lg font-bold text-white mb-4">Modifica Canale #{editingChannel.name}</h3>
                    <form onSubmit={handleEditChannel} className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">Descrizione</label>
                        <input
                          type="text"
                          value={editData.description ?? editingChannel.description ?? ''}
                          onChange={e => setEditData({...editData, description: e.target.value})}
                          className="w-full p-2 bg-gray-700 border border-gray-600 rounded text-white"
                          placeholder="Descrizione del canale..."
                        />
                      </div>
                      {/* Campo topic IRC per tutti i canali */}
                      <TopicEditor channelName={editingChannel.name} />
                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">Categoria</label>
                        <select
                          value={editData.category ?? editingChannel.category}
                          onChange={e => setEditData({...editData, category: e.target.value})}
                          className="w-full p-2 bg-gray-700 border border-gray-600 rounded text-white"
                        >
                          <option value="GENERAL">Generale</option>
                          <option value="MODERATION">Solo Moderatori</option>
                          {userRole === 'admin' && <option value="ADMIN">Solo Admin</option>}
                          <option value="PRIVATE">Privato</option>
                          <option value="GUEST">Guest</option>
                          <option value="HELP">Help</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">Ruolo Richiesto</label>
                        <select
                          value={editData.requiredRole ?? editingChannel.requiredRole}
                          onChange={e => setEditData({...editData, requiredRole: e.target.value})}
                          className="w-full p-2 bg-gray-700 border border-gray-600 rounded text-white"
                        >
                          <option value="user">Utente</option>
                          <option value="moderator">Moderatore</option>
                          {userRole === 'admin' && <option value="admin">Admin</option>}
                          <option value="guest">Guest</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">Privato</label>
                        <input
                          type="checkbox"
                          checked={editData.isPrivate ?? editingChannel.isPrivate}
                          onChange={e => setEditData({...editData, isPrivate: e.target.checked})}
                          className="mr-2"
                        />
                        <span className="text-gray-300">Canale privato</span>
                      </div>
                      <div className="flex space-x-3">
                        <button type="submit" className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded">Salva</button>
                        <button type="button" onClick={() => setEditingChannel(null)} className="flex-1 bg-gray-600 hover:bg-gray-700 text-white py-2 px-4 rounded">Annulla</button>
                      </div>
                    </form>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'users' && (
            <div className="text-center text-gray-400 py-8">
              Gestione Utenti - In sviluppo
            </div>
          )}

          {activeTab === 'security' && (
            <div className="text-center text-gray-400 py-8">
              Impostazioni Sicurezza - In sviluppo
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default AdminPanel