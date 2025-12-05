import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth.simple'
import { prisma } from '@/lib/prisma.simple'
import { PERMISSIONS } from '@/lib/rbac'
import { createAuditLog, AuditAction, EntityType, getIpAddress, getUserAgent } from '@/lib/auditLog'

/**
 * GET /api/customer-returns
 * List all customer returns with filtering
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = session.user as any
    const businessId = parseInt(String(user.businessId))
    // Check permission
    if (!user.permissions?.includes(PERMISSIONS.CUSTOMER_RETURN_VIEW)) {
      return NextResponse.json(
        { error: 'Forbidden - Insufficient permissions' },
        { status: 403 }
      )
    }

    // Get query parameters for filtering
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const customerId = searchParams.get('customerId')
    const saleId = searchParams.get('saleId')
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = (page - 1) * limit

    const where: any = {
      businessId: parseInt(businessId),
    }

    if (status) {
      where.status = status
    }

    if (customerId) {
      where.customerId = parseInt(customerId)
    }

    if (saleId) {
      where.saleId = parseInt(saleId)
    }

    if (startDate || endDate) {
      where.returnDate = {}
      if (startDate) where.returnDate.gte = new Date(startDate)
      if (endDate) where.returnDate.lte = new Date(endDate)
    }

    const [returns, total, totalRefundAggregate] = await Promise.all([
      prisma.customerReturn.findMany({
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
          sale: {
            select: {
              id: true,
              invoiceNumber: true,
              saleDate: true,
            },
          },
          items: true,
        },
        orderBy: {
          createdAt: 'desc',
        },
        skip: offset,
        take: limit,
      }),
      prisma.customerReturn.count({ where }),
      // Total refund amount - matches dashboard calculation exactly
      prisma.customerReturn.aggregate({
        where: { businessId: parseInt(businessId) },  // Use same filter as dashboard (businessId only)
        _sum: { totalRefundAmount: true },
      }),
    ])

    return NextResponse.json({
      returns,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
      summary: {
        totalRefundAmount: parseFloat(totalRefundAggregate._sum.totalRefundAmount?.toString() || '0'),
      },
    })
  } catch (error) {
    console.error('Error fetching customer returns:', error)
    return NextResponse.json(
      { error: 'Failed to fetch customer returns' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/customer-returns
 * Create new customer return request
 */
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
    if (!user.permissions?.includes(PERMISSIONS.CUSTOMER_RETURN_CREATE)) {
      return NextResponse.json(
        { error: 'Forbidden - Insufficient permissions' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const {
      saleId,
      customerId,
      locationId,
      returnDate,
      items, // Array of { productId, productVariationId, quantity, unitPrice, condition, returnType, serialNumberIds?, notes }
      notes,
    } = body

    // Validation
    if (!saleId || !locationId || !returnDate || !items || items.length === 0) {
      return NextResponse.json(
        { error: 'Missing required fields: saleId, locationId, returnDate, items' },
        { status: 400 }
      )
    }

    // Verify sale exists and belongs to business
    const sale = await prisma.sale.findFirst({
      where: {
        id: parseInt(saleId),
        businessId: parseInt(businessId),
        deletedAt: null,
      },
      include: {
        items: true,
      },
    })

    if (!sale) {
      return NextResponse.json(
        { error: 'Sale not found or does not belong to your business' },
        { status: 404 }
      )
    }

    // Validate items - ensure they were in the original sale
    for (const item of items) {
      const saleItem = sale.items.find(
        (si: any) => si.productVariationId === parseInt(item.productVariationId)
      )

      if (!saleItem) {
        return NextResponse.json(
          { error: `Item not found in original sale: ${item.productVariationId}` },
          { status: 400 }
        )
      }

      const quantity = parseFloat(item.quantity)
      const saleQuantity = parseFloat(saleItem.quantity.toString())

      if (quantity > saleQuantity) {
        return NextResponse.json(
          { error: `Return quantity exceeds original sale quantity for item ${item.productVariationId}` },
          { status: 400 }
        )
      }

      if (quantity <= 0) {
        return NextResponse.json(
          { error: `Invalid quantity for item: ${item.productVariationId}` },
          { status: 400 }
        )
      }

      // Validate condition
      if (!['resellable', 'damaged', 'defective'].includes(item.condition)) {
        return NextResponse.json(
          { error: 'Invalid condition. Must be: resellable, damaged, or defective' },
          { status: 400 }
        )
      }

      // Validate return type
      if (!['refund', 'replacement'].includes(item.returnType)) {
        return NextResponse.json(
          { error: 'Invalid return type. Must be: refund or replacement' },
          { status: 400 }
        )
      }
    }

    // Generate return number
    const currentYear = new Date().getFullYear()
    const currentMonth = String(new Date().getMonth() + 1).padStart(2, '0')
    const lastReturn = await prisma.customerReturn.findFirst({
      where: {
        businessId: parseInt(businessId),
        returnNumber: {
          startsWith: `RET-${currentYear}${currentMonth}`,
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    })

    let returnNumber
    if (lastReturn) {
      const lastNumber = parseInt(lastReturn.returnNumber.split('-').pop() || '0')
      returnNumber = `RET-${currentYear}${currentMonth}-${String(lastNumber + 1).padStart(4, '0')}`
    } else {
      returnNumber = `RET-${currentYear}${currentMonth}-0001`
    }

    // Calculate total refund amount
    let totalRefundAmount = 0
    for (const item of items) {
      if (item.returnType === 'refund') {
        totalRefundAmount += parseFloat(item.quantity) * parseFloat(item.unitPrice)
      }
    }

    // Create return
    const customerReturn = await prisma.$transaction(async (tx) => {
      // Create customer return
      const newReturn = await tx.customerReturn.create({
        data: {
          businessId: parseInt(businessId),
          locationId: parseInt(locationId),
          saleId: parseInt(saleId),
          customerId: customerId ? parseInt(customerId) : null,
          returnNumber,
          returnDate: new Date(returnDate),
          status: 'pending',
          totalRefundAmount,
          notes,
          createdBy: parseInt(userId),
        },
      })

      // Create return items
      for (const item of items) {
        // Prepare serial numbers data
        let serialNumbersData = null
        if (item.serialNumberIds && item.serialNumberIds.length > 0) {
          const serialNumberRecords = await tx.productSerialNumber.findMany({
            where: {
              id: { in: item.serialNumberIds.map((id: any) => parseInt(id)) },
            },
          })
          serialNumbersData = serialNumberRecords.map((sn: any) => ({
            id: sn.id,
            serialNumber: sn.serialNumber,
            imei: sn.imei,
          }))
        }

        await tx.customerReturnItem.create({
          data: {
            customerReturnId: newReturn.id,
            productId: parseInt(item.productId),
            productVariationId: parseInt(item.productVariationId),
            quantity: parseFloat(item.quantity),
            unitPrice: parseFloat(item.unitPrice),
            serialNumbers: serialNumbersData,
            condition: item.condition,
            returnType: item.returnType,
            notes: item.notes || null,
          },
        })
      }

      return newReturn
    }, {
      timeout: 60000, // 60 seconds timeout for network resilience
    })

    // Create audit log
    await createAuditLog({
      businessId: parseInt(businessId),
      userId: parseInt(userId),
      username: user.username,
      action: 'customer_return_create' as AuditAction,
      entityType: EntityType.SALE, // Related to sale
      entityIds: [customerReturn.id],
      description: `Created Customer Return ${returnNumber} for Sale ${sale.invoiceNumber}`,
      metadata: {
        returnId: customerReturn.id,
        returnNumber,
        saleId: parseInt(saleId),
        invoiceNumber: sale.invoiceNumber,
        itemCount: items.length,
        totalRefundAmount,
      },
      ipAddress: getIpAddress(request),
      userAgent: getUserAgent(request),
    })

    // Fetch complete return with relations
    const completeReturn = await prisma.customerReturn.findUnique({
      where: { id: customerReturn.id },
      include: {
        customer: true,
        sale: true,
        items: true,
      },
    })

    return NextResponse.json({ return: completeReturn }, { status: 201 })
  } catch (error) {
    console.error('Error creating customer return:', error)
    return NextResponse.json(
      {
        error: 'Failed to create customer return',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
