import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth.simple'
import { prisma } from '@/lib/prisma'
import { PERMISSIONS } from '@/lib/rbac'

// POST /api/warranty-claims/[id]/approve - Approve warranty claim
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
    if (!user.permissions?.includes(PERMISSIONS.WARRANTY_CLAIM_APPROVE)) {
      return NextResponse.json({ error: 'Forbidden - Insufficient permissions' }, { status: 403 })
    }

    const claimId = parseInt(params.id)
    const body = await request.json()
    const { approvalNotes } = body

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

    // Must be diagnosed before approval
    if (existing.status !== 'diagnosed') {
      return NextResponse.json({
        error: `Cannot approve claim in ${existing.status} status. Claim must be diagnosed first.`
      }, { status: 400 })
    }

    // Approve claim
    const claim = await prisma.serviceWarrantyClaim.update({
      where: { id: claimId },
      data: {
        status: 'approved',
        approvalNotes,
        approvedBy: parseInt(userId),
        approvedAt: new Date(),
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
        approvedByUser: {
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
      message: 'Warranty claim approved successfully'
    })
  } catch (error) {
    console.error('Error approving warranty claim:', error)
    return NextResponse.json({ error: 'Failed to approve warranty claim' }, { status: 500 })
  }
}
