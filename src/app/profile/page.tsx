
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import Image from 'next/image'
import Link from 'next/link'
import { FaGithub, FaMapMarkerAlt, FaUsers, FaBookOpen, FaUserCircle, FaUserShield, FaUserSlash, FaUserCheck, FaUserClock, FaHashtag, FaComments, FaCalendarAlt } from 'react-icons/fa'

// Force dynamic rendering - no static generation
export const dynamic = 'force-dynamic';

export default async function ProfilePage() {
  const session = await auth()
  if (!session?.user) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen text-center">
        <h2 className="text-2xl font-bold mb-4">Devi essere autenticato</h2>
        <Link href="/login" className="text-blue-500 underline">Vai al login</Link>
      </div>
    )
  }

  // Recupera utente dal database
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      username: true,
      email: true,
      avatar: true,
      name: true,
      isOnline: true,
      roles: true,
      createdAt: true,
      updatedAt: true,
      banReason: true,
      bannedUntil: true,
      isBanned: true,
      lastSeen: true,
      primaryRole: true,
      githubBio: true,
      githubLocation: true,
      githubRepos: true,
      githubFollowers: true,
      githubUrl: true,
      createdChannels: {
        select: { id: true, name: true, createdAt: true, isPrivate: true }
      },
      channelMembers: {
        select: {
          channel: { select: { id: true, name: true, isPrivate: true } },
          role: true,
          joinedAt: true
        }
      },
      messages: {
        select: { id: true, content: true, timestamp: true, channelId: true }
      }
    }
  })

  if (!user) {
    return <div className="text-center mt-20">Utente non trovato.</div>
  }


  // STATISTICHE
  const totalChannels = user.createdChannels.length
  const totalMemberships = user.channelMembers.length
  const totalMessages = user.messages.length

  return (
    <main className="min-h-screen bg-linear-to-br from-[#0a0f1a] via-[#10182a] to-[#0a0f1a] flex flex-col items-center py-0 px-2">
      {/* Header con cover e avatar */}
  <div className="w-full h-44 md:h-52 bg-linear-to-r from-blue-900 via-blue-800 to-blue-900 relative flex items-end justify-center shadow-xl rounded-b-2xl border-b-2 border-blue-800">
        <div className="absolute -bottom-20 z-20 flex flex-col items-center">
          <div className="relative">
            {user.avatar ? (
              <Image src={user.avatar} alt="Avatar" width={148} height={148} className="rounded-full border-4 border-blue-400 shadow-2xl bg-gray-900 object-cover" />
            ) : (
              <FaUserCircle className="w-36 h-36 text-gray-700 bg-gray-900 rounded-full border-4 border-blue-400 shadow-2xl" />
            )}
            <span className={`absolute bottom-3 right-3 w-7 h-7 border-2 border-gray-900 rounded-full ${user.isOnline ? 'bg-green-500' : 'bg-gray-500'}`} title={user.isOnline ? 'Online' : 'Offline'}></span>
          </div>
        </div>
      </div>
      {/* Card principale */}
      <section className="w-full max-w-4xl bg-[#10182a] rounded-2xl shadow-2xl border border-blue-900 p-8 md:p-10 flex flex-col gap-10 mt-28 mb-12 animate-fade-in">
        {/* Header utente e statistiche */}
        <div className="flex flex-col md:flex-row md:items-center md:gap-8 gap-6 justify-center text-center md:text-left">
          <div className="flex-1 min-w-0">
            <h1 className="text-4xl font-extrabold text-white flex items-center gap-2 justify-center md:justify-start">
              {user.username}
              {user.githubUrl && (
                <Link href={user.githubUrl} target="_blank" className="ml-2 text-blue-400 hover:text-white">
                  <FaGithub size={28} />
                </Link>
              )}
            </h1>
            <p className="text-lg text-blue-200 mt-1 font-mono break-all">{user.email}</p>
            <div className="mt-2 flex flex-wrap gap-2 justify-center md:justify-start">
              {user.roles.map(role => (
                <span key={role} className="text-xs font-semibold px-3 py-1 rounded-full bg-blue-900 text-blue-200 border border-blue-700 uppercase tracking-wider shadow">
                  {role}
                </span>
              ))}
              <span className="text-xs font-semibold px-3 py-1 rounded-full bg-gray-800 text-gray-300 border border-gray-700 uppercase tracking-wider shadow">
                {user.primaryRole}
              </span>
              {user.isBanned && (
                <span className="text-xs font-semibold px-3 py-1 rounded-full bg-red-900 text-red-200 border border-red-700 flex items-center gap-1 shadow" title="Utente bannato">
                  <FaUserSlash /> Bannato
                </span>
              )}
            </div>
            <div className="mt-2 flex flex-wrap gap-4 justify-center md:justify-start text-xs text-blue-300">
              <span className="flex items-center gap-1"><FaCalendarAlt /> Registrato: {new Date(user.createdAt).toLocaleString()}</span>
              <span className="flex items-center gap-1"><FaUserCheck /> Ultimo accesso: {new Date(user.lastSeen).toLocaleString()}</span>
              <span className="flex items-center gap-1"><FaUserClock /> Modifica: {new Date(user.updatedAt).toLocaleString()}</span>
            </div>
          </div>
          {/* Statistiche animate */}
          <div className="flex flex-row md:flex-col gap-4 md:gap-6 justify-center items-center md:items-end mt-4 md:mt-0 min-w-[220px]">
            <div className="flex flex-col items-center bg-linear-to-br from-blue-900 via-blue-800 to-blue-900 rounded-xl p-4 shadow-lg animate-fade-in-up min-w-[110px]">
              <FaHashtag className="text-blue-300 mb-1" size={28} />
              <span className="text-2xl font-bold text-white">{totalChannels}</span>
              <span className="text-xs text-blue-200">Canali creati</span>
            </div>
            <div className="flex flex-col items-center bg-linear-to-br from-blue-900 via-blue-800 to-blue-900 rounded-xl p-4 shadow-lg animate-fade-in-up min-w-[110px]">
              <FaComments className="text-blue-300 mb-1" size={28} />
              <span className="text-2xl font-bold text-white">{totalMessages}</span>
              <span className="text-xs text-blue-200">Messaggi</span>
            </div>
            <div className="flex flex-col items-center bg-linear-to-br from-blue-900 via-blue-800 to-blue-900 rounded-xl p-4 shadow-lg animate-fade-in-up min-w-[110px]">
              <FaUserShield className="text-blue-300 mb-1" size={28} />
              <span className="text-2xl font-bold text-white">{totalMemberships}</span>
              <span className="text-xs text-blue-200">Canali</span>
            </div>
          </div>
        </div>
        {/* Info e GitHub */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 text-blue-100">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="font-semibold">Nome:</span>
              <span>{user.name || '-'}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-semibold">ID:</span>
              <span className="text-xs text-blue-400 font-mono">{user.id}</span>
            </div>
            {user.banReason && (
              <div className="flex items-center gap-2 text-red-400">
                <FaUserSlash />
                <span>Bannato: {user.banReason}</span>
                {user.bannedUntil && (
                  <span className="ml-2">(fino al {new Date(user.bannedUntil).toLocaleString()})</span>
                )}
              </div>
            )}
          </div>
          <div className="space-y-2">
            {user.githubBio && (
              <div className="italic text-blue-300 border-l-4 border-blue-700 pl-3">{user.githubBio}</div>
            )}
            {user.githubLocation && (
              <div className="flex items-center gap-2">
                <FaMapMarkerAlt className="text-blue-400" />
                <span>{user.githubLocation}</span>
              </div>
            )}
            {user.githubRepos !== null && (
              <div className="flex items-center gap-1">
                <FaBookOpen className="text-blue-400" />
                <span className="font-semibold">{user.githubRepos}</span>
                <span className="text-xs text-blue-300">repo pubblici</span>
              </div>
            )}
            {user.githubFollowers !== null && (
              <div className="flex items-center gap-1">
                <FaUsers className="text-blue-400" />
                <span className="font-semibold">{user.githubFollowers}</span>
                <span className="text-xs text-blue-300">followers</span>
              </div>
            )}
            {user.githubUrl && (
              <div className="flex items-center gap-2 mt-2">
                <FaGithub className="text-blue-400" />
                <Link href={user.githubUrl} target="_blank" className="text-blue-400 underline break-all">{user.githubUrl}</Link>
              </div>
            )}
          </div>
        </div>
        {/* Canali e messaggi */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mt-4">
          <div className="bg-[#0a1120] rounded-xl p-6 shadow-lg">
            <h2 className="text-lg font-bold text-blue-300 mb-2 flex items-center gap-2"><FaHashtag /> Canali creati</h2>
            <ul className="space-y-1">
              {user.createdChannels.length === 0 && <li className="text-blue-800 text-sm">Nessun canale creato</li>}
              {user.createdChannels.map(ch => (
                <li key={ch.id} className="flex items-center gap-2 text-blue-100">
                  <FaHashtag className="text-blue-400" />
                  <span>{ch.name}</span>
                  {ch.isPrivate && <span className="text-xs bg-blue-900 text-blue-300 px-2 py-0.5 rounded ml-2">privato</span>}
                  <span className="text-xs text-blue-700 ml-2">{new Date(ch.createdAt).toLocaleDateString()}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="bg-[#0a1120] rounded-xl p-6 shadow-lg">
            <h2 className="text-lg font-bold text-blue-300 mb-2 flex items-center gap-2"><FaHashtag /> Canali a cui partecipa</h2>
            <ul className="space-y-1">
              {user.channelMembers.length === 0 && <li className="text-blue-800 text-sm">Nessuna partecipazione</li>}
              {user.channelMembers.map(m => (
                <li key={m.channel.id} className="flex items-center gap-2 text-blue-100">
                  <FaHashtag className="text-blue-400" />
                  <span>{m.channel.name}</span>
                  {m.channel.isPrivate && <span className="text-xs bg-blue-900 text-blue-300 px-2 py-0.5 rounded ml-2">privato</span>}
                  <span className="text-xs text-blue-700 ml-2">ruolo: {m.role}</span>
                  <span className="text-xs text-blue-700 ml-2">join: {new Date(m.joinedAt).toLocaleDateString()}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
        {/* Messaggi recenti */}
        <div className="bg-[#0a1120] rounded-xl p-6 shadow-lg mt-4">
          <h2 className="text-lg font-bold text-blue-300 mb-2 flex items-center gap-2"><FaComments /> Ultimi messaggi</h2>
          <ul className="space-y-1">
            {user.messages.length === 0 && <li className="text-blue-800 text-sm">Nessun messaggio inviato</li>}
            {user.messages.slice(-5).reverse().map(msg => (
              <li key={msg.id} className="flex items-center gap-2 text-blue-100">
                <span className="text-xs text-blue-700">{new Date(msg.timestamp).toLocaleString()}</span>
                <span className="bg-blue-900 px-2 py-1 rounded text-xs text-blue-200 font-mono">{msg.content}</span>
                <span className="text-xs text-blue-400 ml-2">canale: {msg.channelId}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </main>
  )
}
