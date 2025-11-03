import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth.simple'
import { prisma } from '@/lib/prisma.simple'
import { PERMISSIONS } from '@/lib/rbac'
import { createAuditLog, AuditAction, EntityType, getIpAddress, getUserAgent } from '@/lib/auditLog'

/**
 * POST /api/warranty-claims/[id]/create-supplier-return
 * Auto-generate supplier return for warranty claim
 * Automatically identifies the correct supplier from the serial number
 */
export async function POST(
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
    const userId = user.id
    const { id: claimId } = await params

    // Check permission
    if (!user.permissions?.includes(PERMISSIONS.SUPPLIER_RETURN_CREATE)) {
      return NextResponse.json(
        { error: 'Forbidden - Requires SUPPLIER_RETURN_CREATE permission' },
        { status: 403 }
      )
    }

    // Get warranty claim details
    const warrantyClaim = await prisma.warrantyClaim.findFirst({
      where: {
        id: parseInt(claimId),
        businessId: parseInt(businessId),
      },
      include: {
        sale: {
          select: {
            locationId: true,
          },
        },
      },
    })

    if (!warrantyClaim) {
      return NextResponse.json(
        { error: 'Warranty claim not found' },
        { status: 404 }
      )
    }

    // Check if claim is valid for supplier return
    if (warrantyClaim.status === 'rejected') {
      return NextResponse.json(
        { error: 'Cannot create supplier return for rejected warranty claim' },
        { status: 400 }
      )
    }

    if (!warrantyClaim.serialNumber) {
      return NextResponse.json(
        { error: 'Warranty claim does not have a serial number' },
        { status: 400 }
      )
    }

    // Get serial number with supplier info
    const serialNumberRecord = await prisma.productSerialNumber.findUnique({
      where: {
        businessId_serialNumber: {
          businessId: parseInt(businessId),
          serialNumber: warrantyClaim.serialNumber,
        },
      },
      include: {
        supplier: true,
      },
    })

    if (!serialNumberRecord) {
      return NextResponse.json(
        { error: 'Serial number not found in system' },
        { status: 404 }
      )
    }

    if (!serialNumberRecord.supplierId || !serialNumberRecord.supplier) {
      return NextResponse.json(
        {
          error: 'Serial number does not have supplier information',
          hint: 'This item may have been added before supplier tracking was implemented',
        },
        { status: 400 }
      )
    }

    // Check if supplier return already exists for this claim
    const existingReturn = await prisma.supplierReturn.findFirst({
      where: {
        businessId: parseInt(businessId),
        notes: {
          contains: `Warranty Claim: ${warrantyClaim.claimNumber}`,
        },
        deletedAt: null,
      },
    })

    if (existingReturn) {
      return NextResponse.json(
        {
          error: 'Supplier return already exists for this warranty claim',
          supplierReturnId: existingReturn.id,
          returnNumber: existingReturn.returnNumber,
        },
        { status: 400 }
      )
    }

    // Generate supplier return number
    const year = new Date().getFullYear()
    const month = String(new Date().getMonth() + 1).padStart(2, '0')

    const lastReturn = await prisma.supplierReturn.findFirst({
      where: {
        businessId: parseInt(businessId),
        returnNumber: {
          startsWith: `SR-${year}${month}`,
        },
      },
      orderBy: {
        returnNumber: 'desc',
      },
    })

    let nextNumber = 1
    if (lastReturn) {
      const lastNum = parseInt(lastReturn.returnNumber.split('-')[2])
      nextNumber = lastNum + 1
    }

    const returnNumber = `SR-${year}${month}-${String(nextNumber).padStart(4, '0')}`

    // Create supplier return in transaction
    const supplierReturn = await prisma.$transaction(async (tx) => {
      // Create supplier return
      const supplierReturn = await tx.supplierReturn.create({
        data: {
          businessId: parseInt(businessId),
          locationId: warrantyClaim.sale.locationId,
          supplierId: serialNumberRecord.supplierId!,
          returnNumber,
          returnDate: new Date(),
          returnReason: 'warranty',
          status: 'pending',
          totalAmount: serialNumberRecord.purchaseCost || 0,
          notes: `Auto-generated from Warranty Claim: ${warrantyClaim.claimNumber}\nIssue: ${warrantyClaim.issueDescription}\nSerial Number: ${warrantyClaim.serialNumber}`,
          createdBy: parseInt(userId),
        },
      })

      // Create return item
      await tx.supplierReturnItem.create({
        data: {
          supplierReturnId: supplierReturn.id,
          productId: warrantyClaim.productId,
          productVariationId: warrantyClaim.productVariationId,
          quantity: 1,
          unitCost: serialNumberRecord.purchaseCost || 0,
          serialNumbers: [warrantyClaim.serialNumber],
          condition: 'warranty_claim',
          notes: `Defective - ${warrantyClaim.issueDescription}`,
        },
      })

      // Update warranty claim status
      await tx.warrantyClaim.update({
        where: { id: warrantyClaim.id },
        data: {
          status: 'returned_to_supplier',
          notes: warrantyClaim.notes
            ? `${warrantyClaim.notes}\n\nSupplier Return Created: ${returnNumber}`
            : `Supplier Return Created: ${returnNumber}`,
        },
      })

      // Update serial number status
      await tx.productSerialNumber.update({
        where: { id: serialNumberRecord.id },
        data: {
          status: 'warranty_return',
        },
      })

      return supplierReturn
    })

    // Create audit log
    await createAuditLog({
      businessId: parseInt(businessId),
      userId: parseInt(userId),
      username: user.username,
      action: 'supplier_return_create' as AuditAction,
      entityType: EntityType.PURCHASE,
      entityIds: [supplierReturn.id],
      description: `Created supplier return ${returnNumber} from warranty claim ${warrantyClaim.claimNumber}`,
      metadata: {
        supplierReturnId: supplierReturn.id,
        returnNumber: supplierReturn.returnNumber,
        warrantyClaimId: warrantyClaim.id,
        claimNumber: warrantyClaim.claimNumber,
        supplierId: serialNumberRecord.supplierId,
        supplierName: serialNumberRecord.supplier.name,
        serialNumber: warrantyClaim.serialNumber,
        productId: warrantyClaim.productId,
        reason: warrantyClaim.issueDescription,
      },
      ipAddress: getIpAddress(request),
      userAgent: getUserAgent(request),
    })

    return NextResponse.json({
      success: true,
      message: 'Supplier return created successfully',
      supplierReturn: {
        id: supplierReturn.id,
        returnNumber: supplierReturn.returnNumber,
        supplierId: supplierReturn.supplierId,
        supplierName: serialNumberRecord.supplier.name,
        status: supplierReturn.status,
        returnDate: supplierReturn.returnDate,
        totalAmount: supplierReturn.totalAmount,
      },
    })
  } catch (error: any) {
    console.error('Error creating supplier return from warranty claim:', error)
    return NextResponse.json(
      {
        error: 'Failed to create supplier return',
        details: error.message,
      },
      { status: 500 }
    )
  }
}
