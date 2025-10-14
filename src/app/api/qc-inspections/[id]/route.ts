import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { PERMISSIONS } from '@/lib/rbac'

/**
 * GET /api/qc-inspections/[id]
 * Get a specific quality control inspection
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = session.user as any
    const businessId = user.businessId

    // Check permission
    if (!user.permissions?.includes(PERMISSIONS.QC_INSPECTION_VIEW)) {
      return NextResponse.json({ error: 'Forbidden - Insufficient permissions' }, { status: 403 })
    }

    const { id } = await params
    const inspectionId = parseInt(id)

    // Fetch inspection
    const inspection = await prisma.qualityControlInspection.findFirst({
      where: {
        id: inspectionId,
        businessId: parseInt(businessId),
      },
      include: {
        purchaseReceipt: {
          include: {
            purchase: {
              include: {
                supplier: true,
              },
            },
          },
        },
        items: {
          include: {
            product: true,
            productVariation: true,
          },
        },
        checkItems: {
          orderBy: {
            checkCategory: 'asc',
          },
        },
      },
    })

    if (!inspection) {
      return NextResponse.json(
        { error: 'QC inspection not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      data: inspection,
    })
  } catch (error: any) {
    console.error('Error fetching QC inspection:', error)
    return NextResponse.json(
      { error: 'Failed to fetch QC inspection', details: error.message },
      { status: 500 }
    )
  }
}
