import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { PERMISSIONS } from '@/lib/rbac'

// Helper function to generate payment number
async function generatePaymentNumber(businessId: number, tx: any) {
  const year = new Date().getFullYear()
  const prefix = `SP-${year}-`

  // Get the last payment number for this year
  const lastPayment = await tx.serviceRepairPayment.findFirst({
    where: {
      businessId,
      paymentNumber: {
        startsWith: prefix
      }
    },
    orderBy: {
      paymentNumber: 'desc'
    }
  })

  let nextNumber = 1
  if (lastPayment) {
    const lastNumber = parseInt(lastPayment.paymentNumber.split('-')[2])
    nextNumber = lastNumber + 1
  }

  return `${prefix}${String(nextNumber).padStart(4, '0')}`
}

// GET /api/service-payments - List all service payments
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = session.user as any
    const businessId = user.businessId

    if (!businessId) {
      return NextResponse.json({ error: 'No business associated with user' }, { status: 400 })
    }

    // Check permission
    if (!user.permissions?.includes(PERMISSIONS.SERVICE_PAYMENT_VIEW)) {
      return NextResponse.json({ error: 'Forbidden - Insufficient permissions' }, { status: 403 })
    }

    // Parse query parameters for filtering
    const { searchParams } = new URL(request.url)
    const jobOrderId = searchParams.get('jobOrderId')
    const customerId = searchParams.get('customerId')
    const locationId = searchParams.get('locationId') ? parseInt(searchParams.get('locationId')!) : null
    const paymentMethod = searchParams.get('paymentMethod')
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const search = searchParams.get('search')?.trim() || ''
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = (page - 1) * limit

    // Build where clause
    const whereClause: any = {
      businessId: parseInt(businessId),
      isVoided: false
    }

    // Apply filters
    if (jobOrderId) {
      whereClause.jobOrderId = parseInt(jobOrderId)
    }

    if (customerId) {
      whereClause.customerId = parseInt(customerId)
    }

    if (locationId) {
      whereClause.locationId = parseInt(locationId)
    }

    if (paymentMethod) {
      whereClause.paymentMethod = paymentMethod
    }

    if (startDate || endDate) {
      whereClause.paymentDate = {}
      if (startDate) whereClause.paymentDate.gte = new Date(startDate)
      if (endDate) whereClause.paymentDate.lte = new Date(endDate)
    }

    if (search) {
      whereClause.OR = [
        { paymentNumber: { contains: search, mode: 'insensitive' } },
        { referenceNumber: { contains: search, mode: 'insensitive' } },
        { chequeNumber: { contains: search, mode: 'insensitive' } }
      ]
    }

    const [payments, total] = await Promise.all([
      prisma.serviceRepairPayment.findMany({
        where: whereClause,
        include: {
          jobOrder: {
            select: {
              id: true,
              jobOrderNumber: true,
              customerName: true,
              totalCost: true
            }
          },
          customer: {
            select: {
              id: true,
              name: true,
              mobile: true,
              email: true
            }
          },
          location: {
            select: {
              id: true,
              name: true
            }
          },
          receivedByUser: {
            select: {
              id: true,
              username: true,
              firstName: true,
              lastName: true
            }
          }
        },
        orderBy: { paymentDate: 'desc' },
        skip: offset,
        take: limit
      }),
      prisma.serviceRepairPayment.count({ where: whereClause })
    ])

    // Serialize Decimal fields
    const serializedPayments = payments.map(payment => ({
      ...payment,
      amount: Number(payment.amount),
      jobOrder: payment.jobOrder ? {
        ...payment.jobOrder,
        totalCost: Number(payment.jobOrder.totalCost)
      } : null
    }))

    return NextResponse.json({
      payments: serializedPayments,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      }
    })
  } catch (error) {
    console.error('Error fetching service payments:', error)
    return NextResponse.json({ error: 'Failed to fetch service payments' }, { status: 500 })
  }
}

// POST /api/service-payments - Process payment
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = session.user as any
    const businessId = user.businessId
    const userId = user.id

    if (!businessId) {
      return NextResponse.json({ error: 'No business associated with user' }, { status: 400 })
    }

    // Check permission
    if (!user.permissions?.includes(PERMISSIONS.SERVICE_PAYMENT_CREATE)) {
      return NextResponse.json({ error: 'Forbidden - Insufficient permissions' }, { status: 403 })
    }

    const body = await request.json()
    const {
      jobOrderId,
      locationId,
      customerId,
      paymentDate,
      amount,
      paymentMethod,
      referenceNumber,
      chequeNumber,
      bankName,
      notes
    } = body

    // Validation
    if (!jobOrderId || !locationId || !paymentDate || !amount || !paymentMethod) {
      return NextResponse.json(
        { error: 'Missing required fields: jobOrderId, locationId, paymentDate, amount, paymentMethod' },
        { status: 400 }
      )
    }

    const paymentAmount = parseFloat(amount)
    if (paymentAmount <= 0) {
      return NextResponse.json({ error: 'Payment amount must be greater than zero' }, { status: 400 })
    }

    // Verify location belongs to business
    const location = await prisma.businessLocation.findFirst({
      where: {
        id: parseInt(locationId),
        businessId: parseInt(businessId),
        deletedAt: null
      }
    })

    if (!location) {
      return NextResponse.json({ error: 'Location not found' }, { status: 404 })
    }

    // Verify job order belongs to business
    const jobOrder = await prisma.repairJobOrder.findFirst({
      where: {
        id: parseInt(jobOrderId),
        businessId: parseInt(businessId)
      }
    })

    if (!jobOrder) {
      return NextResponse.json({ error: 'Job order not found' }, { status: 404 })
    }

    // Check if overpayment
    const totalCost = Number(jobOrder.totalCost)
    const paidAmount = Number(jobOrder.paidAmount)
    const remainingBalance = totalCost - paidAmount

    if (paymentAmount > remainingBalance + 0.01) { // Allow small rounding difference
      return NextResponse.json({
        error: `Payment amount (${paymentAmount.toFixed(2)}) exceeds remaining balance (${remainingBalance.toFixed(2)})`
      }, { status: 400 })
    }

    // Create payment in transaction
    const result = await prisma.$transaction(async (tx) => {
      // Generate payment number
      const paymentNumber = await generatePaymentNumber(parseInt(businessId), tx)

      // Create payment
      const payment = await tx.serviceRepairPayment.create({
        data: {
          businessId: parseInt(businessId),
          locationId: parseInt(locationId),
          jobOrderId: parseInt(jobOrderId),
          customerId: customerId ? parseInt(customerId) : null,
          paymentNumber,
          paymentDate: new Date(paymentDate),
          amount: paymentAmount,
          paymentMethod,
          referenceNumber,
          chequeNumber,
          bankName,
          notes,
          receivedBy: parseInt(userId)
        }
      })

      // Update job order paid amount and payment status
      const newPaidAmount = paidAmount + paymentAmount
      const newPaymentStatus = Math.abs(newPaidAmount - totalCost) < 0.01
        ? 'paid'
        : newPaidAmount > 0
        ? 'partial'
        : 'unpaid'

      await tx.repairJobOrder.update({
        where: { id: parseInt(jobOrderId) },
        data: {
          paidAmount: newPaidAmount,
          paymentStatus: newPaymentStatus,
          updatedAt: new Date()
        }
      })

      return payment
    })

    // Fetch complete payment with relations
    const completePayment = await prisma.serviceRepairPayment.findUnique({
      where: { id: result.id },
      include: {
        jobOrder: {
          select: {
            id: true,
            jobOrderNumber: true,
            customerName: true,
            totalCost: true,
            paidAmount: true,
            paymentStatus: true
          }
        },
        customer: true,
        location: true,
        receivedByUser: {
          select: {
            id: true,
            username: true,
            firstName: true,
            lastName: true
          }
        }
      }
    })

    // Serialize Decimal fields
    const serializedPayment = {
      ...completePayment,
      amount: completePayment ? Number(completePayment.amount) : 0,
      jobOrder: completePayment?.jobOrder ? {
        ...completePayment.jobOrder,
        totalCost: Number(completePayment.jobOrder.totalCost),
        paidAmount: Number(completePayment.jobOrder.paidAmount)
      } : null
    }

    return NextResponse.json({
      payment: serializedPayment,
      message: 'Payment processed successfully'
    }, { status: 201 })
  } catch (error) {
    console.error('Error processing payment:', error)
    return NextResponse.json({ error: 'Failed to process payment' }, { status: 500 })
  }
}
