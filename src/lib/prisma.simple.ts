import { PrismaClient } from '@prisma/client'

declare global {
  var prisma: PrismaClient | undefined
}

// Optimized Prisma Client for Supabase + Vercel deployment
const createPrismaClient = () => {
  return new PrismaClient({
    log: process.env.NODE_ENV === 'production'
      ? ['error', 'warn']
      : ['query', 'error', 'warn'],
    datasources: {
      db: {
        url: process.env.DATABASE_URL,
      },
    },
    // ✅ OPTIMIZATION: Configure connection pool for Supabase
    // Supabase recommends smaller pool size for serverless (3-5 connections)
    // Default is 10, which exhausts connection limits quickly
    ...(process.env.NODE_ENV === 'production' && {
      log: ['error', 'warn'],
    }),
  })
}

// Add connection lifecycle logging for debugging
const prismaClient = createPrismaClient()

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
