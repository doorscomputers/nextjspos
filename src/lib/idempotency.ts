import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth.simple'
import { prisma } from '@/lib/prisma.simple'

/**
 * Idempotency middleware - Prevents duplicate submissions using ATOMIC lock-first approach
 *
 * CRITICAL FIX: The previous implementation had a race condition where two concurrent
 * requests could both pass the "check if key exists" step before either had saved.
 *
 * NEW APPROACH (Atomic Lock-First):
 * 1. INSERT the idempotency key FIRST with status='processing' (atomic database operation)
 * 2. Only ONE request can claim the key - database ensures atomicity
 * 3. If INSERT fails (key exists), check status:
 *    - 'processing' → Return 429 "Request in progress"
 *    - 'completed' → Return cached response
 *    - 'failed' → Allow retry
 * 4. After handler completes, UPDATE status to 'completed' with response
 *
 * This eliminates the race condition because INSERT with ON CONFLICT is atomic at DB level.
 */
export async function withIdempotency(
  request: NextRequest,
  endpoint: string,
  handler: () => Promise<NextResponse>
): Promise<NextResponse> {
  const idempotencyKey = request.headers.get('Idempotency-Key')

  // If no idempotency key provided, process normally (backwards compatible)
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
    // STEP 1: Try to CLAIM the idempotency key atomically
    // This is the critical fix - only ONE request can succeed here
    const claimed = await prisma.$queryRaw<Array<{ id: number }>>`
      INSERT INTO idempotency_keys (key, business_id, user_id, endpoint, status, expires_at)
      VALUES (${idempotencyKey}, ${businessId}, ${userId}, ${endpoint}, 'processing',
              NOW() + INTERVAL '24 hours')
      ON CONFLICT (key) DO NOTHING
      RETURNING id
    `

    // STEP 2: If we successfully claimed the key, process the request
    if (claimed && claimed.length > 0) {
      const keyId = claimed[0].id
      console.log(`[Idempotency] Claimed key ${idempotencyKey.slice(0, 20)}... (id=${keyId})`)

      try {
        // Process the actual request
        const response = await handler()
        const responseClone = response.clone()
        const responseBody = await responseClone.json()

        // STEP 3: Update with response (mark as completed)
        await prisma.$executeRaw`
          UPDATE idempotency_keys
          SET status = 'completed',
              response_status = ${response.status},
              response_body = ${JSON.stringify(responseBody)}
          WHERE id = ${keyId}
        `

        console.log(`[Idempotency] Completed key ${idempotencyKey.slice(0, 20)}... status=${response.status}`)

        // Return the response with idempotency header
        return NextResponse.json(responseBody, {
          status: response.status,
          headers: {
            'X-Idempotent-Created': 'true',
          },
        })
      } catch (handlerError) {
        // Handler failed - mark as failed so retries can try again
        console.error(`[Idempotency] Handler failed for key ${idempotencyKey.slice(0, 20)}...:`, handlerError)
        await prisma.$executeRaw`
          UPDATE idempotency_keys SET status = 'failed' WHERE id = ${keyId}
        `
        throw handlerError
      }
    }

    // STEP 4: Key already exists (we didn't claim it) - check its status
    console.log(`[Idempotency] Key ${idempotencyKey.slice(0, 20)}... already exists, checking status`)

    const existing = await prisma.$queryRaw<
      Array<{
        status: string
        response_status: number | null
        response_body: string | null
        created_at: Date
      }>
    >`
      SELECT status, response_status, response_body, created_at
      FROM idempotency_keys
      WHERE key = ${idempotencyKey}
        AND business_id = ${businessId}
      LIMIT 1
    `

    if (existing && existing.length > 0) {
      const record = existing[0]

      if (record.status === 'processing') {
        // Check if key is stale (older than 30 seconds) - likely orphaned from failed UPDATE
        const keyAge = Date.now() - new Date(record.created_at).getTime()
        const STALE_KEY_THRESHOLD_MS = 30000 // 30 seconds

        if (keyAge > STALE_KEY_THRESHOLD_MS) {
          // Key is stale - the original request likely completed but UPDATE failed
          // Delete stale key and allow this request to proceed
          console.warn(`[Idempotency] STALE KEY: ${idempotencyKey.slice(0, 20)}... is ${Math.round(keyAge / 1000)}s old, deleting and retrying`)
          await prisma.$executeRaw`
            DELETE FROM idempotency_keys
            WHERE key = ${idempotencyKey} AND business_id = ${businessId}
          `
          // CRITICAL FIX: Recursively call withIdempotency to properly claim a new key
          // and go through the full idempotency flow (claim -> process -> update)
          // Previously this called handler() directly which bypassed the UPDATE logic
          return await withIdempotency(request, endpoint, handler)
        }

        // Key is fresh - another request is actively processing
        console.warn(`[Idempotency] BLOCKED: Key ${idempotencyKey.slice(0, 20)}... is still processing (${Math.round(keyAge / 1000)}s old)`)
        return NextResponse.json(
          {
            error: 'Request already in progress',
            message: 'Another identical request is being processed. Please wait and try again.',
            retryAfter: 5,
          },
          {
            status: 429,
            headers: {
              'Retry-After': '5',
              'X-Idempotent-Processing': 'true',
            },
          }
        )
      }

      if (record.status === 'completed' && record.response_body) {
        // Return cached response - this is a duplicate request
        console.log(`[Idempotency] REPLAY: Returning cached response for key ${idempotencyKey.slice(0, 20)}...`)
        try {
          const cachedBody = JSON.parse(record.response_body)
          return NextResponse.json(cachedBody, {
            status: record.response_status || 200,
            headers: {
              'X-Idempotent-Replay': 'true',
              'X-Original-Request-Time': record.created_at.toISOString(),
            },
          })
        } catch (parseError) {
          console.error('[Idempotency] Failed to parse cached response, processing normally')
          // Fall through to process normally
        }
      }

      if (record.status === 'failed') {
        // Previous request failed - allow retry by deleting the failed record
        console.log(`[Idempotency] Previous request failed, allowing retry for key ${idempotencyKey.slice(0, 20)}...`)
        await prisma.$executeRaw`
          DELETE FROM idempotency_keys WHERE key = ${idempotencyKey} AND business_id = ${businessId}
        `
        // Fall through to process normally
      }
    }

    // If we get here, process the request normally (shouldn't happen often)
    console.warn(`[Idempotency] Unexpected state for key ${idempotencyKey.slice(0, 20)}..., processing normally`)
    return await handler()
  } catch (error) {
    console.error('[Idempotency] Middleware error:', error)
    // On middleware error, fail-safe by processing the request normally
    // This ensures the system remains functional even if idempotency has issues
    return await handler()
  }
}

/**
 * Cleanup expired idempotency keys
 * Call this periodically (e.g., via cron job or on-demand cleanup)
 */
export async function cleanupExpiredIdempotencyKeys(): Promise<number> {
  const result = await prisma.$executeRaw`
    DELETE FROM idempotency_keys
    WHERE expires_at < CURRENT_TIMESTAMP
  `
  return result
}

/**
 * Cleanup stale 'processing' keys that were never completed
 * Call this to recover from crashed requests (e.g., server restart during processing)
 */
export async function cleanupStaleProcessingKeys(maxAgeMinutes: number = 10): Promise<number> {
  const result = await prisma.$executeRaw`
    DELETE FROM idempotency_keys
    WHERE status = 'processing'
      AND created_at < NOW() - INTERVAL '${maxAgeMinutes} minutes'
  `
  console.log(`[Idempotency] Cleaned up ${result} stale processing keys`)
  return result
}

/**
 * Generate a new idempotency key (for client-side use)
 * This is a helper for creating unique keys
 */
export function generateIdempotencyKey(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`
}
