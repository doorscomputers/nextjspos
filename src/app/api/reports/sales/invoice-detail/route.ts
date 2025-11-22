import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth.simple'
import { prisma } from '@/lib/prisma.simple'
import { getUserAccessibleLocationIds, PERMISSIONS } from '@/lib/rbac'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    console.log('[Invoice Detail] Session retrieved:', {
      hasSession: !!session,
      hasUser: !!session?.user,
      userId: session?.user?.id,
      businessId: (session?.user as any)?.businessId,
    })

    if (!session?.user?.id) {
      console.error('[Invoice Detail] No session or user ID found')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const invoiceNumber = searchParams.get('invoiceNumber')
    const locationId = searchParams.get('locationId') ? parseInt(searchParams.get('locationId')!) : null

    if (!invoiceNumber) {
      return NextResponse.json({ error: 'Invoice number is required' }, { status: 400 })
    }

    // Check if businessId exists in session before parsing
    const businessIdString = (session.user as any).businessId
    if (!businessIdString) {
      console.error('[Invoice Detail] Missing businessId in session. Session user:', JSON.stringify(session.user, null, 2))
      return NextResponse.json({
        error: 'Business context not found in session. Please log out and log in again.'
      }, { status: 400 })
    }

    const businessId = parseInt(businessIdString)
    console.log('[Invoice Detail] BusinessId:', businessId, 'Invoice:', invoiceNumber, 'LocationId:', locationId)

    if (!businessId || Number.isNaN(businessId)) {
      console.error('[Invoice Detail] Invalid businessId after parsing:', businessId, 'Original value:', businessIdString)
      return NextResponse.json({
        error: 'Invalid business context. Please log out and log in again.'
      }, { status: 400 })
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
    console.error('[Invoice Detail] ===== ERROR OCCURRED =====')
    console.error('[Invoice Detail] Error object:', error)

    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    const errorStack = error instanceof Error ? error.stack : undefined
    const errorName = error instanceof Error ? error.name : 'Error'

    console.error('[Invoice Detail] Error name:', errorName)
    console.error('[Invoice Detail] Error message:', errorMessage)

    if (errorStack) {
      console.error('[Invoice Detail] Error stack:', errorStack)
    }

    // Provide more specific error messages
    let userMessage = 'Failed to fetch invoice details'

    if (errorMessage.includes('prisma') || errorMessage.includes('database')) {
      userMessage = 'Database connection error. Please try again.'
    } else if (errorMessage.includes('timeout')) {
      userMessage = 'Request timed out. Please try again.'
    } else if (errorMessage.includes('not found')) {
      userMessage = 'Invoice not found or access denied.'
    }

    console.error('[Invoice Detail] User-facing message:', userMessage)

    return NextResponse.json(
      {
        error: userMessage,
        details: process.env.NODE_ENV === 'development' ? errorMessage : undefined,
        stack: process.env.NODE_ENV === 'development' ? errorStack : undefined,
      },
      { status: 500 }
    )
  }
}
