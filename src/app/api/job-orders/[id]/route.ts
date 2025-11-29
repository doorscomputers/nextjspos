import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth.simple'
import { prisma } from '@/lib/prisma.simple'
import { PERMISSIONS, hasPermission } from '@/lib/rbac'

// GET /api/job-orders/[id] - Get single job order with parts and payments
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
    const businessId = parseInt(String(user.businessId))
    if (!businessId) {
      return NextResponse.json({ error: 'No business associated with user' }, { status: 400 })
    }

    // Check permission
    if (!hasPermission(user, PERMISSIONS.JOB_ORDER_VIEW)) {
      return NextResponse.json({ error: 'Forbidden - Insufficient permissions' }, { status: 403 })
    }

    const jobOrderId = parseInt(params.id)

    const jobOrder = await prisma.repairJobOrder.findFirst({
      where: {
        id: jobOrderId,
        businessId
      },
      include: {
        customer: true,
        product: true,
        productVariation: true,
        serviceType: true,
        technician: true,
        location: true,
        warrantyClaim: {
          include: {
            serialNumber: true
          }
        },
        jobOrderParts: {
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
            }
          }
        },
        repairPayments: {
          include: {
            receivedByUser: {
              select: {
                id: true,
                username: true,
                firstName: true,
                lastName: true
              }
            }
          }
        },
        creator: {
          select: {
            id: true,
            username: true,
            firstName: true,
            lastName: true
          }
        },
        completedByUser: {
          select: {
            id: true,
            username: true,
            firstName: true,
            lastName: true
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

    if (!jobOrder) {
      return NextResponse.json({ error: 'Job order not found' }, { status: 404 })
    }

    // Serialize Decimal fields
    const serializedJobOrder = {
      ...jobOrder,
      laborCost: Number(jobOrder.laborCost),
      partsCost: Number(jobOrder.partsCost),
      taxAmount: Number(jobOrder.tax),
      totalCost: Number(jobOrder.totalCost),
      paidAmount: Number(jobOrder.paidAmount),
      parts: jobOrder.jobOrderParts.map(part => ({
        ...part,
        quantity: Number(part.quantity),
        unitPrice: Number(part.unitPrice),
        subtotal: Number(part.subtotal)
      })),
      payments: jobOrder.repairPayments.map(payment => ({
        ...payment,
        amount: Number(payment.amount)
      }))
    }

    return NextResponse.json({ jobOrder: serializedJobOrder })
  } catch (error) {
    console.error('Error fetching job order:', error)
    return NextResponse.json({ error: 'Failed to fetch job order' }, { status: 500 })
  }
}

// PUT /api/job-orders/[id] - Update job order
export async function PUT(
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

    // Check permission
    if (!hasPermission(user, PERMISSIONS.JOB_ORDER_EDIT)) {
      return NextResponse.json({ error: 'Forbidden - Insufficient permissions' }, { status: 403 })
    }

    const jobOrderId = parseInt(params.id)
    const body = await request.json()

    // Verify job order belongs to user's business
    const existing = await prisma.repairJobOrder.findFirst({
      where: {
        id: jobOrderId,
        businessId
      }
    })

    if (!existing) {
      return NextResponse.json({ error: 'Job order not found' }, { status: 404 })
    }

    const {
      customerName,
      customerPhone,
      customerEmail,
      problemDescription,
      priority,
      estimatedEndDate,
      internalNotes
    } = body

    // Update job order
    const jobOrder = await prisma.repairJobOrder.update({
      where: { id: jobOrderId },
      data: {
        ...(customerName !== undefined && { customerName }),
        ...(customerPhone !== undefined && { customerPhone }),
        ...(customerEmail !== undefined && { customerEmail }),
        ...(problemDescription !== undefined && { problemDescription }),
        ...(priority !== undefined && { priority }),
        ...(estimatedEndDate !== undefined && {
          estimatedEndDate: estimatedEndDate ? new Date(estimatedEndDate) : null
        }),
        ...(internalNotes !== undefined && { internalNotes }),
        updatedAt: new Date()
      },
      include: {
        customer: true,
        product: true,
        productVariation: true,
        serviceType: true,
        technician: true
      }
    })

    // Serialize Decimal fields
    const serializedJobOrder = {
      ...jobOrder,
      laborCost: Number(jobOrder.laborCost),
      partsCost: Number(jobOrder.partsCost),
      taxAmount: Number(jobOrder.tax),
      totalCost: Number(jobOrder.totalCost),
      paidAmount: Number(jobOrder.paidAmount)
    }

    return NextResponse.json({
      jobOrder: serializedJobOrder,
      message: 'Job order updated successfully'
    })
  } catch (error) {
    console.error('Error updating job order:', error)
    return NextResponse.json({ error: 'Failed to update job order' }, { status: 500 })
  }
}

// DELETE /api/job-orders/[id] - Delete job order
export async function DELETE(
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

    // Check permission
    if (!hasPermission(user, PERMISSIONS.JOB_ORDER_DELETE)) {
      return NextResponse.json({ error: 'Forbidden - Insufficient permissions' }, { status: 403 })
    }

    const jobOrderId = parseInt(params.id)

    // Verify job order belongs to user's business
    const existing = await prisma.repairJobOrder.findFirst({
      where: {
        id: jobOrderId,
        businessId
      }
    })

    if (!existing) {
      return NextResponse.json({ error: 'Job order not found' }, { status: 404 })
    }

    // Cannot delete completed job orders
    if (existing.status === 'completed') {
      return NextResponse.json({
        error: 'Cannot delete completed job orders'
      }, { status: 400 })
    }

    // Check for payments
    const paymentsCount = await prisma.serviceRepairPayment.count({
      where: { jobOrderId }
    })

    if (paymentsCount > 0) {
      return NextResponse.json({
        error: 'Cannot delete job order with payments'
      }, { status: 400 })
    }

    // Delete in transaction
    await prisma.$transaction(async (tx) => {
      // Delete parts
      await tx.repairJobOrderPart.deleteMany({
        where: { jobOrderId }
      }, {
      timeout: 60000, // 60 seconds timeout for network resilience
    })

      // Delete job order
      await tx.repairJobOrder.delete({
        where: { id: jobOrderId }
      })

      // Decrement technician job count if assigned
      if (existing.technicianId) {
        await tx.serviceTechnician.update({
          where: { id: existing.technicianId },
          data: {
            currentJobCount: {
              decrement: 1
            }
          }
        })
      }
    })

    return NextResponse.json({ message: 'Job order deleted successfully' })
  } catch (error) {
    console.error('Error deleting job order:', error)
    return NextResponse.json({ error: 'Failed to delete job order' }, { status: 500 })
  }
}
