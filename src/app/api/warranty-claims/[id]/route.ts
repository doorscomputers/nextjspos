import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth.simple'
import { prisma } from '@/lib/prisma'
import { PERMISSIONS } from '@/lib/rbac'

// GET /api/warranty-claims/[id] - Get single warranty claim
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
    const userId = user.id

    if (!businessId) {
      return NextResponse.json({ error: 'No business associated with user' }, { status: 400 })
    }

    // Check permission
    const canViewAll = user.permissions?.includes(PERMISSIONS.WARRANTY_CLAIM_VIEW)
    const canViewOwn = user.permissions?.includes(PERMISSIONS.WARRANTY_CLAIM_VIEW_OWN)

    if (!canViewAll && !canViewOwn) {
      return NextResponse.json({ error: 'Forbidden - Insufficient permissions' }, { status: 403 })
    }

    const claimId = parseInt(params.id)

    const claim = await prisma.serviceWarrantyClaim.findFirst({
      where: {
        id: claimId,
        businessId: parseInt(businessId),
        deletedAt: null
      },
      include: {
        customer: true,
        product: true,
        productVariation: true,
        serialNumber: true,
        location: true,
        assignedTechnician: {
          include: {
            employee: true
          }
        },
        submitter: {
          select: {
            id: true,
            username: true,
            firstName: true,
            lastName: true
          }
        },
        acceptedByUser: {
          select: {
            id: true,
            username: true,
            firstName: true,
            lastName: true
          }
        },
        inspectedByUser: {
          select: {
            id: true,
            username: true,
            firstName: true,
            lastName: true
          }
        },
        assignedByUser: {
          select: {
            id: true,
            username: true,
            firstName: true,
            lastName: true
          }
        },
        approvedByUser: {
          select: {
            id: true,
            username: true,
            firstName: true,
            lastName: true
          }
        },
        rejectedByUser: {
          select: {
            id: true,
            username: true,
            firstName: true,
            lastName: true
          }
        },
        jobOrders: {
          include: {
            serviceType: true,
            technician: {
              include: {
                employee: true
              }
            }
          }
        }
      }
    })

    if (!claim) {
      return NextResponse.json({ error: 'Warranty claim not found' }, { status: 404 })
    }

    // If user can only view own, verify they submitted it
    if (canViewOwn && !canViewAll && claim.submittedBy !== parseInt(userId)) {
      return NextResponse.json({ error: 'Forbidden - You can only view your own claims' }, { status: 403 })
    }

    // Serialize Decimal fields
    const serializedClaim = {
      ...claim,
      laborCost: claim.laborCost ? Number(claim.laborCost) : null,
      partsCost: claim.partsCost ? Number(claim.partsCost) : null,
      totalCost: claim.totalCost ? Number(claim.totalCost) : null,
      jobOrders: claim.jobOrders.map(job => ({
        ...job,
        laborCost: Number(job.laborCost),
        partsCost: Number(job.partsCost),
        taxAmount: Number(job.taxAmount),
        totalCost: Number(job.totalCost),
        paidAmount: Number(job.paidAmount)
      }))
    }

    return NextResponse.json({ claim: serializedClaim })
  } catch (error) {
    console.error('Error fetching warranty claim:', error)
    return NextResponse.json({ error: 'Failed to fetch warranty claim' }, { status: 500 })
  }
}

// PUT /api/warranty-claims/[id] - Update warranty claim
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
    if (!user.permissions?.includes(PERMISSIONS.WARRANTY_CLAIM_UPDATE)) {
      return NextResponse.json({ error: 'Forbidden - Insufficient permissions' }, { status: 403 })
    }

    const claimId = parseInt(params.id)
    const body = await request.json()

    // Verify claim belongs to user's business
    const existing = await prisma.serviceWarrantyClaim.findFirst({
      where: {
        id: claimId,
        businessId: parseInt(businessId),
        deletedAt: null
      }
    })

    if (!existing) {
      return NextResponse.json({ error: 'Warranty claim not found' }, { status: 404 })
    }

    const {
      customerName,
      customerPhone,
      customerEmail,
      issueDescription,
      priority,
      expectedDeliveryDate,
      internalNotes
    } = body

    // Update claim
    const claim = await prisma.serviceWarrantyClaim.update({
      where: { id: claimId },
      data: {
        ...(customerName !== undefined && { customerName }),
        ...(customerPhone !== undefined && { customerPhone }),
        ...(customerEmail !== undefined && { customerEmail }),
        ...(issueDescription !== undefined && { issueDescription }),
        ...(priority !== undefined && { priority }),
        ...(expectedDeliveryDate !== undefined && { expectedDeliveryDate: expectedDeliveryDate ? new Date(expectedDeliveryDate) : null }),
        ...(internalNotes !== undefined && { internalNotes }),
        updatedAt: new Date()
      },
      include: {
        customer: true,
        product: true,
        productVariation: true,
        serialNumber: true,
        location: true
      }
    })

    // Serialize Decimal fields
    const serializedClaim = {
      ...claim,
      laborCost: claim.laborCost ? Number(claim.laborCost) : null,
      partsCost: claim.partsCost ? Number(claim.partsCost) : null,
      totalCost: claim.totalCost ? Number(claim.totalCost) : null
    }

    return NextResponse.json({
      claim: serializedClaim,
      message: 'Warranty claim updated successfully'
    })
  } catch (error) {
    console.error('Error updating warranty claim:', error)
    return NextResponse.json({ error: 'Failed to update warranty claim' }, { status: 500 })
  }
}

// DELETE /api/warranty-claims/[id] - Soft delete warranty claim
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
    if (!user.permissions?.includes(PERMISSIONS.WARRANTY_CLAIM_DELETE)) {
      return NextResponse.json({ error: 'Forbidden - Insufficient permissions' }, { status: 403 })
    }

    const claimId = parseInt(params.id)

    // Verify claim belongs to user's business
    const existing = await prisma.serviceWarrantyClaim.findFirst({
      where: {
        id: claimId,
        businessId: parseInt(businessId),
        deletedAt: null
      }
    })

    if (!existing) {
      return NextResponse.json({ error: 'Warranty claim not found' }, { status: 404 })
    }

    // Cannot delete if there are job orders
    const jobOrdersCount = await prisma.repairJobOrder.count({
      where: { warrantyClaimId: claimId }
    })

    if (jobOrdersCount > 0) {
      return NextResponse.json({
        error: 'Cannot delete warranty claim with associated job orders'
      }, { status: 400 })
    }

    // Soft delete
    await prisma.serviceWarrantyClaim.update({
      where: { id: claimId },
      data: {
        deletedAt: new Date()
      }
    })

    return NextResponse.json({ message: 'Warranty claim deleted successfully' })
  } catch (error) {
    console.error('Error deleting warranty claim:', error)
    return NextResponse.json({ error: 'Failed to delete warranty claim' }, { status: 500 })
  }
}
