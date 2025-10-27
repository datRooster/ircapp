export interface User {
  id: string;
  username: string;
  email?: string;
  avatar?: string;
  isOnline: boolean;
  joinedAt: Date;
  roles: string[];
}

export interface Channel {
  id: string;
  name: string;
  topic?: string;
  description?: string;
  isPrivate: boolean;
  isReadOnly: boolean;
  allowedRoles?: string[]; // Ruoli che possono scrivere in canali read-only
  users: User[];
  createdAt: Date;
  updatedAt: Date;
}

export interface Message {
  id: string;
  content: string;
  userId: string;
  user: User;
  channelId: string;
  channel: Channel;
  timestamp: Date;
  type: 'message' | 'join' | 'part' | 'quit' | 'action' | 'notice' | 'announcement';
}

export interface IRCServer {
  id: string;
  name: string;
  host: string;
  port: number;
  ssl: boolean;
  channels: Channel[];
  users: User[];
  isConnected: boolean;
}

export interface ChatState {
  currentChannel: string | null;
  channels: Channel[];
  messages: { [channelId: string]: Message[] };
  users: User[];
  isConnected: boolean;
}

export interface SocketEvents {
  'user-join': (data: { user: User; channel: string }) => void;
  'user-leave': (data: { userId: string; channel: string }) => void;
  'new-message': (message: Message) => void;
  'channel-update': (channel: Channel) => void;
  'user-update': (user: User) => void;
  connect: () => void;
  disconnect: () => void;
}