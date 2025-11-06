import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth.simple'
import { prisma } from '@/lib/prisma.simple'
import { hasPermission, PERMISSIONS } from '@/lib/rbac'
import { createAuditLog, AuditAction, EntityType } from '@/lib/auditLog'

/**
 * GET /api/quotations - Get saved quotations
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = session.user as any

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')

    const quotations = await prisma.quotation.findMany({
      where: {
        businessId: parseInt(user.businessId),
        ...(status ? { status } : {}), // Only filter by status if provided
      },
      include: {
        items: true,
        customer: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: 50,
    })

    return NextResponse.json({ quotations })
  } catch (error: any) {
    console.error('Error fetching quotations:', error)
    return NextResponse.json(
      { error: 'Failed to fetch quotations', details: error.message },
      { status: 500 }
    )
  }
}

/**
 * POST /api/quotations - Create new quotation
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = session.user as any

    const body = await request.json()
    const { customerName, customerId, locationId, items, notes, subtotal, discountAmount, taxAmount, totalAmount } = body

    // Validation
    if (!items || items.length === 0) {
      return NextResponse.json(
        { error: 'Items are required' },
        { status: 400 }
      )
    }

    // Use current shift location if not provided
    const currentShift = await prisma.cashierShift.findFirst({
      where: {
        userId: parseInt(user.id),
        status: 'open',
        businessId: parseInt(user.businessId),
      },
    })

    const quoteLocationId = locationId || currentShift?.locationId

    if (!quoteLocationId) {
      return NextResponse.json(
        { error: 'Location ID is required' },
        { status: 400 }
      )
    }

    // Generate quotation number
    const currentYear = new Date().getFullYear()
    const currentMonth = String(new Date().getMonth() + 1).padStart(2, '0')
    const lastQuotation = await prisma.quotation.findFirst({
      where: {
        businessId: parseInt(user.businessId),
        quotationNumber: {
          startsWith: `QUOT-${currentYear}${currentMonth}`,
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    })

    let quotationNumber
    if (lastQuotation) {
      const lastNumber = parseInt(lastQuotation.quotationNumber.split('-').pop() || '0')
      quotationNumber = `QUOT-${currentYear}${currentMonth}-${String(lastNumber + 1).padStart(4, '0')}`
    } else {
      quotationNumber = `QUOT-${currentYear}${currentMonth}-0001`
    }

    // Calculate expiry date (7 days from now) - as Date only (no time)
    const today = new Date()
    const expiryDate = new Date(today)
    expiryDate.setDate(expiryDate.getDate() + 7)

    // Create quotation with items in transaction
    const quotation = await prisma.$transaction(async (tx) => {
      const newQuotation = await tx.quotation.create({
        data: {
          businessId: parseInt(user.businessId),
          locationId: parseInt(quoteLocationId),
          customerId: customerId ? parseInt(customerId) : null,
          customerName: customerName || null, // Store walk-in customer name
          quotationNumber,
          quotationDate: today,
          expiryDate,
          subtotal: parseFloat(subtotal || totalAmount),
          taxAmount: parseFloat(taxAmount || 0),
          discountAmount: parseFloat(discountAmount || 0),
          totalAmount: parseFloat(totalAmount),
          status: 'draft',
          notes: notes || null,
          createdBy: parseInt(user.id),
        },
      }, {
      timeout: 60000, // 60 seconds timeout for network resilience
    })

      // Create quotation items
      for (const item of items) {
        await tx.quotationItem.create({
          data: {
            quotationId: newQuotation.id,
            productId: parseInt(item.productId),
            productVariationId: parseInt(item.productVariationId),
            quantity: parseFloat(item.quantity),
            unitPrice: parseFloat(item.unitPrice),
          },
        })
      }

      return newQuotation
    })

    // Create audit log
    await createAuditLog({
      businessId: parseInt(user.businessId),
      userId: parseInt(user.id),
      username: user.username,
      action: 'quotation_create' as AuditAction,
      entityType: 'quotation' as EntityType,
      entityIds: [quotation.id],
      description: `Created quotation ${quotationNumber}${customerName ? ` for ${customerName}` : ''}`,
      metadata: {
        quotationNumber,
        customerName,
        itemCount: items.length,
        totalAmount: parseFloat(totalAmount),
      },
    })

    // Return the created quotation without fetching again
    // The quotation was just created successfully
    return NextResponse.json({
      quotation: {
        ...quotation,
        items: items.map((item: any) => ({
          productId: parseInt(item.productId),
          productVariationId: parseInt(item.productVariationId),
          quantity: parseFloat(item.quantity),
          unitPrice: parseFloat(item.unitPrice),
        }))
      }
    }, { status: 201 })
  } catch (error: any) {
    console.error('Error creating quotation:', error)
    console.error('Error stack:', error.stack)
    return NextResponse.json(
      {
        error: 'Failed to create quotation',
        details: error.message,
        code: error.code,
        meta: error.meta
      },
      { status: 500 }
    )
  }
}
