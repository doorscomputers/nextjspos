import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { PERMISSIONS } from '@/lib/rbac'

/**
 * Get Available Serial Numbers for POS Sale
 * GET /api/serial-numbers/available?productId=123&locationId=456&variationId=789
 *
 * Returns: List of available serial numbers for the product at the specified location
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = session.user as any
    const businessId = parseInt(user.businessId)

    // Check permission
    if (!user.permissions?.includes(PERMISSIONS.SERIAL_NUMBER_VIEW) &&
        !user.permissions?.includes(PERMISSIONS.SELL_CREATE)) {
      return NextResponse.json(
        { error: 'Forbidden - Insufficient permissions' },
        { status: 403 }
      )
    }

    // Get query parameters
    const searchParams = request.nextUrl.searchParams
    const productId = searchParams.get('productId')
    const locationId = searchParams.get('locationId')
    const variationId = searchParams.get('variationId')

    if (!productId || !locationId || !variationId) {
      return NextResponse.json(
        { error: 'productId, locationId, and variationId are required' },
        { status: 400 }
      )
    }

    const productIdNumber = parseInt(productId)
    const locationIdNumber = parseInt(locationId)
    const variationIdNumber = parseInt(variationId)

    if (isNaN(productIdNumber) || isNaN(locationIdNumber) || isNaN(variationIdNumber)) {
      return NextResponse.json(
        { error: 'Invalid productId, locationId, or variationId' },
        { status: 400 }
      )
    }

    // Fetch available serial numbers
    const serialNumbers = await prisma.productSerialNumber.findMany({
      where: {
        businessId,
        productId: productIdNumber,
        productVariationId: variationIdNumber,
        currentLocationId: locationIdNumber,
        status: 'in_stock',
      },
      select: {
        id: { select: { id: true, name: true } },
        serialNumber: { select: { id: true, name: true } },
        imei: { select: { id: true, name: true } },
        condition: { select: { id: true, name: true } },
        purchaseCost: { select: { id: true, name: true } },
        warrantyPeriodMonths: { select: { id: true, name: true } },
        purchasedAt: { select: { id: true, name: true } },
      },
      orderBy: {
        createdAt: 'asc', // FIFO - First In, First Out
      },
    })

    return NextResponse.json({
      success: { select: { id: true, name: true } },
      data: serialNumbers.map(sn => ({
        id: sn.id,
        serialNumber: sn.serialNumber,
        imei: sn.imei || null,
        condition: sn.condition,
        purchaseCost: sn.purchaseCost,
        warrantyMonths: sn.warrantyPeriodMonths,
        purchasedAt: sn.purchasedAt,
      })),
    })

  } catch (error: any) {
    console.error('Error fetching available serial numbers:', error)
    return NextResponse.json(
      {
        error: 'Failed to fetch available serial numbers',
        details: error.message
      },
      { status: 500 }
    )
  }
}
