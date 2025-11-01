import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

interface UpdateSerialNumbersRequest {
  receiptItemId: number
  serialNumbers: Array<{
    serialNumber: string
    condition?: string
    imei?: string
  }>
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    console.log('=== API: PUT serial-numbers called ===')

    const resolvedParams = await params
    console.log('Params:', resolvedParams)

    const session = await getServerSession(authOptions)
    console.log('Session:', session)

    if (!session) {
      console.log('ERROR: No session found')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const receiptId = parseInt(resolvedParams.id)
    console.log('Receipt ID:', receiptId)

    if (isNaN(receiptId)) {
      console.log('ERROR: Invalid receipt ID')
      return NextResponse.json({ error: 'Invalid receipt ID' }, { status: 400 })
    }

    const body: UpdateSerialNumbersRequest = await request.json()
    console.log('Request body:', body)
    const { receiptItemId, serialNumbers } = body

    // Validate required fields
    if (!receiptItemId || !Array.isArray(serialNumbers)) {
      return NextResponse.json({
        error: 'receiptItemId and serialNumbers array are required'
      }, { status: 400 })
    }

    console.log('Validating required fields...')
    // Validate required fields
    if (!receiptItemId || !Array.isArray(serialNumbers)) {
      console.log('ERROR: Invalid fields', { receiptItemId, serialNumbers })
      return NextResponse.json({
        error: 'receiptItemId and serialNumbers array are required'
      }, { status: 400 })
    }

    console.log('Looking up receipt...')
    // Check if the receipt exists and belongs to the user's business
    const receipt = await prisma.purchaseReceipt.findFirst({
      where: {
        id: receiptId,
        businessId: parseInt(session.user.businessId)
      },
      select: {
        items: {
          where: { id: receiptItemId },
          select: {
            purchaseItem: {
              select: {
                product: { select: { id: { select: { id: true, name: true } }, name: { select: { id: true, name: true } } } },
                productVariation: { select: { id: true, name: true } }
              }
            }
          }
        }
      }
    })

    console.log('Found receipt:', receipt)

    if (!receipt) {
      console.log('ERROR: Receipt not found')
      return NextResponse.json({ error: 'Receipt not found' }, { status: 404 })
    }

    if (receipt.status !== 'pending') {
      return NextResponse.json({
        error: 'Can only edit serial numbers for pending receipts'
      }, { status: 400 })
    }

    const receiptItem = receipt.items[0]
    if (!receiptItem) {
      return NextResponse.json({ error: 'Receipt item not found' }, { status: 404 })
    }

    // Get product and variation data from purchaseItem or fetch directly
    let product = null
    let variation = null

    if (receiptItem.purchaseItem) {
      product = receiptItem.purchaseItem.product
      variation = receiptItem.purchaseItem.productVariation
    } else {
      // Fetch directly using IDs
      product = await prisma.product.findFirst({
        where: {
          id: receiptItem.productId,
          businessId: parseInt(session.user.businessId)
        }
      })
      variation = await prisma.productVariation.findFirst({
        where: {
          id: receiptItem.productVariationId,
          businessId: parseInt(session.user.businessId)
        }
      })
    }

    // For now, we'll skip serial number validation since we don't have enableSerialNumber info
    // This will be handled when we fix the variation relationship

    // Validate serial numbers format and check for duplicates
    const serialNumberSet = new Set()
    for (const sn of serialNumbers) {
      if (!sn.serialNumber || typeof sn.serialNumber !== 'string' || sn.serialNumber.trim() === '') {
        return NextResponse.json({
          error: 'All serial numbers must be non-empty strings'
        }, { status: 400 })
      }

      const trimmedSerial = sn.serialNumber.trim()
      if (serialNumberSet.has(trimmedSerial)) {
        return NextResponse.json({
          error: `Duplicate serial number found: ${trimmedSerial}`
        }, { status: 400 })
      }
      serialNumberSet.add(trimmedSerial)
    }

    // Check for serial numbers that already exist in the database
    const existingSerials = await prisma.productSerialNumber.findMany({
      where: {
        serialNumber: {
          in: serialNumbers.map(sn => sn.serialNumber.trim())
        }
      },
      select: {
        purchaseReceipt: {
          select: {
            supplier: { select: { id: { select: { id: true, name: true } }, name: { select: { id: true, name: true } } } }
          }
        },
        product: { select: { id: true, name: true } },
        supplier: { select: { id: true, name: true } }
      }
    })

    if (existingSerials.length > 0) {
      const existingSerialList = existingSerials.map(es => ({
        serialNumber: es.serialNumber,
        product: es.product?.name || 'Unknown',
        receiptNumber: es.purchaseReceipt?.receiptNumber || 'Unknown',
        supplier: es.supplier?.name || 'Unknown'
      }))

      return NextResponse.json({
        error: 'Some serial numbers already exist',
        existingSerials: existingSerialList
      }, { status: 409 })
    }

    console.log('Updating receipt item...')
    // Update the receipt item with new serial numbers
    const updatedReceiptItem = await prisma.purchaseReceiptItem.update({
      where: { id: receiptItemId },
      data: {
        serialNumbers: serialNumbers.map(sn => ({
          ...sn,
          serialNumber: sn.serialNumber.trim()
        }))
      }
    })

    console.log('Skipping audit log for now...')
    // TODO: Re-enable audit log after fixing the main issue
    // Create audit log entry
    /*
    await prisma.auditLog.create({
      data: {
        action: 'UPDATE_RECEIPT_SERIAL_NUMBERS',
        entityType: 'PURCHASE_RECEIPT_ITEM',
        entityId: receiptItemId,
        userId: session.user.id,
        businessId: session.user.businessId,
        oldValues: JSON.stringify({
          serialNumbers: receiptItem.serialNumbers
        }),
        newValues: JSON.stringify({
          serialNumbers: serialNumbers.map(sn => ({
            ...sn,
            serialNumber: sn.serialNumber.trim()
          }))
        }),
        ipAddress: (request as any).ip || 'unknown',
        userAgent: request.headers.get('user-agent') || 'unknown'
      }
    })
    */

    console.log('SUCCESS: Serial numbers updated')
    return NextResponse.json({
      success: { select: { id: true, name: true } },
      message: 'Serial numbers updated successfully',
      receiptItem: updatedReceiptItem
    })

  } catch (error) {
    console.error('Error updating serial numbers:', error)
    return NextResponse.json(
      { error: 'Failed to update serial numbers' },
      { status: 500 }
    )
  }
}