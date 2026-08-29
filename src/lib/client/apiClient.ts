/**
 * API Client with Request Deduplication, Idempotency, Retry Logic, and Offline Queue
 * 101% BULLETPROOF - Prevents duplicate submissions on unreliable networks
 */

// Track in-flight requests to prevent duplicate submissions
const pendingRequests = new Map<string, Promise<Response>>()

/**
 * Generate a deterministic idempotency key based on request payload
 * This ensures that the same request (even after page refresh) gets the same key
 *
 * IMPORTANT: For sales endpoints, the key is based on CART CONTENTS (not time)
 * This prevents double-entry bugs when network times out and user retries:
 * - Same cart = Same key = Server returns cached response
 * - Different cart = Different key = Server processes new sale
 */
async function generateDeterministicIdempotencyKey(
  url: string,
  body: any
): Promise<string> {
  let payload: string

  // Special handling for sales endpoint - use cart-based key with DATE component
  // This allows same items to be sold on different days while preventing
  // duplicate submissions from network timeout retries on the same day
  if (url === '/api/sales' && body?.items) {
    // Create deterministic key from cart contents + current date
    // Key stays the same within the same day for retry handling
    // Key changes on a new day to allow selling same items again
    const today = new Date().toISOString().split('T')[0] // YYYY-MM-DD
    const cartFingerprint = {
      url,
      locationId: body.locationId,
      customerId: body.customerId || null,
      // Include date so same items on different days get different keys
      date: today,
      // CRITICAL FIX: Include cart session ID so same items in a NEW cart get a different key
      // This allows selling the same product multiple times per day
      cartSessionId: body.cartSessionId || null,
      // Sort items by productVariationId for consistent ordering
      items: body.items
        .map((i: any) => ({
          pid: i.productVariationId,
          qty: i.quantity,
          price: i.unitPrice,
        }))
        .sort((a: any, b: any) => a.pid - b.pid),
      // Include total and item count for extra safety against collisions
      total: body.items.reduce(
        (sum: number, i: any) => sum + i.quantity * i.unitPrice,
        0
      ),
      itemCount: body.items.length,
    }
    payload = JSON.stringify(cartFingerprint)
  } else {
    // For other endpoints, use the original time-based approach
    // Round timestamp to 30-second blocks (allows retry window)
    const timeBlock = Math.floor(Date.now() / 30000)
    payload = JSON.stringify({
      url,
      body,
      timeBlock,
    })
  }

  // Use Web Crypto API for hashing (available in browser)
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    const encoder = new TextEncoder()
    const data = encoder.encode(payload)
    const hashBuffer = await crypto.subtle.digest('SHA-256', data)
    const hashArray = Array.from(new Uint8Array(hashBuffer))
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
    return `idem_${hashHex.slice(0, 32)}`
  }

  // Fallback: simple string hash for environments without crypto.subtle
  let hash = 0
  for (let i = 0; i < payload.length; i++) {
    const char = payload.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash // Convert to 32-bit integer
  }
  return `idem_${Math.abs(hash).toString(16)}`
}

// Offline queue storage key
const OFFLINE_QUEUE_KEY = 'pos_offline_queue'

// Queued requests older than this are dropped instead of replayed.
// A stale body (saleDate, prices, shift context) replayed hours or days
// later creates phantom duplicate sales — the cashier re-rings the sale
// long before this window expires if it truly never reached the server.
const MAX_QUEUE_AGE_MS = 2 * 60 * 60 * 1000 // 2 hours

// Offline queue for failed requests - persisted to localStorage
type OfflineQueueItem = {
  id: string
  url: string
  body: any
  options?: ApiClientOptions
  timestamp: number
  retries: number
  // Computed at ENQUEUE time and reused on every replay. The sales key
  // embeds the UTC date, so recomputing it during a replay that crosses
  // UTC midnight (8:00 AM Manila) would mint a new key → duplicate sale.
  idempotencyKey?: string
}

// Alert listeners (POS page) that queued requests aged out and were dropped
function dispatchQueueExpiredEvent(expired: OfflineQueueItem[]): void {
  if (expired.length === 0 || typeof window === 'undefined') return
  console.warn(
    `[API Client] Dropped ${expired.length} expired queued request(s) (>2h old) - NOT submitted:`,
    expired.map(item => ({ url: item.url, queuedAt: new Date(item.timestamp).toISOString() }))
  )
  window.dispatchEvent(new CustomEvent('offlineQueueExpired', {
    detail: {
      dropped: expired.length,
      requests: expired.map(item => ({
        url: item.url,
        queuedAt: new Date(item.timestamp).toISOString(),
      })),
    },
  }))
}

function generateQueueItemId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `q_${Date.now()}_${Math.random().toString(16).slice(2)}`
}

// localStorage is the single source of truth for the queue. Every operation
// re-reads storage so a second POS tab cannot clobber another tab's queued
// sales, and a reload mid-replay cannot lose in-flight items.
function readOfflineQueue(): OfflineQueueItem[] {
  if (typeof window === 'undefined') return []
  try {
    const stored = localStorage.getItem(OFFLINE_QUEUE_KEY)
    if (stored) {
      const parsed: OfflineQueueItem[] = JSON.parse(stored)
      const now = Date.now()
      const expired = parsed.filter(item => now - item.timestamp > MAX_QUEUE_AGE_MS)
      const fresh = parsed.filter(item => now - item.timestamp <= MAX_QUEUE_AGE_MS)
      // Items queued before the id field existed get one assigned (and persisted,
      // otherwise removal-by-id after a successful replay would never match)
      let assignedIds = false
      for (const item of fresh) {
        if (!item.id) {
          item.id = generateQueueItemId()
          assignedIds = true
        }
      }
      if (expired.length > 0 || assignedIds) {
        localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(fresh))
      }
      // This read path prunes before processOfflineQueue ever sees the items
      // (POS polls the queue length every 2s), so the cashier alert must fire
      // from here or expired sales would be dropped silently.
      dispatchQueueExpiredEvent(expired)
      return fresh
    }
  } catch (e) {
    console.error('[API Client] Failed to load offline queue from storage:', e)
  }
  return []
}

// Save queue to localStorage
function saveOfflineQueue(queue: OfflineQueueItem[]): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue))
  } catch (e) {
    console.error('[API Client] Failed to save offline queue to storage:', e)
  }
}

// Add a request to the persistent queue (read-merge-write so concurrent tabs don't clobber each other)
async function enqueueOfflineRequest(url: string, body: any, options?: ApiClientOptions): Promise<void> {
  const idempotencyKey = options?.skipIdempotency
    ? undefined
    : await generateDeterministicIdempotencyKey(url, body)
  const queue = readOfflineQueue()
  queue.push({
    id: generateQueueItemId(),
    url,
    body,
    options,
    timestamp: Date.now(),
    retries: 0,
    idempotencyKey,
  })
  saveOfflineQueue(queue)
}

// Remove a single item from the persistent queue by id
function removeOfflineRequest(id: string): void {
  const queue = readOfflineQueue()
  saveOfflineQueue(queue.filter(item => item.id !== id))
}

// A network-level failure means the request may never have reached the server
// (or the response was lost). App-level failures (validation, insufficient
// stock, etc.) arrive as plain Error with the server message and must NOT be queued.
function isNetworkError(error: any): boolean {
  return (
    error instanceof TypeError || // fetch: "Failed to fetch" / DNS / connection reset
    error?.name === 'TimeoutError' || // AbortSignal.timeout fired
    error?.name === 'AbortError'
  )
}

// Connection status
let isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true

// Monitor connection status
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    isOnline = true
    console.log('[API Client] Connection restored - processing offline queue')
    processOfflineQueue()
  })
  window.addEventListener('offline', () => {
    isOnline = false
    console.log('[API Client] Connection lost - requests will be queued')
  })

  // The 'online' event alone is NOT a reliable replay trigger: a flaky WAN
  // fails requests while navigator.onLine stays true, so nothing would ever
  // fire it. Replay shortly after load and on a steady interval — the
  // re-entrancy guard and per-item idempotency keys make extra runs safe.
  setTimeout(() => { processOfflineQueue() }, 5000)
  setInterval(() => { processOfflineQueue() }, 60000)
}

interface ApiClientOptions extends RequestInit {
  skipIdempotency?: boolean // Set to true to disable idempotency for this request
  maxRetries?: number // Maximum retry attempts (default: 3)
  retryDelay?: number // Initial retry delay in ms (default: 1000)
  queueIfOffline?: boolean // Queue request if offline (default: true)
  idempotencyKey?: string // Precomputed key (queue replay) - overrides generation
}

/**
 * Exponential backoff retry delay
 */
function getRetryDelay(attempt: number, baseDelay: number = 1000): number {
  return Math.min(baseDelay * Math.pow(2, attempt), 30000) // Max 30 seconds
}

/**
 * Sleep utility for retry delays
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

// Notification callbacks for offline sync results
type SyncResultCallback = (results: { success: number; failed: number }) => void
let onSyncComplete: SyncResultCallback | null = null

/**
 * Register a callback to be notified when offline queue sync completes
 * CRITICAL-4 FIX: Allows UI to show notifications after sync
 */
export function onOfflineQueueSyncComplete(callback: SyncResultCallback): void {
  onSyncComplete = callback
}

// Re-entrancy guard: a flapping connection can fire 'online' repeatedly
let isProcessingQueue = false

/**
 * Process offline queue when connection is restored
 * Items are removed from persistent storage only AFTER the server confirms
 * them — a reload/crash mid-replay leaves unconfirmed items queued, and the
 * server-side idempotency key makes a second replay of a confirmed item a no-op.
 */
async function processOfflineQueue() {
  if (isProcessingQueue) return
  isProcessingQueue = true

  try {
    // Drop expired requests instead of replaying stale bodies (phantom sales)
    const queue = readOfflineQueue()
    const now = Date.now()
    const expired = queue.filter(item => now - item.timestamp > MAX_QUEUE_AGE_MS)
    const fresh = queue.filter(item => now - item.timestamp <= MAX_QUEUE_AGE_MS)
    if (expired.length > 0) {
      saveOfflineQueue(fresh)
      dispatchQueueExpiredEvent(expired)
    }

    if (fresh.length === 0) return
    console.log(`[API Client] Processing ${fresh.length} queued requests`)

    let successCount = 0
    let failedCount = 0

    for (const queuedRequest of fresh) {
      try {
        await apiPost(queuedRequest.url, queuedRequest.body, {
          ...queuedRequest.options,
          queueIfOffline: false, // Don't re-queue if it fails again
          // Reuse the key computed at enqueue time - recomputing across UTC
          // midnight would mint a new key and duplicate the sale
          idempotencyKey: queuedRequest.idempotencyKey,
        })
        console.log(`[API Client] Successfully processed queued request to ${queuedRequest.url}`)
        // Remove from persistent queue only after confirmed success
        removeOfflineRequest(queuedRequest.id)
        successCount++
      } catch (error) {
        console.error(`[API Client] Failed to process queued request to ${queuedRequest.url}:`, error)
        // Leave the item in the queue; bump its retry counter in storage
        const current = readOfflineQueue()
        const match = current.find(item => item.id === queuedRequest.id)
        if (match) {
          match.retries += 1
          saveOfflineQueue(current)
        }
        failedCount++
      }
    }

    // Notify listeners of sync results (CRITICAL-4)
    if (onSyncComplete) {
      onSyncComplete({ success: successCount, failed: failedCount })
    }

    // Also dispatch a custom event for components that prefer event-based notification
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('offlineQueueSynced', {
        detail: { success: successCount, failed: failedCount, remaining: readOfflineQueue().length }
      }))
    }
  } finally {
    isProcessingQueue = false
  }
}

/**
 * Get connection status
 */
export function isConnectionOnline(): boolean {
  return isOnline
}

/**
 * Get offline queue length
 */
export function getOfflineQueueLength(): number {
  return readOfflineQueue().length
}

/**
 * POST request with automatic deduplication, idempotency, and retry logic
 */
export async function apiPost<T = any>(
  url: string,
  body: any,
  options?: ApiClientOptions
): Promise<T> {
  const requestKey = `POST-${url}-${JSON.stringify(body)}`
  const maxRetries = options?.maxRetries ?? 3
  const retryDelay = options?.retryDelay ?? 1000
  const queueIfOffline = options?.queueIfOffline ?? true

  // If same request already in flight, return existing promise
  if (pendingRequests.has(requestKey)) {
    console.log(`[API Client] Deduplicating request to ${url}`)
    const existingPromise = pendingRequests.get(requestKey)!
    const response = await existingPromise
    return response.json()
  }

  // Check if offline - queue request and persist to localStorage (CRITICAL-3 FIX)
  if (!isOnline && queueIfOffline) {
    console.log(`[API Client] Offline - queuing request to ${url}`)
    await enqueueOfflineRequest(url, body, options)
    throw new Error('No internet connection. Request has been queued and will be sent when connection is restored.')
  }

  // Generate deterministic idempotency key (unless disabled)
  // This ensures the SAME request gets the SAME key, even after page refresh.
  // Queue replays pass the key computed at enqueue time instead.
  const idempotencyKey = options?.skipIdempotency
    ? undefined
    : options?.idempotencyKey ?? await generateDeterministicIdempotencyKey(url, body)

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...options?.headers,
  }

  if (idempotencyKey) {
    headers['Idempotency-Key'] = idempotencyKey
  }

  // Retry logic with exponential backoff
  let lastError: Error | null = null

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const requestPromise = fetch(url, {
        ...options,
        method: 'POST',
        body: JSON.stringify(body),
        headers, // after ...options so caller-supplied headers cannot drop Idempotency-Key
        signal: AbortSignal.timeout(60000), // 60 second timeout
      })
        .then(async (response) => {
          // Check if this was a replayed response (idempotency cache hit)
          const isReplay = response.headers.get('X-Idempotent-Replay') === 'true'
          if (isReplay) {
            console.log(`[API Client] Received replayed response for ${url} (idempotency cache hit)`)
          }

          // Handle 429 "Request in progress" - another identical request is being processed
          if (response.status === 429) {
            const retryAfter = parseInt(response.headers.get('Retry-After') || '5')
            const errorData = await response.json().catch(() => ({ error: 'Request in progress' }))
            console.log(`[API Client] Request in progress (429), will retry in ${retryAfter}s`)
            // Throw special error that will trigger a retry with delay
            const error = new Error(`REQUEST_IN_PROGRESS:${retryAfter}`)
            ;(error as any).retryAfter = retryAfter
            ;(error as any).isInProgress = true
            throw error
          }

          if (!response.ok) {
            const error = await response.json().catch(() => ({ error: 'Request failed' }))
            throw new Error(error.error || `Request failed with status ${response.status}`)
          }

          return response
        })
        .finally(() => {
          // Remove from pending requests after completion
          pendingRequests.delete(requestKey)
        })

      pendingRequests.set(requestKey, requestPromise)

      const response = await requestPromise
      const data = await response.json()

      // Success! Return data
      console.log(`[API Client] Request to ${url} succeeded on attempt ${attempt + 1}`)
      return data
    } catch (error: any) {
      lastError = error
      pendingRequests.delete(requestKey) // Clean up on error

      // Don't retry on certain errors
      if (error.message.includes('Unauthorized') || error.message.includes('Forbidden')) {
        console.error(`[API Client] Non-retryable error for ${url}:`, error.message)
        throw error
      }

      // Special handling for 429 "Request in progress" - use server-specified delay
      if (error.isInProgress && error.retryAfter) {
        const serverDelay = error.retryAfter * 1000 // Convert to milliseconds
        console.log(`[API Client] Another request is processing, waiting ${serverDelay}ms before retry...`)
        await sleep(serverDelay)
        continue // Retry immediately after waiting
      }

      // If not last attempt, wait and retry
      if (attempt < maxRetries) {
        const delay = getRetryDelay(attempt, retryDelay)
        console.log(`[API Client] Request to ${url} failed (attempt ${attempt + 1}/${maxRetries + 1}). Retrying in ${delay}ms...`)
        await sleep(delay)
      } else {
        console.error(`[API Client] Request to ${url} failed after ${maxRetries + 1} attempts`)

        // Queue when retries are exhausted by NETWORK failures, even if
        // navigator.onLine is still true (typical intermittent WAN: WiFi up,
        // internet down). App-level errors are never queued — they would fail
        // again identically on replay.
        if (queueIfOffline && (!isOnline || isNetworkError(error))) {
          await enqueueOfflineRequest(url, body, options)
          throw new Error('Request failed and queued for retry when connection is restored.')
        }
      }
    }
  }

  // If we get here, all retries failed
  throw lastError || new Error('Request failed after multiple retries')
}

/**
 * PUT request with deduplication
 */
export async function apiPut<T = any>(
  url: string,
  body: any,
  options?: ApiClientOptions
): Promise<T> {
  const requestKey = `PUT-${url}-${JSON.stringify(body)}`

  if (pendingRequests.has(requestKey)) {
    const existingPromise = pendingRequests.get(requestKey)!
    const response = await existingPromise
    return response.json()
  }

  const requestPromise = fetch(url, {
    method: 'PUT',
    body: JSON.stringify(body),
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
    ...options,
  })
    .then(async (response) => {
      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Request failed' }))
        throw new Error(error.error || `Request failed with status ${response.status}`)
      }
      return response
    })
    .finally(() => {
      pendingRequests.delete(requestKey)
    })

  pendingRequests.set(requestKey, requestPromise)

  const response = await requestPromise
  return response.json()
}

/**
 * GET request (no deduplication needed for reads)
 */
export async function apiGet<T = any>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
    ...options,
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Request failed' }))
    throw new Error(error.error || `Request failed with status ${response.status}`)
  }

  return response.json()
}

/**
 * DELETE request with deduplication
 */
export async function apiDelete<T = any>(url: string, options?: RequestInit): Promise<T> {
  const requestKey = `DELETE-${url}`

  if (pendingRequests.has(requestKey)) {
    const existingPromise = pendingRequests.get(requestKey)!
    const response = await existingPromise
    return response.json()
  }

  const requestPromise = fetch(url, {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
    ...options,
  })
    .then(async (response) => {
      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Request failed' }))
        throw new Error(error.error || `Request failed with status ${response.status}`)
      }
      return response
    })
    .finally(() => {
      pendingRequests.delete(requestKey)
    })

  pendingRequests.set(requestKey, requestPromise)

  const response = await requestPromise
  return response.json()
}

/**
 * Clear all pending requests (useful for cleanup)
 */
export function clearPendingRequests() {
  pendingRequests.clear()
}

/**
 * Check if a request is currently pending
 */
export function isRequestPending(method: string, url: string, body?: any): boolean {
  const requestKey = body
    ? `${method}-${url}-${JSON.stringify(body)}`
    : `${method}-${url}`
  return pendingRequests.has(requestKey)
}
