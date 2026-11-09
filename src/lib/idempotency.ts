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

  // AUTO-CLEANUP: Periodically clean old keys (1% of requests) to prevent accumulation
  // This runs in the background and doesn't block the current request
  if (Math.random() < 0.01) {
    prisma.$executeRaw`
      DELETE FROM idempotency_keys
      WHERE created_at < NOW() - INTERVAL '12 hours'
    `.then((deleted) => {
      if (deleted > 0) {
        console.log(`[Idempotency] Auto-cleanup: deleted ${deleted} old keys`)
      }
    }).catch(() => {
      // Ignore cleanup errors - non-critical
    })
  }

  // Set the moment handler() is invoked. The fail-safe in the outer catch must
  // never run the handler a second time: a sale that already committed would
  // be committed again (duplicate sale).
  let handlerStarted = false

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

      let response: NextResponse
      try {
        // Process the actual request
        handlerStarted = true
        response = await handler()
      } catch (handlerError) {
        // Handler threw before producing a response - mark as failed so retries can try again
        console.error(`[Idempotency] Handler failed for key ${idempotencyKey.slice(0, 20)}...:`, handlerError)
        await prisma.$executeRaw`
          UPDATE idempotency_keys SET status = 'failed' WHERE id = ${keyId}
        `
        throw handlerError
      }

      // STEP 3: Record the response (mark as completed).
      // The handler has finished - whatever happens below, it must NOT run again.
      // If recording fails (DB blip right after the sale committed), retry the
      // UPDATE a few times, then return the handler's response as-is rather than
      // re-running the handler.
      try {
        const responseBody = await response.clone().json()
        await markKeyCompleted(keyId, response.status, JSON.stringify(responseBody))

        console.log(`[Idempotency] Completed key ${idempotencyKey.slice(0, 20)}... status=${response.status}`)

        // Return the response with idempotency header
        return NextResponse.json(responseBody, {
          status: response.status,
          headers: {
            'X-Idempotent-Created': 'true',
          },
        })
      } catch (recordError) {
        console.error(`[Idempotency] Could not record completion for key ${idempotencyKey.slice(0, 20)}..., returning handler response as-is:`, recordError)
        return response
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
        // Check if key is stale - likely orphaned from a killed function.
        // Must exceed the longest lifetime of any idempotent function
        // (vercel.json maxDuration: sales 120s, transfers/GRN/exchange 150s):
        // deleting the key while the original request is still alive lets a
        // retry re-run the handler → duplicate sale.
        const keyAge = Date.now() - new Date(record.created_at).getTime()
        const STALE_KEY_THRESHOLD_MS = 180000 // 180 seconds

        if (keyAge > STALE_KEY_THRESHOLD_MS) {
          // Key is stale - the original request likely completed but UPDATE failed
          // CRITICAL-6 FIX: Use DELETE RETURNING to atomically check if we actually deleted
          // This prevents race condition where multiple requests try to delete the same stale key
          console.warn(`[Idempotency] STALE KEY: ${idempotencyKey.slice(0, 20)}... is ${Math.round(keyAge / 1000)}s old, attempting atomic delete`)
          const deleted = await prisma.$queryRaw<Array<{ id: number }>>`
            DELETE FROM idempotency_keys
            WHERE key = ${idempotencyKey} AND business_id = ${businessId}
            RETURNING id
          `

          // Only proceed if WE actually deleted the key (not another concurrent request)
          if (deleted && deleted.length > 0) {
            console.log(`[Idempotency] Successfully deleted stale key, retrying request`)
            // CRITICAL: Recursively call withIdempotency to properly claim a new key
            // and go through the full idempotency flow (claim -> process -> update)
            return await withIdempotency(request, endpoint, handler)
          } else {
            // Another request already deleted it - return 429 to retry
            console.warn(`[Idempotency] Stale key was already deleted by another request`)
            return NextResponse.json(
              {
                error: 'Request already in progress',
                message: 'Another request is being processed. Please wait and try again.',
                retryAfter: 2,
              },
              { status: 429, headers: { 'Retry-After': '2' } }
            )
          }
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

          // CRITICAL FIX: For sales endpoint, check if cached sale was voided/cancelled
          // The cached response has the original status, but sale may have been voided since
          // This allows users to create a new sale with same items after voiding
          if (endpoint === '/api/sales' && cachedBody.id) {
            const currentSale = await prisma.$queryRaw<Array<{ status: string }>>`
              SELECT status FROM sales WHERE id = ${cachedBody.id} LIMIT 1
            `
            if (currentSale.length > 0 && (currentSale[0].status === 'voided' || currentSale[0].status === 'cancelled')) {
              console.warn(`[Idempotency] Cached sale ${cachedBody.id} is now ${currentSale[0].status} - attempting atomic delete`)
              // CRITICAL-6 FIX: Use DELETE RETURNING to atomically ensure we deleted the key
              const deleted = await prisma.$queryRaw<Array<{ id: number }>>`
                DELETE FROM idempotency_keys WHERE key = ${idempotencyKey} AND business_id = ${businessId}
                RETURNING id
              `
              if (deleted && deleted.length > 0) {
                // Process as new request
                return await withIdempotency(request, endpoint, handler)
              }
              // If we didn't delete it, another request might be processing - fall through to return cached
            }
          }

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
    if (handlerStarted) {
      // The handler already ran (and may have committed). Never run it again -
      // report the failure so the client can check and retry safely.
      return NextResponse.json(
        {
          error: 'Request failed',
          details: error instanceof Error ? error.message : String(error),
        },
        { status: 500 }
      )
    }
    // Middleware failed before the handler ran (e.g. the claim INSERT failed).
    // Fail-safe by processing the request normally so the system stays usable.
    return await handler()
  }
}

// Retry delays for recording a completed key. Total extra wait ≤ 5s, well
// inside every route's maxDuration budget.
const COMPLETION_RETRY_DELAYS_MS = [500, 1500, 3000]

async function markKeyCompleted(keyId: number, responseStatus: number, responseBody: string): Promise<void> {
  for (let attempt = 0; ; attempt++) {
    try {
      await prisma.$executeRaw`
        UPDATE idempotency_keys
        SET status = 'completed',
            response_status = ${responseStatus},
            response_body = ${responseBody}
        WHERE id = ${keyId}
      `
      return
    } catch (error) {
      if (attempt >= COMPLETION_RETRY_DELAYS_MS.length) throw error
      console.warn(`[Idempotency] Completion UPDATE failed (attempt ${attempt + 1}), retrying in ${COMPLETION_RETRY_DELAYS_MS[attempt]}ms`)
      await new Promise((resolve) => setTimeout(resolve, COMPLETION_RETRY_DELAYS_MS[attempt]))
    }
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
