import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { PERMISSIONS } from '@/lib/rbac'

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
    const businessId = user.businessId

    if (!businessId) {
      return NextResponse.json({ error: 'No business associated with user' }, { status: 400 })
    }

    // Check permission
    if (!user.permissions?.includes(PERMISSIONS.REPAIR_JOB_VIEW)) {
      return NextResponse.json({ error: 'Forbidden - Insufficient permissions' }, { status: 403 })
    }

    const jobOrderId = parseInt(params.id)

    const jobOrder = await prisma.repairJobOrder.findFirst({
      where: {
        id: jobOrderId,
        businessId: parseInt(businessId)
      },
      select: {
        customer: { select: { id: { select: { id: true, name: true } }, name: { select: { id: true, name: true } } } },
        product: { select: { id: true, name: true } },
        productVariation: { select: { id: true, name: true } },
        serviceType: { select: { id: true, name: true } },
        technician: {
          select: {
            employee: { select: { id: { select: { id: true, name: true } }, name: { select: { id: true, name: true } } } }
          }
        },
        location: { select: { id: true, name: true } },
        warrantyClaim: {
          select: {
            serialNumber: { select: { id: { select: { id: true, name: true } }, name: { select: { id: true, name: true } } } }
          }
        },
        parts: {
          select: {
            product: {
              select: {
                id: { select: { id: { select: { id: true, name: true } }, name: { select: { id: true, name: true } } } },
                name: { select: { id: true, name: true } },
                sku: { select: { id: true, name: true } }
              }
            },
            productVariation: {
              select: {
                id: { select: { id: true, name: true } },
                name: { select: { id: true, name: true } },
                sku: { select: { id: true, name: true } }
              }
            }
          }
        },
        payments: {
          select: {
            receivedByUser: {
              select: {
                id: { select: { id: { select: { id: true, name: true } }, name: { select: { id: true, name: true } } } },
                username: { select: { id: true, name: true } },
                firstName: { select: { id: true, name: true } },
                lastName: { select: { id: true, name: true } }
              }
            }
          }
        },
        creator: {
          select: {
            id: { select: { id: true, name: true } },
            username: { select: { id: true, name: true } },
            firstName: { select: { id: true, name: true } },
            lastName: { select: { id: true, name: true } }
          }
        },
        completedByUser: {
          select: {
            id: { select: { id: true, name: true } },
            username: { select: { id: true, name: true } },
            firstName: { select: { id: true, name: true } },
            lastName: { select: { id: true, name: true } }
          }
        },
        qualityCheckedByUser: {
          select: {
            id: { select: { id: true, name: true } },
            username: { select: { id: true, name: true } },
            firstName: { select: { id: true, name: true } },
            lastName: { select: { id: true, name: true } }
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
      taxAmount: Number(jobOrder.taxAmount),
      totalCost: Number(jobOrder.totalCost),
      paidAmount: Number(jobOrder.paidAmount),
      parts: jobOrder.parts.map(part => ({
        ...part,
        quantity: Number(part.quantity),
        unitPrice: Number(part.unitPrice),
        subtotal: Number(part.subtotal)
      })),
      payments: jobOrder.payments.map(payment => ({
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

    const {
      customerName,
      customerPhone,
      customerEmail,
      issueDescription,
      priority,
      expectedCompletionDate,
      internalNotes
    } = body

    // Update job order
    const jobOrder = await prisma.repairJobOrder.update({
      where: { id: jobOrderId },
      data: {
        ...(customerName !== undefined && { customerName }),
        ...(customerPhone !== undefined && { customerPhone }),
        ...(customerEmail !== undefined && { customerEmail }),
        ...(issueDescription !== undefined && { issueDescription }),
        ...(priority !== undefined && { priority }),
        ...(expectedCompletionDate !== undefined && {
          expectedCompletionDate: expectedCompletionDate ? new Date(expectedCompletionDate) : null
        }),
        ...(internalNotes !== undefined && { internalNotes }),
        updatedAt: new Date()
      },
      select: {
        customer: { select: { id: { select: { id: true, name: true } }, name: { select: { id: true, name: true } } } },
        product: { select: { id: true, name: true } },
        productVariation: { select: { id: true, name: true } },
        serviceType: { select: { id: true, name: true } },
        technician: {
          select: {
            employee: { select: { id: { select: { id: true, name: true } }, name: { select: { id: true, name: true } } } }
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
    const businessId = user.businessId

    if (!businessId) {
      return NextResponse.json({ error: 'No business associated with user' }, { status: 400 })
    }

    // Check permission
    if (!user.permissions?.includes(PERMISSIONS.REPAIR_JOB_DELETE)) {
      return NextResponse.json({ error: 'Forbidden - Insufficient permissions' }, { status: 403 })
    }

    const jobOrderId = parseInt(params.id)

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
