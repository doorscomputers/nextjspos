/** Pure rules of the Mobile Physical Count (no database), unit-tested in __tests__/mobileCountRules.test.ts */

export const MAX_COUNT_QTY = 1_000_000

/** Count quantity: 0 to 1,000,000 with at most 4 decimals (matches Decimal(22,4)). */
export function isValidCountQty(q: unknown): q is number {
  if (typeof q !== 'number' || !Number.isFinite(q) || q < 0 || q > MAX_COUNT_QTY) return false
  const scaled = q * 10000
  return Math.abs(scaled - Math.round(scaled)) < 1e-6
}

/**
 * Phone clock protection. Shifts a phone timestamp by (server clock − phone clock)
 * measured at upload time, then keeps it inside [session start, server now].
 * Returns null for an unreadable timestamp.
 */
export function correctCountTime(phoneIso: string, deviceNow: Date, serverNow: Date, sessionStart: Date): Date | null {
  const t = new Date(phoneIso)
  if (isNaN(t.getTime()) || isNaN(deviceNow.getTime())) return null
  const offsetMs = serverNow.getTime() - deviceNow.getTime()
  const ms = Math.min(Math.max(t.getTime() + offsetMs, sessionStart.getTime()), serverNow.getTime())
  return new Date(ms)
}
