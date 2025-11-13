import { PrismaClient } from '@prisma/client'

declare global {
  var prisma: PrismaClient | undefined
}

// Optimized Prisma Client for Supabase + Vercel deployment
const createPrismaClient = () => {
  // Parse DATABASE_URL and add connection pool settings
  const databaseUrl = process.env.DATABASE_URL || ''

  // Add connection pool and timeout parameters to prevent stale connections
  // This fixes: "Shift close hangs after 12+ hours"
  const urlWithParams = new URL(databaseUrl)

  // Connection pool settings for Supabase (prevents stale connections)
  urlWithParams.searchParams.set('connection_limit', '5') // Max 5 connections (Supabase recommendation)
  urlWithParams.searchParams.set('pool_timeout', '10') // 10 seconds to acquire connection
  urlWithParams.searchParams.set('connect_timeout', '15') // 15 seconds to establish new connection
  urlWithParams.searchParams.set('socket_timeout', '30') // 30 seconds for socket operations

  return new PrismaClient({
    log: process.env.NODE_ENV === 'production'
      ? ['error', 'warn']
      : ['query', 'error', 'warn'],
    datasources: {
      db: {
        url: urlWithParams.toString(),
      },
    },
  })
}

// Add connection lifecycle logging for debugging
const prismaClient = createPrismaClient()

// ⚡ CRITICAL FIX: Auto-reconnect middleware for stale connections
// Detects connection errors and automatically reconnects
// This fixes: "Shift close hangs after 12 hours" issue
//
// Only apply middleware at runtime, not during build
if (typeof prismaClient.$use === 'function') {
  try {
    prismaClient.$use(async (params, next) => {
      const maxRetries = 2
      let attempt = 0

      while (attempt < maxRetries) {
        try {
          return await next(params)
        } catch (error: any) {
          attempt++

          // Check if error is a connection/timeout issue
          const isConnectionError =
            error.message?.includes('Connection') ||
            error.message?.includes('timeout') ||
            error.message?.includes('ECONNRESET') ||
            error.message?.includes('ETIMEDOUT') ||
            error.code === 'P1001' || // Can't reach database server
            error.code === 'P1002' || // Database server timeout
            error.code === 'P1008' || // Operations timed out
            error.code === 'P2024' // Connection pool timeout

          if (isConnectionError && attempt < maxRetries) {
            console.warn(
              `[Prisma] Connection error detected (attempt ${attempt}/${maxRetries}). Reconnecting...`
            )

            // Disconnect and let Prisma recreate connection pool
            await prismaClient.$disconnect()

            // Small delay before retry
            await new Promise((resolve) => setTimeout(resolve, 1000))

            console.log('[Prisma] Reconnected, retrying query...')
            continue
          }

          // If not a connection error or max retries reached, throw
          throw error
        }
      }
    })
  } catch (middlewareError) {
    // Middleware setup failed (happens during build) - continue without it
    console.warn('[Prisma] Middleware setup skipped (build-time or incompatible client)')
  }
}

// Graceful shutdown handler
if (process.env.NODE_ENV === 'production') {
  process.on('beforeExit', async () => {
    await prismaClient.$disconnect()
  })
}

export const prisma = globalThis.prisma ?? prismaClient

if (process.env.NODE_ENV !== 'production') {
  globalThis.prisma = prisma
}

export default prisma
