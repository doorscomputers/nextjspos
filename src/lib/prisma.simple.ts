import { PrismaClient } from '@prisma/client'

declare global {
  var prisma: PrismaClient | undefined
}

// Simplified Prisma Client for Vercel deployment
const createPrismaClient = () => {
  return new PrismaClient({
    log: process.env.NODE_ENV === 'production'
      ? ['error', 'warn']
      : ['query', 'error', 'warn'],
  })
}

export const prisma = globalThis.prisma ?? createPrismaClient()

if (process.env.NODE_ENV !== 'production') {
  globalThis.prisma = prisma
}

export default prisma
