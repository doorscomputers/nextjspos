import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { PERMISSIONS } from '@/lib/rbac'

// POST /api/warranty-claims/[id]/inspect - Conduct inspection/diagnosis
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
    if (!user.permissions?.includes(PERMISSIONS.WARRANTY_CLAIM_INSPECT)) {
      return NextResponse.json({ error: 'Forbidden - Insufficient permissions' }, { status: 403 })
    }

    const claimId = parseInt(params.id)
    const body = await request.json()
    const { diagnosisNotes, inspectionFindings, estimatedLaborCost, estimatedPartsCost } = body

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

    // Can inspect if accepted or already under inspection
    if (!['accepted', 'under_inspection'].includes(existing.status)) {
      return NextResponse.json({
        error: `Cannot inspect claim in ${existing.status} status. Claim must be accepted first.`
      }, { status: 400 })
    }

    // Calculate total estimated cost
    const laborCost = estimatedLaborCost ? parseFloat(estimatedLaborCost) : 0
    const partsCost = estimatedPartsCost ? parseFloat(estimatedPartsCost) : 0
    const totalCost = laborCost + partsCost

    // Update claim with inspection details
    const claim = await prisma.serviceWarrantyClaim.update({
      where: { id: claimId },
      data: {
        status: 'diagnosed',
        diagnosisNotes: diagnosisNotes || existing.diagnosisNotes,
        inspectionFindings: inspectionFindings || existing.inspectionFindings,
        laborCost: estimatedLaborCost !== undefined ? laborCost : existing.laborCost,
        partsCost: estimatedPartsCost !== undefined ? partsCost : existing.partsCost,
        totalCost: estimatedLaborCost !== undefined || estimatedPartsCost !== undefined ? totalCost : existing.totalCost,
        inspectedBy: parseInt(userId),
        inspectedAt: new Date(),
        updatedAt: new Date()
      },
      include: {
        customer: true,
        product: true,
        productVariation: true,
        serialNumber: true,
        inspectedByUser: {
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
      message: 'Warranty claim inspection completed successfully'
    })
  } catch (error) {
    console.error('Error inspecting warranty claim:', error)
    return NextResponse.json({ error: 'Failed to inspect warranty claim' }, { status: 500 })
  }
}
