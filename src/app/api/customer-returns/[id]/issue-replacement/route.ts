/**
 * Issue Replacement for Approved Customer Return
 * POST /api/customer-returns/[id]/issue-replacement
 *
 * This endpoint handles issuing replacement items to customers after their return
 * has been approved. It:
 * 1. Validates the return is approved and has replacement items
 * 2. Creates a replacement "sale" transaction (with $0 charge)
 * 3. Deducts inventory at the SAME LOCATION where return was processed
 * 4. Links replacement sale to original customer return
 * 5. Marks return as "replacement_issued"
 *
 * LOCATION-BASED: Inventory is deducted from the same location where the return was processed
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { processReplacementIssuance, checkStockAvailability } from '@/lib/stockOperations'

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // 1. Authenticate user
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = parseInt(session.user.id)
    const businessId = session.user.businessId
    const userDisplayName = `${session.user.firstName || ''} ${session.user.lastName || ''}`.trim()

    // 2. Parse request
    const { replacementItems } = await request.json()

    if (!replacementItems || !Array.isArray(replacementItems) || replacementItems.length === 0) {
      return NextResponse.json(
        { error: 'Replacement items are required' },
        { status: 400 }
      )
    }

    // Validate each replacement item
    for (const item of replacementItems) {
      if (!item.productId || !item.productVariationId || !item.quantity) {
        return NextResponse.json(
          { error: 'Each replacement item must have productId, productVariationId, and quantity' },
          { status: 400 }
        )
      }
    }

    // 3. Fetch customer return
    const returnId = parseInt(params.id)
    const customerReturn = await prisma.customerReturn.findFirst({
      where: {
        id: returnId,
        businessId,
      },
      include: {
        items: true,
        sale: {
          select: {
            id: true,
            invoiceNumber: true,
            customerId: true,
          },
        },
      },
    })

    if (!customerReturn) {
      return NextResponse.json(
        { error: 'Customer return not found' },
        { status: 404 }
      )
    }

    // 4. Validate return status
    if (customerReturn.status !== 'approved') {
      return NextResponse.json(
        { error: 'Only approved returns can have replacements issued' },
        { status: 400 }
      )
    }

    // 5. Check if any items are marked for replacement
    const replacementReturnItems = customerReturn.items.filter(
      (item) => item.returnType === 'replacement'
    )

    if (replacementReturnItems.length === 0) {
      return NextResponse.json(
        { error: 'This return has no items marked for replacement' },
        { status: 400 }
      )
    }

    // 6. Check if replacement already issued
    if (customerReturn.replacementIssued) {
      return NextResponse.json(
        { error: 'Replacement has already been issued for this return' },
        { status: 400 }
      )
    }

    // 7. Validate stock availability for ALL replacement items at the return location
    const stockCheckResults = await Promise.all(
      replacementItems.map(async (item) => {
        const availability = await checkStockAvailability({
          productVariationId: item.productVariationId,
          locationId: customerReturn.locationId,
          quantity: item.quantity,
        })
        return {
          productVariationId: item.productVariationId,
          ...availability,
        }
      })
    )

    const insufficientStock = stockCheckResults.filter((result) => !result.available)
    if (insufficientStock.length > 0) {
      return NextResponse.json(
        {
          error: 'Insufficient stock for replacement items',
          details: insufficientStock.map((result) => ({
            productVariationId: result.productVariationId,
            required: result.shortage + result.currentStock,
            available: result.currentStock,
            shortage: result.shortage,
          })),
        },
        { status: 400 }
      )
    }

    // 8. Process replacement issuance within transaction
    const result = await prisma.$transaction(async (tx) => {
      // Generate replacement invoice number
      const today = new Date()
      const year = today.getFullYear()
      const month = String(today.getMonth() + 1).padStart(2, '0')

      const lastSale = await tx.sale.findFirst({
        where: { businessId },
        orderBy: { id: 'desc' },
        select: { invoiceNumber: true },
      })

      let nextNumber = 1
      if (lastSale?.invoiceNumber) {
        const match = lastSale.invoiceNumber.match(/-(\d+)$/)
        if (match) {
          nextNumber = parseInt(match[1]) + 1
        }
      }

      const replacementInvoiceNumber = `RPL-${year}${month}-${String(nextNumber).padStart(6, '0')}`

      // Calculate totals (all $0 for replacements)
      const totalQuantity = replacementItems.reduce(
        (sum, item) => sum + parseFloat(item.quantity.toString()),
        0
      )

      // Create replacement sale
      const replacementSale = await tx.sale.create({
        data: {
          businessId,
          locationId: customerReturn.locationId, // SAME LOCATION as return
          customerId: customerReturn.sale.customerId,
          invoiceNumber: replacementInvoiceNumber,
          saleDate: new Date(),
          status: 'completed',
          saleType: 'replacement', // Mark as replacement transaction
          subtotal: 0, // No charge for replacements
          taxAmount: 0,
          discountAmount: 0,
          shippingCost: 0,
          totalAmount: 0, // $0 total
          createdBy: userId,
          notes: `Replacement issued for return ${customerReturn.returnNumber}`,
        },
      })

      // Create sale items and deduct inventory
      for (const item of replacementItems) {
        // Create sale item
        await tx.saleItem.create({
          data: {
            saleId: replacementSale.id,
            productId: item.productId,
            productVariationId: item.productVariationId,
            quantity: item.quantity,
            unitPrice: 0, // No charge
            unitCost: item.unitCost || 0,
          },
        })

        // Deduct inventory using stock operations (LOCATION-SPECIFIC)
        await processReplacementIssuance({
          businessId,
          productId: item.productId,
          productVariationId: item.productVariationId,
          locationId: customerReturn.locationId, // CRITICAL: Use return's location
          quantity: parseFloat(item.quantity.toString()),
          unitCost: item.unitCost || 0,
          returnId: customerReturn.id,
          returnNumber: customerReturn.returnNumber,
          userId,
          userDisplayName,
          tx,
        })
      }

      // Update customer return - mark as replacement issued
      await tx.customerReturn.update({
        where: { id: customerReturn.id },
        data: {
          replacementIssued: true,
          replacementIssuedAt: new Date(),
          replacementIssuedBy: userId,
          replacementSaleId: replacementSale.id,
        },
      })

      return {
        replacementSale,
        totalQuantity,
      }
    })

    return NextResponse.json({
      success: true,
      message: 'Replacement issued successfully',
      replacementSale: {
        id: result.replacementSale.id,
        invoiceNumber: result.replacementSale.invoiceNumber,
        totalQuantity: result.totalQuantity,
        locationId: customerReturn.locationId,
      },
    })
  } catch (error: any) {
    console.error('Error issuing replacement:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to issue replacement' },
      { status: 500 }
    )
  }
}
