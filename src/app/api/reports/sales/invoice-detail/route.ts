import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth.simple'
import { prisma } from '@/lib/prisma.simple'
import { getUserAccessibleLocationIds, PERMISSIONS } from '@/lib/rbac'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const invoiceNumber = searchParams.get('invoiceNumber')
    const locationId = searchParams.get('locationId') ? parseInt(searchParams.get('locationId')!) : null

    if (!invoiceNumber) {
      return NextResponse.json({ error: 'Invoice number is required' }, { status: 400 })
    }

    const businessId = parseInt(session.user.businessId)
    console.log('[Invoice Detail] BusinessId:', businessId, 'Invoice:', invoiceNumber, 'LocationId:', locationId)

    if (!businessId || Number.isNaN(businessId)) {
      console.error('[Invoice Detail] Invalid businessId:', businessId)
      return NextResponse.json({ error: 'Invalid business context' }, { status: 400 })
    }

    // Get all locations for this business to ensure proper filtering
    console.log('[Invoice Detail] Fetching business locations for businessId:', businessId)
    const businessLocations = await prisma.businessLocation.findMany({
      where: { businessId },
      select: { id: true }
    })
    console.log('[Invoice Detail] Found', businessLocations.length, 'locations')
    const businessLocationIds = businessLocations.map(loc => loc.id)

    if (businessLocationIds.length === 0) {
      return NextResponse.json({ error: 'No locations found for this business' }, { status: 404 })
    }

    // Build where clause with location filtering
    const whereClause: any = {
      businessId,
      invoiceNumber,
      deletedAt: null,
    }

    // Automatic location filtering based on user's assigned locations
    const accessibleLocationIds = getUserAccessibleLocationIds({
      id: session.user.id,
      permissions: session.user.permissions || [],
      roles: session.user.roles || [],
      businessId: parseInt(session.user.businessId),
      locationIds: session.user.locationIds || []
    })

    // If user has limited location access, enforce it
    if (accessibleLocationIds !== null) {
      const normalizedLocationIds = accessibleLocationIds
        .map((id) => Number(id))
        .filter((id): id is number => Number.isFinite(id) && Number.isInteger(id))
        .filter((id) => businessLocationIds.includes(id)) // Ensure they're in current business

      if (normalizedLocationIds.length === 0) {
        // User has no location access - return 404
        return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })
      }
      whereClause.locationId = { in: normalizedLocationIds }
    } else {
      // User has access to all locations - filter by business locations
      if (locationId && businessLocationIds.includes(locationId)) {
        whereClause.locationId = locationId
      } else {
        whereClause.locationId = { in: businessLocationIds }
      }
    }

    // Fetch the sale with all details
    console.log('[Invoice Detail] Querying sale with whereClause:', JSON.stringify(whereClause, null, 2))
    const sale = await prisma.sale.findFirst({
      where: whereClause,
      include: {
        customer: {
          select: {
            id: true,
            name: true,
            email: true,
            mobile: true,
          },
        },
        items: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
                sku: true,
              },
            },
          },
        },
        payments: {
          select: {
            id: true,
            paymentMethod: true,
            amount: true,
            paymentDate: true,
          },
        },
        location: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    })

    console.log('[Invoice Detail] Sale query completed. Found sale:', sale ? 'YES' : 'NO')

    if (!sale) {
      console.log('[Invoice Detail] Invoice not found')
      return NextResponse.json({ error: 'Invoice not found or you do not have access to this location' }, { status: 404 })
    }

    console.log('[Invoice Detail] Sale found. Items count:', sale.items?.length || 0)

    // Fetch product variations separately
    const variationIds = sale.items.map(item => item.productVariationId).filter(id => id)
    console.log('[Invoice Detail] Variation IDs to fetch:', variationIds.length)
    const variations = variationIds.length > 0
      ? await prisma.productVariation.findMany({
          where: { id: { in: variationIds } },
          select: { id: true, name: true, sku: true }
        })
      : []
    const variationMap = new Map(variations.map(v => [v.id, v]))

    // Format the response
    const response = {
      id: sale.id,
      invoiceNumber: sale.invoiceNumber,
      saleDate: sale.saleDate,
      customer: sale.customer?.name || 'Walk-in Customer',
      customerId: sale.customerId,
      totalAmount: parseFloat(sale.totalAmount.toString()),
      subtotal: parseFloat(sale.subtotal.toString()),
      taxAmount: parseFloat(sale.taxAmount.toString()),
      discountAmount: parseFloat(sale.discountAmount.toString()),
      discountType: sale.discountType,
      paymentStatus: sale.status,
      items: sale.items.map((item) => {
        const variation = variationMap.get(item.productVariationId)
        return {
          productName: item.product?.name || 'Unknown Product',
          variationName: variation?.name || '',
          sku: variation?.sku || item.product?.sku || '',
          quantity: parseFloat(item.quantity.toString()),
          unitPrice: parseFloat(item.unitPrice.toString()),
          total: parseFloat(item.quantity.toString()) * parseFloat(item.unitPrice.toString()),
        }
      }),
      payments: sale.payments.map((payment) => ({
        method: payment.paymentMethod,
        amount: parseFloat(payment.amount.toString()),
      })),
      location: sale.location,
    }

    console.log('[Invoice Detail] Response prepared successfully for invoice:', response.invoiceNumber)
    return NextResponse.json(response)
  } catch (error: unknown) {
    console.error('[Invoice Detail] ERROR occurred:', error)
    const details = error instanceof Error ? error.message : 'Unknown error'
    const stack = error instanceof Error ? error.stack : undefined
    if (stack) {
      console.error('Error stack:', stack)
    }
    return NextResponse.json(
      {
        error: 'Failed to fetch invoice details',
        details,
        stack: process.env.NODE_ENV === 'development' ? stack : undefined,
      },
      { status: 500 }
    )
  }
}
