/**
 * ============================================================================
 * MIDDLEWARE (middleware.ts - Root Directory)
 * ============================================================================
 *
 * WHAT IS MIDDLEWARE?
 * Middleware runs BEFORE every request reaches your pages/API routes.
 * It's like a security guard that checks every visitor before letting them in.
 *
 * PURPOSE OF THIS FILE:
 * 1. AUTHENTICATION: Protect dashboard pages from unauthenticated users
 * 2. PERFORMANCE MONITORING: Log request timing for optimization
 *
 * EXECUTION ORDER:
 * User makes request → Middleware runs → Page/API route runs
 *
 * WHEN THIS RUNS:
 * - On every page navigation
 * - On every API call
 * - Before any Next.js page or API route handler
 *
 * KEY FEATURES:
 * - Redirects unauthenticated users to login page
 * - Preserves intended destination URL (callbackUrl)
 * - Logs request performance with color-coded output
 * - Excludes static files from monitoring
 *
 * RELATED FILES:
 * - src/lib/auth.ts - NextAuth configuration
 * - src/app/login/page.tsx - Login page
 * - src/app/dashboard/* - Protected dashboard pages
 */

import { NextResponse } from 'next/server' // Next.js response utilities
import type { NextRequest } from 'next/server' // TypeScript type for Next.js requests
import { getToken } from 'next-auth/jwt' // NextAuth JWT token decoder

/**
 * MIDDLEWARE FUNCTION
 *
 * This function runs on every request that matches the config.matcher pattern below.
 *
 * @param request - The incoming HTTP request object
 * @returns NextResponse - Either redirects to login or allows request to continue
 */
export async function middleware(request: NextRequest) {
  // ============================================================================
  // PERFORMANCE MONITORING: Start Timer
  // ============================================================================
  // Record when request started processing
  // Used to calculate total request duration at end
  const startTime = performance.now()

  // Extract request details for logging
  const url = request.nextUrl.pathname // e.g., "/dashboard/products"
  const method = request.method // e.g., "GET", "POST"

  // ============================================================================
  // AUTHENTICATION CHECK: Protect Dashboard Routes
  // ============================================================================
  // PURPOSE: Ensure only logged-in users can access /dashboard/* pages
  //
  // HOW IT WORKS:
  // 1. Check if requested URL starts with "/dashboard"
  // 2. If yes, verify user has valid JWT token (session)
  // 3. If no token, redirect to login page
  // 4. If token exists, allow request to proceed
  //
  // WHY USE getToken() INSTEAD OF getServerSession()?
  // - getToken() is optimized for middleware
  // - Faster (doesn't query database)
  // - Only decodes JWT to check if valid
  if (url.startsWith('/dashboard')) {
    // Decode JWT token from cookie
    // Returns null if no token or invalid token
    const token = await getToken({
      req: request, // Pass request object to access cookies
      secret: process.env.NEXTAUTH_SECRET, // Secret key to decrypt JWT
    })

    // No valid token found - user is NOT authenticated
    if (!token) {
      // Build login URL with callback parameter
      // callbackUrl = where to redirect after successful login
      // Example: /login?callbackUrl=/dashboard/products
      const loginUrl = new URL('/login', request.url)
      loginUrl.searchParams.set('callbackUrl', url) // Remember where they wanted to go

      // Redirect to login page
      // After login, NextAuth will redirect them back to callbackUrl
      return NextResponse.redirect(loginUrl)
    }
  }

  // ============================================================================
  // ALLOW REQUEST: User is authenticated or route doesn't require auth
  // ============================================================================
  // Continue processing the request normally
  // This passes control to the actual page/API route handler
  const response = NextResponse.next()

  // ============================================================================
  // PERFORMANCE MONITORING: Calculate Request Duration
  // ============================================================================
  const endTime = performance.now() // Record end time
  const duration = Math.round(endTime - startTime) // Calculate milliseconds taken

  // ============================================================================
  // PERFORMANCE LOGGING: Color-Coded Console Output
  // ============================================================================
  // PURPOSE: Quickly identify slow requests for optimization
  //
  // COLOR CODING:
  // 🟢 Green: Fast (<500ms) - Excellent performance
  // 🟡 Yellow: Medium (500-1000ms) - Acceptable
  // 🟠 Orange: Slow (1000-2000ms) - Needs attention
  // 🔴 Red: Very Slow (>2000ms) - Critical - needs immediate optimization
  //
  // EXAMPLE OUTPUT:
  // 🟢 [14:32:10] GET    /dashboard/products                     245ms
  // 🔴 [14:32:15] POST   /api/products                           2340ms
  let emoji = '🟢' // Fast (< 500ms)
  let color = '\x1b[32m' // Green text

  if (duration > 2000) {
    emoji = '🔴' // Very slow (> 2s)
    color = '\x1b[31m' // Red text
  } else if (duration > 1000) {
    emoji = '🟠' // Slow (> 1s)
    color = '\x1b[33m' // Orange/Yellow text
  } else if (duration > 500) {
    emoji = '🟡' // Medium (> 500ms)
    color = '\x1b[33m' // Yellow text
  }

  const reset = '\x1b[0m' // Reset color back to default
  const timestamp = new Date().toISOString().split('T')[1].split('.')[0] // Extract time only (HH:MM:SS)

  // Output formatted log line to console
  // Format: 🟢 [14:32:10] GET    /dashboard/products                     245ms
  console.log(
    `${emoji} [${timestamp}] ${color}${method.padEnd(6)}${reset} ${url.padEnd(50)} ${color}${duration}ms${reset}`
  )

  return response
}

// ============================================================================
// MIDDLEWARE CONFIGURATION
// ============================================================================
// PURPOSE: Define which routes this middleware should run on
//
// MATCHER PATTERN:
// - Runs on ALL routes EXCEPT:
//   * /_next/static - Next.js static files (JS, CSS)
//   * /_next/image - Next.js optimized images
//   * /favicon.ico - Browser favicon
//   * *.png, *.jpg, etc. - Image files
//
// WHY EXCLUDE STATIC FILES?
// - Static files don't need authentication
// - Reduces unnecessary middleware executions
// - Improves performance
//
// WHAT GETS CHECKED:
// - All dashboard pages (/dashboard/*)
// - All API routes (/api/*)
// - Landing pages (/, /login, etc.)
export const config = {
  matcher: [
    /*
     * Match all request paths EXCEPT:
     * - _next/static (Next.js static build files)
     * - _next/image (Next.js Image Optimization API)
     * - favicon.ico (browser favicon)
     * - *.png, *.jpg, *.jpeg, *.gif, *.svg, *.ico (image files)
     *
     * Regex explanation:
     * (?!...) = Negative lookahead - match anything NOT containing these patterns
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.png|.*\\.jpg|.*\\.jpeg|.*\\.gif|.*\\.svg|.*\\.ico).*)',
  ],
}
