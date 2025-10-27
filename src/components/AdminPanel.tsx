import React, { useState, useEffect } from 'react'
import { useSetTopic } from '../hooks/useSetTopic'
import TopicEditor from './TopicEditor'
import { FaCrown, FaPlus, FaCog, FaUsers, FaShieldAlt, FaArchive, FaEdit, FaTrash } from 'react-icons/fa'

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
              {channel.category === 'ADMIN' && <FaCrown className="text-yellow-400" />}
              {channel.category === 'MODERATION' && <FaShieldAlt className="text-blue-400" />}
              {channel.isPrivate && <FaShieldAlt className="text-red-400" />}
              {channel.isArchived && <FaArchive className="text-gray-400" />}
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
              <FaUsers className="inline mr-1" />
              {channel._count?.members || 0}
            </span>
            {(userRole === 'admin' || userRole === 'moderator') && (
              <div className="flex space-x-1">
                <button className="p-1 text-blue-400 hover:bg-blue-400/20 rounded" onClick={() => { setEditingChannel(channel); setEditData({}) }}>
                  <FaEdit size={12} />
                </button>
                <button className="p-1 text-red-400 hover:bg-red-400/20 rounded">
                  <FaTrash size={12} />
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

  if (!['admin', 'moderator'].includes(userRole)) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-gray-900 p-6 rounded-lg max-w-md w-full mx-4">
          <h2 className="text-xl font-bold text-red-400 mb-4">Accesso Negato</h2>
          <p className="text-gray-300 mb-4">
            Non hai i permessi necessari per accedere al pannello di amministrazione.
          </p>
          <button 
            onClick={onClose}
            className="w-full bg-red-600 hover:bg-red-700 text-white py-2 px-4 rounded"
          >
            Chiudi
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-gray-900 w-full max-w-6xl h-5/6 mx-4 rounded-lg flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-700">
          <div className="flex items-center space-x-3">
            <FaCrown className="text-yellow-400" />
            <h2 className="text-xl font-bold text-white">Pannello Amministrazione</h2>
            <span className="text-sm bg-blue-600 px-2 py-1 rounded">{userRole}</span>
          </div>
          <button 
            onClick={onClose}
            className="text-gray-400 hover:text-white text-xl"
          >
            ×
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-700">
          <button
            onClick={() => setActiveTab('channels')}
            className={`px-6 py-3 font-medium ${
              activeTab === 'channels' 
                ? 'text-blue-400 border-b-2 border-blue-400' 
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <FaCog className="inline mr-2" />
            Gestione Canali
          </button>
          <button
            onClick={() => setActiveTab('users')}
            className={`px-6 py-3 font-medium ${
              activeTab === 'users' 
                ? 'text-blue-400 border-b-2 border-blue-400' 
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <FaUsers className="inline mr-2" />
            Gestione Utenti
          </button>
          <button
            onClick={() => setActiveTab('security')}
            className={`px-6 py-3 font-medium ${
              activeTab === 'security' 
                ? 'text-blue-400 border-b-2 border-blue-400' 
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <FaShieldAlt className="inline mr-2" />
            Sicurezza
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
                    className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg flex items-center space-x-2"
                  >
                    <FaPlus />
                    <span>Nuovo Canale</span>
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