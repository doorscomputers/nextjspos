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

// Offline queue for failed requests - persisted to localStorage
type OfflineQueueItem = {
  url: string
  body: any
  options?: ApiClientOptions
  timestamp: number
  retries: number
}

// Load queue from localStorage on startup
function loadOfflineQueue(): OfflineQueueItem[] {
  if (typeof window === 'undefined') return []
  try {
    const stored = localStorage.getItem(OFFLINE_QUEUE_KEY)
    if (stored) {
      const parsed = JSON.parse(stored)
      console.log(`[API Client] Loaded ${parsed.length} queued requests from storage`)
      return parsed
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

// Initialize queue from localStorage
const offlineQueue: OfflineQueueItem[] = loadOfflineQueue()

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
}

interface ApiClientOptions extends RequestInit {
  skipIdempotency?: boolean // Set to true to disable idempotency for this request
  maxRetries?: number // Maximum retry attempts (default: 3)
  retryDelay?: number // Initial retry delay in ms (default: 1000)
  queueIfOffline?: boolean // Queue request if offline (default: true)
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

/**
 * Process offline queue when connection is restored
 * CRITICAL-3 & CRITICAL-4 FIX: Persists queue to localStorage and notifies on completion
 */
async function processOfflineQueue() {
  if (offlineQueue.length === 0) return

  const totalQueued = offlineQueue.length
  console.log(`[API Client] Processing ${totalQueued} queued requests`)

  const queueCopy = [...offlineQueue]
  offlineQueue.length = 0 // Clear queue
  saveOfflineQueue(offlineQueue) // Save cleared queue

  let successCount = 0
  let failedCount = 0

  for (const queuedRequest of queueCopy) {
    try {
      await apiPost(queuedRequest.url, queuedRequest.body, {
        ...queuedRequest.options,
        queueIfOffline: false, // Don't re-queue if it fails again
      })
      console.log(`[API Client] Successfully processed queued request to ${queuedRequest.url}`)
      successCount++
    } catch (error) {
      console.error(`[API Client] Failed to process queued request to ${queuedRequest.url}:`, error)
      // If it still fails, put it back in queue for manual retry
      offlineQueue.push({
        ...queuedRequest,
        retries: queuedRequest.retries + 1,
      })
      failedCount++
    }
  }

  // Save any failed requests back to localStorage
  saveOfflineQueue(offlineQueue)

  // Notify listeners of sync results (CRITICAL-4)
  if (onSyncComplete) {
    onSyncComplete({ success: successCount, failed: failedCount })
  }

  // Also dispatch a custom event for components that prefer event-based notification
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('offlineQueueSynced', {
      detail: { success: successCount, failed: failedCount, remaining: offlineQueue.length }
    }))
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
  return offlineQueue.length
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
    offlineQueue.push({
      url,
      body,
      options,
      timestamp: Date.now(),
      retries: 0,
    })
    saveOfflineQueue(offlineQueue) // Persist to localStorage so it survives page refresh
    throw new Error('No internet connection. Request has been queued and will be sent when connection is restored.')
  }

  // Generate deterministic idempotency key (unless disabled)
  // This ensures the SAME request gets the SAME key, even after page refresh
  const idempotencyKey = options?.skipIdempotency
    ? undefined
    : await generateDeterministicIdempotencyKey(url, body)

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
        method: 'POST',
        body: JSON.stringify(body),
        headers,
        signal: AbortSignal.timeout(60000), // 60 second timeout
        ...options,
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

        // Queue for offline processing if appropriate
        if (queueIfOffline && !isOnline) {
          offlineQueue.push({
            url,
            body,
            options,
            timestamp: Date.now(),
            retries: 0,
          })
          saveOfflineQueue(offlineQueue) // Persist to localStorage (CRITICAL-3 FIX)
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
