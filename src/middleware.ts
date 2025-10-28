import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'

// Base handler executed inside the auth wrapper for normal requests
const baseHandler = (req: any) => {
  const isLoggedIn = !!req.auth
  const isOnLoginPage = req.nextUrl.pathname === '/login'

  // Se l'utente è sulla pagina di login e è già autenticato, reindirizza alla home
  if (isLoggedIn && isOnLoginPage) {
    return NextResponse.redirect(new URL('/', req.url))
  }

  // Se l'utente non è autenticato e non è sulla pagina di login, reindirizza al login
  if (!isLoggedIn && !isOnLoginPage) {
    return NextResponse.redirect(new URL('/login', req.url))
  }

  return NextResponse.next()
}

// Middleware exported: first try a dev-only bypass, otherwise use auth(baseHandler)
export default (req: NextRequest) => {
  // Developer bypass: only active when NODE_ENV !== 'production' and DEV_AUTH_BYPASS=true
  // Requires DEV_AUTH_BYPASS_TOKEN to be set and the request to include header
  // `x-dev-bypass: <DEV_AUTH_BYPASS_TOKEN>`.
  // NOTE: This is strictly for local development and testing. Do NOT enable in prod.
  try {
    const isDev = process.env.NODE_ENV !== 'production'
    const bypassEnabled = process.env.DEV_AUTH_BYPASS === 'true'
    const bypassToken = process.env.DEV_AUTH_BYPASS_TOKEN
    if (isDev && bypassEnabled && bypassToken) {
      const header = req.headers.get('x-dev-bypass') || req.headers.get('X-DEV-BYPASS')
      if (header && header === bypassToken) {
        return NextResponse.next()
      }
    }
  } catch (err) {
    // swallow errors and fall back to normal auth flow
  }

  // Default behavior: run the authenticated handler
  const handler = auth(baseHandler)
  return (handler as unknown as any)(req)
}

export const config = {
  matcher: ['/((?!api/auth|_next/static|_next/image|favicon.ico).*)'],
}