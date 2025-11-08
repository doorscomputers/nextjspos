import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth.simple'
import { prisma } from '@/lib/prisma.simple'
import { PERMISSIONS } from '@/lib/rbac'
import { createAuditLog, AuditAction, EntityType, getIpAddress, getUserAgent } from '@/lib/auditLog'
import { getManilaDate } from '@/lib/timezone'

// GET - List all purchase orders
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = session.user as any
    const businessId = parseInt(String(user.businessId))
    // Check permission
    if (!user.permissions?.includes(PERMISSIONS.PURCHASE_VIEW)) {
      return NextResponse.json(
        { error: 'Forbidden - Insufficient permissions' },
        { status: 403 }
      )
    }

    // Get query parameters for filtering
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const supplierId = searchParams.get('supplierId')
    const locationId = searchParams.get('locationId') ? parseInt(searchParams.get('locationId')!) : null
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const includeDetails = searchParams.get('includeDetails') === 'true'
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = (page - 1) * limit

    const where: any = {
      businessId: parseInt(businessId),
      deletedAt: null,
    }

    if (status) {
      where.status = status
    }

    if (supplierId) {
      where.supplierId = parseInt(supplierId)
    }

    if (locationId) {
      where.locationId = parseInt(locationId)
    }

    // Date range filtering - using date string comparison
    if (startDate || endDate) {
      where.purchaseDate = {}

      if (startDate) {
        // Parse as local date and get start of day
        const parts = startDate.split('-')
        const localStart = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]), 0, 0, 0, 0)
        where.purchaseDate.gte = localStart
      }

      if (endDate) {
        // Parse as local date and get end of day
        const parts = endDate.split('-')
        const localEnd = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]), 23, 59, 59, 999)
        where.purchaseDate.lte = localEnd
      }
    }

    console.log('=== Purchase Orders Date Filter Debug ===')
    console.log('Input startDate:', startDate)
    console.log('Input endDate:', endDate)
    if (startDate) {
      const parts = startDate.split('-')
      const localStart = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]), 0, 0, 0, 0)
      console.log('Computed start date:', localStart)
      console.log('Start date ISO:', localStart.toISOString())
    }
    if (endDate) {
      const parts = endDate.split('-')
      const localEnd = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]), 23, 59, 59, 999)
      console.log('Computed end date:', localEnd)
      console.log('End date ISO:', localEnd.toISOString())
    }

    // Build include object dynamically
    const includeObject: any = {
      supplier: {
        select: {
          id: true,
          name: true,
          mobile: true,
          email: true,
        },
      },
      items: {
        include: {
          receiptItems: true,
          product: {
            select: {
              id: true,
              name: true,
              sku: true,
            },
          },
          productVariation: {
            select: {
              id: true,
              name: true,
              sku: true,
            },
          },
        },
      },
    }

    // If includeDetails is true, add receipts
    if (includeDetails) {
      includeObject.receipts = true
    }

    const [purchases, total] = await Promise.all([
      prisma.purchase.findMany({
        where,
        include: includeObject,
        orderBy: {
          createdAt: 'desc',
        },
        skip: offset,
        take: limit,
      }),
      prisma.purchase.count({ where }),
    ])

    return NextResponse.json({
      purchases,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    })
  } catch (error) {
    console.error('Error fetching purchases:', error)
    return NextResponse.json(
      { error: 'Failed to fetch purchases' },
      { status: 500 }
    )
  }
}

// POST - Create new purchase order
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = session.user as any
    const businessId = parseInt(String(user.businessId))
    const userId = user.id

    // Check permission
    if (!user.permissions?.includes(PERMISSIONS.PURCHASE_CREATE)) {
      return NextResponse.json(
        { error: 'Forbidden - Insufficient permissions' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const {
      locationId,
      supplierId,
      expectedDeliveryDate,
      items, // Array of { productId, productVariationId, quantity, unitCost, requiresSerial }
      taxAmount = 0,
      discountAmount = 0,
      shippingCost = 0,
      notes,
    } = body

    // Validation
    if (!locationId || !supplierId || !items || items.length === 0) {
      return NextResponse.json(
        { error: 'Missing required fields: locationId, supplierId, items' },
        { status: 400 }
      )
    }

    // ✅ OPTIMIZATION: Run validation queries in parallel
    const currentYear = new Date().getFullYear()
    const currentMonth = String(new Date().getMonth() + 1).padStart(2, '0')

    const [supplier, location, lastPurchase] = await Promise.all([
      // Verify supplier
      prisma.supplier.findFirst({
        where: {
          id: parseInt(supplierId),
          businessId: parseInt(businessId),
          deletedAt: null,
        },
        select: { id: true, name: true } // Only select needed fields
      }),
      // Verify location
      prisma.businessLocation.findFirst({
        where: {
          id: parseInt(locationId),
          businessId: parseInt(businessId),
          deletedAt: null,
        },
        select: { id: true, name: true } // Only select needed fields
      }),
      // Get last PO number
      prisma.purchase.findFirst({
        where: {
          businessId: parseInt(businessId),
          purchaseOrderNumber: {
            startsWith: `PO-${currentYear}${currentMonth}`,
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
        select: { purchaseOrderNumber: true } // Only select needed field
      })
    ])

    if (!supplier) {
      return NextResponse.json(
        { error: 'Supplier not found or does not belong to your business' },
        { status: 404 }
      )
    }

    if (!location) {
      return NextResponse.json(
        { error: 'Location not found or does not belong to your business' },
        { status: 404 }
      )
    }

    // Check location access
    const hasAccessAllLocations = user.permissions?.includes(PERMISSIONS.ACCESS_ALL_LOCATIONS)
    if (!hasAccessAllLocations) {
      const userLocationIds = user.locationIds || []

      if (!userLocationIds.includes(parseInt(locationId))) {
        return NextResponse.json(
          { error: 'You do not have access to this location' },
          { status: 403 }
        )
      }
    }

    // Calculate subtotal
    let subtotal = 0
    for (const item of items) {
      const quantity = parseFloat(item.quantity)
      const unitCost = parseFloat(item.unitCost)

      if (isNaN(quantity) || quantity <= 0) {
        return NextResponse.json(
          { error: `Invalid quantity for item: ${item.productId}` },
          { status: 400 }
        )
      }

      if (isNaN(unitCost) || unitCost < 0) {
        return NextResponse.json(
          { error: `Invalid unit cost for item: ${item.productId}` },
          { status: 400 }
        )
      }

      subtotal += quantity * unitCost
    }

    // Calculate total with proper rounding to avoid floating point precision issues
    const totalAmount = parseFloat((
      subtotal +
      parseFloat(taxAmount || 0) +
      parseFloat(shippingCost || 0) -
      parseFloat(discountAmount || 0)
    ).toFixed(2))

    // Generate PO number (lastPurchase already fetched in parallel above)
    let poNumber
    if (lastPurchase) {
      const lastNumber = parseInt(lastPurchase.purchaseOrderNumber.split('-').pop() || '0')
      poNumber = `PO-${currentYear}${currentMonth}-${String(lastNumber + 1).padStart(4, '0')}`
    } else {
      poNumber = `PO-${currentYear}${currentMonth}-0001`
    }

    // ✅ OPTIMIZATION: Create purchase order with bulk item insert
    const purchase = await prisma.$transaction(async (tx) => {
      // Create purchase
      const newPurchase = await tx.purchase.create({
        data: {
          businessId: parseInt(businessId),
          locationId: parseInt(locationId),
          supplierId: parseInt(supplierId),
          purchaseOrderNumber: poNumber,
          purchaseDate: getManilaDate(), // MANILA TIMEZONE (UTC+8) - prevents backdating fraud
          expectedDeliveryDate: expectedDeliveryDate ? new Date(expectedDeliveryDate) : null,
          status: 'pending',
          subtotal,
          taxAmount: parseFloat(taxAmount || 0),
          discountAmount: parseFloat(discountAmount || 0),
          shippingCost: parseFloat(shippingCost || 0),
          totalAmount,
          notes,
          createdBy: parseInt(userId),
        },
        include: {
          supplier: {
            select: {
              id: true,
              name: true,
              mobile: true,
              email: true,
            }
          }
        }
      }, {
      timeout: 60000, // 60 seconds timeout for network resilience
    })

      // ✅ OPTIMIZATION: Bulk insert items (1 query instead of N queries)
      await tx.purchaseItem.createMany({
        data: items.map((item: any) => ({
          purchaseId: newPurchase.id,
          productId: parseInt(item.productId),
          productVariationId: parseInt(item.productVariationId),
          quantity: parseFloat(item.quantity),
          unitCost: parseFloat(item.unitCost),
          quantityReceived: 0,
          requiresSerial: item.requiresSerial || false,
          subUnitId: item.subUnitId ? parseInt(item.subUnitId) : null, // UOM support
        }))
      })

      // Fetch items to return in response
      const purchaseItems = await tx.purchaseItem.findMany({
        where: { purchaseId: newPurchase.id }
      })

      return { ...newPurchase, items: purchaseItems }
    })

    // ✅ OPTIMIZATION: Create audit log asynchronously (don't block response)
    createAuditLog({
      businessId: parseInt(businessId),
      userId: parseInt(userId),
      username: user.username,
      action: 'purchase_order_create' as AuditAction,
      entityType: EntityType.PURCHASE,
      entityIds: [purchase.id],
      description: `Created Purchase Order ${poNumber}`,
      metadata: {
        purchaseId: purchase.id,
        poNumber,
        supplierId: parseInt(supplierId),
        supplierName: supplier.name,
        locationId: parseInt(locationId),
        locationName: location.name,
        totalAmount,
        itemCount: items.length,
      },
      ipAddress: getIpAddress(request),
      userAgent: getUserAgent(request),
    }).catch(err => console.error('Audit log creation failed:', err))

    // ✅ OPTIMIZATION: Return immediately (purchase already has relations from transaction)
    return NextResponse.json(purchase, { status: 201 })
  } catch (error) {
    console.error('Error creating purchase order:', error)
    return NextResponse.json(
      {
        error: 'Failed to create purchase order',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
