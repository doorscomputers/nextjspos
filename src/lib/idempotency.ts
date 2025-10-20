import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

/**
 * Idempotency middleware - Prevents duplicate submissions on unreliable networks
 *
 * Usage:
 * ```typescript
 * export async function POST(request: NextRequest) {
 *   return withIdempotency(request, '/api/sales', async () => {
 *     // Your endpoint logic here
 *   })
 * }
 * ```
 */
export async function withIdempotency(
  request: NextRequest,
  endpoint: string,
  handler: () => Promise<NextResponse>
): Promise<NextResponse> {
  const idempotencyKey = request.headers.get('Idempotency-Key')

  // If no idempotency key provided, process normally
  if (!idempotencyKey) {
    return await handler()
  }

  // Get user session for business isolation
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const user = session.user as any
  const businessId = parseInt(user.businessId)
  const userId = parseInt(user.id)

  try {
    // Check if this request was already processed
    const existing = await prisma.$queryRaw<
      Array<{
        id: number
        response_status: number
        response_body: any
        created_at: Date
      }>
    >(
      `SELECT id, response_status, response_body, created_at
       FROM idempotency_keys
       WHERE key = ${idempotencyKey}
         AND business_id = ${businessId}
       LIMIT 1`
    )

    if (existing && existing.length > 0) {
      const cached = existing[0]

      // Return cached response
      return new NextResponse(JSON.stringify(cached.response_body), {
        status: cached.response_status,
        headers: {
          'Content-Type': 'application/json',
          'X-Idempotent-Replay': 'true',
          'X-Original-Request-Time': cached.created_at.toISOString(),
        },
      })
    }

    // Process the request
    const response = await handler()
    const responseClone = response.clone()
    const responseBody = await responseClone.json()

    // Cache the result for 24 hours
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000)

    try {
      // Store idempotency key (use raw query to avoid Prisma schema dependency)
      await prisma.$executeRaw`
        INSERT INTO idempotency_keys (
          key,
          business_id,
          user_id,
          endpoint,
          request_body,
          response_status,
          response_body,
          expires_at
        ) VALUES (
          ${idempotencyKey},
          ${businessId},
          ${userId},
          ${endpoint},
          ${JSON.stringify(await request.json().catch(() => null))},
          ${response.status},
          ${JSON.stringify(responseBody)},
          ${expiresAt}
        )
        ON CONFLICT (key) DO NOTHING
      `
    } catch (cacheError) {
      // Log but don't fail the request if caching fails
      console.error('Failed to cache idempotency key:', cacheError)
    }

    // Return original response
    return NextResponse.json(responseBody, {
      status: response.status,
      headers: {
        'X-Idempotent-Created': 'true',
      },
    })
  } catch (error) {
    console.error('Idempotency middleware error:', error)
    // On error, process the request normally (fail-safe)
    return await handler()
  }
}

/**
 * Cleanup expired idempotency keys
 * Call this periodically (e.g., via cron job)
 */
export async function cleanupExpiredIdempotencyKeys(): Promise<number> {
  const result = await prisma.$executeRaw`
    DELETE FROM idempotency_keys
    WHERE expires_at < CURRENT_TIMESTAMP
  `
  return result
}

/**
 * Generate a new idempotency key (for client-side use)
 * This is a helper for creating unique keys
 */
export function generateIdempotencyKey(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`
}
