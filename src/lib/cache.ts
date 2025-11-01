import { unstable_cache } from 'next/cache'

/**
 * Caching utilities for UltimatePOS Modern
 * 
 * Provides different caching strategies:
 * 1. Next.js unstable_cache for server-side caching
 * 2. Redis caching for expensive queries
 * 3. Static generation helpers
 */

// ============================================
// NEXT.JS CACHE CONFIGURATIONS
// ============================================

// Cache configurations for different data types
export const CACHE_CONFIGS = {
    // Static data that rarely changes
    STATIC: {
        revalidate: 3600, // 1 hour
        tags: ['static']
    },

    // Semi-static data that changes occasionally
    SEMI_STATIC: {
        revalidate: 300, // 5 minutes
        tags: ['semi-static']
    },

    // Dynamic data that changes frequently
    DYNAMIC: {
        revalidate: 60, // 1 minute
        tags: ['dynamic']
    },

    // Real-time data that should not be cached
    REALTIME: {
        revalidate: 0,
        tags: ['realtime']
    }
} as const

// ============================================
// CACHED DATA FETCHERS
// ============================================

/**
 * Cached products list for dashboard
 */
export const getCachedProducts = unstable_cache(
    async (businessId: number, page: number = 1, limit: number = 10) => {
        const { prisma } = await import('@/lib/prisma')

        const skip = (page - 1) * limit

        return await prisma.product.findMany({
            where: {
                businessId,
                deletedAt: null,
                isActive: true
            },
            select: {
                id: true,
                name: true,
                sku: true,
                image: true,
                isActive: true,
                category: { select: { id: true, name: true } },
                brand: { select: { id: true, name: true } },
                unit: { select: { id: true, name: true, shortName: true } },
                variations: {
                    where: { deletedAt: null },
                    select: {
                        id: true,
                        name: true,
                        sku: true,
                        variationLocationDetails: {
                            select: { id: true, qtyAvailable: true }
                        }
                    }
                }
            },
            orderBy: { createdAt: 'desc' },
            skip,
            take: limit
        })
    },
    ['products'],
    CACHE_CONFIGS.SEMI_STATIC
)

/**
 * Cached dashboard stats
 */
export const getCachedDashboardStats = unstable_cache(
    async (businessId: number, locationId?: number) => {
        const { prisma } = await import('@/lib/prisma')

        const whereClause: any = { businessId }
        if (locationId) {
            whereClause.locationId = locationId
        }

        // Get today's sales
        const today = new Date()
        today.setHours(0, 0, 0, 0)
        const tomorrow = new Date(today)
        tomorrow.setDate(tomorrow.getDate() + 1)

        const [salesData, purchaseData, customerReturnData, supplierReturnData] = await Promise.all([
            prisma.sale.aggregate({
                where: {
                    ...whereClause,
                    saleDate: { gte: today, lt: tomorrow },
                    status: { notIn: ['voided', 'cancelled'] }
                },
                _sum: { totalAmount: true, subtotal: true },
                _count: true
            }),
            prisma.accountsPayable.aggregate({
                where: {
                    businessId,
                    invoiceDate: { gte: today, lt: tomorrow }
                },
                _sum: { totalAmount: true },
                _count: true
            }),
            prisma.customerReturn.aggregate({
                where: {
                    businessId,
                    returnDate: { gte: today, lt: tomorrow }
                },
                _sum: { totalRefundAmount: true },
                _count: true
            }),
            prisma.supplierReturn.aggregate({
                where: {
                    businessId,
                    returnDate: { gte: today, lt: tomorrow }
                },
                _sum: { totalAmount: true },
                _count: true
            })
        ])

        return {
            totalSales: Number(salesData._sum.totalAmount || 0),
            netAmount: Number(salesData._sum.subtotal || 0),
            totalPurchase: Number(purchaseData._sum.totalAmount || 0),
            totalSellReturn: Number(customerReturnData._sum.totalRefundAmount || 0),
            totalSupplierReturn: Number(supplierReturnData._sum.totalAmount || 0),
            salesCount: salesData._count,
            purchaseCount: purchaseData._count
        }
    },
    ['dashboard-stats'],
    CACHE_CONFIGS.DYNAMIC
)

/**
 * Cached locations for a business
 */
export const getCachedLocations = unstable_cache(
    async (businessId: number) => {
        const { prisma } = await import('@/lib/prisma')

        return await prisma.businessLocation.findMany({
            where: {
                businessId,
                deletedAt: null,
                isActive: true
            },
            select: {
                id: true,
                name: true
            },
            orderBy: { name: 'asc' }
        })
    },
    ['locations'],
    CACHE_CONFIGS.STATIC
)

/**
 * Cached categories for a business
 */
export const getCachedCategories = unstable_cache(
    async (businessId: number) => {
        const { prisma } = await import('@/lib/prisma')

        return await prisma.category.findMany({
            where: { businessId, deletedAt: null },
            select: { id: true, name: true },
            orderBy: { name: 'asc' }
        })
    },
    ['categories'],
    CACHE_CONFIGS.STATIC
)

/**
 * Cached brands for a business
 */
export const getCachedBrands = unstable_cache(
    async (businessId: number) => {
        const { prisma } = await import('@/lib/prisma')

        return await prisma.brand.findMany({
            where: { businessId, deletedAt: null },
            select: { id: true, name: true },
            orderBy: { name: 'asc' }
        })
    },
    ['brands'],
    CACHE_CONFIGS.STATIC
)

// ============================================
// IN-MEMORY LRU CACHE (No external dependencies)
// ============================================

interface CacheEntry<T> {
    value: T
    expiresAt: number
}

class InMemoryLRUCache {
    private cache: Map<string, CacheEntry<any>>
    private maxSize: number

    constructor(maxSize: number = 1000) {
        this.cache = new Map()
        this.maxSize = maxSize
    }

    set<T>(key: string, value: T, ttlSeconds: number = 300): void {
        // Remove oldest entry if at capacity
        if (this.cache.size >= this.maxSize) {
            const firstKey = this.cache.keys().next().value
            this.cache.delete(firstKey)
        }

        const expiresAt = Date.now() + (ttlSeconds * 1000)
        this.cache.set(key, { value, expiresAt })
    }

    get<T>(key: string): T | null {
        const entry = this.cache.get(key)
        if (!entry) return null

        // Check if expired
        if (Date.now() > entry.expiresAt) {
            this.cache.delete(key)
            return null
        }

        // Move to end (LRU)
        this.cache.delete(key)
        this.cache.set(key, entry)

        return entry.value
    }

    delete(key: string): void {
        this.cache.delete(key)
    }

    clear(): void {
        this.cache.clear()
    }

    size(): number {
        return this.cache.size
    }

    // Clean up expired entries
    cleanup(): void {
        const now = Date.now()
        for (const [key, entry] of this.cache.entries()) {
            if (now > entry.expiresAt) {
                this.cache.delete(key)
            }
        }
    }
}

// Global in-memory cache instance
const memoryCache = new InMemoryLRUCache(1000)

// Periodic cleanup every 5 minutes
if (typeof window === 'undefined') {
    setInterval(() => {
        memoryCache.cleanup()
    }, 5 * 60 * 1000)
}

/**
 * Cache data in memory (fast, no external dependencies)
 */
export function cacheInMemory<T>(key: string, data: T, ttlSeconds: number = 300): void {
    memoryCache.set(key, data, ttlSeconds)
}

/**
 * Get cached data from memory
 */
export function getFromMemory<T>(key: string): T | null {
    return memoryCache.get<T>(key)
}

/**
 * Delete from memory cache
 */
export function deleteFromMemory(key: string): void {
    memoryCache.delete(key)
}

/**
 * Clear all memory cache
 */
export function clearMemoryCache(): void {
    memoryCache.clear()
}

/**
 * Get memory cache size
 */
export function getMemoryCacheSize(): number {
    return memoryCache.size()
}

// ============================================
// REDIS CACHING (Optional)
// ============================================

let redis: any = null

/**
 * Initialize Redis connection
 */
export async function initRedis() {
    if (redis) return redis

    try {
        const Redis = (await import('ioredis')).default
        redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379')
        console.log('✅ Redis connected')
        return redis
    } catch (error) {
        console.warn('⚠️  Redis not available, using memory cache only')
        return null
    }
}

/**
 * Cache data with Redis
 */
export async function cacheWithRedis<T>(
    key: string,
    data: T,
    ttl: number = 300 // 5 minutes default
): Promise<void> {
    const redisClient = await initRedis()
    if (!redisClient) return

    try {
        await redisClient.setex(key, ttl, JSON.stringify(data))
    } catch (error) {
        console.warn('Failed to cache with Redis:', error)
    }
}

/**
 * Get cached data from Redis
 */
export async function getFromRedis<T>(key: string): Promise<T | null> {
    const redisClient = await initRedis()
    if (!redisClient) return null

    try {
        const cached = await redisClient.get(key)
        return cached ? JSON.parse(cached) : null
    } catch (error) {
        console.warn('Failed to get from Redis:', error)
        return null
    }
}

// ============================================
// CACHE INVALIDATION
// ============================================

/**
 * Invalidate cache by tags
 */
export async function invalidateCache(tags: string[]) {
    const { revalidateTag } = await import('next/cache')

    for (const tag of tags) {
        revalidateTag(tag)
    }
}

/**
 * Invalidate product-related caches
 */
export async function invalidateProductCaches() {
    await invalidateCache(['products', 'semi-static'])
}

/**
 * Invalidate dashboard caches
 */
export async function invalidateDashboardCaches() {
    await invalidateCache(['dashboard-stats', 'dynamic'])
}

/**
 * Invalidate all caches
 */
export async function invalidateAllCaches() {
    await invalidateCache(['static', 'semi-static', 'dynamic', 'realtime'])
}

// ============================================
// CACHE MONITORING
// ============================================

/**
 * Get cache statistics
 */
export async function getCacheStats() {
    const redisClient = await initRedis()
    if (!redisClient) return null

    try {
        const info = await redisClient.info('memory')
        const keyspace = await redisClient.info('keyspace')

        return {
            memory: info,
            keyspace: keyspace,
            connected: true
        }
    } catch (error) {
        return {
            connected: false,
            error: error instanceof Error ? error.message : 'Unknown error'
        }
    }
}

// ============================================
// SMART CACHE WRAPPER UTILITIES
// ============================================

/**
 * Cache wrapper that automatically caches function results in memory
 * Usage: const cachedFunction = withCache(expensiveFunction, 'cache-key', 300)
 */
export function withCache<T extends (...args: any[]) => Promise<any>>(
    fn: T,
    keyPrefix: string,
    ttlSeconds: number = 300
): T {
    return (async (...args: Parameters<T>): Promise<Awaited<ReturnType<T>>> => {
        // Generate unique key based on function arguments
        const argsKey = JSON.stringify(args)
        const cacheKey = `${keyPrefix}:${argsKey}`

        // Try to get from cache first
        const cached = getFromMemory<Awaited<ReturnType<T>>>(cacheKey)
        if (cached !== null) {
            return cached
        }

        // Execute function and cache result
        const result = await fn(...args)
        cacheInMemory(cacheKey, result, ttlSeconds)
        return result
    }) as T
}

/**
 * Cache wrapper with manual key generation (for more control)
 * Usage: const result = await withCacheKey('my-key', () => expensiveOperation(), 300)
 */
export async function withCacheKey<T>(
    cacheKey: string,
    fn: () => Promise<T>,
    ttlSeconds: number = 300
): Promise<T> {
    // Try to get from cache first
    const cached = getFromMemory<T>(cacheKey)
    if (cached !== null) {
        return cached
    }

    // Execute function and cache result
    const result = await fn()
    cacheInMemory(cacheKey, result, ttlSeconds)
    return result
}

/**
 * Batch cache wrapper - executes multiple functions in parallel and caches results
 * Usage: const results = await withBatchCache([
 *   { key: 'key1', fn: () => query1(), ttl: 300 },
 *   { key: 'key2', fn: () => query2(), ttl: 300 }
 * ])
 */
export async function withBatchCache<T = any>(
    operations: Array<{
        key: string
        fn: () => Promise<T>
        ttl?: number
    }>
): Promise<T[]> {
    const results = await Promise.all(
        operations.map(async ({ key, fn, ttl = 300 }) => {
            // Check cache first
            const cached = getFromMemory<T>(key)
            if (cached !== null) {
                return cached
            }

            // Execute and cache
            const result = await fn()
            cacheInMemory(key, result, ttl)
            return result
        })
    )

    return results
}

/**
 * Conditional cache wrapper - only caches if condition is met
 * Usage: const result = await withConditionalCache(
 *   'key',
 *   () => query(),
 *   (result) => result.length > 0,
 *   300
 * )
 */
export async function withConditionalCache<T>(
    cacheKey: string,
    fn: () => Promise<T>,
    shouldCache: (result: T) => boolean,
    ttlSeconds: number = 300
): Promise<T> {
    // Try to get from cache first
    const cached = getFromMemory<T>(cacheKey)
    if (cached !== null) {
        return cached
    }

    // Execute function
    const result = await fn()

    // Only cache if condition is met
    if (shouldCache(result)) {
        cacheInMemory(cacheKey, result, ttlSeconds)
    }

    return result
}

/**
 * Refresh cache in background while returning stale data
 * Usage: const result = await withStaleWhileRevalidate('key', () => query(), 300)
 */
export async function withStaleWhileRevalidate<T>(
    cacheKey: string,
    fn: () => Promise<T>,
    ttlSeconds: number = 300
): Promise<T> {
    const cached = getFromMemory<T>(cacheKey)

    if (cached !== null) {
        // Return stale data immediately
        // Refresh in background (don't await)
        fn().then((result) => {
            cacheInMemory(cacheKey, result, ttlSeconds)
        }).catch((error) => {
            console.error('Background cache refresh failed:', error)
        })

        return cached
    }

    // No cache, execute normally
    const result = await fn()
    cacheInMemory(cacheKey, result, ttlSeconds)
    return result
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

/**
 * Generate cache key for business-specific data
 */
export function generateCacheKey(prefix: string, businessId: number, ...params: (string | number)[]): string {
    return `${prefix}:${businessId}:${params.join(':')}`
}

/**
 * Check if cache is enabled
 */
export function isCacheEnabled(): boolean {
    return process.env.NODE_ENV === 'production' || process.env.ENABLE_CACHE === 'true'
}

/**
 * Get cache TTL based on data type
 */
export function getCacheTTL(dataType: 'static' | 'semi-static' | 'dynamic' | 'realtime'): number {
    const ttlMap = {
        static: 3600,      // 1 hour
        'semi-static': 300, // 5 minutes
        dynamic: 60,        // 1 minute
        realtime: 0         // No cache
    }

    return ttlMap[dataType]
}

