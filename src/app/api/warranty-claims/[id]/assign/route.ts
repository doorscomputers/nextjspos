import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth.simple'
import { prisma } from '@/lib/prisma.simple'
import { PERMISSIONS } from '@/lib/rbac'

// POST /api/warranty-claims/[id]/assign - Assign technician to claim
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
    const userId = user.id

    if (!businessId) {
      return NextResponse.json({ error: 'No business associated with user' }, { status: 400 })
    }

    // Check permission
    if (!user.permissions?.includes(PERMISSIONS.WARRANTY_CLAIM_ASSIGN)) {
      return NextResponse.json({ error: 'Forbidden - Insufficient permissions' }, { status: 403 })
    }

    const claimId = parseInt(params.id)
    const body = await request.json()
    const { technicianId } = body

    if (!technicianId) {
      return NextResponse.json({ error: 'technicianId is required' }, { status: 400 })
    }

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

    // Verify technician belongs to business and is available
    const technician = await prisma.serviceTechnician.findFirst({
      where: {
        id: parseInt(technicianId),
        businessId: parseInt(businessId),
        isAvailable: true,
        employee: {
          isActive: true,
          deletedAt: null
        }
      },
      include: {
        employee: true
      }
    })

    if (!technician) {
      return NextResponse.json({ error: 'Technician not found or not available' }, { status: 404 })
    }

    // Check if technician has capacity
    if (technician.currentJobCount >= technician.maxConcurrentJobs) {
      return NextResponse.json({
        error: `Technician has reached maximum concurrent jobs (${technician.maxConcurrentJobs})`
      }, { status: 400 })
    }

    // Assign technician
    const claim = await prisma.serviceWarrantyClaim.update({
      where: { id: claimId },
      data: {
        technicianId: parseInt(technicianId),
        assignedBy: parseInt(userId),
        assignedAt: new Date(),
        updatedAt: new Date()
      },
      include: {
        customer: true,
        product: true,
        productVariation: true,
        serialNumber: true,
        assignedTechnician: {
          include: {
            employee: true
          }
        },
        assignedByUser: {
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
    const serializedClaim = {
      ...claim,
      laborCost: claim.laborCost ? Number(claim.laborCost) : null,
      partsCost: claim.partsCost ? Number(claim.partsCost) : null,
      totalCost: claim.totalCost ? Number(claim.totalCost) : null
    }

    return NextResponse.json({
      claim: serializedClaim,
      message: 'Technician assigned successfully'
    })
  } catch (error) {
    console.error('Error assigning technician to warranty claim:', error)
    return NextResponse.json({ error: 'Failed to assign technician' }, { status: 500 })
  }
}
