import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { PERMISSIONS } from '@/lib/rbac'

// POST /api/service-payments/[id]/void - Void payment
export async function POST(
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
    const userId = user.id

    if (!businessId) {
      return NextResponse.json({ error: 'No business associated with user' }, { status: 400 })
    }

    // Check permission
    if (!user.permissions?.includes(PERMISSIONS.SERVICE_PAYMENT_VOID)) {
      return NextResponse.json({ error: 'Forbidden - Insufficient permissions' }, { status: 403 })
    }

    const paymentId = parseInt(params.id)
    const body = await request.json()
    const { voidReason } = body

    if (!voidReason) {
      return NextResponse.json({ error: 'voidReason is required' }, { status: 400 })
    }

    // Verify payment belongs to user's business
    const existing = await prisma.serviceRepairPayment.findFirst({
      where: {
        id: paymentId,
        businessId: parseInt(businessId)
      }
    })

    if (!existing) {
      return NextResponse.json({ error: 'Payment not found' }, { status: 404 })
    }

    // Cannot void already voided payment
    if (existing.isVoided) {
      return NextResponse.json({ error: 'Payment is already voided' }, { status: 400 })
    }

    // Void payment in transaction
    const result = await prisma.$transaction(async (tx) => {
      // Void payment
      const payment = await tx.serviceRepairPayment.update({
        where: { id: paymentId },
        data: {
          isVoided: { select: { id: true, name: true } },
          voidReason,
          voidedBy: parseInt(userId),
          voidedAt: new Date()
        }
      })

      // Update job order paid amount and payment status
      const jobOrder = await tx.repairJobOrder.findUnique({
        where: { id: existing.jobOrderId }
      })

      if (jobOrder) {
        const totalCost = Number(jobOrder.totalCost)
        const currentPaidAmount = Number(jobOrder.paidAmount)
        const voidedAmount = Number(existing.amount)
        const newPaidAmount = Math.max(0, currentPaidAmount - voidedAmount)
        const newPaymentStatus = Math.abs(newPaidAmount - totalCost) < 0.01
          ? 'paid'
          : newPaidAmount > 0
          ? 'partial'
          : 'unpaid'

        await tx.repairJobOrder.update({
          where: { id: existing.jobOrderId },
          data: {
            paidAmount: newPaidAmount,
            paymentStatus: newPaymentStatus,
            updatedAt: new Date()
          }
        })
      }

      return payment
    })

    // Fetch complete payment with relations
    const completePayment = await prisma.serviceRepairPayment.findUnique({
      where: { id: result.id },
      select: {
        jobOrder: {
          select: {
            id: { select: { id: { select: { id: true, name: true } }, name: { select: { id: true, name: true } } } },
            jobOrderNumber: { select: { id: true, name: true } },
            customerName: { select: { id: true, name: true } },
            totalCost: { select: { id: true, name: true } },
            paidAmount: { select: { id: true, name: true } },
            paymentStatus: { select: { id: true, name: true } }
          }
        },
        customer: { select: { id: true, name: true } },
        receivedByUser: {
          select: {
            id: { select: { id: true, name: true } },
            username: { select: { id: true, name: true } },
            firstName: { select: { id: true, name: true } },
            lastName: { select: { id: true, name: true } }
          }
        },
        voidedByUser: {
          select: {
            id: { select: { id: true, name: true } },
            username: { select: { id: true, name: true } },
            firstName: { select: { id: true, name: true } },
            lastName: { select: { id: true, name: true } }
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
      message: 'Payment voided successfully'
    })
  } catch (error) {
    console.error('Error voiding payment:', error)
    return NextResponse.json({ error: 'Failed to void payment' }, { status: 500 })
  }
}
