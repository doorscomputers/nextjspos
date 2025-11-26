/**
 * Pagination Utilities for UltimatePOS Modern
 *
 * Provides consistent pagination across all API endpoints to prevent
 * performance issues from loading too many records at once.
 */

// Maximum allowed records per request (hard limit)
// Increased from 1000 to 4000 to support POS with large product catalogs
export const MAX_PAGE_SIZE = 4000

// Default page size if not specified
export const DEFAULT_PAGE_SIZE = 50

/**
 * Extract and validate pagination parameters from URLSearchParams
 *
 * @param searchParams - URL search parameters from Next.js request
 * @returns Object with validated limit and skip values
 *
 * @example
 * ```typescript
 * const { limit, skip } = getPaginationParams(request.nextUrl.searchParams)
 * const products = await prisma.product.findMany({
 *   take: limit,
 *   skip: skip
 * })
 * ```
 */
export function getPaginationParams(searchParams: URLSearchParams): {
  limit: number
  skip: number
  page: number
} {
  const limitParam = searchParams.get('limit')
  const pageParam = searchParams.get('page')

  // Parse and validate limit (max 1000 records)
  const requestedLimit = limitParam ? parseInt(limitParam, 10) : DEFAULT_PAGE_SIZE
  const limit = Math.min(
    Math.max(requestedLimit, 1), // Minimum 1 record
    MAX_PAGE_SIZE // Maximum 1000 records
  )

  // Parse and validate page number (minimum 1)
  const page = pageParam ? Math.max(parseInt(pageParam, 10), 1) : 1

  // Calculate skip value for database offset
  const skip = (page - 1) * limit

  return { limit, skip, page }
}

/**
 * Create pagination metadata for API responses
 *
 * @param total - Total number of records
 * @param page - Current page number
 * @param limit - Records per page
 * @returns Pagination metadata object
 *
 * @example
 * ```typescript
 * const pagination = createPaginationMeta(totalCount, page, limit)
 * return NextResponse.json({
 *   data: products,
 *   pagination
 * })
 * ```
 */
export function createPaginationMeta(
  total: number,
  page: number,
  limit: number
): {
  total: number
  page: number
  limit: number
  totalPages: number
  hasNextPage: boolean
  hasPrevPage: boolean
} {
  const totalPages = Math.ceil(total / limit)

  return {
    total,
    page,
    limit,
    totalPages,
    hasNextPage: page < totalPages,
    hasPrevPage: page > 1,
  }
}

/**
 * Validate and sanitize pagination parameters from request body
 *
 * @param body - Request body containing pagination params
 * @returns Validated pagination parameters
 */
export function validatePaginationParams(body: {
  page?: number
  limit?: number
}): {
  limit: number
  skip: number
  page: number
} {
  const limit = body.limit
    ? Math.min(Math.max(body.limit, 1), MAX_PAGE_SIZE)
    : DEFAULT_PAGE_SIZE

  const page = body.page ? Math.max(body.page, 1) : 1
  const skip = (page - 1) * limit

  return { limit, skip, page }
}
