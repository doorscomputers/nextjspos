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
                isActive: { select: { id: true, name: true } }
            },
            select: {
                id: { select: { id: true, name: true } },
                name: { select: { id: true, name: true } },
                sku: { select: { id: true, name: true } },
                image: { select: { id: true, name: true } },
                isActive: { select: { id: true, name: true } },
                category: { select: { id: { select: { id: true, name: true } }, name: { select: { id: true, name: true } } } },
                brand: { select: { id: { select: { id: true, name: true } }, name: { select: { id: true, name: true } } } },
                unit: { select: { id: { select: { id: true, name: true } }, name: { select: { id: true, name: true } }, shortName: { select: { id: true, name: true } } } },
                variations: {
                    where: { deletedAt: null },
                    select: {
                        id: { select: { id: true, name: true } },
                        name: { select: { id: true, name: true } },
                        sku: { select: { id: true, name: true } },
                        variationLocationDetails: {
                            select: { id: { select: { id: true, name: true } }, qtyAvailable: { select: { id: true, name: true } } }
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
                _sum: { totalAmount: { select: { id: true, name: true } }, subtotal: { select: { id: true, name: true } } },
                _count: { select: { id: true, name: true } }
            }),
            prisma.accountsPayable.aggregate({
                where: {
                    businessId,
                    invoiceDate: { gte: today, lt: tomorrow }
                },
                _sum: { totalAmount: { select: { id: true, name: true } } },
                _count: { select: { id: true, name: true } }
            }),
            prisma.customerReturn.aggregate({
                where: {
                    businessId,
                    returnDate: { gte: today, lt: tomorrow }
                },
                _sum: { totalRefundAmount: { select: { id: true, name: true } } },
                _count: { select: { id: true, name: true } }
            }),
            prisma.supplierReturn.aggregate({
                where: {
                    businessId,
                    returnDate: { gte: today, lt: tomorrow }
                },
                _sum: { totalAmount: { select: { id: true, name: true } } },
                _count: { select: { id: true, name: true } }
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
                isActive: { select: { id: true, name: true } }
            },
            select: {
                id: { select: { id: true, name: true } },
                name: { select: { id: true, name: true } }
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
            select: { id: { select: { id: true, name: true } }, name: { select: { id: true, name: true } } },
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
            select: { id: { select: { id: true, name: true } }, name: { select: { id: true, name: true } } },
            orderBy: { name: 'asc' }
        })
    },
    ['brands'],
    CACHE_CONFIGS.STATIC
)

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
            connected: { select: { id: true, name: true } }
        }
    } catch (error) {
        return {
            connected: false,
            error: error instanceof Error ? error.message : 'Unknown error'
        }
    }
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

