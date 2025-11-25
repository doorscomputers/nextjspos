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

/**
 * DATE RANGE UTILITIES FOR PRISMA QUERIES
 *
 * These functions create Date objects with proper UTC+8 offset for database filtering.
 * They ensure that when we query "today" in Philippines time, we get the correct UTC range.
 *
 * Example:
 * User selects "Today" (2025-11-25 in UTC+8)
 * Without offset: new Date(2025, 10, 25, 0, 0, 0) = 2025-11-25T00:00:00.000Z (UTC)
 *                 This represents 2025-11-25 08:00 AM in Philippines
 *                 Result: Misses 8 hours of today, includes 8 hours of yesterday
 *
 * With offset:    new Date('2025-11-25T00:00:00+08:00') = 2025-11-24T16:00:00.000Z (UTC)
 *                 This correctly represents 2025-11-25 00:00 AM in Philippines
 *                 Result: Correct date range
 */

/**
 * Create a date at the start of day in Philippines timezone (00:00:00)
 *
 * @param year - Full year (e.g., 2025)
 * @param month - Month (0-11, where 0 = January)
 * @param day - Day of month (1-31)
 * @returns Date object representing midnight in Philippines timezone (as UTC)
 */
export function createStartOfDayPH(year: number, month: number, day: number): Date {
  // Create ISO string with Philippines timezone offset (+08:00)
  const monthStr = String(month + 1).padStart(2, '0')
  const dayStr = String(day).padStart(2, '0')
  const isoString = `${year}-${monthStr}-${dayStr}T00:00:00+08:00`
  return new Date(isoString)
}

/**
 * Create a date at the end of day in Philippines timezone (23:59:59)
 *
 * @param year - Full year (e.g., 2025)
 * @param month - Month (0-11, where 0 = January)
 * @param day - Day of month (1-31)
 * @returns Date object representing end of day in Philippines timezone (as UTC)
 */
export function createEndOfDayPH(year: number, month: number, day: number): Date {
  // Create ISO string with Philippines timezone offset (+08:00)
  const monthStr = String(month + 1).padStart(2, '0')
  const dayStr = String(day).padStart(2, '0')
  const isoString = `${year}-${monthStr}-${dayStr}T23:59:59.999+08:00`
  return new Date(isoString)
}

/**
 * Get today's date range in Philippines timezone
 * Returns start (00:00:00) and end (23:59:59) of today
 */
export function getTodayRangePH(): { startOfDay: Date; endOfDay: Date } {
  const now = getManilaDate()
  const year = now.getFullYear()
  const month = now.getMonth()
  const day = now.getDate()

  return {
    startOfDay: createStartOfDayPH(year, month, day),
    endOfDay: createEndOfDayPH(year, month, day)
  }
}

/**
 * Get yesterday's date range in Philippines timezone
 * Returns start (00:00:00) and end (23:59:59) of yesterday
 */
export function getYesterdayRangePH(): { startOfDay: Date; endOfDay: Date } {
  const now = getManilaDate()
  const yesterday = new Date(now)
  yesterday.setDate(yesterday.getDate() - 1)

  const year = yesterday.getFullYear()
  const month = yesterday.getMonth()
  const day = yesterday.getDate()

  return {
    startOfDay: createStartOfDayPH(year, month, day),
    endOfDay: createEndOfDayPH(year, month, day)
  }
}

/**
 * Get this week's date range in Philippines timezone
 * Week starts on Sunday (day 0)
 */
export function getThisWeekRangePH(): { startOfWeek: Date; endOfWeek: Date } {
  const now = getManilaDate()
  const dayOfWeek = now.getDay() // 0 = Sunday, 6 = Saturday

  // Calculate start of week (Sunday)
  const startDate = new Date(now)
  startDate.setDate(startDate.getDate() - dayOfWeek)
  const startYear = startDate.getFullYear()
  const startMonth = startDate.getMonth()
  const startDay = startDate.getDate()

  // Calculate end of week (Saturday)
  const endDate = new Date(startDate)
  endDate.setDate(endDate.getDate() + 6)
  const endYear = endDate.getFullYear()
  const endMonth = endDate.getMonth()
  const endDay = endDate.getDate()

  return {
    startOfWeek: createStartOfDayPH(startYear, startMonth, startDay),
    endOfWeek: createEndOfDayPH(endYear, endMonth, endDay)
  }
}

/**
 * Get this month's date range in Philippines timezone
 */
export function getThisMonthRangePH(): { startOfMonth: Date; endOfMonth: Date } {
  const now = getManilaDate()
  const year = now.getFullYear()
  const month = now.getMonth()

  // First day of month
  const startOfMonth = createStartOfDayPH(year, month, 1)

  // Last day of month
  const lastDay = new Date(year, month + 1, 0).getDate()
  const endOfMonth = createEndOfDayPH(year, month, lastDay)

  return {
    startOfMonth,
    endOfMonth
  }
}

/**
 * Get this year's date range in Philippines timezone
 */
export function getThisYearRangePH(): { startOfYear: Date; endOfYear: Date } {
  const now = getManilaDate()
  const year = now.getFullYear()

  return {
    startOfYear: createStartOfDayPH(year, 0, 1), // January 1st
    endOfYear: createEndOfDayPH(year, 11, 31)    // December 31st
  }
}

/**
 * Convert a date string or Date object to Philippines timezone date range
 * Useful for parsing user-provided dates from query parameters
 *
 * @param dateInput - Date string (YYYY-MM-DD) or Date object
 * @returns Start and end of the day in Philippines timezone
 */
export function parseDateToPHRange(dateInput: string | Date): { startOfDay: Date; endOfDay: Date } {
  let year: number
  let month: number
  let day: number

  if (typeof dateInput === 'string') {
    // IMPORTANT: Parse YYYY-MM-DD string directly without timezone conversion
    // This ensures "2025-11-25" means Nov 25, not shifted by timezone
    const parts = dateInput.split('-')
    year = parseInt(parts[0], 10)
    month = parseInt(parts[1], 10) - 1 // Convert to 0-indexed
    day = parseInt(parts[2], 10)
  } else {
    // For Date objects, get components in Manila timezone
    const manilaDate = toManilaTime(dateInput)
    year = manilaDate.getFullYear()
    month = manilaDate.getMonth()
    day = manilaDate.getDate()
  }

  return {
    startOfDay: createStartOfDayPH(year, month, day),
    endOfDay: createEndOfDayPH(year, month, day)
  }
}
