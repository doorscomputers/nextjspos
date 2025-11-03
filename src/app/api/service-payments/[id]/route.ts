import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth.simple'
import { prisma } from '@/lib/prisma'
import { PERMISSIONS } from '@/lib/rbac'

// GET /api/service-payments/[id] - Get single payment
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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

    const paymentId = parseInt(params.id)

    const payment = await prisma.serviceRepairPayment.findFirst({
      where: {
        id: paymentId,
        businessId: parseInt(businessId)
      },
      include: {
        jobOrder: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
                sku: true
              }
            },
            productVariation: {
              select: {
                id: true,
                name: true,
                sku: true
              }
            },
            serviceType: true
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

    if (!payment) {
      return NextResponse.json({ error: 'Payment not found' }, { status: 404 })
    }

    // Serialize Decimal fields
    const serializedPayment = {
      ...payment,
      amount: Number(payment.amount),
      jobOrder: {
        ...payment.jobOrder,
        laborCost: Number(payment.jobOrder.laborCost),
        partsCost: Number(payment.jobOrder.partsCost),
        taxAmount: Number(payment.jobOrder.taxAmount),
        totalCost: Number(payment.jobOrder.totalCost),
        paidAmount: Number(payment.jobOrder.paidAmount)
      }
    }

    return NextResponse.json({ payment: serializedPayment })
  } catch (error) {
    console.error('Error fetching payment:', error)
    return NextResponse.json({ error: 'Failed to fetch payment' }, { status: 500 })
  }
}
