# IRC Web App - Architettura Tecnica

## 📐 Panoramica Architetturale

Questa applicazione implementa un sistema di chat web che si interfaccia con il protocollo IRC attraverso un bridge HTTP personalizzato.

```
┌─────────────────┐
│   Next.js App   │
│   (Frontend)    │
└────────┬────────┘
         │ HTTP POST
         ▼
┌─────────────────┐      ┌──────────────┐
│  API Routes     │◄────►│  PostgreSQL  │
│  /api/socketio  │      │   (Prisma)   │
└────────┬────────┘      └──────────────┘
         │ HTTP POST
         ▼
┌─────────────────┐      ┌──────────────┐
│  Bridge Bot     │◄────►│  IRC Server  │
│  (webapp-bot)   │      │  (Port 6667) │
└─────────────────┘      └──────┬───────┘
                                │
                                ▼
                         ┌──────────────┐
                         │ IRC Clients  │
                         │  (Esterni)   │
                         └──────────────┘
```

---

## 🔄 Flusso di Messaggistica

### 1. Webapp → IRC (Invio Messaggio)

1. **Frontend** (`ChatWindow.tsx`):
   - Utente scrive messaggio
   - Hook `useChatMessages` aggiunge echo ottimistico
   - Service `api.sendMessage()` invia a backend

2. **API Route** (`/api/socketio`):
   - Riceve POST con `action: 'send-message'`
   - NON salva nel DB (evita duplicati)
   - Inoltra al bridge bot su `http://localhost:4000/send-irc`

3. **Bridge Bot** (`src/bridge/webapp-bot.js`):
   - Riceve il messaggio cifrato
   - Decifra con `SecureIRCProtocol.decryptMessage()`
   - Formatta come `[username] plaintext`
   - Invia al server IRC via `irc-framework`

4. **IRC Server** (`src/irc-server/`):
   - Riceve messaggio dal bot
   - Broadcast a tutti i client connessi (bot incluso)

5. **Echo Detection** (bot):
   - Bot riceve il proprio messaggio come echo
   - Hash del messaggio confrontato con cache recente
   - Se match → ignora (evita loop)
   - Se messaggio nuovo da IRC esterno → procedi al punto 6

### 2. IRC → Webapp (Ricezione Messaggio)

6. **Bridge Bot** (evento `message`):
   - Riceve messaggio da IRC (client esterno o echo)
   - Se echo del bot → ignora
   - Se nuovo → cifra con AES-256-GCM
   - POST a `/api/socketio` con `action: 'irc-message'`

7. **API Route**:
   - Riceve messaggio cifrato da bot
   - Salva nel DB (PostgreSQL via Prisma)
   - Restituisce messaggio al bot

8. **Frontend Polling** (`useSocket.ts`):
   - Hook esegue polling ogni 2 secondi
   - GET `/api/socketio` con `action: 'get-messages'`
   - API decifra messaggi server-side
   - Frontend riceve plaintext e aggiorna UI

---

## 🔒 Sistema di Cifratura

### Strategia: Bot-Decrypt

- **Chiave**: AES-256 (32 bytes) in `WEBAPP_ENC_KEY` (base64)
- **Algoritmo**: AES-256-GCM (Authenticated Encryption)
- **IV**: 12 bytes random per messaggio
- **Tag**: 16 bytes per autenticazione

### Flusso Cifratura

```
Plaintext → AES-256-GCM → Ciphertext + IV + Tag → Database
                                                  ↓
                                            Stored at rest
                                                  ↓
                        AES-256-GCM Decrypt ← API Route
                                                  ↓
                                            Plaintext → Frontend
```

### File Coinvolti

- **Server-side**: `src/lib/secure-irc.server.ts`
  - `encryptMessage(plaintext)` → `{ encryptedContent, iv, tag }`
  - `decryptMessage(ciphertext, iv, tag)` → `plaintext`
  - Usa Node.js `crypto` module

- **Client-side stub**: `src/lib/secure-irc.client.ts`
  - Lancia errori se chiamato (cifratura solo server-side)
  - Previene uso accidentale di crypto Node in browser

### Note Sicurezza

⚠️ **Questo NON è E2E puro**: il bot possiede la chiave e può leggere tutti i messaggi. Per E2E reale servirebbero chiavi per utente e scambio di chiavi pubbliche.

---

## 📁 Struttura Directory

```
/
├── src/
│   ├── app/                      # Next.js App Router
│   │   ├── api/                  # API Routes
│   │   │   ├── socketio/         # Endpoint principale messaggi
│   │   │   ├── messages/         # CRUD singoli messaggi
│   │   │   ├── channels/         # Gestione canali
│   │   │   ├── keys/             # Endpoint cifratura (futuro)
│   │   │   └── auth/             # NextAuth handlers
│   │   ├── channels/[id]/        # Pagine canali dinamiche
│   │   ├── login/                # Autenticazione
│   │   └── profile/              # Profilo utente
│   │
│   ├── components/               # Componenti React
│   │   ├── ChatWindow.tsx        # Main chat (refactored)
│   │   ├── MessageList.tsx       # Lista messaggi
│   │   ├── MessageInput.tsx      # Input messaggi
│   │   ├── ChannelSidebar.tsx    # Sidebar canali
│   │   ├── AdminPanel.tsx        # Pannello admin
│   │   └── TopicEditor.tsx       # Editor topic
│   │
│   ├── hooks/                    # Custom React Hooks
│   │   ├── useChatMessages.ts    # Logica messaggi
│   │   ├── useMessageSelection.ts # Selezione multipla
│   │   ├── useSocket.ts          # Mock socket (polling)
│   │   ├── useEncryption.ts      # Utility cifratura
│   │   └── useSetTopic.ts        # Topic management
│   │
│   ├── services/                 # Service Layer
│   │   └── api.ts                # Chiamate API centralizzate
│   │
│   ├── lib/                      # Utility & Config
│   │   ├── auth.ts               # NextAuth configuration
│   │   ├── prisma.ts             # Prisma client singleton
│   │   ├── lobby-messages.ts     # Messaggi lobby speciali
│   │   ├── secure-irc.server.ts  # Cifratura server-side
│   │   ├── secure-irc.client.ts  # Stub browser
│   │   └── unused/               # File legacy
│   │
│   ├── bridge/                   # IRC Bridge
│   │   └── webapp-bot.js         # Bot HTTP→IRC
│   │
│   ├── irc-server/               # Custom IRC Server
│   │   ├── start-server.ts       # Entry point
│   │   ├── irc-server.ts         # Core server logic
│   │   ├── irc-client.ts         # Client connection handler
│   │   ├── user-manager.ts       # Gestione utenti
│   │   └── channel-manager.ts    # Gestione canali
│   │
│   ├── types/                    # TypeScript Types
│   │   ├── index.ts              # Tipi principali
│   │   └── next-auth.d.ts        # Estensioni NextAuth
│   │
│   └── middleware.ts             # Next.js Middleware (auth)
│
├── prisma/
│   ├── schema.prisma             # Database schema
│   ├── migrations/               # Migrazioni DB
│   └── seed-guest-help.ts        # Seed iniziale
│
├── scripts/                      # Utility CLI
│   ├── create-bot-user.ts        # Crea utente bot IRC
│   └── e2e-send.js               # Test E2E
│
├── public/                       # Static assets
└── package.json                  # Dependencies & scripts
```

---

## 🗄️ Database Schema (Prisma)

### Modelli Principali

**User**
- `id`, `username`, `email`, `password`
- `roles[]` - Array di ruoli (user, admin, moderator)
- `isOnline`, `isBanned`, `lastSeen`
- `githubBio`, `githubUrl`, ... (dati OAuth)

**Channel**
- `id`, `name`, `topic`, `description`
- `isPrivate`, `isArchived`
- `category` - Enum: GENERAL, ADMIN, HELP, GUEST
- `requiredRole` - Ruolo minimo per accesso
- `parentId` - Gerarchia canali (thread)

**Message**
- `id`, `content`, `timestamp`
- `encrypted` - Boolean
- `iv`, `keyId` - Parametri cifratura GCM
- `type` - Enum: MESSAGE, JOIN, PART, ANNOUNCEMENT
- `userId`, `channelId` - Foreign keys

**ChannelMember**
- `userId`, `channelId`
- `role` - Ruolo nel canale
- `permissions[]` - Array permessi custom
- `canRead`, `canWrite`, `canBan`, ...

---

## 🎣 Custom Hooks

### `useChatMessages({ channel, currentUserId })`

**Responsabilità**:
- Carica messaggi dal server
- Gestisce listener socket per nuovi messaggi
- Deduplica messaggi
- Echo ottimistico per UX fluida

**Ritorna**:
```typescript
{
  messages: MessageWithPending[]
  isLoaded: boolean
  addOptimisticMessage: (content, username) => void
  removeMessage: (id) => void
  socket: MockSocket
}
```

### `useMessageSelection(messages)`

**Responsabilità**:
- Stato selezione multipla
- Select all / Deselect all
- Bulk delete con conferma

**Ritorna**:
```typescript
{
  selectedMessages: Set<string>
  selectAll: boolean
  handleSelectMessage: (id) => void
  handleSelectAll: () => void
  handleDeleteSelected: (onDelete) => void
  clearSelection: () => void
}
```

### `useSocket()`

**Mock polling implementazione**:
- Simula WebSocket con polling HTTP ogni 2s
- Emit: converte in POST API
- On: registra callback per eventi
- Auto-polling per nuovi messaggi

---

## 🌐 Service Layer (`src/services/api.ts`)

Centralizza tutte le chiamate API:

```typescript
// Messaggi
await sendMessage({ content, userId, channelId, ... })
await getMessages({ channelId })
await deleteMessage(messageId)

// Canali
await getChannels()
await setChannelTopic(channelId, topic)
```

**Vantaggi**:
- ✅ Single source of truth per API calls
- ✅ Error handling centralizzato
- ✅ Facile testare e moccare
- ✅ Type-safe con TypeScript

---

## 🔑 Autenticazione (NextAuth v5)

### Providers

1. **GitHub OAuth**
   - Login via GitHub
   - Profilo automatico con avatar, bio, repos

2. **Credentials**
   - Login username/password
   - Bcrypt per hashing
   - Admin predefinito da env vars

### Flow

1. User fa login → `signIn()`
2. Callback `signIn`:
   - Cerca/crea utente in DB
   - Aggiorna `lastSeen`, `isOnline`
3. JWT token con `{ username, roles, isAdmin }`
4. Session contiene dati utente

### Middleware

`src/middleware.ts`:
- Protected routes: `/channels/*`, `/profile`
- Redirect a `/login` se non autenticato
- Public: `/`, `/login`, `/api/auth/*`

---

## 🚀 Deploy & Production

### Variabili Ambiente Richieste

```env
# Database
DATABASE_URL="postgresql://..."

# NextAuth
NEXTAUTH_SECRET="random-32-char-secret"
NEXTAUTH_URL="https://your-domain.com"

# OAuth (solo GitHub attivo)
GITHUB_CLIENT_ID="..."
GITHUB_CLIENT_SECRET="..."

# Cifratura
IRC_ENCRYPTION_KEY="base64-encoded-32-bytes"
WEBAPP_ENC_KEY="base64-encoded-32-bytes"  # Stesso valore o separato

# Admin predefinito
ADMIN_USERNAME="admin"
ADMIN_PASSWORD="secure-password"
ADMIN_EMAIL="admin@domain.com"

# Bot bridge (opzionale)
WEBAPP_HOST="https://your-domain.com"  # URL webapp per callback bot
```

### Deployment Consigliato

**Webapp** → Vercel
- Auto-deploy da GitHub
- Imposta env vars nel dashboard
- `npm run build` automatico

**Bot Bridge** → Railway / Heroku / VPS
- Esegui `npm run bot:start`
- Esponi porta 4000
- Configura `WEBAPP_HOST` con URL webapp

**IRC Server** → VPS / Dedicated
- Esegui `npm run irc:start`
- Porta 6667 per client esterni
- Firewall: apri porta solo se necessario

**Database** → Railway PostgreSQL / Supabase
- Auto-backup
- Connection pooling con Prisma
- SSL abilitato

---

## 🧪 Testing

### Script Disponibili

```bash
# Test E2E invio messaggio
node scripts/e2e-send.js

# Crea utente bot IRC nel DB
npm run create-bot

# Prisma Studio (GUI database)
npm run db:studio
```

### Testing Manuale

1. Avvia tutti i servizi:
   ```bash
   npm run dev:all
   ```

2. Connetti client IRC esterno:
   ```
   /server localhost 6667
   /nick testuser
   /join #general
   ```

3. Invia messaggio da webapp → verifica su client IRC
4. Invia messaggio da IRC → verifica su webapp

---

## 📊 Performance & Scalabilità

### Ottimizzazioni Attuali

- ✅ Polling interval: 2s (bilanciamento UX/server load)
- ✅ Prisma connection pooling
- ✅ Cifratura at-rest (sicurezza)
- ✅ Echo ottimistico (perceived performance)
- ✅ React Query caching (future)

### Limitazioni Conosciute

- ⚠️ Polling non scala oltre 100-200 utenti concorrenti
- ⚠️ Bot bridge single-instance (no HA)
- ⚠️ IRC server non clustered

### Future Improvements

1. **WebSocket reale** via Socket.io:
   - Sostituire polling con eventi real-time
   - `useSocket` diventa wrapper Socket.io vero

2. **Bot bridge scaling**:
   - Multiple bot instances
   - Load balancer con session affinity

3. **Caching Redis**:
   - Messaggi recenti in cache
   - Riduce query DB

4. **E2E encryption vera**:
   - Chiavi per utente
   - Web Crypto API client-side
   - Plugin per client IRC esterni

---

## 🐛 Troubleshooting

### Bot non riceve messaggi dalla webapp

1. Verifica bot listening: `curl http://localhost:4000/send-irc`
2. Check logs bot: cerca "HTTP bridge in ascolto"
3. Verifica `WEBAPP_ENC_KEY` impostata

### Messaggi non appaiono in webapp

1. Check polling: console browser per errori
2. Verifica API `/api/socketio` risponde
3. Database: messaggi salvati? `npm run db:studio`

### Client IRC non riceve messaggi

1. Bot connesso a IRC server? Check log "User connected"
2. Bot in canale? `/names #channelname` da client
3. Firewall blocca porta 6667?

### Errori cifratura "[Messaggio non decifrabile]"

1. `IRC_ENCRYPTION_KEY` identica su webapp e bot?
2. Formato base64 corretto? `openssl rand -base64 32`
3. Migrazioni DB applicate? `npx prisma migrate deploy`

---

## 📚 Risorse & References

- [Next.js Documentation](https://nextjs.org/docs)
- [Prisma Documentation](https://www.prisma.io/docs)
- [NextAuth.js v5](https://authjs.dev/)
- [IRC Protocol RFC 1459](https://datatracker.ietf.org/doc/html/rfc1459)
- [Node.js Crypto Module](https://nodejs.org/api/crypto.html)

---

_Ultimo aggiornamento: 2 novembre 2025_
