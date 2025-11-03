import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth.simple'
import { prisma } from '@/lib/prisma'
import { PERMISSIONS } from '@/lib/rbac'

// POST /api/job-orders/[id]/estimate - Update cost estimate
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

    if (!businessId) {
      return NextResponse.json({ error: 'No business associated with user' }, { status: 400 })
    }

    // Check permission
    if (!user.permissions?.includes(PERMISSIONS.REPAIR_JOB_UPDATE)) {
      return NextResponse.json({ error: 'Forbidden - Insufficient permissions' }, { status: 403 })
    }

    const jobOrderId = parseInt(params.id)
    const body = await request.json()
    const { laborCost, taxRate } = body

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

    // Cannot update estimate for completed job orders
    if (existing.status === 'completed') {
      return NextResponse.json({
        error: 'Cannot update estimate for completed job orders'
      }, { status: 400 })
    }

    // Calculate new totals
    const labor = laborCost !== undefined ? parseFloat(laborCost) : Number(existing.laborCost)
    const parts = Number(existing.partsCost)
    const rate = taxRate !== undefined ? parseFloat(taxRate) : existing.taxRate
    const tax = rate ? ((labor + parts) * rate / 100) : Number(existing.taxAmount)
    const total = labor + parts + tax

    // Update job order
    const jobOrder = await prisma.repairJobOrder.update({
      where: { id: jobOrderId },
      data: {
        ...(laborCost !== undefined && { laborCost: labor }),
        ...(taxRate !== undefined && { taxRate: rate }),
        taxAmount: tax,
        totalCost: total,
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
      message: 'Cost estimate updated successfully'
    })
  } catch (error) {
    console.error('Error updating cost estimate:', error)
    return NextResponse.json({ error: 'Failed to update cost estimate' }, { status: 500 })
  }
}
