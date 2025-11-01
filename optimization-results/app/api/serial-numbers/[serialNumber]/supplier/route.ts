import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

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
      select: {
        supplier: {
          select: {
            id: { select: { id: { select: { id: true, name: true } }, name: { select: { id: true, name: true } } } },
            name: { select: { id: true, name: true } },
            contactPerson: { select: { id: true, name: true } },
            email: { select: { id: true, name: true } },
            mobile: { select: { id: true, name: true } },
            address: { select: { id: true, name: true } },
            city: { select: { id: true, name: true } },
            state: { select: { id: true, name: true } },
            country: { select: { id: true, name: true } },
            paymentTerms: { select: { id: true, name: true } },
          },
        },
        purchaseReceipt: {
          select: {
            id: { select: { id: true, name: true } },
            receiptNumber: { select: { id: true, name: true } },
            receiptDate: { select: { id: true, name: true } },
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
