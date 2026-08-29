"use client"

import { useEffect } from "react"
import { drainDroppedQueueNotices, getOfflineQueueLength } from "@/lib/client/apiClient"

/**
 * Keeps the offline sale queue alive across the whole dashboard.
 *
 * Two jobs, both of which must happen outside the POS page:
 *
 * 1. Importing the api client starts its replay timer, so a sale queued on POS
 *    keeps retrying even after the cashier navigates elsewhere in the dashboard.
 *
 * 2. Telling the cashier about sales that aged out of the queue and were never
 *    submitted.
 *
 * Job 2 deliberately does NOT rely on catching the `offlineQueueExpired` event
 * live. Pruning happens inside readOfflineQueue, which runs from status polls,
 * the module's own 5s timer, and enqueue — any of which can fire before this
 * component has mounted (during the layout's auth spinner, on a hard reload, or
 * while a page's own effect runs first). A missed event would mean a sale
 * silently vanished. Instead the api client persists each dropped sale, and
 * this component drains that record whenever it mounts. The live event is kept
 * only as a fast path; draining clears the record, so the two cannot
 * double-alert.
 */
export default function OfflineQueueWatcher() {
  useEffect(() => {
    const showDropped = () => {
      const dropped = drainDroppedQueueNotices()
      if (dropped.length === 0) return

      const lines = dropped.map(d => `• ${d.summary || d.url}`).join('\n')
      alert(
        `⚠️ ${dropped.length} offline sale(s) queued more than 2 hours ago were NOT submitted.\n\n` +
        `${lines}\n\n` +
        `These were never saved. Check the Sales List first — if a sale is not there, ring it up again now.`
      )
    }

    // Deferred: pruning can happen synchronously inside an in-flight sale
    // submit, and a blocking alert() there would freeze that request mid-await.
    const handleQueueExpired = () => { setTimeout(showDropped, 0) }

    window.addEventListener('offlineQueueExpired', handleQueueExpired)

    // Drain anything dropped before this component existed.
    showDropped()

    const pending = getOfflineQueueLength()
    if (pending > 0) {
      console.log(`[OfflineQueueWatcher] ${pending} queued request(s) pending sync`)
    }

    return () => window.removeEventListener('offlineQueueExpired', handleQueueExpired)
  }, [])

  return null
}
