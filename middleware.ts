import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getToken } from 'next-auth/jwt'

/**
 * Performance Monitoring + Auth Middleware
 * - Logs accurate timing for all requests
 * - Protects dashboard routes
 */
export async function middleware(request: NextRequest) {
  const startTime = performance.now()
  const url = request.nextUrl.pathname
  const method = request.method

  // Auth check for dashboard routes
  if (url.startsWith('/dashboard')) {
    const token = await getToken({
      req: request,
      secret: process.env.NEXTAUTH_SECRET,
    })

    if (!token) {
      const loginUrl = new URL('/login', request.url)
      loginUrl.searchParams.set('callbackUrl', url)
      return NextResponse.redirect(loginUrl)
    }
  }

  // Continue with request
  const response = NextResponse.next()

  // Calculate and log performance
  const endTime = performance.now()
  const duration = Math.round(endTime - startTime)

  // Color-coded logging based on performance thresholds
  let emoji = '🟢' // Fast (< 500ms)
  let color = '\x1b[32m' // Green

  if (duration > 2000) {
    emoji = '🔴' // Very slow (> 2s)
    color = '\x1b[31m' // Red
  } else if (duration > 1000) {
    emoji = '🟠' // Slow (> 1s)
    color = '\x1b[33m' // Orange/Yellow
  } else if (duration > 500) {
    emoji = '🟡' // Medium (> 500ms)
    color = '\x1b[33m' // Yellow
  }

  const reset = '\x1b[0m'
  const timestamp = new Date().toISOString().split('T')[1].split('.')[0]

  // Log with color coding
  console.log(
    `${emoji} [${timestamp}] ${color}${method.padEnd(6)}${reset} ${url.padEnd(50)} ${color}${duration}ms${reset}`
  )

  return response
}

// Configure which routes to monitor
export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico (favicon)
     * - public assets
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.png|.*\\.jpg|.*\\.jpeg|.*\\.gif|.*\\.svg|.*\\.ico).*)',
  ],
}
