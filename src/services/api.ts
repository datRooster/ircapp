/**
 * Service layer per le API calls
 * Centralizza tutte le chiamate API per messaggi e canali
 */

export interface SendMessagePayload {
  content: string
  userId: string
  channelId: string
  channelName: string
  username: string
  encrypted?: boolean
  iv?: string
  keyId?: string
}

export interface GetMessagesPayload {
  channelId: string
}

/**
 * Invia un messaggio al server
 */
export async function sendMessage(payload: SendMessagePayload): Promise<{ success: boolean; message?: any; error?: string }> {
  try {
    const response = await fetch('/api/socketio', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...payload, action: 'send-message' })
    })

    const result = await response.json()

    if (!response.ok) {
      throw new Error(result.error || 'Errore invio messaggio')
    }

    return result
  } catch (error) {
    console.error('❌ Send message error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Errore sconosciuto'
    }
  }
}

/**
 * Carica messaggi di un canale
 */
export async function getMessages(payload: GetMessagesPayload) {
  try {
    const response = await fetch('/api/socketio', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...payload, action: 'get-messages' })
    })

    const result = await response.json()

    if (!response.ok) {
      throw new Error(result.error || 'Errore caricamento messaggi')
    }

    return {
      success: true,
      messages: result.messages || []
    }
  } catch (error) {
    console.error('❌ Get messages error:', error)
    return {
      success: false,
      messages: [],
      error: error instanceof Error ? error.message : 'Errore sconosciuto'
    }
  }
}

/**
 * Elimina un messaggio
 */
export async function deleteMessage(messageId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await fetch(`/api/messages/${messageId}`, {
      method: 'DELETE'
    })

    const result = await response.json()

    if (!response.ok) {
      throw new Error(result.error || 'Errore eliminazione messaggio')
    }

    return { success: true }
  } catch (error) {
    console.error('❌ Delete message error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Errore sconosciuto'
    }
  }
}

/**
 * Carica canali disponibili
 */
export async function getChannels() {
  try {
    const response = await fetch('/api/channels')
    const result = await response.json()

    if (!response.ok) {
      throw new Error(result.error || 'Errore caricamento canali')
    }

    return {
      success: true,
      channels: result.channels || []
    }
  } catch (error) {
    console.error('❌ Get channels error:', error)
    return {
      success: false,
      channels: [],
      error: error instanceof Error ? error.message : 'Errore sconosciuto'
    }
  }
}

/**
 * Imposta il topic di un canale (solo admin)
 */
export async function setChannelTopic(channelId: string, topic: string): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await fetch('/api/admin/set-topic', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ channelId, topic })
    })

    const result = await response.json()

    if (!response.ok) {
      throw new Error(result.error || 'Errore impostazione topic')
    }

    return { success: true }
  } catch (error) {
    console.error('❌ Set topic error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Errore sconosciuto'
    }
  }
}
