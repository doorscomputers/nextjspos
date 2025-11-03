import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth.simple'
import { prisma } from '@/lib/prisma.simple'
import { PERMISSIONS } from '@/lib/rbac'

// GET - List all accounts payable
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = session.user as any
    const businessId = user.businessId

    // Check permission
    if (!user.permissions?.includes(PERMISSIONS.ACCOUNTS_PAYABLE_VIEW)) {
      return NextResponse.json(
        { error: 'Forbidden - Insufficient permissions' },
        { status: 403 }
      )
    }

    // Get query parameters for filtering
    const { searchParams } = new URL(request.url)
    const supplierId = searchParams.get('supplierId')
    const paymentStatus = searchParams.get('paymentStatus')
    const overdue = searchParams.get('overdue') === 'true'
    const idsParam = searchParams.get('ids') // For batch payment
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = (page - 1) * limit

    const where: any = {
      businessId: parseInt(businessId),
      deletedAt: null,
    }

    // If specific IDs are requested (for batch payment)
    if (idsParam) {
      const ids = idsParam.split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id))
      if (ids.length > 0) {
        where.id = { in: ids }
      }
    }

    if (supplierId) {
      where.supplierId = parseInt(supplierId)
    }

    if (paymentStatus) {
      where.paymentStatus = paymentStatus
    }

    if (overdue) {
      where.AND = [
        { dueDate: { lt: new Date() } },
        { paymentStatus: { in: ['unpaid', 'partial'] } },
      ]
    }

    const [accountsPayable, total] = await Promise.all([
      prisma.accountsPayable.findMany({
        where,
        include: {
          supplier: {
            select: {
              id: true,
              name: true,
              mobile: true,
              email: true,
            },
          },
          purchase: {
            select: {
              id: true,
              purchaseOrderNumber: true,
              purchaseDate: true,
            },
          },
          payments: {
            select: {
              id: true,
              paymentNumber: true,
              paymentDate: true,
              amount: true,
              paymentMethod: true,
              status: true,
            },
            orderBy: {
              paymentDate: 'desc',
            },
          },
        },
        orderBy: {
          dueDate: 'asc',
        },
        skip: offset,
        take: limit,
      }),
      prisma.accountsPayable.count({ where }),
    ])

    // Calculate aging buckets
    const today = new Date()
    const aging = {
      current: 0,
      days30: 0,
      days60: 0,
      days90: 0,
      days90Plus: 0, // Match frontend expectation
      total: 0,
    }

    const summaryWhere: any = {
      businessId: parseInt(businessId),
      paymentStatus: { in: ['unpaid', 'partial'] },
      deletedAt: null,
    }

    const allOutstanding = await prisma.accountsPayable.findMany({
      where: summaryWhere,
      select: {
        balanceAmount: true,
        dueDate: true,
      },
    })

    for (const ap of allOutstanding) {
      const daysOverdue = Math.floor(
        (today.getTime() - ap.dueDate.getTime()) / (1000 * 60 * 60 * 24)
      )
      const balance = parseFloat(ap.balanceAmount.toString())

      if (daysOverdue <= 0) {
        aging.current += balance
      } else if (daysOverdue <= 30) {
        aging.days30 += balance
      } else if (daysOverdue <= 60) {
        aging.days60 += balance
      } else if (daysOverdue <= 90) {
        aging.days90 += balance
      } else {
        aging.days90Plus += balance
      }
      aging.total += balance
    }

    // Map the response to match frontend expectations
    const formattedPayables = accountsPayable.map((ap) => ({
      id: ap.id,
      invoiceNumber: ap.invoiceNumber,
      invoiceDate: ap.invoiceDate.toISOString(),
      dueDate: ap.dueDate.toISOString(),
      amount: parseFloat(ap.totalAmount.toString()),
      paidAmount: parseFloat(ap.paidAmount.toString()),
      balanceAmount: parseFloat(ap.balanceAmount.toString()),
      status: ap.paymentStatus,
      notes: ap.notes,
      createdAt: ap.createdAt.toISOString(),
      supplier: ap.supplier,
      purchase: ap.purchase,
    }))

    return NextResponse.json({
      payables: formattedPayables, // Changed from accountsPayable to payables
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
      aging,
    })
  } catch (error) {
    console.error('Error fetching accounts payable:', error)
    return NextResponse.json(
      { error: 'Failed to fetch accounts payable' },
      { status: 500 }
    )
  }
}

// POST - Create accounts payable entry (usually created automatically with purchase)
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = session.user as any
    const businessId = user.businessId

    // Check permission
    if (!user.permissions?.includes(PERMISSIONS.ACCOUNTS_PAYABLE_CREATE)) {
      return NextResponse.json(
        { error: 'Forbidden - Insufficient permissions' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const {
      purchaseId,
      supplierId,
      invoiceNumber,
      invoiceDate,
      dueDate,
      totalAmount,
      paymentTerms,
      notes,
    } = body

    // Validation
    if (!purchaseId || !supplierId || !invoiceNumber || !invoiceDate || !dueDate || !totalAmount) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // Verify purchase belongs to business
    const purchase = await prisma.purchase.findFirst({
      where: {
        id: parseInt(purchaseId),
        businessId: parseInt(businessId),
        deletedAt: null,
      },
    })

    if (!purchase) {
      return NextResponse.json(
        { error: 'Purchase not found or does not belong to your business' },
        { status: 404 }
      )
    }

    // Verify supplier belongs to business
    const supplier = await prisma.supplier.findFirst({
      where: {
        id: parseInt(supplierId),
        businessId: parseInt(businessId),
        deletedAt: null,
      },
    })

    if (!supplier) {
      return NextResponse.json(
        { error: 'Supplier not found or does not belong to your business' },
        { status: 404 }
      )
    }

    // Create accounts payable entry
    const accountsPayable = await prisma.accountsPayable.create({
      data: {
        businessId: parseInt(businessId),
        purchaseId: parseInt(purchaseId),
        supplierId: parseInt(supplierId),
        invoiceNumber,
        invoiceDate: new Date(invoiceDate),
        dueDate: new Date(dueDate),
        totalAmount: parseFloat(totalAmount),
        paidAmount: 0,
        balanceAmount: parseFloat(totalAmount),
        discountAmount: 0,
        paymentStatus: 'unpaid',
        paymentTerms: paymentTerms ? parseInt(paymentTerms) : null,
        notes,
      },
      include: {
        supplier: true,
        purchase: true,
      },
    })

    return NextResponse.json(accountsPayable, { status: 201 })
  } catch (error) {
    console.error('Error creating accounts payable:', error)
    return NextResponse.json(
      {
        error: 'Failed to create accounts payable',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
