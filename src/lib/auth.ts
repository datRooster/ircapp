import NextAuth, { NextAuthConfig } from 'next-auth'
import Credentials from 'next-auth/providers/credentials'
import GitHub from 'next-auth/providers/github'
import { PrismaAdapter } from '@auth/prisma-adapter'
import { prisma } from './prisma'
import bcrypt from 'bcryptjs'

export const authOptions: NextAuthConfig = {
  providers: [
    // OAuth Provider - Solo GitHub
    GitHub({
      clientId: process.env.GITHUB_CLIENT_ID!,
      clientSecret: process.env.GITHUB_CLIENT_SECRET!,
    }),
    
    // Credentials fallback per admin e utenti locali
    Credentials({
      name: 'credentials',
      credentials: {
        username: { label: 'Username', type: 'text' },
        password: { label: 'Password', type: 'password' }
      },
      async authorize(credentials) {
        if (!credentials?.username || !credentials?.password) {
          return null
        }

        try {
          // Controlla se è l'admin predefinito
          if (
            credentials.username === (process.env.ADMIN_USERNAME || 'admin') &&
            credentials.password === (process.env.ADMIN_PASSWORD || 'admin123')
          ) {
            // Crea o aggiorna admin nel database
            const adminUser = await prisma.user.upsert({
              where: { username: process.env.ADMIN_USERNAME || 'admin' },
              update: { 
                isOnline: true,
                roles: ['admin', 'user']
              },
              create: {
                username: process.env.ADMIN_USERNAME || 'admin',
                email: process.env.ADMIN_EMAIL || 'admin@ircommunity.local',
                password: await bcrypt.hash(process.env.ADMIN_PASSWORD || 'admin123', 10),
                isOnline: true,
                roles: ['admin', 'user']
              }
            })

            return {
              id: adminUser.id,
              name: adminUser.username,
              email: adminUser.email,
              username: adminUser.username,
              roles: adminUser.roles,
              isAdmin: true
            }
          }

          // Cerca nel database
          const user = await prisma.user.findUnique({
            where: { username: credentials.username as string }
          })

          if (!user || !user.password) {
            return null
          }

          const isValidPassword = await bcrypt.compare(
            credentials.password as string,
            user.password
          )
          
          if (!isValidPassword) {
            return null
          }

          // Aggiorna stato online
          await prisma.user.update({
            where: { id: user.id },
            data: { isOnline: true }
          })

          return {
            id: user.id,
            name: user.username,
            email: user.email,
            username: user.username,
            roles: user.roles,
            isAdmin: user.roles.includes('admin')
          }
        } catch (error) {
          console.error('❌ Auth error:', error)
          return null
        }
      }
    })
  ],
  session: {
    strategy: 'jwt'
  },
  pages: {
    signIn: '/login'
  },
  callbacks: {
    async signIn({ user, account, profile }) {
      // Gestione OAuth provider - Solo GitHub
      if (account && account.provider === 'github') {
        try {
          // Cerca utente esistente per email
          let dbUser = await prisma.user.findUnique({
            where: { email: user.email! }
          })

          if (!dbUser) {
            // Crea nuovo utente OAuth usando i dati reali di GitHub
            const username = typeof profile?.login === 'string'
              ? profile.login
              : (typeof user.email === 'string' ? user.email.split('@')[0] + '_' + account.provider : 'github_user')
            const name = typeof user.name === 'string'
              ? user.name
              : (typeof profile?.name === 'string' ? profile.name : username)
            const avatar = typeof profile?.avatar_url === 'string'
              ? profile.avatar_url
              : (typeof user.image === 'string' ? user.image : null)
            // Dati avanzati GitHub
            const githubBio = typeof profile?.bio === 'string' ? profile.bio : null
            const githubLocation = typeof profile?.location === 'string' ? profile.location : null
            const githubRepos = typeof profile?.public_repos === 'number' ? profile.public_repos : null
            const githubFollowers = typeof profile?.followers === 'number' ? profile.followers : null
            const githubUrl = typeof profile?.html_url === 'string' ? profile.html_url : null

            dbUser = await prisma.user.create({
              data: {
                username,
                email: user.email!,
                name,
                avatar,
                roles: ['user'],
                primaryRole: 'USER',
                isOnline: true,
                githubBio,
                githubLocation,
                githubRepos,
                githubFollowers,
                githubUrl
              }
            })

            // Crea record account per linking
            await prisma.account.create({
              data: {
                userId: dbUser.id,
                type: account.type,
                provider: account.provider,
                providerAccountId: account.providerAccountId,
                access_token: account.access_token,
                refresh_token: account.refresh_token,
                expires_at: account.expires_at,
                token_type: account.token_type,
                scope: account.scope,
                id_token: account.id_token,
                session_state: account.session_state as string
              }
            })

            console.log(`✅ Created new OAuth user: ${username} via ${account.provider}`)
          } else {
            // Aggiorna last seen per utente esistente
            await prisma.user.update({
              where: { id: dbUser.id },
              data: { 
                isOnline: true,
                lastSeen: new Date(),
                name: user.name || dbUser.name,
                avatar: user.image || dbUser.avatar
              }
            })
          }

          // Aggiorna user object con dati dal database
          user.id = dbUser.id
          ;(user as any).username = dbUser.username
          ;(user as any).roles = dbUser.roles
          ;(user as any).isAdmin = dbUser.roles.includes('admin')
          
          return true
        } catch (error) {
          console.error(`❌ OAuth signIn error for ${account.provider}:`, error)
          return false
        }
      }
      
      return true // Per credentials provider
    },
    async jwt({ token, user, account }) {
      if (user) {
        token.username = (user as any).username
        token.roles = (user as any).roles
        token.isAdmin = (user as any).isAdmin
      }
      return token
    },
    async session({ session, token }) {
      if (token && session.user) {
        session.user.id = token.sub!
        ;(session.user as any).username = token.username as string
        ;(session.user as any).roles = token.roles as string[]
        ;(session.user as any).isAdmin = token.isAdmin as boolean
      }
      return session
    }
  }
}

export const { handlers, auth, signIn, signOut } = NextAuth(authOptions)