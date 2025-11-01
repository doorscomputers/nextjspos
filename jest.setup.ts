// Jest setup file for API tests
import { jest } from '@jest/globals'

// Mock Next.js router
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    prefetch: jest.fn(),
    back: jest.fn(),
  }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => '/',
}))

// Mock NextAuth
jest.mock('next-auth', () => ({
  getServerSession: jest.fn(),
}))

// Mock Prisma Client
jest.mock('@/lib/prisma', () => ({
  prisma: {
    // Add mock implementations as needed
  },
}))

// Increase timeout for API tests
jest.setTimeout(30000)
