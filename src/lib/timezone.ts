/**
 * Timezone Utility for Philippines Manila Time
 *
 * This ensures all server timestamps are recorded in Philippines Manila timezone (UTC+8)
 * regardless of the server's local timezone.
 */

/**
 * Get current date/time in Philippines Manila timezone
 * @returns Date object representing current time in Manila (UTC+8)
 */
export function getManilaDate(): Date {
  // Create date in Manila timezone (Asia/Manila = UTC+8)
  const manilaDateString = new Date().toLocaleString('en-US', {
    timeZone: 'Asia/Manila',
  })

  return new Date(manilaDateString)
}

/**
 * Convert any date to Manila timezone
 * @param date - Date to convert (optional, defaults to now)
 * @returns Date object in Manila timezone
 */
export function toManilaTime(date?: Date): Date {
  const sourceDate = date || new Date()

  const manilaDateString = sourceDate.toLocaleString('en-US', {
    timeZone: 'Asia/Manila',
  })

  return new Date(manilaDateString)
}

/**
 * Get Manila timezone offset in minutes
 * Manila is UTC+8, which is 480 minutes ahead of UTC
 */
export const MANILA_UTC_OFFSET_MINUTES = 480

/**
 * Format date in Manila timezone for display
 * @param date - Date to format
 * @param options - Intl.DateTimeFormatOptions
 * @returns Formatted date string
 */
export function formatManilaDate(
  date: Date,
  options?: Intl.DateTimeFormatOptions
): string {
  return date.toLocaleString('en-PH', {
    timeZone: 'Asia/Manila',
    ...options,
  })
}

/**
 * Get current Manila date (date only, no time)
 * @returns Date object set to midnight Manila time
 */
export function getManilaDateOnly(): Date {
  const manila = getManilaDate()
  manila.setHours(0, 0, 0, 0)
  return manila
}
