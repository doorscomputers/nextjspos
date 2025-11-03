import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth.simple'
import { prisma } from '@/lib/prisma'
import { PERMISSIONS } from '@/lib/rbac'
import { createAuditLog, AuditAction, EntityType, getIpAddress, getUserAgent } from '@/lib/auditLog'

/**
 * GET /api/qc-inspections
 * List quality control inspections
 */
export async function GET(request: NextRequest) {
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

    // Get query parameters
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '50')
    const status = searchParams.get('status')
    const locationId = searchParams.get('locationId') ? parseInt(searchParams.get('locationId')!) : null
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')

    const skip = (page - 1) * limit

    // Build where clause
    const where: any = {
      businessId: parseInt(businessId),
    }

    if (status) {
      where.status = status
    }

    if (locationId) {
      where.locationId = parseInt(locationId)
    }

    if (startDate || endDate) {
      where.inspectionDate = {}
      if (startDate) {
        where.inspectionDate.gte = new Date(startDate)
      }
      if (endDate) {
        where.inspectionDate.lte = new Date(endDate)
      }
    }

    // Fetch inspections
    const [inspections, total] = await Promise.all([
      prisma.qualityControlInspection.findMany({
        where,
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
          _count: {
            select: {
              items: true,
              checkItems: true,
            },
          },
        },
        orderBy: {
          inspectionDate: 'desc',
        },
        skip,
        take: limit,
      }),
      prisma.qualityControlInspection.count({ where }),
    ])

    return NextResponse.json({
      success: true,
      data: inspections,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    })
  } catch (error: any) {
    console.error('Error fetching QC inspections:', error)
    return NextResponse.json(
      { error: 'Failed to fetch QC inspections', details: error.message },
      { status: 500 }
    )
  }
}

/**
 * POST /api/qc-inspections
 * Create a new quality control inspection
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = session.user as any
    const businessId = user.businessId
    const userId = user.id

    // Check permission
    if (!user.permissions?.includes(PERMISSIONS.QC_INSPECTION_CREATE)) {
      return NextResponse.json({ error: 'Forbidden - Insufficient permissions' }, { status: 403 })
    }

    const body = await request.json()
    const {
      purchaseReceiptId,
      locationId,
      inspectionDate,
    } = body

    // Validate required fields
    if (!purchaseReceiptId || !locationId) {
      return NextResponse.json(
        { error: 'Missing required fields: purchaseReceiptId, locationId' },
        { status: 400 }
      )
    }

    // Verify purchase receipt exists and belongs to this business
    const purchaseReceipt = await prisma.purchaseReceipt.findFirst({
      where: {
        id: parseInt(purchaseReceiptId),
        businessId: parseInt(businessId),
      },
      include: {
        purchase: {
          include: {
            supplier: true,
          },
        },
        items: {
          include: {
            product: true,
            productVariation: true,
          },
        },
      },
    })

    if (!purchaseReceipt) {
      return NextResponse.json(
        { error: 'Purchase receipt not found' },
        { status: 404 }
      )
    }

    // Check if inspection already exists for this receipt
    const existingInspection = await prisma.qualityControlInspection.findFirst({
      where: {
        purchaseReceiptId: parseInt(purchaseReceiptId),
        businessId: parseInt(businessId),
      },
    })

    if (existingInspection) {
      return NextResponse.json(
        { error: 'QC inspection already exists for this receipt', data: existingInspection },
        { status: 400 }
      )
    }

    // Generate inspection number
    const lastInspection = await prisma.qualityControlInspection.findFirst({
      where: { businessId: parseInt(businessId) },
      orderBy: { id: 'desc' },
      select: { inspectionNumber: true },
    })

    let nextNumber = 1
    if (lastInspection?.inspectionNumber) {
      const match = lastInspection.inspectionNumber.match(/QC-(\d+)/)
      if (match) {
        nextNumber = parseInt(match[1]) + 1
      }
    }
    const inspectionNumber = `QC-${nextNumber.toString().padStart(6, '0')}`

    // Create QC inspection with items
    const qcInspection = await prisma.qualityControlInspection.create({
      data: {
        businessId: parseInt(businessId),
        locationId: parseInt(locationId),
        purchaseReceiptId: parseInt(purchaseReceiptId),
        inspectionNumber,
        inspectionDate: inspectionDate ? new Date(inspectionDate) : new Date(),
        status: 'pending',
        inspectedBy: parseInt(userId),
        createdBy: parseInt(userId),
        items: {
          create: purchaseReceipt.items.map((item: any) => ({
            purchaseReceiptItemId: item.id,
            productId: item.productId,
            productVariationId: item.productVariationId,
            quantityOrdered: item.quantityOrdered,
            quantityReceived: item.quantityReceived,
            quantityInspected: 0,
            quantityPassed: 0,
            quantityFailed: 0,
            inspectionResult: 'pending',
          })),
        },
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
      },
    })

    // Create audit log
    await createAuditLog({
      businessId: parseInt(businessId),
      userId: parseInt(userId),
      username: user.username,
      action: 'qc_inspection_create' as AuditAction,
      entityType: EntityType.PURCHASE,
      entityIds: [qcInspection.id, parseInt(purchaseReceiptId)],
      description: `Created QC Inspection ${inspectionNumber} for GRN ${purchaseReceipt.grnNumber}`,
      metadata: {
        inspectionId: qcInspection.id,
        inspectionNumber,
        purchaseReceiptId: parseInt(purchaseReceiptId),
        grnNumber: purchaseReceipt.grnNumber,
        purchaseId: purchaseReceipt.purchaseId,
        supplierId: purchaseReceipt.purchase.supplierId,
        supplierName: purchaseReceipt.purchase.supplier.name,
      },
      ipAddress: getIpAddress(request),
      userAgent: getUserAgent(request),
    })

    return NextResponse.json({
      success: true,
      message: 'QC inspection created successfully',
      data: qcInspection,
    })
  } catch (error: any) {
    console.error('Error creating QC inspection:', error)
    return NextResponse.json(
      { error: 'Failed to create QC inspection', details: error.message },
      { status: 500 }
    )
  }
}
