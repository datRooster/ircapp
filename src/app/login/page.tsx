'use client'

import { useState } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useIframeMessenger } from '@/hooks/useIframeMessenger'
import { 
  FaGithub, 
  FaEye, 
  FaEyeSlash,
  FaCrown,
  FaUsers,
  FaLock 
} from 'react-icons/fa'

export default function LoginPage() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [isLogin, setIsLogin] = useState(true)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()
  const { sendMessage, isInIframe } = useIframeMessenger()

  const handleOAuthSignIn = async (provider: string) => {
    setIsLoading(true)
    setError('')
    
    try {
      console.log(`🚀 Starting ${provider} OAuth flow...`)
      
      // Per OAuth deve fare redirect automatico
      await signIn(provider, { 
        callbackUrl: '/',
        redirect: true
      })
    } catch (error: any) {
      console.error(`❌ OAuth ${provider} error:`, error)
      setError(error.message || `Errore durante l'autenticazione con ${provider}`)
      setIsLoading(false)
    }
  }

  const handleCredentialsSignIn = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError('')

    try {
      if (isLogin) {
        const result = await signIn('credentials', {
          username,
          password,
          redirect: false,
        })

        if (result?.error) {
          setError('Credenziali non valide')
        } else {
          // Notifica il parent se in iframe
          if (isInIframe) {
            sendMessage('AUTH_STATUS', { 
              authenticated: true, 
              user: { username } 
            })
          }
          router.push('/')
        }
      } else {
        // Registration logic remains the same
        const response = await fetch('/api/auth/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username, password })
        })

        if (response.ok) {
          const result = await signIn('credentials', {
            username,
            password,
            redirect: false,
          })
          
          if (!result?.error) {
            // Notifica il parent se in iframe
            if (isInIframe) {
              sendMessage('AUTH_STATUS', { 
                authenticated: true, 
                user: { username } 
              })
            }
            router.push('/')
          }
        } else {
          const data = await response.json()
          setError(data.error || 'Errore durante la registrazione')
        }
      }
    } catch (error) {
      setError('Errore di connessione')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-linear-to-br from-gray-900 via-blue-900 to-gray-900 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        {/* Header */}
        <div className="text-center">
          <div className="mx-auto h-16 w-16 bg-blue-600 rounded-full flex items-center justify-center mb-4">
            <FaCrown className="h-8 w-8 text-white" />
          </div>
          <h1 className="text-4xl font-extrabold text-white">
            IRC Community
          </h1>
          <p className="mt-2 text-gray-300">
            Moderna chat IRC con autenticazione sicura
          </p>
        </div>

        {/* Social Login */}
        <div className="bg-gray-800 rounded-lg p-6 shadow-xl border border-gray-700">
          <h2 className="text-xl font-bold text-white mb-6 text-center">
            {isLogin ? 'Accedi con' : 'Registrati con'}
          </h2>
          
          <div className="space-y-3">
            <button
              onClick={() => handleOAuthSignIn('github')}
              disabled={isLoading}
              className="w-full flex items-center justify-center px-4 py-3 border border-gray-600 rounded-lg shadow-sm bg-gray-700 text-white hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 transition-colors"
            >
              <FaGithub className="h-5 w-5 text-gray-400 mr-3" />
              Continua con GitHub
            </button>
          </div>

          {/* Divider */}
          <div className="my-6">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-600" />
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-gray-800 text-gray-400">oppure</span>
              </div>
            </div>
          </div>

          {/* Credentials Form */}
          <form onSubmit={handleCredentialsSignIn} className="space-y-4">
            <div>
              <label htmlFor="username" className="block text-sm font-medium text-gray-300 mb-2">
                <FaUsers className="inline mr-2" />
                Nome utente
              </label>
              <input
                id="username"
                name="username"
                type="text"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="appearance-none relative block w-full px-3 py-3 border border-gray-600 bg-gray-700 text-white placeholder-gray-400 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Il tuo nome utente"
              />
            </div>
            
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-300 mb-2">
                <FaLock className="inline mr-2" />
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="appearance-none relative block w-full px-3 py-3 pr-10 border border-gray-600 bg-gray-700 text-white placeholder-gray-400 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="La tua password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-white"
                >
                  {showPassword ? <FaEyeSlash /> : <FaEye />}
                </button>
              </div>
            </div>

            {error && (
              <div className="bg-red-900 border border-red-600 text-red-300 px-4 py-3 rounded-lg text-sm">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="w-full flex justify-center py-3 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isLoading ? (
                'Caricamento...'
              ) : (
                isLogin ? 'Accedi' : 'Registrati'
              )}
            </button>
          </form>

          <div className="mt-6 text-center">
            <button
              type="button"
              onClick={() => setIsLogin(!isLogin)}
              className="text-blue-400 hover:text-blue-300 text-sm underline"
            >
              {isLogin 
                ? 'Non hai un account? Registrati' 
                : 'Hai già un account? Accedi'
              }
            </button>
          </div>
        </div>

        {/* Admin Demo */}
        <div className="bg-linear-to-r from-yellow-900 to-orange-900 rounded-lg p-4 border border-yellow-600">
          <div className="flex items-center mb-2">
            <FaCrown className="text-yellow-400 mr-2" />
            <h3 className="text-sm font-bold text-yellow-200">Account Demo</h3>
          </div>
          <div className="text-xs text-yellow-300 space-y-1">
            <div><strong>Admin:</strong> username: <code className="bg-yellow-800 px-1 rounded">admin</code>, password: <code className="bg-yellow-800 px-1 rounded">admin123</code></div>
            <div><strong>Utente:</strong> Registrati con qualsiasi username o usa OAuth</div>
          </div>
        </div>
      </div>
    </div>
  )
}