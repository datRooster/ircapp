import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'

// Base handler executed inside the auth wrapper for normal requests
const baseHandler = (req: any) => {
  const isLoggedIn = !!req.auth?.user
  const isOnLoginPage = req.nextUrl.pathname === '/login'
  const isOnApiRoute = req.nextUrl.pathname.startsWith('/api/')

  // Skip API routes - they handle their own auth
  if (isOnApiRoute) {
    return NextResponse.next()
  }

  // Se l'utente è sulla pagina di login e è già autenticato, reindirizza alla home
  if (isLoggedIn && isOnLoginPage) {
    console.log('[Middleware] User logged in, redirecting from /login to /')
    return NextResponse.redirect(new URL('/', req.url))
  }

  // Se l'utente non è autenticato e non è sulla pagina di login, reindirizza al login
  if (!isLoggedIn && !isOnLoginPage) {
    console.log('[Middleware] User not logged in, redirecting to /login')
    return NextResponse.redirect(new URL('/login', req.url))
  }

  return NextResponse.next()
}

// Middleware exported: first try a dev-only bypass, otherwise use auth(baseHandler)
export default (req: NextRequest) => {
  // Developer bypass: ONLY for local development, NEVER in production
  // Requires all three conditions:
  // 1. NODE_ENV !== 'production'
  // 2. DEV_AUTH_BYPASS=true
  // 3. Correct x-dev-bypass header matching DEV_AUTH_BYPASS_TOKEN
  const isProd = process.env.NODE_ENV === 'production'
  
  if (!isProd) {
    try {
      const bypassEnabled = process.env.DEV_AUTH_BYPASS === 'true'
      const bypassToken = process.env.DEV_AUTH_BYPASS_TOKEN
      if (bypassEnabled && bypassToken) {
        const header = req.headers.get('x-dev-bypass') || req.headers.get('X-DEV-BYPASS')
        if (header && header === bypassToken) {
          console.log('[Middleware] Dev bypass active')
          return NextResponse.next()
        }
      }
    } catch (err) {
      // swallow errors and fall back to normal auth flow
    }
  }

  // Default behavior: run the authenticated handler
  const handler = auth(baseHandler)
  return (handler as unknown as any)(req)
}

export const config = {
  matcher: ['/((?!api/auth|_next/static|_next/image|favicon.ico).*)'],
}