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
        location: {
          select: {
            name: true,
          },
        },
        items: {
          include: {
            product: {
              select: {
                name: true,
              },
            },
            productVariation: {
              select: {
                name: true,
              },
            },
          },
        },
        replacementSale: {
          include: {
            items: {
              include: {
                product: {
                  select: {
                    name: true,
                  },
                },
                productVariation: {
                  select: {
                    name: true,
                  },
                },
              },
            },
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
          locationName: exchange.location.name,
          customerName: exchange.customer?.name || 'Walk-in',
          exchangeReason: exchange.notes || 'N/A',

          // Returned item
          returnedProductName: returnedItem?.product.name || 'N/A',
          returnedVariationName: returnedItem?.productVariation?.name || 'N/A',
          returnedQuantity: returnedItem ? parseFloat(returnedItem.quantity.toString()) : 0,
          returnedUnitPrice: returnedItem ? parseFloat(returnedItem.unitPrice.toString()) : 0,
          returnItemTotal,

          // Exchanged item
          exchangedProductName: exchangedItem?.product.name || 'N/A',
          exchangedVariationName: exchangedItem?.productVariation?.name || 'N/A',
          exchangedQuantity: exchangedItem ? parseFloat(exchangedItem.quantity.toString()) : 0,
          exchangedUnitPrice: exchangedItem ? parseFloat(exchangedItem.unitPrice.toString()) : 0,
          exchangeItemTotal,

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
