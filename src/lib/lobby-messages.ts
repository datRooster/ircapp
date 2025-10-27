import { Message, Channel, User } from '../types'

export const createLobbyMessages = (channel: Channel): Message[] => {
  const systemUser: User = {
    id: 'ircbot',
    username: 'IRCBot',
    isOnline: true,
    joinedAt: new Date(),
    roles: ['admin', 'bot']
  }

  const messages: Message[] = [
    {
      id: 'lobby-welcome',
      content: 'Benvenuto nella IRC Community!\n\nQuesto è il canale lobby dove puoi leggere le regole e informazioni della community.\nSolo gli amministratori possono scrivere qui per mantenere ordine e chiarezza.',
      userId: 'ircbot',
      user: systemUser,
      channelId: channel.id,
      channel: channel,
      timestamp: new Date(Date.now() - 300000),
      type: 'announcement'
    },

    {
      id: 'lobby-rules',
      content: `Rispetto reciproco\n• Tratta tutti i membri con cortesia e rispetto\n• Non tollerare comportamenti offensivi\n\nComunicazione responsabile\n• Evita spam e messaggi ripetitivi\n• Usa i canali appropriati\n• Mantieni un linguaggio appropriato\n\nSicurezza e moderazione\n• Non condividere informazioni sensibili\n• Gli amministratori hanno l'autorità finale\n• Le violazioni comportano sanzioni`,
      userId: 'ircbot',
      user: systemUser,
      channelId: channel.id,
      channel: channel,
      timestamp: new Date(Date.now() - 250000),
      type: 'announcement'
    },

    {
      id: 'lobby-commands',
      content: `Comandi base\n• /help - Mostra l'elenco completo\n• /join #canale - Unisciti a un canale\n• /users - Mostra utenti online\n• /me [azione] - Messaggio di azione\n\nSicurezza\n• /encrypt - Attiva crittografia messaggi\n• Toggle crittografia nell'interfaccia\n\nComandi amministratore\n• /kick [utente] - Espelli utente\n• /ban [utente] - Banna utente`,
      userId: 'ircbot',
      user: systemUser,
      channelId: channel.id,
      channel: channel,
      timestamp: new Date(Date.now() - 200000),
      type: 'announcement'
    },

    {
      id: 'lobby-channels',
      content: `#lobby (Solo lettura)\nRegole e informazioni della community\nAnnunci ufficiali degli amministratori\n\n#general\nDiscussioni generali della community\nChat libera e socializzazione\n\n#tech\nDiscussioni tecniche e programmazione\nSupporto tecnico e condivisione codice\n\nCome partecipare\nUsa /join #nome-canale oppure clicca sui canali nella sidebar`,
      userId: 'ircbot',
      user: systemUser,
      channelId: channel.id,
      channel: channel,
      timestamp: new Date(Date.now() - 150000),
      type: 'announcement'
    },

    {
      id: 'lobby-footer',
      content: 'Buona permanenza nella IRC Community!\n\nInizia selezionando un canale dalla sidebar per partecipare alle discussioni.\nPer domande o supporto, contatta un amministratore.',
      userId: 'ircbot',
      user: systemUser,
      channelId: channel.id,
      channel: channel,
      timestamp: new Date(Date.now() - 100000),
      type: 'announcement'
    }
  ]

  return messages
}