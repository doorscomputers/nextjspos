import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth.simple'
import { prisma } from '@/lib/prisma.simple'
import { PERMISSIONS } from '@/lib/rbac'
import { createAuditLog, AuditAction, EntityType, getIpAddress, getUserAgent } from '@/lib/auditLog'
import { checkStockAvailability, processSale } from '@/lib/stockOperations'
import {
  sendLargeDiscountAlert,
  sendCreditSaleAlert,
} from '@/lib/email'
import {
  sendTelegramLargeDiscountAlert,
  sendTelegramCreditSaleAlert,
} from '@/lib/telegram'
import { withIdempotency } from '@/lib/idempotency'
import { getNextInvoiceNumber } from '@/lib/atomicNumbers'
import { InventoryImpactTracker } from '@/lib/inventory-impact-tracker'
import { isAccountingEnabled, recordCashSale, recordCreditSale } from '@/lib/accountingIntegration'

// GET - List all sales
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = session.user as any
    const businessId = parseInt(String(user.businessId))
    const userId = user.id
    const businessIdNumber = Number(businessId)
    const userIdNumber = Number(userId)
    if (Number.isNaN(businessIdNumber) || Number.isNaN(userIdNumber)) {
      return NextResponse.json({ error: 'Invalid user context' }, { status: 400 })
    }
    const userDisplayName =
      [user.firstName, user.lastName].filter(Boolean).join(' ') || user.username || `User#${userIdNumber}`

    // Check permission
    if (!user.permissions?.includes(PERMISSIONS.SELL_VIEW) &&
        !user.permissions?.includes(PERMISSIONS.SELL_VIEW_OWN)) {
      return NextResponse.json(
        { error: 'Forbidden - Insufficient permissions' },
        { status: 403 }
      )
    }

    // Get query parameters for filtering
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const customerId = searchParams.get('customerId')
    const locationId = searchParams.get('locationId') ? parseInt(searchParams.get('locationId')!) : null
    const shiftId = searchParams.get('shiftId') // Filter by specific shift
    const date = searchParams.get('date') // Filter by specific date
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = (page - 1) * limit

    const where: any = {
      businessId: parseInt(businessId),
      deletedAt: null,
    }

    // Check if user has access to all locations (admin permission)
    const hasAccessAllLocations = user.permissions?.includes(PERMISSIONS.ACCESS_ALL_LOCATIONS)

    // Filter sales by user's assigned locations UNLESS they have ACCESS_ALL_LOCATIONS permission
    if (!hasAccessAllLocations) {
      const userLocations = await prisma.userLocation.findMany({
        where: { userId: parseInt(userId) },
        select: { locationId: true },
      })
      const userLocationIds = userLocations.map(ul => ul.locationId)

      if (userLocationIds.length > 0) {
        where.locationId = { in: userLocationIds }
      } else {
        // User has no location assignments - return empty result
        where.id = -1 // Impossible ID to match nothing
      }
    }
    // If hasAccessAllLocations is true, no location filter is applied (show all sales)

    // If user has SELL_VIEW_OWN, only show their own sales (within their locations)
    if (user.permissions?.includes(PERMISSIONS.SELL_VIEW_OWN) &&
        !user.permissions?.includes(PERMISSIONS.SELL_VIEW)) {
      where.createdBy = parseInt(userId)
    }

    if (status) {
      where.status = status
    }

    if (customerId) {
      where.customerId = parseInt(customerId)
    }

    // Allow further filtering by specific location (must be within user's assigned locations)
    if (locationId) {
      const requestedLocationId = parseInt(locationId)
      if (userLocationIds.includes(requestedLocationId)) {
        where.locationId = requestedLocationId
      } else {
        // Requested location not in user's assignments - return empty
        where.id = -1
      }
    }

    // Filter by specific shift (for POS shift session management)
    if (shiftId) {
      where.shiftId = parseInt(shiftId)
    }

    // Filter by specific date (for POS today's sales)
    if (date) {
      const filterDate = new Date(date)
      where.saleDate = filterDate
    }

    if (startDate || endDate) {
      where.saleDate = {}
      if (startDate) where.saleDate.gte = new Date(startDate)
      if (endDate) where.saleDate.lte = new Date(endDate)
    }

    const [sales, total] = await Promise.all([
      prisma.sale.findMany({
        where,
        include: {
          customer: {
            select: {
              id: true,
              name: true,
              mobile: true,
              email: true,
            },
          },
          creator: {
            select: {
              id: true,
              username: true,
              firstName: true,
              lastName: true,
              surname: true,
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
          payments: true,
        },
        orderBy: {
          createdAt: 'desc',
        },
        skip: offset,
        take: limit,
      }),
      prisma.sale.count({ where }),
    ])

    return NextResponse.json({
      sales,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    })
  } catch (error) {
    console.error('Error fetching sales:', error)
    return NextResponse.json(
      { error: 'Failed to fetch sales' },
      { status: 500 }
    )
  }
}

// POST - Create new sale
export async function POST(request: NextRequest) {
  return withIdempotency(request, '/api/sales', async () => {
    try {
      const session = await getServerSession(authOptions)

      if (!session?.user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }

      const user = session.user as any
      const businessId = parseInt(String(user.businessId))
      const userId = user.id
      const businessIdNumber = Number(businessId)
      const userIdNumber = Number(userId)
      if (Number.isNaN(businessIdNumber) || Number.isNaN(userIdNumber)) {
        return NextResponse.json({ error: 'Invalid user context' }, { status: 400 })
      }
      const userDisplayName =
        [user.firstName, user.lastName].filter(Boolean).join(' ') || user.username || `User#${userIdNumber}`

      // Check permission
      if (!user.permissions?.includes(PERMISSIONS.SELL_CREATE)) {
        return NextResponse.json(
          { error: 'Forbidden - Insufficient permissions' },
          { status: 403 }
        )
      }

    const body = await request.json()

    // DEBUG: Log incoming request for 400 error debugging
    console.log('==== SALES API DEBUG ====')
    console.log('Incoming sale request body:', JSON.stringify(body, null, 2))

    const {
      locationId,
      customerId,
      saleDate,
      items, // Array of { productId, productVariationId, quantity, unitPrice, serialNumberIds: [] }
      payments, // Array of { method, amount, reference }
      taxAmount = 0,
      discountAmount = 0,
      shippingCost = 0,
      notes,
      status, // 'completed', 'pending' (for credit sales)
      // Philippine BIR discount tracking
      discountType, // 'senior', 'pwd', 'regular', or null
      seniorCitizenId,
      seniorCitizenName,
      pwdId,
      pwdName,
      discountApprovedBy,
      vatExempt = false,
    } = body

    console.log('Parsed values:')
    console.log('- locationId:', locationId, 'type:', typeof locationId)
    console.log('- customerId:', customerId, 'type:', typeof customerId)
    console.log('- items count:', items?.length)
    console.log('- payments count:', payments?.length)

    const locationIdNumber = Number(locationId)
    if (Number.isNaN(locationIdNumber)) {
      console.error('VALIDATION ERROR: Invalid locationId -', locationId)
      return NextResponse.json({ error: 'Invalid locationId' }, { status: 400 })
    }

    const customerIdNumber = customerId !== undefined && customerId !== null ? Number(customerId) : null
    if (customerIdNumber !== null && Number.isNaN(customerIdNumber)) {
      console.error('VALIDATION ERROR: Invalid customerId -', customerId)
      return NextResponse.json({ error: 'Invalid customerId' }, { status: 400 })
    }

    const discountApprovedByNumber =
      discountApprovedBy !== undefined && discountApprovedBy !== null
        ? Number(discountApprovedBy)
        : null
    if (discountApprovedByNumber !== null && Number.isNaN(discountApprovedByNumber)) {
      console.error('VALIDATION ERROR: Invalid discountApprovedBy -', discountApprovedBy)
      return NextResponse.json({ error: 'Invalid discountApprovedBy value' }, { status: 400 })
    }

    // Validation
    if (!locationId || !saleDate || !items || items.length === 0) {
      console.error('VALIDATION ERROR: Missing required fields')
      console.error('- locationId:', locationId)
      console.error('- saleDate:', saleDate)
      console.error('- items:', items)
      console.error('- items.length:', items?.length)
      return NextResponse.json(
        { error: 'Missing required fields: locationId, saleDate, items' },
        { status: 400 }
      )
    }

    // For credit sales (status: 'pending'), customer is required
    const isCreditSale = status === 'pending'
    if (isCreditSale && !customerId) {
      return NextResponse.json(
        { error: 'Customer is required for credit/charge invoice sales' },
        { status: 400 }
      )
    }

    // For non-credit sales, at least one payment is required
    if (!isCreditSale && (!payments || payments.length === 0)) {
      return NextResponse.json(
        { error: 'At least one payment method is required' },
        { status: 400 }
      )
    }

    // Verify location belongs to business
    const location = await prisma.businessLocation.findFirst({
      where: {
        id: locationIdNumber,
        businessId: businessIdNumber,
        deletedAt: null,
      },
    })

    if (!location) {
      return NextResponse.json(
        { error: 'Location not found or does not belong to your business' },
        { status: 404 }
      )
    }

    // Check location access
    const hasAccessAllLocations = user.permissions?.includes(PERMISSIONS.ACCESS_ALL_LOCATIONS)
    if (!hasAccessAllLocations) {
      const userLocation = await prisma.userLocation.findUnique({
        where: {
          userId_locationId: {
            userId: userIdNumber,
            locationId: locationIdNumber,
          },
        },
      })

      if (!userLocation) {
        return NextResponse.json(
          { error: 'You do not have access to this location' },
          { status: 403 }
        )
      }
    }

    // Check for open cashier shift - REQUIRED FOR POS
    console.log('DEBUG: Checking for open shift...')
    console.log('- userId:', userIdNumber)
    console.log('- businessId:', businessIdNumber)
    console.log('- session locationIds:', (session.user as any).locationIds)

    // Get user's assigned locations from session
    const userLocationIds = (session.user as any).locationIds || []

    // Build shift query - match by userId AND user's assigned locations
    const shiftWhereClause: any = {
      userId: userIdNumber,
      status: 'open',
      businessId: businessIdNumber,
    }

    // If user has specific locations assigned, only find shifts at those locations
    if (userLocationIds.length > 0) {
      shiftWhereClause.locationId = { in: userLocationIds }
      console.log('DEBUG: Filtering shifts by user locations:', userLocationIds)
    }

    const currentShift = await prisma.cashierShift.findFirst({
      where: shiftWhereClause,
    })

    console.log('DEBUG: Open shift query result:', currentShift ? 'FOUND' : 'NOT FOUND')
    if (currentShift) {
      console.log('- Shift ID:', currentShift.id)
      console.log('- Shift Number:', currentShift.shiftNumber)
      console.log('- Shift status:', currentShift.status)
      console.log('- Shift locationId:', currentShift.locationId)
    }

    if (!currentShift) {
      console.error('VALIDATION ERROR: No open shift found for this user at their assigned locations')
      return NextResponse.json(
        { error: 'No open shift found. Please start your shift before making sales.' },
        { status: 400 }
      )
    }

    // Verify customer if provided and get customer name for serial numbers
    let customerName: string | null = null
    if (customerIdNumber !== null) {
      const customer = await prisma.customer.findFirst({
        where: {
          id: customerIdNumber,
          businessId: businessIdNumber,
          deletedAt: null,
        },
      })

      if (!customer) {
        return NextResponse.json(
          { error: 'Customer not found or does not belong to your business' },
          { status: 404 }
        )
      }

      customerName = customer.name
    }

    // Collect all serial numbers for batch validation (performance optimization)
    const allSerialNumberIds: number[] = []
    items.forEach(item => {
      if (item.requiresSerial && item.serialNumberIds) {
        allSerialNumberIds.push(...item.serialNumberIds.map((id: any) => Number(id)))
      }
    })

    // Batch fetch all serial numbers at once (instead of N+1 queries)
    let serialNumbersMap = new Map()
    if (allSerialNumberIds.length > 0) {
      const serialNumbers = await prisma.productSerialNumber.findMany({
        where: {
          id: { in: allSerialNumberIds },
          businessId: businessIdNumber,
          currentLocationId: locationIdNumber,
          status: 'in_stock',
        },
      })
      serialNumbersMap = new Map(serialNumbers.map(sn => [sn.id, sn]))
    }

    // Validate items and check stock availability
    let subtotal = 0
    for (const item of items) {
      const quantity = parseFloat(item.quantity)
      const unitPrice = parseFloat(item.unitPrice)

      if (isNaN(quantity) || quantity <= 0) {
        return NextResponse.json(
          { error: `Invalid quantity for item: ${item.productId}` },
          { status: 400 }
        )
      }

      if (isNaN(unitPrice) || unitPrice < 0) {
        return NextResponse.json(
          { error: `Invalid unit price for item: ${item.productId}` },
          { status: 400 }
        )
      }

      // Check stock availability via centralized stock helper
      const availability = await checkStockAvailability({
        productVariationId: Number(item.productVariationId),
        locationId: locationIdNumber,
        quantity,
      })

      if (!availability.available) {
        return NextResponse.json(
          {
            error: `Insufficient stock for item ${item.productId}. Available: ${availability.currentStock}, Required: ${quantity}`,
          },
          { status: 400 }
        )
      }

      // If serial numbers required, validate them using batch-fetched data
      if (item.requiresSerial) {
        if (!item.serialNumberIds || item.serialNumberIds.length === 0) {
          return NextResponse.json(
            { error: `Serial numbers required for item ${item.productId}` },
            { status: 400 }
          )
        }

        if (item.serialNumberIds.length !== quantity) {
          return NextResponse.json(
            {
              error: `Serial number count mismatch for item ${item.productId}. Expected: ${quantity}, Provided: ${item.serialNumberIds.length}`,
            },
            { status: 400 }
          )
        }

        // Verify serial numbers exist and are available (using pre-fetched map)
        for (const serialNumberId of item.serialNumberIds) {
          const serialNumber = serialNumbersMap.get(Number(serialNumberId))

          if (!serialNumber || serialNumber.productVariationId !== Number(item.productVariationId)) {
            return NextResponse.json(
              { error: `Serial number ${serialNumberId} not available for sale` },
              { status: 400 }
            )
          }
        }
      }

      subtotal += quantity * unitPrice
    }

    // Calculate total
    const totalAmount =
      subtotal +
      parseFloat(taxAmount || 0) +
      parseFloat(shippingCost || 0) -
      parseFloat(discountAmount || 0)

    // For non-credit sales, validate payments total is sufficient (allow overpayment for change)
    if (!isCreditSale) {
      const paymentsTotal = payments.reduce(
        (sum: number, payment: any) => sum + parseFloat(payment.amount),
        0
      )

      if (paymentsTotal < totalAmount - 0.01) {
        return NextResponse.json(
          {
            error: `Insufficient payment. Total due: ${totalAmount.toFixed(2)}, Total paid: ${paymentsTotal.toFixed(2)}`,
          },
          { status: 400 }
        )
      }
    }

    // TRANSACTION IMPACT TRACKING: Step 1 - Capture inventory BEFORE transaction
    const impactTracker = new InventoryImpactTracker()
    const productVariationIds = items.map((item: any) => Number(item.productVariationId))
    const locationIds = [locationIdNumber]
    await impactTracker.captureBefore(productVariationIds, locationIds)

    // Create sale and deduct stock in transaction
    const sale = await prisma.$transaction(async (tx) => {
      // Generate location-specific invoice number atomically inside transaction
      const invoiceNumber = await getNextInvoiceNumber(businessIdNumber, locationIdNumber, location.name, tx)

      // Create sale
      const newSale = await tx.sale.create({
        data: {
          businessId: businessIdNumber,
          locationId: locationIdNumber,
          customerId: customerIdNumber,
          invoiceNumber,
          saleDate: new Date(saleDate),
          status: isCreditSale ? 'pending' : 'completed', // Use status from request
          shiftId: currentShift.id, // Associate with current cashier shift
          subtotal,
          taxAmount: parseFloat(taxAmount || 0),
          discountAmount: parseFloat(discountAmount || 0),
          shippingCost: parseFloat(shippingCost || 0),
          totalAmount,
          notes,
          // Philippine BIR discount tracking
          discountType: discountType || null,
          seniorCitizenId: seniorCitizenId || null,
          seniorCitizenName: seniorCitizenName || null,
          pwdId: pwdId || null,
          pwdName: pwdName || null,
          discountApprovedBy: discountApprovedByNumber,
          vatExempt: vatExempt || false,
          createdBy: userIdNumber,
        },
      })

      // Create sale items and deduct stock
      for (const item of items) {
        const productIdNumber = Number(item.productId)
        const productVariationIdNumber = Number(item.productVariationId)
        const quantityNumber = parseFloat(item.quantity)
        const unitPriceNumber = parseFloat(item.unitPrice)

        if (Number.isNaN(productIdNumber) || Number.isNaN(productVariationIdNumber)) {
          throw new Error('Invalid product identifiers in sale item')
        }

        // Get product variation to fetch purchase price for unitCost
        const variation = await tx.productVariation.findUnique({
          where: { id: productVariationIdNumber },
        })

        if (!variation) {
          throw new Error(`Product variation ${item.productVariationId} not found`)
        }

        // Prepare serial numbers data for JSON field
        let serialNumbersData = null
        if (item.requiresSerial && item.serialNumberIds) {
          // Fetch serial numbers to get their details
          const serialNumberRecords = await tx.productSerialNumber.findMany({
            where: {
              id: { in: item.serialNumberIds.map((id: any) => Number(id)) },
            },
          })
          serialNumbersData = serialNumberRecords.map(sn => ({
            id: sn.id,
            serialNumber: sn.serialNumber,
            imei: sn.imei,
          }))
        }

        // Create sale item
        await tx.saleItem.create({
          data: {
            saleId: newSale.id,
            productId: productIdNumber,
            productVariationId: productVariationIdNumber,
            quantity: quantityNumber,
            unitPrice: unitPriceNumber,
            unitCost: parseFloat(variation.purchasePrice.toString()), // Use purchase price as unit cost
            serialNumbers: serialNumbersData, // Store serial numbers as JSON
          },
        })

        await processSale({
          tx,
          businessId: businessIdNumber,
          productId: productIdNumber,
          productVariationId: productVariationIdNumber,
          locationId: locationIdNumber,
          quantity: quantityNumber,
          unitCost: parseFloat(variation.purchasePrice.toString()),
          saleId: newSale.id,
          userId: userIdNumber,
          userDisplayName,
        })

        // Handle serial numbers if required
        if (item.requiresSerial && item.serialNumberIds) {
          for (const serialNumberId of item.serialNumberIds) {
            // Update serial number status to sold
            const serialNumberRecord = await tx.productSerialNumber.update({
              where: { id: Number(serialNumberId) },
              data: {
                status: 'sold',
                saleId: newSale.id,
                soldAt: new Date(saleDate),
                soldTo: customerName, // Use customer name, not ID
              },
            })

            // Create movement record
            await tx.serialNumberMovement.create({
              data: {
                serialNumberId: serialNumberRecord.id, // CRITICAL: Use actual ID
                movementType: 'sale',
                fromLocationId: locationIdNumber,
                referenceType: 'sale',
                referenceId: newSale.id,
                movedBy: userIdNumber,
                notes: `Sold via ${invoiceNumber}`,
              },
            })
          }
        }
      }

      // Create sale payments (only for non-credit sales)
      if (!isCreditSale && payments && payments.length > 0) {
        for (const payment of payments) {
          await tx.salePayment.create({
            data: {
              saleId: newSale.id,
              paymentMethod: payment.method,
              amount: parseFloat(payment.amount),
              referenceNumber: payment.reference,
            },
          })
        }
      } else if (isCreditSale) {
        // For credit sales, create a placeholder payment entry
        await tx.salePayment.create({
          data: {
            saleId: newSale.id,
            paymentMethod: 'credit',
            amount: 0, // No payment yet
            referenceNumber: 'Pending Payment',
          },
        })
      }

      return newSale
    }, {
      timeout: 60000, // 60 seconds timeout for network resilience
    })

    // TRANSACTION IMPACT TRACKING: Step 2 - Capture inventory AFTER and generate report
    const inventoryImpact = await impactTracker.captureAfterAndReport(
      productVariationIds,
      locationIds,
      'sale',
      sale.id,
      sale.invoiceNumber,
      undefined, // No location types needed for single-location sales
      userDisplayName
    )

    // ACCOUNTING INTEGRATION: Create journal entries if accounting is enabled
    if (await isAccountingEnabled(businessIdNumber)) {
      try {
        // Calculate COGS (Cost of Goods Sold) from sale items
        const saleWithItems = await prisma.sale.findUnique({
          where: { id: sale.id },
          include: { items: true }
        })

        const costOfGoodsSold = saleWithItems?.items.reduce(
          (sum, item) => sum + (parseFloat(item.unitCost.toString()) * parseFloat(item.quantity.toString())),
          0
        ) || 0

        if (isCreditSale) {
          // Credit Sale (Charge Invoice) - record as Accounts Receivable
          await recordCreditSale({
            businessId: businessIdNumber,
            userId: userIdNumber,
            saleId: sale.id,
            saleDate: new Date(saleDate),
            totalAmount,
            costOfGoodsSold,
            invoiceNumber: sale.invoiceNumber,
            customerId: customerIdNumber || undefined
          })
        } else {
          // Cash Sale - record as Cash received
          await recordCashSale({
            businessId: businessIdNumber,
            userId: userIdNumber,
            saleId: sale.id,
            saleDate: new Date(saleDate),
            totalAmount,
            costOfGoodsSold,
            invoiceNumber: sale.invoiceNumber
          })
        }
      } catch (accountingError) {
        // Log accounting errors but don't fail the sale
        console.error('Accounting integration error:', accountingError)
      }
    }

    // Create audit log
    await createAuditLog({
      businessId: businessIdNumber,
      userId: userIdNumber,
      username: user.username,
      action: 'sale_create' as AuditAction,
      entityType: EntityType.SALE,
      entityIds: [sale.id],
      description: `Created Sale ${sale.invoiceNumber}`,
      metadata: {
        saleId: sale.id,
        invoiceNumber: sale.invoiceNumber,
        customerId: customerIdNumber,
        locationId: locationIdNumber,
        totalAmount,
        itemCount: items.length,
        paymentMethods: (payments || []).map((p: any) => p.method),
      },
      ipAddress: getIpAddress(request),
      userAgent: getUserAgent(request),
    })

    // Fetch complete sale with relations
    const completeSale = await prisma.sale.findUnique({
      where: { id: sale.id },
      include: {
        customer: true,
        creator: {
          select: {
            id: true,
            username: true,
            firstName: true,
            lastName: true,
            surname: true,
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
        payments: true,
      },
    })

    // Send email and Telegram alerts (async, don't wait for completion)
    setImmediate(async () => {
      try {
        // Alert for large discounts
        if (discountAmount && parseFloat(discountAmount) > 0) {
          await Promise.all([
            sendLargeDiscountAlert({
              saleNumber: sale.invoiceNumber,
              discountAmount: parseFloat(discountAmount),
              discountType: discountType || 'Regular Discount',
              totalAmount,
              cashierName: user.username || user.name || 'Unknown',
              locationName: location.name,
              timestamp: new Date(saleDate),
              reason: notes || undefined,
            }),
            sendTelegramLargeDiscountAlert({
              saleNumber: sale.invoiceNumber,
              discountAmount: parseFloat(discountAmount),
              discountType: discountType || 'Regular Discount',
              totalAmount,
              cashierName: user.username || user.name || 'Unknown',
              locationName: location.name,
              timestamp: new Date(saleDate),
              reason: notes || undefined,
            }),
          ])
        }

        // Alert for credit sales
        if (isCreditSale && customerName) {
          await Promise.all([
            sendCreditSaleAlert({
              saleNumber: sale.invoiceNumber,
              creditAmount: totalAmount,
              customerName,
              cashierName: user.username || user.name || 'Unknown',
              locationName: location.name,
              timestamp: new Date(saleDate),
            }),
            sendTelegramCreditSaleAlert({
              saleNumber: sale.invoiceNumber,
              creditAmount: totalAmount,
              customerName,
              cashierName: user.username || user.name || 'Unknown',
              locationName: location.name,
              timestamp: new Date(saleDate),
            }),
          ])
        }
      } catch (notificationError) {
        // Log notification errors but don't fail the sale
        console.error('Notification error:', notificationError)
      }
    })

    // Return with inventory impact report
    return NextResponse.json({
      ...completeSale,
      inventoryImpact
    }, { status: 201 })
  } catch (error) {
    console.error('Error creating sale:', error)
    console.error('Error stack:', error instanceof Error ? error.stack : 'No stack')
    return NextResponse.json(
      {
        error: 'Failed to create sale',
        details: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        type: error instanceof Error ? error.constructor.name : typeof error,
      },
      { status: 500 }
    )
  }
  }) // Close idempotency wrapper
}
