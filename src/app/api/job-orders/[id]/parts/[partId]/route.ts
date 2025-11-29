import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth.simple'
import { prisma } from '@/lib/prisma.simple'
import { PERMISSIONS } from '@/lib/rbac'

// DELETE /api/job-orders/[id]/parts/[partId] - Remove part from job order
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string; partId: string } }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = session.user as any
    const businessId = parseInt(String(user.businessId))
    if (!businessId) {
      return NextResponse.json({ error: 'No business associated with user' }, { status: 400 })
    }

    // Check permission
    if (!user.permissions?.includes(PERMISSIONS.JOB_ORDER_ADD_PARTS)) {
      return NextResponse.json({ error: 'Forbidden - Insufficient permissions' }, { status: 403 })
    }

    const jobOrderId = parseInt(params.id)
    const partId = parseInt(params.partId)

    // Verify job order belongs to user's business
    const jobOrder = await prisma.repairJobOrder.findFirst({
      where: {
        id: jobOrderId,
        businessId: parseInt(businessId)
      }
    })

    if (!jobOrder) {
      return NextResponse.json({ error: 'Job order not found' }, { status: 404 })
    }

    // Cannot remove parts from completed job orders
    if (jobOrder.status === 'completed') {
      return NextResponse.json({
        error: 'Cannot remove parts from completed job orders'
      }, { status: 400 })
    }

    // Verify part belongs to job order
    const part = await prisma.repairJobOrderPart.findFirst({
      where: {
        id: partId,
        jobOrderId,
        businessId: parseInt(businessId)
      }
    })

    if (!part) {
      return NextResponse.json({ error: 'Part not found' }, { status: 404 })
    }

    // Delete part and recalculate job order costs in transaction
    await prisma.$transaction(async (tx) => {
      // Delete part
      await tx.repairJobOrderPart.delete({
        where: { id: partId }
      }, {
      timeout: 60000, // 60 seconds timeout for network resilience
    })

      // Recalculate job order costs
      const parts = await tx.repairJobOrderPart.findMany({
        where: { jobOrderId }
      })

      const partsCost = parts.reduce((sum, p) => sum + Number(p.subtotal), 0)
      const laborCost = Number(jobOrder.laborCost)
      const taxAmount = jobOrder.taxRate ? ((laborCost + partsCost) * jobOrder.taxRate / 100) : Number(jobOrder.taxAmount)
      const totalCost = laborCost + partsCost + taxAmount

      // Update job order
      await tx.repairJobOrder.update({
        where: { id: jobOrderId },
        data: {
          partsCost,
          taxAmount,
          totalCost,
          updatedAt: new Date()
        }
      })
    })

    return NextResponse.json({ message: 'Part removed successfully' })
  } catch (error) {
    console.error('Error removing part from job order:', error)
    return NextResponse.json({ error: 'Failed to remove part' }, { status: 500 })
  }
}
