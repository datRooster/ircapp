# IRC Community Web App

Una moderna applicazione web per community IRC costruita con le ultime tecnologie web standard.

## ✅ Stato dell'Implementazione - Aggiornamento del 23/10/2025

### 🎉 **FUNZIONALITÀ COMPLETATE E OPERATIVE:**

#### ✅ **Sistema di Chat Multi-Canale**
- **Chat separata per canale**: Ogni canale ha la propria cronologia messaggi
- **Cambio canale dinamico**: I messaggi si aggiornano automaticamente quando si cambia canale  
- **Messaggi persistenti**: I messaggi vengono salvati e ricaricati per ogni canale
- **Indicatori visivi**: Stato connessione e canale attivo chiaramente visibili

#### ✅ **Interfaccia Utente Moderna**
- **Design responsive**: Ottimizzato per desktop e mobile
- **Sidebar canali**: Navigazione intuitiva tra #general e #tech
- **Chat window**: Finestra chat con messaggi scrollabili
- **Indicatori stato**: Connessione Socket.io e crittografia visibili
- **Messaggi di sistema**: Benvenuto automatico per ogni canale

#### ✅ **Sistema di Messaggistica**
- **Invio messaggi funzionante**: I messaggi vengono inviati e visualizzati correttamente
- **Mock Socket.io**: Sistema di polling che simula WebSocket per evitare problemi di connessione
- **Validazione messaggi**: Controllo lunghezza e contenuto
- **Timestamp**: Ora di invio per ogni messaggio
- **Avatar utenti**: Iniziali colorate per identificazione rapida

#### ✅ **Sicurezza di Base**
- **Sanitizzazione input**: Protezione XSS e injection
- **Validazione dati**: Controllo rigoroso dei parametri
```markdown
# IRC Community Web App

Applicazione web per community IRC che mette insieme Next.js, TypeScript, Tailwind e un bridge verso client IRC testuali.

Questo repository contiene sia la webapp (Next.js App Router) sia il bridge HTTP/IRC (bot) e uno starter per il server IRC locale.

## Obiettivo di questo repository
- Fornire un'interfaccia web moderna per canali IRC
- Permettere sincronizzazione bidirezionale tra webapp e server IRC reale tramite un bridge (bot)
- Essere deployabile (Vercel / Railway / Docker)

---

## Struttura importante e comandi principali

- `npm run dev` — avvia la webapp in sviluppo (Next.js)
- `npm run irc:start` — avvia il server IRC (TypeScript starter in `src/irc-server`)
- `node webapp-bot.js` — avvia il bridge HTTP→IRC (bot) che riceve POST da `/api/socketio`
- `node webapp-bot.js` — avvia il bridge HTTP→IRC (bot) che riceve POST da `/api/socketio`
- `npm run dev:full` — (concurrently) esegue webapp + IRC server insieme

Consiglio per sviluppo locale (zsh):

```bash
# 1) Installa dipendenze
npm install --legacy-peer-deps

# 2) Avvia il server IRC (in un terminale separato)
npm run irc:start

# 3) Avvia il bridge bot (in un altro terminale)
node webapp-bot.js

# 4) Avvia la webapp
npm run dev -- --port 3000

# Oppure tutto insieme (richiede concurrently)
npm run dev:full
```

---

## Come funziona la sincronizzazione (breve)

- La webapp emette eventi (via `useSocket`) che POSTano a `/api/socketio` con `action: 'send-message'`.
- L'API `/api/socketio` salva il messaggio su Prisma e inoltra al bridge bot su `http://localhost:4000/send-irc`.
- Il bridge (`webapp-bot.js`) invia il messaggio al server IRC; quando riceve messaggi da IRC li POSTa a `/api/socketio` con `action: 'irc-message'`.
- `useSocket` polla `/api/socketio` con `action: 'get-messages'` per ottenere nuovi messaggi.

---

## Deployment e note pratiche

1) Vercel
- Push su GitHub e configura Vercel per il repo. Assicurati di impostare le variabili d'ambiente nel progetto Vercel (es. `DATABASE_URL`, `NEXTAUTH_SECRET`, provider OAuth).

2) Railway / Server con PostgreSQL
- Se usi Railway, aggiungi PostgreSQL e imposta le variabili elencate nella sezione "Railway / Production" qui sotto.

3) Avviare servizi in produzione
- On Vercel la parte bot/bridge non gira automaticamente: in produzione raccomando di eseguire il bot come servizio separato (Heroku, Railway, Docker container o VM) che faccia listen sulla porta 4000 e possa comunicare con la webapp tramite HTTPS.

---

## Railway / Production (sintesi)

Variabili ambiente importanti da impostare in produzione:

```env
DATABASE_URL=postgresql://...
NEXTAUTH_SECRET=your-super-secret-key
NEXTAUTH_URL=https://your-app.domain
GITHUB_CLIENT_ID=...
GITHUB_CLIENT_SECRET=...
ADMIN_EMAIL=admin@yourdomain
```

Eseguire le migrazioni Prisma in produzione:

```bash
npx prisma migrate deploy
npx prisma generate
```

Environment variables utili per il bot
- `WEBAPP_HOST` — URL (incluso protocollo e porta) della webapp per le notifiche IRC→webapp (es. `http://localhost:`). Se non impostato il bot userà `http://localhost:3000`.

### Cifratura end-to-end (opzione bot-decrypt)

Questo progetto supporta ora un flusso "bot-decrypt" per i messaggi contrassegnati come cifrati dalla webapp:

- Impostare la variabile d'ambiente `WEBAPP_ENC_KEY` con una chiave AES-256 (32 byte) codificata in base64. Esempio generazione:

```bash
# Genera 32 bytes e stampa base64
openssl rand -base64 32
```

- In ambienti di sviluppo è possibile mettere `WEBAPP_ENC_KEY` nel file `.env` (ma in produzione usare secret manager).
- Flusso:
	- Il client web cifra il messaggio con AES-256-GCM usando la chiave ottenuta dall'endpoint protetto `/api/keys` e invia `content` (base64 ciphertext) + `iv` + `encrypted: true` a `/api/socketio`.
	- L'API salva il messaggio cifrato e inoltra il payload al bot (includendo `encrypted` e `iv`).
	- Il bot (se `WEBAPP_ENC_KEY` è impostata) decripta il messaggio e invia il plaintext su IRC, mantenendo una UX compatibile con client IRC tradizionali.
	- Quando il bot riceve messaggi da IRC li cifra e li POSTa a `/api/socketio` (se `WEBAPP_ENC_KEY` configurata), così la webapp riceve payload cifrati e li decifra client-side.

Nota importante di sicurezza:
- Questo approccio NON è E2E dal punto di vista strettissimo: il bot possiede la chiave e può leggere i plaintext. Per E2E reale occorre un sistema di gestione chiavi più complesso (chiavi per utente, scambio di chiavi, plugin per client IRC esterni) e non fornito qui.
- Assicurati di memorizzare `WEBAPP_ENC_KEY` in un secret manager (es. Vercel Secrets, Railway secrets, HashiCorp Vault) in produzione. Non committare la chiave nel repo.

Migrazione Prisma:
- Abbiamo aggiunto i campi `encrypted`, `iv` e `keyId` al modello `Message`. Dopo pull/merge esegui le migrazioni e genera il client Prisma:

```bash
npx prisma migrate dev --name add-encryption-fields
npx prisma generate
```


---

## Developer notes (consolidate)

- Use TypeScript and Tailwind for new components
- Keep server-side auth checks tramite `src/lib/auth.ts`
- Evitare log debug eccessivi in produzione; preferisci logger con livelli

---

## File rimossi/unificati in questa pulizia

- Il contenuto di `RAILWAY_SETUP.md` e `.github/copilot-instructions.md` è stato consolidato qui.
- Alcuni file di test di setup locali hanno been archiviati o rimossi (vedi git history).

---

## Conclusione

Ho consolidato la documentazione principale in questo `README.md`. Per il deploy su Vercel ricorda di esporre il bot come servizio separato e di impostare le variabili d'ambiente. Se vuoi, posso:

- Aggiungere script npm per avviare bot e IRC server insieme con PM2 / Docker
- Commitare ulteriori pulizie (rimuovere file test locali) o archiviarli in `./archive`

---

_Ultima modifica automatica: 27 ottobre 2025_

```
- **Autenticazione utenti**: NextAuth configurato
