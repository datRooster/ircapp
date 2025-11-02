'use client'

import { 
  FaCrown, 
  FaShieldAlt, 
  FaTerminal, 
  FaHome, 
  FaExclamationTriangle,
  FaHeart
} from 'react-icons/fa'

interface AnnouncementMessageProps {
  id: string
  content: string
  timestamp: Date
}

const getIconForMessage = (id: string) => {
  switch (id) {
    case 'lobby-welcome':
      return <FaCrown className="text-yellow-400" />
    case 'lobby-rules':
      return <FaShieldAlt className="text-blue-400" />
    case 'lobby-commands':
      return <FaTerminal className="text-green-400" />
    case 'lobby-channels':
      return <FaHome className="text-purple-400" />
    case 'lobby-footer':
      return <FaHeart className="text-red-400" />
    default:
      return <FaExclamationTriangle className="text-orange-400" />
  }
}

const getTitleForMessage = (id: string) => {
  switch (id) {
    case 'lobby-welcome':
      return 'BENVENUTO NELLA COMMUNITY'
    case 'lobby-rules':
      return 'REGOLE DELLA COMMUNITY'
    case 'lobby-commands':
      return 'COMANDI DISPONIBILI'
    case 'lobby-channels':
      return 'CANALI DISPONIBILI'
    case 'lobby-footer':
      return 'BUONA PERMANENZA'
    default:
      return 'ANNUNCIO'
  }
}

export default function AnnouncementMessage({ id, content, timestamp }: AnnouncementMessageProps) {
  const icon = getIconForMessage(id)
  const title = getTitleForMessage(id)

  return (
    <div className="my-6 px-4">
      <div className="max-w-2xl mx-auto bg-linear-to-r from-gray-800 to-gray-700 rounded-lg p-6 border border-gray-600 shadow-lg">
        {/* Header con icona e titolo */}
        <div className="flex items-center justify-center mb-4">
          <div className="flex items-center space-x-3">
            <div className="text-2xl">
              {icon}
            </div>
            <h3 className="text-lg font-bold text-white uppercase tracking-wider">
              {title}
            </h3>
          </div>
        </div>

        {/* Contenuto */}
        <div className="text-center">
          <div className="text-gray-300 leading-relaxed whitespace-pre-line">
            {content}
          </div>
        </div>

        {/* Timestamp */}
        <div className="flex justify-center mt-4 pt-3 border-t border-gray-600">
          <span className="text-xs text-gray-400">
            {new Date(timestamp).toLocaleTimeString('it-IT')}
          </span>
        </div>
      </div>
    </div>
  )
}