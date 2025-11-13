/**
 * ============================================================================
 * ACTIVITY TRACKER (src/lib/activity-tracker.ts)
 * ============================================================================
 *
 * PURPOSE: Track user activity for JWT-based authentication systems
 *
 * WHY THIS EXISTS:
 * - JWT sessions are stored in browser cookies, NOT in database
 * - The Session table is empty when using JWT strategy
 * - Active Users Monitor needs to show who's currently using the system
 * - This module provides activity tracking independent of session storage
 *
 * HOW IT WORKS:
 * 1. On each request, we record the user's "last seen" timestamp
 * 2. Store IP, user agent, current URL for monitoring
 * 3. Use UPSERT to update existing record or create new one
 * 4. Query users active in last N minutes to show "online" status
 *
 * USAGE:
 * ```typescript
 * // In API routes
 * import { trackUserActivity } from '@/lib/activity-tracker'
 * await trackUserActivity(userId, request)
 *
 * // In middleware (optional)
 * import { trackUserActivityFromToken } from '@/lib/activity-tracker'
 * await trackUserActivityFromToken(token, request)
 * ```
 *
 * PERFORMANCE:
 * - Single UPSERT query per request (very fast)
 * - Only updates timestamp if > 1 minute since last update (reduces DB writes)
 * - Indexed queries for fast lookups
 * - No joins needed for simple activity checks
 */

import { prisma } from '@/lib/prisma'
import { NextRequest } from 'next/server'

/**
 * Extract device type from user agent string
 */
function getDeviceType(userAgent: string | null): string {
  if (!userAgent) return 'unknown'

  const ua = userAgent.toLowerCase()
  if (ua.includes('mobile')) return 'mobile'
  if (ua.includes('tablet') || ua.includes('ipad')) return 'tablet'
  return 'desktop'
}

/**
 * Extract browser name from user agent string
 */
function getBrowserName(userAgent: string | null): string {
  if (!userAgent) return 'unknown'

  const ua = userAgent.toLowerCase()
  if (ua.includes('edg')) return 'Edge'
  if (ua.includes('chrome')) return 'Chrome'
  if (ua.includes('firefox')) return 'Firefox'
  if (ua.includes('safari')) return 'Safari'
  if (ua.includes('opera')) return 'Opera'
  return 'unknown'
}

/**
 * Get client IP address from request
 * Handles various proxy headers (Cloudflare, Vercel, etc.)
 */
function getClientIp(request: NextRequest): string | null {
  // Try various headers in order of preference
  const forwarded = request.headers.get('x-forwarded-for')
  if (forwarded) {
    return forwarded.split(',')[0].trim()
  }

  const realIp = request.headers.get('x-real-ip')
  if (realIp) {
    return realIp
  }

  const cfConnectingIp = request.headers.get('cf-connecting-ip')
  if (cfConnectingIp) {
    return cfConnectingIp
  }

  return null
}

/**
 * Track user activity with smart throttling
 *
 * THROTTLING: Only updates if last update was > 1 minute ago
 * This reduces database writes while keeping accurate activity tracking
 *
 * @param userId - The user ID to track
 * @param request - Next.js request object (to extract IP, user agent, URL)
 */
export async function trackUserActivity(
  userId: number,
  request: NextRequest
): Promise<void> {
  try {
    const userAgent = request.headers.get('user-agent')
    const ipAddress = getClientIp(request)
    const currentUrl = request.nextUrl.pathname

    // Check if we need to update (throttle to max once per minute)
    const existingActivity = await prisma.userActivity.findUnique({
      where: { userId },
      select: { lastSeenAt: true }
    })

    const now = new Date()
    const oneMinuteAgo = new Date(now.getTime() - 60 * 1000)

    // Skip update if last activity was less than 1 minute ago
    if (existingActivity && existingActivity.lastSeenAt > oneMinuteAgo) {
      return // Throttled - no update needed
    }

    // Upsert activity record (update if exists, create if not)
    await prisma.userActivity.upsert({
      where: { userId },
      update: {
        lastSeenAt: now,
        currentUrl,
        ipAddress,
        userAgent,
        deviceType: getDeviceType(userAgent),
        browser: getBrowserName(userAgent),
        updatedAt: now
      },
      create: {
        userId,
        lastSeenAt: now,
        currentUrl,
        ipAddress,
        userAgent,
        deviceType: getDeviceType(userAgent),
        browser: getBrowserName(userAgent)
      }
    })
  } catch (error) {
    // Don't throw - activity tracking failures shouldn't break the app
    console.error('[Activity Tracker] Error tracking user activity:', error)
  }
}

/**
 * Track activity from JWT token (for use in middleware)
 *
 * @param token - NextAuth JWT token
 * @param request - Next.js request object
 */
export async function trackUserActivityFromToken(
  token: any,
  request: NextRequest
): Promise<void> {
  // Debug logging (only in development)
  if (process.env.NODE_ENV === 'development') {
    console.log('[Activity Tracker] trackUserActivityFromToken called')
    console.log('[Activity Tracker] Token userId:', token?.userId)
    console.log('[Activity Tracker] Request path:', request.nextUrl.pathname)
  }

  if (!token?.userId) {
    if (process.env.NODE_ENV === 'development') {
      console.log('[Activity Tracker] ❌ No userId in token, skipping')
    }
    return
  }

  const userId = parseInt(token.userId.toString())
  if (isNaN(userId)) {
    if (process.env.NODE_ENV === 'development') {
      console.log('[Activity Tracker] ❌ Invalid userId:', token.userId)
    }
    return
  }

  if (process.env.NODE_ENV === 'development') {
    console.log('[Activity Tracker] ✓ Tracking user ID:', userId)
  }

  await trackUserActivity(userId, request)
}

/**
 * Get users active within the specified time window
 *
 * @param businessId - Business ID to filter by
 * @param minutesAgo - Time window in minutes (default: 5)
 * @returns Array of active users with their details
 */
export async function getActiveUsers(
  businessId: number,
  minutesAgo: number = 5
) {
  const cutoffTime = new Date(Date.now() - minutesAgo * 60 * 1000)

  return await prisma.userActivity.findMany({
    where: {
      lastSeenAt: {
        gte: cutoffTime
      },
      user: {
        businessId: businessId,
        allowLogin: true
      }
    },
    include: {
      user: {
        select: {
          id: true,
          username: true,
          firstName: true,
          lastName: true,
          surname: true,
          email: true,
          roles: {
            include: {
              role: {
                select: {
                  name: true
                }
              }
            }
          },
          userLocations: {
            include: {
              location: {
                select: {
                  id: true,
                  name: true,
                  locationCode: true
                }
              }
            }
          }
        }
      }
    },
    orderBy: {
      lastSeenAt: 'desc'
    }
  })
}

/**
 * Clean up old activity records (run periodically)
 * Removes activity records older than specified days
 *
 * @param daysOld - Remove records older than this many days (default: 30)
 */
export async function cleanupOldActivity(daysOld: number = 30): Promise<number> {
  const cutoffDate = new Date(Date.now() - daysOld * 24 * 60 * 60 * 1000)

  const result = await prisma.userActivity.deleteMany({
    where: {
      lastSeenAt: {
        lt: cutoffDate
      }
    }
  })

  return result.count
}
