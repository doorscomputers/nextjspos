import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { PERMISSIONS } from '@/lib/rbac'
import { createAuditLog, AuditAction, EntityType, getIpAddress, getUserAgent } from '@/lib/auditLog'

// GET - List all sales
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = session.user as any
    const businessId = user.businessId
    const userId = user.id

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
    const locationId = searchParams.get('locationId')
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = (page - 1) * limit

    const where: any = {
      businessId: parseInt(businessId),
      deletedAt: null,
    }

    // If user has SELL_VIEW_OWN, only show their own sales
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

    if (locationId) {
      where.locationId = parseInt(locationId)
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
          items: true,
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
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = session.user as any
    const businessId = user.businessId
    const userId = user.id

    // Check permission
    if (!user.permissions?.includes(PERMISSIONS.SELL_CREATE)) {
      return NextResponse.json(
        { error: 'Forbidden - Insufficient permissions' },
        { status: 403 }
      )
    }

    const body = await request.json()
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
    } = body

    // Validation
    if (!locationId || !saleDate || !items || items.length === 0) {
      return NextResponse.json(
        { error: 'Missing required fields: locationId, saleDate, items' },
        { status: 400 }
      )
    }

    if (!payments || payments.length === 0) {
      return NextResponse.json(
        { error: 'At least one payment method is required' },
        { status: 400 }
      )
    }

    // Verify location belongs to business
    const location = await prisma.businessLocation.findFirst({
      where: {
        id: parseInt(locationId),
        businessId: parseInt(businessId),
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
            userId: parseInt(userId),
            locationId: parseInt(locationId),
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

    // Verify customer if provided and get customer name for serial numbers
    let customerName: string | null = null
    if (customerId) {
      const customer = await prisma.customer.findFirst({
        where: {
          id: parseInt(customerId),
          businessId: parseInt(businessId),
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

      // Check stock availability
      const stock = await prisma.variationLocationDetails.findUnique({
        where: {
          productVariationId_locationId: {
            productVariationId: parseInt(item.productVariationId),
            locationId: parseInt(locationId),
          },
        },
      })

      if (!stock || parseFloat(stock.qtyAvailable.toString()) < quantity) {
        const availableQty = stock ? parseFloat(stock.qtyAvailable.toString()) : 0
        return NextResponse.json(
          {
            error: `Insufficient stock for item ${item.productId}. Available: ${availableQty}, Required: ${quantity}`,
          },
          { status: 400 }
        )
      }

      // If serial numbers required, validate them
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

        // Verify serial numbers exist and are available
        for (const serialNumberId of item.serialNumberIds) {
          const serialNumber = await prisma.productSerialNumber.findFirst({
            where: {
              id: parseInt(serialNumberId),
              businessId: parseInt(businessId),
              productVariationId: parseInt(item.productVariationId),
              currentLocationId: parseInt(locationId),
              status: 'in_stock',
            },
          })

          if (!serialNumber) {
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

    // Validate payments total matches sale total
    const paymentsTotal = payments.reduce(
      (sum: number, payment: any) => sum + parseFloat(payment.amount),
      0
    )

    if (Math.abs(paymentsTotal - totalAmount) > 0.01) {
      return NextResponse.json(
        {
          error: `Payment total (${paymentsTotal}) does not match sale total (${totalAmount})`,
        },
        { status: 400 }
      )
    }

    // Generate invoice number
    const currentYear = new Date().getFullYear()
    const currentMonth = String(new Date().getMonth() + 1).padStart(2, '0')
    const lastSale = await prisma.sale.findFirst({
      where: {
        businessId: parseInt(businessId),
        invoiceNumber: {
          startsWith: `INV-${currentYear}${currentMonth}`,
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    })

    let invoiceNumber
    if (lastSale) {
      const lastNumber = parseInt(lastSale.invoiceNumber.split('-').pop() || '0')
      invoiceNumber = `INV-${currentYear}${currentMonth}-${String(lastNumber + 1).padStart(4, '0')}`
    } else {
      invoiceNumber = `INV-${currentYear}${currentMonth}-0001`
    }

    // Create sale and deduct stock in transaction
    const sale = await prisma.$transaction(async (tx) => {
      // Create sale
      const newSale = await tx.sale.create({
        data: {
          businessId: parseInt(businessId),
          locationId: parseInt(locationId),
          customerId: customerId ? parseInt(customerId) : null,
          invoiceNumber,
          saleDate: new Date(saleDate),
          status: 'completed',
          subtotal,
          taxAmount: parseFloat(taxAmount || 0),
          discountAmount: parseFloat(discountAmount || 0),
          shippingCost: parseFloat(shippingCost || 0),
          totalAmount,
          notes,
          createdBy: parseInt(userId),
        },
      })

      // Create sale items and deduct stock
      for (const item of items) {
        // Get product variation to fetch purchase price for unitCost
        const variation = await tx.productVariation.findUnique({
          where: { id: parseInt(item.productVariationId) },
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
              id: { in: item.serialNumberIds.map((id: any) => parseInt(id)) },
            },
          })
          serialNumbersData = serialNumberRecords.map(sn => ({
            id: sn.id,
            serialNumber: sn.serialNumber,
            imei: sn.imei,
          }))
        }

        // Create sale item
        const saleItem = await tx.saleItem.create({
          data: {
            saleId: newSale.id,
            productId: parseInt(item.productId),
            productVariationId: parseInt(item.productVariationId),
            quantity: parseFloat(item.quantity),
            unitPrice: parseFloat(item.unitPrice),
            unitCost: parseFloat(variation.purchasePrice.toString()), // Use purchase price as unit cost
            serialNumbers: serialNumbersData, // Store serial numbers as JSON
          },
        })

        // Deduct stock
        const currentStock = await tx.variationLocationDetails.findUnique({
          where: {
            productVariationId_locationId: {
              productVariationId: parseInt(item.productVariationId),
              locationId: parseInt(locationId),
            },
          },
        })

        if (!currentStock) {
          throw new Error(`Stock record not found for variation ${item.productVariationId}`)
        }

        const newQty = parseFloat(currentStock.qtyAvailable.toString()) - parseFloat(item.quantity)

        await tx.variationLocationDetails.update({
          where: {
            productVariationId_locationId: {
              productVariationId: parseInt(item.productVariationId),
              locationId: parseInt(locationId),
            },
          },
          data: {
            qtyAvailable: newQty,
          },
        })

        // Create stock transaction
        await tx.stockTransaction.create({
          data: {
            businessId: parseInt(businessId),
            productId: parseInt(item.productId),
            productVariationId: parseInt(item.productVariationId),
            locationId: parseInt(locationId),
            type: 'sale',
            quantity: -parseFloat(item.quantity), // Negative for deduction
            unitCost: 0, // Will be calculated from FIFO/LIFO later
            balanceQty: newQty,
            referenceType: 'sale',
            referenceId: newSale.id,
            createdBy: parseInt(userId),
            notes: `Sale ${invoiceNumber}`,
          },
        })

        // Handle serial numbers if required
        if (item.requiresSerial && item.serialNumberIds) {
          for (const serialNumberId of item.serialNumberIds) {
            // Update serial number status to sold
            const serialNumberRecord = await tx.productSerialNumber.update({
              where: { id: parseInt(serialNumberId) },
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
                fromLocationId: parseInt(locationId),
                referenceType: 'sale',
                referenceId: newSale.id,
                movedBy: parseInt(userId),
                notes: `Sold via ${invoiceNumber}`,
              },
            })
          }
        }
      }

      // Create sale payments
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

      return newSale
    }, {
      timeout: 30000, // 30 seconds timeout for complex transaction
    })

    // Create audit log
    await createAuditLog({
      businessId: parseInt(businessId),
      userId: parseInt(userId),
      username: user.username,
      action: 'sale_create' as AuditAction,
      entityType: EntityType.SALE,
      entityIds: [sale.id],
      description: `Created Sale ${invoiceNumber}`,
      metadata: {
        saleId: sale.id,
        invoiceNumber,
        customerId: customerId ? parseInt(customerId) : null,
        locationId: parseInt(locationId),
        totalAmount,
        itemCount: items.length,
        paymentMethods: payments.map((p: any) => p.method),
      },
      ipAddress: getIpAddress(request),
      userAgent: getUserAgent(request),
    })

    // Fetch complete sale with relations
    const completeSale = await prisma.sale.findUnique({
      where: { id: sale.id },
      include: {
        customer: true,
        items: true,
        payments: true,
      },
    })

    return NextResponse.json(completeSale, { status: 201 })
  } catch (error) {
    console.error('Error creating sale:', error)
    return NextResponse.json(
      {
        error: 'Failed to create sale',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
