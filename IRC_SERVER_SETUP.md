# 📡 IRC Server - Configurazione e Accesso

## 🏗️ Architettura Attuale

La tua applicazione ha **3 componenti**:

### 1. Web App (Next.js) 
- **URL**: https://web-production-75688.up.railway.app
- **Porta**: Assegnata automaticamente da Railway (variabile `$PORT`)
- **Funzione**: Interfaccia web per chat in tempo reale
- **Accesso**: Aperto a tutti via HTTPS

### 2. IRC Server (processo interno)
- **Porta**: 6667 (standard IRC)
- **Protocollo**: IRC tradizionale (RFC 1459)
- **Funzione**: Server IRC completo per client esterni
- **Stato attuale**: INTERNO - non esposto su Railway

### 3. Bridge Bot
- **Funzione**: Sincronizza messaggi tra IRC e Web App
- **Connessione**: Locale tra i 3 processi

---

## 🌐 Configurazione Attuale (Solo Web)

**Attualmente funzionante:**
- ✅ Gli utenti accedono via browser: https://web-production-75688.up.railway.app
- ✅ Chat in tempo reale tramite Socket.io
- ✅ Autenticazione GitHub OAuth
- ✅ Canali, messaggi, topic management

**NON funzionante (per design):**
- ❌ Connessione da client IRC esterni (WeeChat, HexChat, irssi)
- ❌ Porta 6667 non esposta pubblicamente

**Questo è OK se vuoi solo la web app!**

---

## 🔧 Opzione: Esporre IRC Server (per client esterni)

Se vuoi permettere connessioni da client IRC tradizionali, hai 2 opzioni:

### Opzione A: Servizio Railway Separato per IRC (Consigliata)

**Vantaggi:**
- Isolamento dei servizi
- Scalabilità indipendente
- Port forwarding TCP nativo

**Passi:**
1. Crea un nuovo servizio su Railway dashboard
2. Collega lo stesso repository GitHub
3. Configura con `railway-irc.toml` (già creato)
4. Setta variabili d'ambiente:
   ```bash
   DATABASE_URL=<stesso del web>
   IRC_PORT=6667
   IRC_HOSTNAME=irc.yourdomain.com
   ```
5. Railway ti darà un indirizzo TCP tipo: `irc-production-xxxxx.up.railway.app:6667`

**Connessione client:**
```irc
/server irc-production-xxxxx.up.railway.app 6667
```

### Opzione B: Processo Unico con TCP Proxy

Railway può esporre porte TCP aggiuntive, ma è più complesso:

1. Modifica `railway.toml` per includere TCP listener
2. Richiedi a Railway di abilitare TCP forwarding
3. Usa il Procfile per avviare tutti i processi insieme

---

## 🚀 Configurazione Locale (Development)

Per testare in locale con client IRC:

```bash
# Terminal 1: Avvia tutto (web + irc + bot)
npm run dev:all

# Terminal 2: Connetti con un client IRC
# WeeChat esempio:
/server add local localhost/6667
/connect local
/join #lobby
```

**Indirizzi locali:**
- Web App: http://localhost:3000
- IRC Server: localhost:6667

---

## 📝 Variabili d'Ambiente per IRC

Nel tuo `.env` o Railway Variables:

```bash
# IRC Server Configuration
IRC_PORT=6667                    # Porta IRC standard
IRC_HOSTNAME=localhost           # Hostname del server
IRC_ENCRYPTION_KEY=<tua-chiave>  # Chiave per cifratura messaggi
```

---

## 🎯 Raccomandazione

**Per la maggior parte degli utenti: usa solo la Web App**

Motivi:
1. ✅ Più sicura (HTTPS nativo)
2. ✅ Più facile da usare (no client IRC da configurare)
3. ✅ Mobile-friendly
4. ✅ Funzionalità moderne (emoji, notifiche, file upload)
5. ✅ Autenticazione OAuth integrata

**Esponi IRC solo se:**
- Hai utenti che preferiscono client IRC classici
- Vuoi federation con altri server IRC
- Serve per integrazioni automatiche (bot esterni)

---

## 🔍 Come Verificare l'IRC Server

### Controllo locale:
```bash
# Avvia server
npm run irc:start

# In un altro terminal, testa con netcat
nc localhost 6667
```

Dovresti poter inviare comandi IRC:
```
NICK testuser
USER testuser 0 * :Test User
JOIN #lobby
QUIT
```

### Log server:
```bash
# Vedi connessioni e comandi
npm run irc:start

# Output:
# 🚀 IRC Server listening on port 6667
# 🔌 New IRC connection from 127.0.0.1:xxxxx
# 📨 IRC Command: NICK from testuser
```

---

## 📞 Supporto

Se decidi di esporre l'IRC server pubblicamente, fammi sapere e ti aiuto con:
1. Configurazione servizio separato Railway
2. DNS setup (se hai un dominio)
3. SSL/TLS per IRC (porta 6697)
4. Rate limiting e sicurezza

Per ora, la web app funziona perfettamente! 🎉
