import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { hasPermission } from '@/lib/rbac'
import { PERMISSIONS } from '@/lib/rbac'

/**
 * GET /api/reports/exchange-items
 *
 * Generates a detailed report of exchange transactions showing:
 * - Items that were returned
 * - Items that were issued as replacements
 * - Price differences
 * - Exchange reasons
 *
 * Query Parameters:
 * - startDate (required): Start date in YYYY-MM-DD format
 * - endDate (required): End date in YYYY-MM-DD format
 * - locationId (optional): Filter by location
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!hasPermission(session.user, PERMISSIONS.REPORT_VIEW)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const searchParams = request.nextUrl.searchParams
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const locationId = searchParams.get('locationId')

    if (!startDate || !endDate) {
      return NextResponse.json({ error: 'Start date and end date are required' }, { status: 400 })
    }

    // Parse dates
    const startDateTime = new Date(startDate)
    startDateTime.setHours(0, 0, 0, 0)

    const endDateTime = new Date(endDate)
    endDateTime.setHours(23, 59, 59, 999)

    // Build where clause
    const whereClause: any = {
      businessId: parseInt(session.user.businessId),
      returnDate: {
        gte: startDateTime,
        lte: endDateTime,
      },
      status: 'exchanged', // Only get exchanges, not regular returns
    }

    if (locationId) {
      whereClause.locationId = parseInt(locationId)
    }

    // Fetch customer returns (exchanges) with all related data
    const exchanges = await prisma.customerReturn.findMany({
      where: whereClause,
      include: {
        sale: {
          select: {
            invoiceNumber: true,
          },
        },
        customer: {
          select: {
            name: true,
          },
        },
        items: true,
        replacementSale: {
          include: {
            items: true,
            payments: {
              select: {
                paymentMethod: true,
                amount: true,
              },
            },
          },
        },
      },
      orderBy: {
        returnDate: 'desc',
      },
    })

    // Return items / sale items / returns have no product, variation or location
    // relations in the schema, so look the names up separately
    const productIds = new Set<number>()
    const variationIds = new Set<number>()
    exchanges.forEach((ex) => {
      ;[...ex.items, ...(ex.replacementSale?.items || [])].forEach((it) => {
        productIds.add(it.productId)
        variationIds.add(it.productVariationId)
      })
    })
    const [products, variations, locations] = await Promise.all([
      prisma.product.findMany({ where: { id: { in: [...productIds] } }, select: { id: true, name: true } }),
      prisma.productVariation.findMany({ where: { id: { in: [...variationIds] } }, select: { id: true, name: true } }),
      prisma.businessLocation.findMany({
        where: { id: { in: [...new Set(exchanges.map((ex) => ex.locationId))] }, businessId: whereClause.businessId },
        select: { id: true, name: true },
      }),
    ])
    const productName = new Map(products.map((p) => [p.id, p.name]))
    const variationName = new Map(variations.map((v) => [v.id, v.name]))
    const locationName = new Map(locations.map((l) => [l.id, l.name]))

    // Serials are stored as [{ serialNumber }] (or plain strings); show as "SN1, SN2"
    const serialsText = (value: any) =>
      Array.isArray(value)
        ? value.map((s: any) => (typeof s === 'string' ? s : s?.serialNumber)).filter(Boolean).join(', ')
        : ''

    // Transform data to flat structure for the report
    const reportData: any[] = []

    exchanges.forEach((exchange) => {
      // Get payment method from replacement sale payments
      const paymentMethod = exchange.replacementSale?.payments
        .map((p) => p.paymentMethod)
        .filter((method, index, self) => self.indexOf(method) === index)
        .join(', ') || 'N/A'

      // Match returned items with exchanged items
      // In most cases, there's a 1:1 mapping, but we'll handle multiple items
      const maxItems = Math.max(
        exchange.items.length,
        exchange.replacementSale?.items.length || 0
      )

      for (let i = 0; i < maxItems; i++) {
        const returnedItem = exchange.items[i]
        const exchangedItem = exchange.replacementSale?.items[i]

        const returnItemTotal = returnedItem
          ? parseFloat(returnedItem.quantity.toString()) * parseFloat(returnedItem.unitPrice.toString())
          : 0

        const exchangeItemTotal = exchangedItem
          ? parseFloat(exchangedItem.quantity.toString()) * parseFloat(exchangedItem.unitPrice.toString())
          : 0

        const priceDifference = exchangeItemTotal - returnItemTotal

        reportData.push({
          // Exchange info
          exchangeNumber: exchange.returnNumber,
          exchangeDate: exchange.returnDate,
          originalInvoice: exchange.sale.invoiceNumber,
          locationName: locationName.get(exchange.locationId) || 'N/A',
          customerName: exchange.customer?.name || 'Walk-in',
          exchangeReason: exchange.notes || 'N/A',

          // Returned item
          returnedProductName: (returnedItem && productName.get(returnedItem.productId)) || 'N/A',
          returnedVariationName: (returnedItem && variationName.get(returnedItem.productVariationId)) || 'N/A',
          returnedQuantity: returnedItem ? parseFloat(returnedItem.quantity.toString()) : 0,
          returnedUnitPrice: returnedItem ? parseFloat(returnedItem.unitPrice.toString()) : 0,
          returnItemTotal,
          returnedSerialNumbers: serialsText(returnedItem?.serialNumbers),

          // Exchanged item
          exchangedProductName: (exchangedItem && productName.get(exchangedItem.productId)) || 'N/A',
          exchangedVariationName: (exchangedItem && variationName.get(exchangedItem.productVariationId)) || 'N/A',
          exchangedQuantity: exchangedItem ? parseFloat(exchangedItem.quantity.toString()) : 0,
          exchangedUnitPrice: exchangedItem ? parseFloat(exchangedItem.unitPrice.toString()) : 0,
          exchangeItemTotal,
          exchangedSerialNumbers: serialsText(exchangedItem?.serialNumbers),

          // Difference
          priceDifference,
          paymentMethod: priceDifference > 0 ? paymentMethod : 'N/A',
        })
      }
    })

    // Calculate summary
    const summary = {
      totalExchanges: exchanges.length,
      totalItemsReturned: reportData.reduce((sum, item) => sum + item.returnedQuantity, 0),
      totalItemsIssued: reportData.reduce((sum, item) => sum + item.exchangedQuantity, 0),
      totalReturnValue: reportData.reduce((sum, item) => sum + item.returnItemTotal, 0),
      totalExchangeValue: reportData.reduce((sum, item) => sum + item.exchangeItemTotal, 0),
      netValueImpact: reportData.reduce((sum, item) => sum + item.priceDifference, 0),
    }

    return NextResponse.json({
      exchanges: reportData,
      summary,
    })
  } catch (error: any) {
    console.error('Exchange items report error:', error)
    return NextResponse.json(
      { error: 'Failed to generate exchange items report', details: error.message },
      { status: 500 }
    )
  }
}
