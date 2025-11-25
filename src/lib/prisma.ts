/**
 * PRISMA DATABASE CLIENT CONFIGURATION
 * =====================================
 *
 * This file configures the Prisma ORM client for database operations.
 * Prisma is the Object-Relational Mapper (ORM) that lets us work with the database
 * using TypeScript objects instead of writing raw SQL.
 *
 * KEY CONCEPTS:
 * -------------
 * 1. **Singleton Pattern**: Only ONE Prisma client instance exists across the entire app
 *    - Prevents connection pool exhaustion
 *    - Improves performance by reusing connections
 *    - Required for Next.js development mode (hot reload would create multiple clients)
 *
 * 2. **Connection Pooling**: Database connections are expensive to create
 *    - Pooling reuses existing connections instead of creating new ones each time
 *    - Configured via DATABASE_URL query parameters
 *
 * 3. **Environment-Specific Logging**: Different log levels for dev vs production
 *    - Development: Full query logging for debugging
 *    - Production: Only errors and warnings to reduce noise
 *
 * 4. **Performance Monitoring**: Middleware tracks slow queries (> 1 second)
 *
 * 5. **Graceful Shutdown**: Cleanly closes database connections when app stops
 */

import { PrismaClient } from '@prisma/client'

/**
 * Global singleton holder for Prisma client
 *
 * In Next.js development mode, hot reload can cause multiple Prisma clients to be created,
 * exhausting database connections. By storing the client in `globalThis`, we ensure
 * only one client exists even across hot reloads.
 */
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

/**
 * Create a new Prisma Client instance with optimized configuration
 *
 * LOGGING CONFIGURATION:
 * ----------------------
 * - Production: ['error', 'warn'] - Only critical issues to reduce log volume
 * - Development: ['query', 'error', 'warn'] - Includes SQL queries for debugging
 *
 * Why log queries in development?
 * - See exactly what SQL Prisma generates
 * - Debug N+1 query problems
 * - Optimize slow queries
 * - Learn how Prisma ORM works
 *
 * @returns Configured PrismaClient instance
 */
const createPrismaClient = () => {
  return new PrismaClient({
    log: process.env.NODE_ENV === 'production'
      ? ['error', 'warn'] // Only log errors and warnings in production
      : ['query', 'error', 'warn'], // Full logging in development (includes SQL queries)

    // Database connection configuration
    // The actual connection string comes from DATABASE_URL environment variable
    datasources: {
      db: {
        url: process.env.DATABASE_URL,
      },
    },
  })
}

/**
 * CONNECTION POOL CONFIGURATION
 * ==============================
 *
 * Database connections are expensive resources that need careful management.
 * This section configures the connection pool parameters for optimal performance.
 *
 * WHY CONNECTION POOLING MATTERS:
 * -------------------------------
 * - Creating a new database connection takes 50-100ms
 * - Reusing an existing connection from the pool takes < 1ms
 * - Without pooling, every API request would wait for a new connection
 * - With pooling, connections are reused across requests (massive performance gain)
 *
 * CONNECTION POOL PARAMETERS:
 * ---------------------------
 *
 * 1. **connection_limit** (default: 10)
 *    - Maximum number of simultaneous database connections
 *    - PostgreSQL default max is usually 100 connections total
 *    - Each app instance (server, background worker, etc.) needs its own pool
 *    - Formula: connection_limit = total_db_connections / number_of_app_instances
 *    - Example: 100 total connections ÷ 5 app instances = 20 per instance
 *
 *    When to increase:
 *    - High traffic (many concurrent users)
 *    - Long-running queries
 *    - Many API routes executing simultaneously
 *
 *    When to decrease:
 *    - Low traffic sites
 *    - Many app instances (to avoid exhausting database)
 *    - Limited database resources
 *
 * 2. **pool_timeout** (default: 20 seconds)
 *    - How long to wait for an available connection from the pool
 *    - If all connections are busy, request waits this long before timing out
 *    - Set higher for: Long-running reports, batch operations
 *    - Set lower for: Real-time user interactions (fail fast if system overloaded)
 *
 * 3. **connect_timeout** (default: 10 seconds)
 *    - How long to wait when establishing a NEW database connection
 *    - Only applies when creating connections, not when getting from pool
 *    - Set higher for: Slow network, remote databases
 *    - Set lower for: Local databases, fast network
 *
 * RECOMMENDED VALUES BY USE CASE:
 * --------------------------------
 * Small app (< 100 users):
 *   connection_limit: 10, pool_timeout: 20, connect_timeout: 10
 *
 * Medium app (100-1000 users):
 *   connection_limit: 20, pool_timeout: 30, connect_timeout: 10
 *
 * Large app (1000+ users):
 *   connection_limit: 50, pool_timeout: 60, connect_timeout: 15
 *   (You may also need to increase PostgreSQL's max_connections)
 *
 * MONITORING CONNECTION POOL:
 * ---------------------------
 * If you see errors like "connection pool timeout" or "too many connections":
 * 1. Check PostgreSQL max_connections: SELECT setting FROM pg_settings WHERE name = 'max_connections';
 * 2. Check active connections: SELECT count(*) FROM pg_stat_activity;
 * 3. Increase connection_limit if you have capacity
 * 4. Optimize slow queries to release connections faster
 * 5. Add more app instances and reduce connection_limit per instance
 */

// Only configure connection pool on server-side (not in browser)
if (typeof window === 'undefined' && process.env.DATABASE_URL) {
  const url = new URL(process.env.DATABASE_URL)

  // Add connection pool parameters if not already present in DATABASE_URL
  // (User can override these in their .env file if needed)

  if (!url.searchParams.has('connection_limit')) {
    url.searchParams.set('connection_limit', '10') // Conservative default for small-medium apps
  }

  if (!url.searchParams.has('pool_timeout')) {
    url.searchParams.set('pool_timeout', '20') // Wait up to 20 seconds for available connection
  }

  if (!url.searchParams.has('connect_timeout')) {
    url.searchParams.set('connect_timeout', '10') // Wait up to 10 seconds to establish new connection
  }

  // Update the environment variable with the configured pool parameters
  process.env.DATABASE_URL = url.toString()
}

/**
 * SINGLETON PRISMA CLIENT EXPORT
 * ===============================
 *
 * This uses the "nullish coalescing operator" (??):
 * - If global prisma already exists → use it (reuse across hot reloads)
 * - If global prisma is undefined → create a new one
 *
 * This pattern prevents multiple Prisma clients in Next.js development mode.
 */
export const prisma = globalForPrisma.prisma ?? createPrismaClient()

/**
 * PERFORMANCE MONITORING MIDDLEWARE
 * ==================================
 *
 * This middleware automatically detects slow database queries (> 1 second)
 * and logs them to the console with details.
 *
 * WHY MONITOR SLOW QUERIES:
 * -------------------------
 * - Database queries are usually the bottleneck in web apps
 * - A single slow query can make an entire page load slowly
 * - Identifying slow queries lets you optimize them (add indexes, rewrite logic, etc.)
 *
 * WHAT TO DO WHEN YOU SEE A SLOW QUERY WARNING:
 * ----------------------------------------------
 * 1. Note the model and action (e.g., "Product.findMany")
 * 2. Check the query arguments to see what filters were used
 * 3. Consider adding database indexes on frequently queried columns
 * 4. Use Prisma's query optimization features (select only needed fields, include only needed relations)
 * 5. For complex reports, consider using raw SQL or materialized views
 *
 * Example warning:
 * "⚠️  Slow query detected: Product.findMany took 2500ms"
 * Action: Add index on frequently filtered columns or reduce the amount of data being fetched
 */
if (typeof prisma.$use === 'function') {
  try {
    prisma.$use(async (params, next) => {
      const start = Date.now()
      const result = await next(params) // Execute the actual query
      const duration = Date.now() - start

      // Log warning if query took longer than 1 second (1000ms)
      if (duration > 1000) {
        console.warn(
          `⚠️  Slow query detected: ${params.model}.${params.action} took ${duration}ms`,
          params.args ? `Args: ${JSON.stringify(params.args).substring(0, 200)}` : ''
        )
      }

      return result
    })
  } catch (middlewareError) {
    // Middleware setup failed (can happen during build or with Prisma 5+)
    // This is not critical - the app will work fine without performance monitoring
    console.warn('[Prisma] Performance monitoring middleware skipped (incompatible client version)')
  }
}

/**
 * DEVELOPMENT MODE: Store client in global to survive hot reloads
 *
 * In Next.js development mode with hot reload (HMR), the code is re-executed
 * on every file change. Without this, each reload would create a new Prisma client,
 * eventually exhausting database connections.
 *
 * By storing in globalThis, the client survives across reloads.
 *
 * Production doesn't have hot reload, so this is unnecessary there.
 */
if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma
}

/**
 * GRACEFUL SHUTDOWN HANDLING
 * ===========================
 *
 * When the Node.js process is about to exit, we need to cleanly close
 * all database connections. This prevents:
 * - "Unexpected connection closed" errors in database logs
 * - Connection leaks
 * - Incomplete transactions
 *
 * The 'beforeExit' event fires when Node.js empties its event loop
 * and is about to terminate. This gives us a chance to clean up.
 *
 * This only runs server-side (not in browser where there's no process object).
 */
if (typeof window === 'undefined') {
  process.on('beforeExit', async () => {
    await prisma.$disconnect()
  })
}

/**
 * Default export for convenience
 * You can import prisma using either:
 *   import { prisma } from '@/lib/prisma'  // Named export
 *   import prisma from '@/lib/prisma'      // Default export
 */
export default prisma
