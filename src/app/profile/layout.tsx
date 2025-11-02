import { ReactNode } from 'react'
import { prisma } from '@/lib/prisma'

// Sidebar statica: solo lista canali, nessun handler
export default async function ProfileLayout({ children }: { children: ReactNode }) {
  const channels = await prisma.channel.findMany({
    select: { id: true, name: true, isPrivate: true },
    orderBy: { name: 'asc' }
  })
  return (
    <div className="flex h-screen bg-gray-900">
      <aside className="w-64 bg-gray-800 text-white flex flex-col">
        <div className="p-4 border-b border-gray-700">
          <h1 className="text-xl font-bold">IRC Community</h1>
        </div>
        {/* Voci extra */}
        <nav className="p-4 border-b border-gray-700 space-y-2">
          <a href="/" className="flex items-center gap-2 px-3 py-2 rounded hover:bg-blue-900 transition-colors font-semibold text-blue-300">
            <span>🏠</span>
            <span>Home IRC</span>
          </a>
          <a href="/profile" className="flex items-center gap-2 px-3 py-2 rounded hover:bg-blue-900 transition-colors font-semibold text-blue-300">
            <span>👤</span>
            <span>Profilo</span>
          </a>
          <a href="/profile/security" className="flex items-center gap-2 px-3 py-2 rounded hover:bg-blue-900 transition-colors text-blue-200">
            <span>🔒</span>
            <span>Sicurezza</span>
          </a>
          <a href="/profile/settings" className="flex items-center gap-2 px-3 py-2 rounded hover:bg-blue-900 transition-colors text-blue-200">
            <span>⚙️</span>
            <span>Impostazioni</span>
          </a>
        </nav>
        <div className="flex-1 overflow-y-auto p-4">
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-2">Canali</h2>
          <div className="space-y-1">
            {channels.map((channel) => (
              <div key={channel.id} className={`w-full text-left px-2 py-1 rounded ${channel.isPrivate ? 'bg-gray-700' : ''}`}>
                <span className="text-gray-400 mr-2">#</span>
                <span>{channel.name}</span>
                {channel.isPrivate && <span className="ml-2 text-xs bg-gray-700 text-gray-300 px-2 py-0.5 rounded">privato</span>}
              </div>
            ))}
          </div>
        </div>
      </aside>
      <div className="flex-1 flex flex-col overflow-y-auto">
        {children}
      </div>
    </div>
  )
}
