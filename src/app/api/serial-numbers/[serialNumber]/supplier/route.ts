import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth.simple'
import { prisma } from '@/lib/prisma.simple'

/**
 * GET /api/serial-numbers/[serialNumber]/supplier
 * Get supplier information for a serial number
 * CRITICAL: Used for warranty claims to know which supplier to return defective items to
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ serialNumber: string }> }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = session.user as any
    const businessId = user.businessId
    const { serialNumber } = await params

    if (!serialNumber) {
      return NextResponse.json(
        { error: 'Serial number is required' },
        { status: 400 }
      )
    }

    // Find the serial number with supplier info
    const serialNumberRecord = await prisma.productSerialNumber.findUnique({
      where: {
        businessId_serialNumber: {
          businessId: parseInt(businessId),
          serialNumber: serialNumber.trim(),
        },
      },
      include: {
        supplier: {
          select: {
            id: true,
            name: true,
            contactPerson: true,
            email: true,
            mobile: true,
            address: true,
            city: true,
            state: true,
            country: true,
            paymentTerms: true,
          },
        },
        purchaseReceipt: {
          select: {
            id: true,
            receiptNumber: true,
            receiptDate: true,
          },
        },
      },
    })

    if (!serialNumberRecord) {
      return NextResponse.json(
        { error: 'Serial number not found' },
        { status: 404 }
      )
    }

    // Check warranty status
    const isUnderWarranty = serialNumberRecord.warrantyEndDate
      ? serialNumberRecord.warrantyEndDate >= new Date()
      : false

    return NextResponse.json({
      serialNumber: serialNumberRecord.serialNumber,
      status: serialNumberRecord.status,
      condition: serialNumberRecord.condition,
      purchasedAt: serialNumberRecord.purchasedAt,
      purchaseCost: serialNumberRecord.purchaseCost,
      warrantyStartDate: serialNumberRecord.warrantyStartDate,
      warrantyEndDate: serialNumberRecord.warrantyEndDate,
      isUnderWarranty,
      supplier: serialNumberRecord.supplier,
      purchaseReceipt: serialNumberRecord.purchaseReceipt,
      soldAt: serialNumberRecord.soldAt,
      soldTo: serialNumberRecord.soldTo,
    })
  } catch (error: any) {
    console.error('Error fetching supplier for serial number:', error)
    return NextResponse.json(
      {
        error: 'Failed to fetch supplier information',
        details: error.message,
      },
      { status: 500 }
    )
  }
}
