import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { PERMISSIONS } from '@/lib/rbac'

// POST /api/warranty-claims/[id]/accept - Accept claim for processing
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
    if (!user.permissions?.includes(PERMISSIONS.WARRANTY_CLAIM_ACCEPT)) {
      return NextResponse.json({ error: 'Forbidden - Insufficient permissions' }, { status: 403 })
    }

    const claimId = parseInt(params.id)

    // Verify claim belongs to user's business and is in pending status
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

    if (existing.status !== 'pending') {
      return NextResponse.json({
        error: `Cannot accept claim in ${existing.status} status. Only pending claims can be accepted.`
      }, { status: 400 })
    }

    // Accept claim
    const claim = await prisma.serviceWarrantyClaim.update({
      where: { id: claimId },
      data: {
        status: 'accepted',
        acceptedBy: parseInt(userId),
        acceptedAt: new Date(),
        updatedAt: new Date()
      },
      include: {
        customer: true,
        product: true,
        productVariation: true,
        serialNumber: true,
        acceptedByUser: {
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
      message: 'Warranty claim accepted successfully'
    })
  } catch (error) {
    console.error('Error accepting warranty claim:', error)
    return NextResponse.json({ error: 'Failed to accept warranty claim' }, { status: 500 })
  }
}
