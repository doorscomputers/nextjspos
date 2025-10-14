import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

/**
 * Quick Serial Number Lookup for Warranty Claims
 * GET /api/serial-numbers/lookup?serial=SN12345
 *
 * Returns: Supplier info + Date received for warranty processing
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = session.user as any
    const businessId = parseInt(user.businessId)

    // Get serial number from query
    const searchParams = request.nextUrl.searchParams
    const serialNumber = searchParams.get('serial')

    if (!serialNumber || serialNumber.trim() === '') {
      return NextResponse.json(
        { error: 'Serial number is required' },
        { status: 400 }
      )
    }

    // Search for serial number
    const serialRecord = await prisma.productSerialNumber.findUnique({
      where: {
        businessId_serialNumber: {
          businessId,
          serialNumber: serialNumber.trim(),
        },
      },
      include: {
        product: {
          select: {
            id: true,
            name: true,
            sku: true,
          },
        },
        productVariation: {
          select: {
            id: true,
            name: true,
          },
        },
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
        currentLocation: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    })

    if (!serialRecord) {
      return NextResponse.json(
        {
          error: 'Serial number not found',
          message: `Serial number "${serialNumber}" does not exist in the system or belongs to a different business.`
        },
        { status: 404 }
      )
    }

    // Calculate warranty status
    const isUnderWarranty = serialRecord.warrantyEndDate
      ? serialRecord.warrantyEndDate >= new Date()
      : false

    const warrantyExpired = serialRecord.warrantyEndDate
      ? serialRecord.warrantyEndDate < new Date()
      : false

    // Return simplified response
    return NextResponse.json({
      success: true,
      data: {
        // Serial number info
        serialNumber: serialRecord.serialNumber,
        imei: serialRecord.imei,
        status: serialRecord.status,
        condition: serialRecord.condition,

        // Product info
        product: {
          id: serialRecord.product.id,
          name: serialRecord.product.name,
          sku: serialRecord.product.sku,
          variation: serialRecord.productVariation?.name || 'N/A',
        },

        // Supplier info (KEY for warranty returns!)
        supplier: serialRecord.supplier ? {
          id: serialRecord.supplier.id,
          name: serialRecord.supplier.name,
          contactPerson: serialRecord.supplier.contactPerson,
          email: serialRecord.supplier.email,
          mobile: serialRecord.supplier.mobile,
          address: serialRecord.supplier.address,
          city: serialRecord.supplier.city,
          state: serialRecord.supplier.state,
          country: serialRecord.supplier.country,
          paymentTerms: serialRecord.supplier.paymentTerms,
        } : null,

        // Date info
        dateReceived: serialRecord.purchasedAt,
        receiptNumber: serialRecord.purchaseReceipt?.receiptNumber || 'N/A',
        receiptDate: serialRecord.purchaseReceipt?.receiptDate || null,

        // Warranty info
        warranty: {
          isUnderWarranty,
          warrantyExpired,
          warrantyStartDate: serialRecord.warrantyStartDate,
          warrantyEndDate: serialRecord.warrantyEndDate,
        },

        // Current location
        currentLocation: serialRecord.currentLocation ? {
          id: serialRecord.currentLocation.id,
          name: serialRecord.currentLocation.name,
        } : null,

        // Sale info (if sold)
        saleInfo: serialRecord.status === 'sold' ? {
          soldAt: serialRecord.soldAt,
          soldTo: serialRecord.soldTo,
          salePrice: serialRecord.salePrice,
        } : null,

        // Purchase cost
        purchaseCost: serialRecord.purchaseCost,
      },
    })

  } catch (error: any) {
    console.error('Serial number lookup error:', error)
    return NextResponse.json(
      {
        error: 'Failed to lookup serial number',
        details: error.message
      },
      { status: 500 }
    )
  }
}
