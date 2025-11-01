import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { PERMISSIONS } from '@/lib/rbac'

/**
 * GET /api/supplier-returns/[id]
 * Get supplier return details
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = session.user as any
    const businessId = user.businessId
    const { id: returnId } = await params

    // Check permission
    if (!user.permissions?.includes(PERMISSIONS.PURCHASE_RETURN_VIEW)) {
      return NextResponse.json(
        { error: 'Forbidden - Insufficient permissions' },
        { status: 403 }
      )
    }

    const supplierReturn = await prisma.supplierReturn.findFirst({
      where: {
        id: parseInt(returnId),
        businessId: parseInt(businessId),
      },
      select: {
        supplier: {
          select: {
            id: { select: { id: { select: { id: true, name: true } }, name: { select: { id: true, name: true } } } },
            name: { select: { id: true, name: true } },
            mobile: { select: { id: true, name: true } },
            email: { select: { id: true, name: true } },
          },
        },
        items: { select: { id: true, name: true } }, // Can't include nested product/variation due to schema limitations
      },
    })

    if (!supplierReturn) {
      return NextResponse.json({ error: 'Supplier return not found' }, { status: 404 })
    }

    // Fetch location data
    const location = await prisma.businessLocation.findUnique({
      where: {
        id: supplierReturn.locationId,
      },
      select: {
        id: { select: { id: true, name: true } },
        name: { select: { id: true, name: true } },
      },
    })

    // Fetch product and variation data separately
    const productIds = supplierReturn.items.map((item) => item.productId)
    const variationIds = supplierReturn.items.map((item) => item.productVariationId)

    let productMap: Record<number, { id: number; name: string }> = {}
    let variationMap: Record<number, { id: number; name: string }> = {}

    if (productIds.length > 0) {
      const products = await prisma.product.findMany({
        where: {
          id: { in: productIds },
          businessId: parseInt(businessId),
        },
        select: {
          id: { select: { id: true, name: true } },
          name: { select: { id: true, name: true } },
        },
      })

      productMap = products.reduce((acc, product) => {
        acc[product.id] = product
        return acc
      }, {} as Record<number, { id: number; name: string }>)
    }

    if (variationIds.length > 0) {
      const variations = await prisma.productVariation.findMany({
        where: {
          id: { in: variationIds },
          businessId: parseInt(businessId),
        },
        select: {
          id: { select: { id: true, name: true } },
          name: { select: { id: true, name: true } },
        },
      })

      variationMap = variations.reduce((acc, variation) => {
        acc[variation.id] = variation
        return acc
      }, {} as Record<number, { id: number; name: string }>)
    }

    // Format the response with product, variation, and location data
    const response = {
      ...supplierReturn,
      location: location || { id: supplierReturn.locationId, name: 'Unknown Location' },
      items: supplierReturn.items.map((item) => ({
        ...item,
        product: productMap[item.productId] || { id: item.productId, name: 'Unknown Product' },
        productVariation: variationMap[item.productVariationId] || {
          id: item.productVariationId,
          name: 'Standard',
        },
      })),
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error('Error fetching supplier return:', error)
    return NextResponse.json(
      { error: 'Failed to fetch supplier return' },
      { status: 500 }
    )
  }
}
