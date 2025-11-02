import { prisma } from '@/lib/prisma';
import Link from 'next/link';

// Force dynamic rendering - no static generation
export const dynamic = 'force-dynamic';

export default async function ChannelsListPage() {
  const channels = await prisma.channel.findMany({ orderBy: { name: 'asc' } });
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Canali disponibili</h1>
      <ul className="space-y-2">
        {channels.map(channel => (
          <li key={channel.id}>
            <Link href={`/channels/${channel.id}`} className="text-blue-500 hover:underline">
              #{channel.name}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
