import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth.simple'
import { prisma } from '@/lib/prisma'
import { PERMISSIONS } from '@/lib/rbac'

// POST /api/job-orders/[id]/quality-check - Perform QC approval
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
    if (!user.permissions?.includes(PERMISSIONS.REPAIR_JOB_QC)) {
      return NextResponse.json({ error: 'Forbidden - Insufficient permissions' }, { status: 403 })
    }

    const jobOrderId = parseInt(params.id)
    const body = await request.json()
    const { qualityCheckNotes, passed } = body

    if (passed === undefined) {
      return NextResponse.json({ error: 'passed (boolean) is required' }, { status: 400 })
    }

    // Verify job order belongs to user's business
    const existing = await prisma.repairJobOrder.findFirst({
      where: {
        id: jobOrderId,
        businessId: parseInt(businessId)
      }
    })

    if (!existing) {
      return NextResponse.json({ error: 'Job order not found' }, { status: 404 })
    }

    // Can only QC completed job orders
    if (existing.status !== 'completed') {
      return NextResponse.json({
        error: 'Can only perform quality check on completed job orders'
      }, { status: 400 })
    }

    // Update job order with QC results
    const jobOrder = await prisma.repairJobOrder.update({
      where: { id: jobOrderId },
      data: {
        qualityCheckNotes,
        qualityCheckPassed: passed,
        qualityCheckedBy: parseInt(userId),
        qualityCheckedAt: new Date(),
        updatedAt: new Date()
      },
      include: {
        customer: true,
        product: true,
        serviceType: true,
        technician: {
          include: {
            employee: true
          }
        },
        qualityCheckedByUser: {
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
    const serializedJobOrder = {
      ...jobOrder,
      laborCost: Number(jobOrder.laborCost),
      partsCost: Number(jobOrder.partsCost),
      taxAmount: Number(jobOrder.taxAmount),
      totalCost: Number(jobOrder.totalCost),
      paidAmount: Number(jobOrder.paidAmount)
    }

    return NextResponse.json({
      jobOrder: serializedJobOrder,
      message: `Quality check ${passed ? 'passed' : 'failed'} successfully`
    })
  } catch (error) {
    console.error('Error performing quality check:', error)
    return NextResponse.json({ error: 'Failed to perform quality check' }, { status: 500 })
  }
}
