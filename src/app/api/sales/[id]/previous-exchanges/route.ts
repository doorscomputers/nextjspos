import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth.simple'
import { prisma } from '@/lib/prisma.simple'

/**
 * GET /api/sales/[id]/previous-exchanges
 * Returns list of previous exchanges for this invoice
 * Used by ExchangeDialog to warn if invoice was already exchanged
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const saleId = parseInt(id)

    if (isNaN(saleId)) {
      return NextResponse.json({ error: 'Invalid sale ID' }, { status: 400 })
    }

    const businessId = parseInt((session.user as any).businessId)

    // Find all exchanges for this sale
    const previousExchanges = await prisma.customerReturn.findMany({
      where: {
        businessId,
        saleId: saleId,
        status: 'exchanged'
      },
      select: {
        id: true,
        returnNumber: true,
        returnDate: true,
        notes: true,
        totalRefundAmount: true,
        items: {
          select: {
            id: true,
            quantity: true,
            unitPrice: true,
            condition: true,
            productId: true
          }
        },
        replacementSale: {
          select: {
            id: true,
            invoiceNumber: true
          }
        }
      },
      orderBy: { returnDate: 'desc' }
    })

    // CustomerReturnItem has no product relation, so look up names separately
    const productIds = [...new Set(previousExchanges.flatMap(ex => ex.items.map(item => item.productId)))]
    const products = productIds.length > 0
      ? await prisma.product.findMany({
          where: { id: { in: productIds }, businessId },
          select: { id: true, name: true }
        })
      : []
    const productNames = new Map(products.map(p => [p.id, p.name]))

    return NextResponse.json({
      previousExchanges: previousExchanges.map(ex => ({
        id: ex.id,
        returnNumber: ex.returnNumber,
        returnDate: ex.returnDate,
        reason: ex.notes,
        totalAmount: parseFloat(ex.totalRefundAmount.toString()),
        replacementInvoice: ex.replacementSale?.invoiceNumber,
        items: ex.items.map(item => ({
          productName: productNames.get(item.productId) || `Product #${item.productId}`,
          quantity: parseFloat(item.quantity.toString()),
          unitPrice: parseFloat(item.unitPrice.toString()),
          condition: item.condition
        }))
      })),
      count: previousExchanges.length
    })
  } catch (error) {
    console.error('Error fetching previous exchanges:', error)
    return NextResponse.json(
      { error: 'Failed to fetch previous exchanges' },
      { status: 500 }
    )
  }
}
