import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const serialNumber = searchParams.get('serial')

    if (!serialNumber) {
      return NextResponse.json({ error: 'Serial number is required' }, { status: 400 })
    }

    // Check if serial number exists in the database for this business
    const existingSerial = await prisma.productSerialNumber.findFirst({
      where: {
        serialNumber: serialNumber.trim(),
        businessId: parseInt(session.user.businessId.toString()),
      },
      select: {
        product: {
          select: {
            name: { select: { id: { select: { id: true, name: true } }, name: { select: { id: true, name: true } } } },
          },
        },
        productVariation: {
          select: {
            name: { select: { id: true, name: true } },
            sku: { select: { id: true, name: true } },
          },
        },
        purchaseReceipt: {
          select: {
            receiptNumber: { select: { id: true, name: true } },
            supplier: {
              select: {
                name: { select: { id: true, name: true } },
              },
            },
          },
        },
      },
    })

    if (existingSerial) {
      return NextResponse.json({
        exists: { select: { id: true, name: true } },
        serial: {
          serialNumber: existingSerial.serialNumber,
          product: existingSerial.product.name,
          variation: existingSerial.productVariation.name,
          sku: existingSerial.productVariation.sku,
          supplier: existingSerial.purchaseReceipt?.supplier.name || 'Unknown',
          receiptNumber: existingSerial.purchaseReceipt?.receiptNumber || 'Unknown',
          status: existingSerial.status,
        },
      })
    }

    return NextResponse.json({
      exists: false,
    })
  } catch (error) {
    console.error('Error checking serial number:', error)
    return NextResponse.json(
      { error: 'Failed to check serial number' },
      { status: 500 }
    )
  }
}
