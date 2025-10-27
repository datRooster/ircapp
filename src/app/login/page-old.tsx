'use client'

import { useState } from 'react'
import { signIn, getProviders } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { 
  FaGoogle, 
  FaGithub, 
  FaDiscord, 
  FaEye, 
  FaEyeSlash,
  FaCrown,
  FaUsers 
} from 'react-icons/fa'

export default function LoginPage() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [isLogin, setIsLogin] = useState(true)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()

  const handleOAuthSignIn = async (provider: string) => {
    setIsLoading(true)
    try {
      const result = await signIn(provider, { 
        callbackUrl: '/',
        redirect: true 
      })
    } catch (error) {
      setError('Errore durante l\'autenticazione social')
    } finally {
      setIsLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError('')

    try {
      if (isLogin) {
        // Login
        const result = await signIn('credentials', {
          username,
          password,
          redirect: false,
        })

        if (result?.error) {
          setError('Credenziali non valide')
        } else {
          router.push('/')
        }
      } else {
        // Registration
        const response = await fetch('/api/auth/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username, password })
        })

        if (response.ok) {
          // Auto-login dopo registrazione
          const result = await signIn('credentials', {
            username,
            password,
            redirect: false,
          })
          
          if (!result?.error) {
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
    <div className="min-h-screen bg-gray-900 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h1 className="text-center text-3xl font-extrabold text-white">
            IRC Community
          </h1>
          <h2 className="mt-6 text-center text-2xl font-bold text-gray-300">
            {isLogin ? 'Accedi al tuo account' : 'Crea un nuovo account'}
          </h2>
        </div>
        
        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          <div className="space-y-4">
            <div>
              <label htmlFor="username" className="block text-sm font-medium text-gray-300">
                Nome utente
              </label>
              <input
                id="username"
                name="username"
                type="text"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="mt-1 appearance-none relative block w-full px-3 py-2 border border-gray-600 bg-gray-800 text-white placeholder-gray-400 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
                placeholder="Il tuo nome utente"
              />
            </div>
            
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-300">
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1 appearance-none relative block w-full px-3 py-2 border border-gray-600 bg-gray-800 text-white placeholder-gray-400 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
                placeholder="La tua password"
              />
            </div>
          </div>

          {error && (
            <div className="text-red-400 text-sm text-center">
              {error}
            </div>
          )}

          <div>
            <button
              type="submit"
              disabled={isLoading}
              className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                'Caricamento...'
              ) : (
                isLogin ? 'Accedi' : 'Registrati'
              )}
            </button>
          </div>

          <div className="text-center">
            <button
              type="button"
              onClick={() => setIsLogin(!isLogin)}
              className="text-blue-400 hover:text-blue-300 text-sm"
            >
              {isLogin 
                ? 'Non hai un account? Registrati' 
                : 'Hai già un account? Accedi'
              }
            </button>
          </div>

          {/* Login demo accounts */}
          <div className="mt-6 pt-6 border-t border-gray-700">
            <p className="text-center text-sm text-gray-400 mb-4">Account demo:</p>
            <div className="space-y-2 text-xs text-gray-500">
              <div className="text-center">
                <strong className="text-yellow-400">Admin:</strong> username: <code>admin</code>, password: <code>admin123</code>
              </div>
              <div className="text-center">
                <strong className="text-blue-400">User:</strong> Registrati con qualsiasi username
              </div>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}