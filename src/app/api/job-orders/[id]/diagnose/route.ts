import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth.simple'
import { prisma } from '@/lib/prisma.simple'
import { PERMISSIONS, hasPermission } from '@/lib/rbac'

// POST /api/job-orders/[id]/diagnose - Add diagnosis to job order
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
    const businessId = parseInt(String(user.businessId))
    if (!businessId) {
      return NextResponse.json({ error: 'No business associated with user' }, { status: 400 })
    }

    // Check permission (hasPermission includes Super Admin bypass)
    if (!hasPermission(user, PERMISSIONS.JOB_ORDER_DIAGNOSE)) {
      return NextResponse.json({ error: 'Forbidden - Insufficient permissions' }, { status: 403 })
    }

    const jobOrderId = parseInt(params.id)
    const body = await request.json()
    const { diagnosisNotes, repairNotes } = body

    if (!diagnosisNotes) {
      return NextResponse.json({ error: 'diagnosisNotes is required' }, { status: 400 })
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

    // Update job order with diagnosis
    const jobOrder = await prisma.repairJobOrder.update({
      where: { id: jobOrderId },
      data: {
        diagnosisNotes,
        repairNotes: repairNotes || existing.repairNotes,
        status: existing.status === 'pending' ? 'in_progress' : existing.status,
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
      message: 'Diagnosis added successfully'
    })
  } catch (error) {
    console.error('Error adding diagnosis to job order:', error)
    return NextResponse.json({ error: 'Failed to add diagnosis' }, { status: 500 })
  }
}
