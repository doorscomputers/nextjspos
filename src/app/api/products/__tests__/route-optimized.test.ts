/**
 * API Route Tests - Products API (Optimized)
 * 
 * Tests for the optimized products API route with server-side pagination
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals'
import { GET } from '@/app/api/products/route-optimized'
import { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'

// Mock dependencies
jest.mock('next-auth')
jest.mock('@/lib/prisma', () => ({
  prisma: {
    product: {
      count: jest.fn(),
      findMany: jest.fn(),
    },
  },
}))

describe('Products API - Optimized Route', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should return 401 when user is not authenticated', async () => {
    ;(getServerSession as jest.Mock).mockResolvedValue(null)

    const request = new NextRequest('http://localhost:3000/api/products/route-optimized')
    const response = await GET(request)
    const data = await response.json()

    expect(response.status).toBe(401)
    expect(data.error).toBe('Unauthorized')
  })

  it('should return 403 when user lacks permission', async () => {
    ;(getServerSession as jest.Mock).mockResolvedValue({
      user: {
        businessId: '1',
        permissions: [], // No permissions
      },
    })

    const request = new NextRequest('http://localhost:3000/api/products/route-optimized')
    const response = await GET(request)
    const data = await response.json()

    expect(response.status).toBe(403)
    expect(data.error).toContain('Forbidden')
  })

  it('should return paginated products with default pagination', async () => {
    const mockProducts = [
      {
        id: 1,
        name: 'Test Product',
        sku: 'TEST-001',
        enabled: true,
        enableStock: true,
        type: 'single',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]

    ;(getServerSession as jest.Mock).mockResolvedValue({
      user: {
        id: '1',
        businessId: '1',
        permissions: ['PRODUCT_VIEW'],
      },
    })

    const { prisma } = await import('@/lib/prisma')
    ;(prisma.product.count as jest.Mock).mockResolvedValue(1)
    ;(prisma.product.findMany as jest.Mock).mockResolvedValue(mockProducts)

    const request = new NextRequest('http://localhost:3000/api/products/route-optimized')
    const response = await GET(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.data).toBeDefined()
    expect(data.totalCount).toBe(1)
    expect(prisma.product.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        skip: 0,
        take: 50, // Default pagination
      })
    )
  })

  it('should handle custom pagination parameters', async () => {
    ;(getServerSession as jest.Mock).mockResolvedValue({
      user: {
        id: '1',
        businessId: '1',
        permissions: ['PRODUCT_VIEW'],
      },
    })

    const { prisma } = await import('@/lib/prisma')
    ;(prisma.product.count as jest.Mock).mockResolvedValue(100)
    ;(prisma.product.findMany as jest.Mock).mockResolvedValue([])

    const request = new NextRequest(
      'http://localhost:3000/api/products/route-optimized?skip=20&take=10'
    )
    const response = await GET(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.totalCount).toBe(100)
    expect(prisma.product.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        skip: 20,
        take: 10,
      })
    )
  })

  it('should handle search filtering', async () => {
    ;(getServerSession as jest.Mock).mockResolvedValue({
      user: {
        id: '1',
        businessId: '1',
        permissions: ['PRODUCT_VIEW'],
      },
    })

    const { prisma } = await import('@/lib/prisma')
    ;(prisma.product.count as jest.Mock).mockResolvedValue(0)
    ;(prisma.product.findMany as jest.Mock).mockResolvedValue([])

    const request = new NextRequest(
      'http://localhost:3000/api/products/route-optimized?search=test'
    )
    const response = await GET(request)

    expect(response.status).toBe(200)
    expect(prisma.product.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: expect.arrayContaining([
            expect.objectContaining({
              name: expect.objectContaining({
                contains: 'test',
              }),
            }),
          ]),
        }),
      })
    )
  })
})
