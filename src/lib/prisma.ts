import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

// Production-optimized Prisma Client configuration with connection pooling
const createPrismaClient = () => {
  return new PrismaClient({
    log: process.env.NODE_ENV === 'production'
      ? ['error', 'warn'] // Only log errors and warnings in production
      : ['query', 'error', 'warn'], // Full logging in development

    // Connection pool optimization with explicit limits
    datasources: {
      db: {
        url: process.env.DATABASE_URL,
      },
    },
  })
}

// Set connection pool limits via environment variable
// PostgreSQL default connection limit is 100, but we should use far less per instance
// Recommended: 10-20 connections for web apps, adjust based on load
if (typeof window === 'undefined' && process.env.DATABASE_URL) {
  const url = new URL(process.env.DATABASE_URL)

  // Add connection pool parameters if not already present
  if (!url.searchParams.has('connection_limit')) {
    url.searchParams.set('connection_limit', '10')
  }
  if (!url.searchParams.has('pool_timeout')) {
    url.searchParams.set('pool_timeout', '20')
  }
  if (!url.searchParams.has('connect_timeout')) {
    url.searchParams.set('connect_timeout', '10')
  }

  process.env.DATABASE_URL = url.toString()
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient()

// 🚀 PERFORMANCE MONITORING: Log slow queries (> 1 second)
prisma.$use(async (params, next) => {
  const start = Date.now()
  const result = await next(params)
  const duration = Date.now() - start

  if (duration > 1000) {
    console.warn(
      `⚠️  Slow query detected: ${params.model}.${params.action} took ${duration}ms`,
      params.args ? `Args: ${JSON.stringify(params.args).substring(0, 200)}` : ''
    )
  }

  return result
})

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma
}

// Graceful shutdown handling
if (typeof window === 'undefined') {
  process.on('beforeExit', async () => {
    await prisma.$disconnect()
  })
}

export default prisma
