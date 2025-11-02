/**
 * Custom hook per gestire la selezione multipla di messaggi
 * Utilizzato per bulk operations (es. eliminazione multipla)
 */

'use client'

import { useState, useCallback } from 'react'
import { MessageWithPending } from '../types'

export function useMessageSelection(messages: MessageWithPending[]) {
  const [selectedMessages, setSelectedMessages] = useState<Set<string>>(new Set())
  const [selectAll, setSelectAll] = useState(false)

  const handleSelectMessage = useCallback((id: string) => {
    setSelectedMessages(prev => {
      const newSet = new Set(prev)
      if (newSet.has(id)) {
        newSet.delete(id)
      } else {
        newSet.add(id)
      }
      return newSet
    })
  }, [])

  const handleSelectAll = useCallback(() => {
    if (selectAll) {
      setSelectedMessages(new Set())
      setSelectAll(false)
    } else {
      const selectableIds = messages
        .filter(m => m.type !== 'announcement')
        .map(m => m.id)
      setSelectedMessages(new Set(selectableIds))
      setSelectAll(true)
    }
  }, [selectAll, messages])

  const handleDeleteSelected = useCallback(async (onDelete: (ids: string[]) => void) => {
    if (selectedMessages.size === 0) return

    if (!window.confirm(`Sei sicuro di voler eliminare ${selectedMessages.size} messaggi?`)) {
      return
    }

    const idsToDelete = Array.from(selectedMessages)
    
    // Chiamata API per eliminare
    for (const id of idsToDelete) {
      try {
        await fetch(`/api/messages/${id}`, { method: 'DELETE' })
      } catch (error) {
        console.error(`Errore eliminazione messaggio ${id}:`, error)
      }
    }

    // Callback per aggiornare UI
    onDelete(idsToDelete)

    // Reset selezione
    setSelectedMessages(new Set())
    setSelectAll(false)
  }, [selectedMessages])

  const clearSelection = useCallback(() => {
    setSelectedMessages(new Set())
    setSelectAll(false)
  }, [])

  return {
    selectedMessages,
    selectAll,
    handleSelectMessage,
    handleSelectAll,
    handleDeleteSelected,
    clearSelection
  }
}
