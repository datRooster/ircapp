
import { notFound } from 'next/navigation';
import ChatWindow from '@/components/ChatWindow';
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma';

interface ChannelPageProps {
  params: { id: string }
}

export default async function ChannelPage({ params }: ChannelPageProps) {
  const session = await auth()
  const userSession = session?.user
  if (!userSession) return notFound()

  // Carica canale dinamicamente

  const channelRaw = await prisma.channel.findUnique({
    where: { id: params.id }
  });
  if (!channelRaw) return notFound();
  // Adatta il tipo per ChatWindow (aggiungi isReadOnly/users se mancano)
  const channel = {
    ...channelRaw,
    topic: channelRaw.topic ?? undefined,
    description: channelRaw.description ?? undefined,
    isReadOnly: false,
    users: [],
  };

  // Carica utente corrente

  const userRaw = await prisma.user.findUnique({
    where: { id: userSession.id }
  });
  if (!userRaw) return notFound();
  // joinedAt fallback per compatibilità tipo User
  const user = {
    ...userRaw,
    email: userRaw.email ?? undefined,
    avatar: userRaw.avatar ?? undefined,
    joinedAt: userRaw.createdAt,
  };

  return (
    <ChatWindow channel={channel} currentUser={user} isGuest={user.roles?.includes('guest')} />
  );
}
