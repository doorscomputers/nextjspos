import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { PERMISSIONS } from '@/lib/rbac'

// POST /api/job-orders/[id]/complete - Mark job order as complete
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
    if (!user.permissions?.includes(PERMISSIONS.REPAIR_JOB_COMPLETE)) {
      return NextResponse.json({ error: 'Forbidden - Insufficient permissions' }, { status: 403 })
    }

    const jobOrderId = parseInt(params.id)
    const body = await request.json()
    const { completionNotes } = body

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

    // Cannot complete already completed job orders
    if (existing.status === 'completed') {
      return NextResponse.json({
        error: 'Job order is already completed'
      }, { status: 400 })
    }

    // Complete job order in transaction
    const result = await prisma.$transaction(async (tx) => {
      // Update job order
      const jobOrder = await tx.repairJobOrder.update({
        where: { id: jobOrderId },
        data: {
          status: 'completed',
          completionNotes,
          completedBy: parseInt(userId),
          completedAt: new Date(),
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
          warrantyClaim: true
        }
      })

      // Decrement technician job count and update stats
      if (jobOrder.technicianId) {
        const technician = await tx.serviceTechnician.findUnique({
          where: { id: jobOrder.technicianId }
        })

        if (technician) {
          // Calculate repair time in hours
          const startTime = jobOrder.createdAt
          const endTime = new Date()
          const repairTime = (endTime.getTime() - startTime.getTime()) / (1000 * 60 * 60)

          // Update technician stats
          const totalJobs = technician.totalJobsCompleted + 1
          const currentAvgTime = Number(technician.averageRepairTime || 0)
          const newAvgTime = (currentAvgTime * technician.totalJobsCompleted + repairTime) / totalJobs

          await tx.serviceTechnician.update({
            where: { id: jobOrder.technicianId },
            data: {
              currentJobCount: Math.max(0, technician.currentJobCount - 1),
              totalJobsCompleted: totalJobs,
              averageRepairTime: newAvgTime
            }
          })
        }
      }

      // Update warranty claim status if linked
      if (jobOrder.warrantyClaimId) {
        await tx.serviceWarrantyClaim.update({
          where: { id: jobOrder.warrantyClaimId },
          data: {
            status: 'completed',
            completedAt: new Date()
          }
        })
      }

      return jobOrder
    })

    // Serialize Decimal fields
    const serializedJobOrder = {
      ...result,
      laborCost: Number(result.laborCost),
      partsCost: Number(result.partsCost),
      taxAmount: Number(result.taxAmount),
      totalCost: Number(result.totalCost),
      paidAmount: Number(result.paidAmount)
    }

    return NextResponse.json({
      jobOrder: serializedJobOrder,
      message: 'Job order completed successfully'
    })
  } catch (error) {
    console.error('Error completing job order:', error)
    return NextResponse.json({ error: 'Failed to complete job order' }, { status: 500 })
  }
}
