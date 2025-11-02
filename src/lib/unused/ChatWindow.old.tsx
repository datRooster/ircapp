'use client'

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
  const [messages, setMessages] = useState<MessageWithPending[]>([])
  const [isLoaded, setIsLoaded] = useState(false)
  const [newMessage, setNewMessage] = useState('')
  // La cifratura è gestita solo lato backend
  const [selectedMessages, setSelectedMessages] = useState<Set<string>>(new Set())
  const [selectAll, setSelectAll] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const socket = useSocket()
  // Gestione selezione multipla
  const isAdminOrMod = (currentUser.roles || []).includes('admin') || (currentUser.roles || []).includes('moderator');

  const handleSelectMessage = (id: string) => {
    setSelectedMessages(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  const handleSelectAll = () => {
    if (selectAll) {
      setSelectedMessages(new Set());
      setSelectAll(false);
    } else {
      setSelectedMessages(new Set(messages.filter(m => m.type !== 'announcement').map(m => m.id)));
      setSelectAll(true);
    }
  };

  const handleDeleteSelected = async () => {
    if (selectedMessages.size === 0) return;
    if (!window.confirm(`Sei sicuro di voler eliminare ${selectedMessages.size} messaggi?`)) return;
    for (const id of selectedMessages) {
      try {
        const res = await fetch(`/api/messages/${id}`, { method: 'DELETE' });
        // Non gestiamo errori singoli, UX enterprise: best effort
      } catch { }
    }
    setMessages(prev => prev.filter(m => !selectedMessages.has(m.id)));
    setSelectedMessages(new Set());
    setSelectAll(false);
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  // Web Crypto availability handled by useEncryption hook

  // Carica i messaggi del canale specifico
  useEffect(() => {
    const loadChannelMessages = async () => {
      console.log(`🔄 Loading messages for channel: ${channel.id}`)
      try {
        if (channel.id === 'lobby') {
          const { createLobbyMessages } = await import('../lib/lobby-messages')
          const lobbyMessages = createLobbyMessages(channel)
          setMessages(lobbyMessages)
          console.log(`✅ Loaded ${lobbyMessages.length} lobby messages`)
          return
        }
        // Solo al primo caricamento del canale, NON dopo invio messaggio
        const response = await fetch('/api/socketio', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'get-messages', channelId: channel.id })
        })
        const result = await response.json()
        const existingMessages = result.messages || []
        const processedMessages: Message[] = [...existingMessages]
        const welcomeMessage: Message = {
          id: `welcome-${channel.id}`,
          content: `Benvenuto nel canale #${channel.name}! ${existingMessages.length > 0 ? `Ci sono ${existingMessages.length} messaggi precedenti.` : 'Inizia la conversazione!'}`,
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
        setMessages([welcomeMessage, ...processedMessages])
        console.log(`✅ Loaded ${existingMessages.length} messages for #${channel.name}`)
      } catch (error) {
        console.error('❌ Error loading messages:', error)
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
    }
    // Carica solo al mount/cambio canale, MAI dopo invio messaggio
    loadChannelMessages()
    setIsLoaded(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channel.id, channel.name]) // Ricarica solo quando cambia canale

  useEffect(() => {
    if (!socket || !socket.connected) {
      console.log('⏳ Socket not ready yet...')
      return
    }

    console.log(`🏠 Joining channel: ${channel.id}`)
    // Join del canale
    socket.emit('join-channel', channel.id)

    // Listener per nuovi messaggi del canale specifico
    const handleNewMessage = async (message: Message) => {
      console.log('📨 Received message for channel check:', message.channelId, 'current:', channel.id)

      // Controlla che il messaggio sia per il canale corrente
      if (message.channelId === channel.id) {
        // Non mostrare mai messaggi cifrati in chat
        if (message.encrypted) {
          console.log('⏩ Messaggio cifrato ignorato in chat window')
          return
        }
        setMessages(prev => {
          // Sostituisci l'echo ottimistico se matcha per content, userId e pending
          const idx = prev.findIndex(m => (m as any).pending && m.content === message.content && m.userId === message.userId)
          if (idx !== -1) {
            const newArr = [...prev]
            newArr[idx] = { ...message }
            // Deduplica per id (mantieni la prima occorrenza)
            const seen = new Set<string>()
            return newArr.filter(m => {
              if (seen.has(m.id)) return false
              seen.add(m.id)
              return true
            })
          }

          // Rimuovi eventuali pending duplicati e aggiungi il messaggio reale
          const filtered = prev.filter(m => !((m as any).pending && m.content === message.content && m.userId === message.userId));
          // Se già presente (stesso id), non aggiungere ma deduplica
          if (filtered.find(m => m.id === message.id)) {
            const seen = new Set<string>()
            return filtered.filter(m => {
              if (seen.has(m.id)) return false
              seen.add(m.id)
              return true
            })
          }
          const combined = [...filtered, { ...message }]
          const seen = new Set<string>()
          return combined.filter(m => {
            if (seen.has(m.id)) return false
            seen.add(m.id)
            return true
          })
        })
      } else {
        console.log('ℹ️ Message is for different channel, ignoring')
      }
    }

    // Listener per errori
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
  }, [socket, socket?.connected, channel.id])


  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault()
    if (!newMessage.trim() || !socket) return
    // Guest: può scrivere solo in canali guest/help
    if (isGuest && !['guest', 'help'].includes(channel.name)) {
      console.log('❌ Guest può scrivere solo in guest/help')
      return
    }
    // Controlla permessi per canali read-only
    if (channel.isReadOnly) {
      const userRoles = currentUser.roles || ['user']
      const allowedRoles = channel.allowedRoles || ['admin']
      const hasPermission = userRoles.some((role: string) => allowedRoles.includes(role))
      if (!hasPermission) {
        console.log('❌ User has no permission to write in this channel')
        return
      }
    }
    (async () => {
      try {
        const channelName = channel.name.startsWith('#') ? channel.name : `#${channel.name}`
        // Echo ottimistico
        const optimisticId = `pending-${Date.now()}`
        const optimisticMsg: MessageWithPending = {
          id: optimisticId,
          content: newMessage,
          userId: currentUser.id,
          channelId: channel.id,
          timestamp: new Date(),
          user: currentUser,
          channel: channel,
          type: 'message', // Assicurati che sia minuscolo se richiesto dall'enum
          pending: true
        };
        setMessages(prev => [...prev, optimisticMsg])
        socket.emit('send-message', {
          content: newMessage,
          userId: currentUser.id,
          channelId: channel.id,
          channelName,
          username: currentUser.username
        })
        setNewMessage('')
      } catch (err) {
        console.error('❌ Invio messaggio errore', err)
        alert('Errore durante l\'invio del messaggio')
      }
    })()
  }

  // Handler per eliminazione messaggio (API + stato locale)
  const handleDeleteMessage = async (messageId: string) => {
    if (!window.confirm('Sei sicuro di voler eliminare questo messaggio?')) return;
    try {
      const res = await fetch(`/api/messages/${messageId}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || 'Errore eliminazione messaggio');
        return;
      }
      // Aggiorna stato locale rimuovendo il messaggio
      setMessages(prev => prev.filter(m => m.id !== messageId));
    } catch (err) {
      alert('Errore di rete nell\'eliminazione del messaggio');
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Channel Header */}
      <div className="bg-gray-800 text-white p-4 border-b border-gray-700">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold">#{channel.name}</h2>
            {channel.description && (
              <p className="text-gray-300 text-sm mt-1">{channel.description}</p>
            )}
          </div>
          <div className="flex items-center space-x-2">
            <div className={`w-3 h-3 rounded-full ${socket?.connected ? 'bg-green-500' : 'bg-red-500'}`}></div>
            <span className="text-sm text-gray-300">
              {socket?.connected ? 'Connesso' : 'Disconnesso'}
            </span>
          </div>
        </div>
      </div>

      {/* Messages + Azioni enterprise */}
      <div className="flex-1 overflow-y-auto bg-gray-900">
        {/* Barra azioni enterprise sopra la lista messaggi */}
        {isAdminOrMod && messages.length > 0 && (
          <div className="sticky top-0 z-10 flex items-center gap-2 bg-gray-900/95 py-2 px-4 border-b border-gray-800">
            <button
              className={`px-3 py-1 rounded border text-xs font-semibold transition ${selectAll ? 'bg-blue-700 border-blue-400 text-white' : 'bg-gray-700 border-gray-500 text-gray-200 hover:bg-blue-800 hover:text-white'}`}
              onClick={handleSelectAll}
              type="button"
              title={selectAll ? 'Deseleziona tutti' : 'Seleziona tutti'}
            >
              {selectAll ? 'Deseleziona tutti' : 'Seleziona tutti'}
            </button>
            <button
              className={`px-3 py-1 rounded border text-xs font-semibold transition ${selectedMessages.size > 0 ? 'bg-red-700 border-red-400 text-white hover:bg-red-800' : 'bg-gray-700 border-gray-500 text-gray-400 cursor-not-allowed'}`}
              onClick={handleDeleteSelected}
              type="button"
              disabled={selectedMessages.size === 0}
              title="Elimina tutti i messaggi selezionati"
            >
              Elimina selezionati
            </button>
          </div>
        )}
        {messages.map((message, idx) => {
          // Render speciale per messaggi di annuncio
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

          // UX: Nascondi echo bot webapp se è un duplicato del messaggio appena inviato dall'utente corrente
          if (
            message.user.username === 'webapp' &&
            idx > 0 &&
            messages[idx - 1].userId === currentUser.id &&
            message.content === `[${currentUser.username}] ${messages[idx - 1].content}`
          ) {
            return null;
          }

          // Mostra badge se messaggio arriva dal bot webapp
          const isWebappBot = message.user.username === 'webapp';

          // Controllo permessi: admin/moderatore del canale
          const userRoles = currentUser.roles || [];
          const canDelete = userRoles.includes('admin') || userRoles.includes('moderator');

          return (
            <div key={message.id} className={`flex items-start space-x-3 p-4 group hover:bg-gray-800/60 ${selectedMessages.has(message.id) ? 'bg-blue-900/40' : ''}`}>
              {/* Checkbox selezione multipla solo per admin/mod e non announcement */}
              {isAdminOrMod && (
                <input
                  type="checkbox"
                  checked={selectedMessages.has(message.id)}
                  onChange={() => handleSelectMessage(message.id)}
                  className="mt-2 accent-blue-600 w-4 h-4 border-gray-400 rounded focus:ring-2 focus:ring-blue-500"
                  title="Seleziona messaggio"
                />
              )}
              <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center text-white text-sm font-bold">
                {message.user.username.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1">
                <div className="flex items-center space-x-2">
                  <span className="font-semibold text-white">{message.user.username}</span>
                  {isWebappBot && (
                    <span className="text-xs bg-gray-700 text-blue-300 px-2 py-1 rounded-full border border-blue-400 ml-1">via webapp</span>
                  )}
                  <span className="text-xs text-gray-400">
                    {new Date(message.timestamp).toLocaleTimeString()}
                  </span>
                  {(message as any).secure && (
                    <span className="text-xs bg-green-600 px-2 py-1 rounded-full">
                      ✓ Sicuro
                    </span>
                  )}
                  {(message as any).encrypted && (
                    <span className="text-xs bg-blue-600 px-2 py-1 rounded-full">
                      🔒 Crittografato
                    </span>
                  )}
                  {/* Pulsante elimina, solo per admin/moderatore */}
                  {canDelete && (
                    <button
                      title="Elimina messaggio"
                      className="ml-2 text-red-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition"
                      onClick={() => handleDeleteMessage(message.id)}
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                  )}
                </div>
                <p className="text-gray-200 mt-1 wrap-break-word">{message.content}</p>
              </div>
            </div>
          )
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Message Input */}
      <form onSubmit={handleSendMessage} className="p-4 bg-gray-800 border-t border-gray-700">
        {/* Guest: solo guest/help */}
        {isGuest && !['guest', 'help'].includes(channel.name) ? (
          <div className="text-center py-4">
            <div className="text-yellow-400 mb-2">🔒 Solo utenti registrati possono scrivere qui</div>
            <div className="text-sm text-gray-400">
              Come ospite puoi scrivere solo nei canali <b>#guest</b> e <b>#help</b>.<br />
              Registrati o accedi per partecipare alle altre chat.
            </div>
          </div>
        ) : channel.isReadOnly && (() => {
          const userRoles = currentUser.roles || ['user']
          const allowedRoles = channel.allowedRoles || ['admin']
          const hasPermission = userRoles.some((role: string) => allowedRoles.includes(role))
          if (!hasPermission) {
            return (
              <div className="text-center py-4">
                <div className="text-yellow-400 mb-2">🔒 Canale di sola lettura</div>
                <div className="text-sm text-gray-400">
                  Solo gli amministratori possono scrivere in questo canale.
                  <br />
                  Seleziona un altro canale dalla sidebar per partecipare alle discussioni.
                </div>
              </div>
            )
          }
        })() || (
          <>
            <div className="mb-2 flex items-center space-x-4">
              <span className="text-sm text-blue-400 flex items-center gap-2">
                <span>🔒</span>
                <span>I messaggi sono sempre crittografati end-to-end</span>
              </span>
            </div>
            <div className="flex space-x-2">
              <input
                type="text"
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                placeholder={`Messaggio #${channel.name} (crittografato)`}
                className="flex-1 bg-gray-700 text-white rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                maxLength={1000}
              />
              <button
                type="submit"
                disabled={!newMessage.trim()}
                className="bg-blue-500 hover:bg-blue-600 disabled:bg-gray-600 text-white px-6 py-2 rounded-lg font-medium transition-colors flex items-center space-x-1"
              >
                <span>🔒</span>
                <span>Invia</span>
              </button>
            </div>
          </>
        )}
      </form>
    </div>
  );
}