import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const productId = parseInt(params.id)
    const businessId = parseInt(session.user.businessId)

    // Get product
    const product = await prisma.product.findUnique({
      where: { id: productId, businessId },
      include: {
        variations: {
          select: {
            id: true,
          },
        },
      },
    })

    if (!product) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 })
    }

    // Calculate date 30 days ago for sales velocity
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

    // Get sales for all variations of this product in the last 30 days
    const variationIds = product.variations.map((v) => v.id)

    const salesData = await prisma.salesLine.findMany({
      where: {
        productVariationId: { in: variationIds },
        sale: {
          businessId,
          createdAt: { gte: thirtyDaysAgo },
          status: { in: ['completed', 'final'] },
        },
      },
      select: {
        quantity: true,
      },
    })

    const totalSalesQty = salesData.reduce(
      (sum, sale) => sum + parseFloat(sale.quantity.toString()),
      0
    )

    // Calculate average daily sales
    const avgDailySales = totalSalesQty / 30

    // If no sales, return message
    if (avgDailySales === 0) {
      return NextResponse.json({
        success: true,
        data: {
          hasSalesData: false,
          message: 'No sales data found for the last 30 days',
          avgDailySales: 0,
          suggestedReorderPoint: 0,
          suggestedReorderQuantity: 0,
          suggestedLeadTimeDays: 7, // Default
          suggestedSafetyStockDays: 3, // Default
        },
      })
    }

    // Use default lead time and safety stock if not set
    const leadTimeDays = product.leadTimeDays || 7
    const safetyStockDays = product.safetyStockDays || 3

    // Calculate suggested reorder point
    const suggestedReorderPoint = Math.ceil(
      avgDailySales * (leadTimeDays + safetyStockDays)
    )

    // Calculate suggested reorder quantity (enough for 2 cycles)
    const suggestedReorderQuantity = Math.ceil(
      avgDailySales * (leadTimeDays + safetyStockDays) * 2
    )

    return NextResponse.json({
      success: true,
      data: {
        hasSalesData: true,
        totalSalesLast30Days: totalSalesQty,
        avgDailySales: Math.round(avgDailySales * 100) / 100,
        suggestedReorderPoint,
        suggestedReorderQuantity,
        suggestedLeadTimeDays: leadTimeDays,
        suggestedSafetyStockDays: safetyStockDays,
        calculationBasis: {
          leadTimeDays,
          safetyStockDays,
          formula: '(Avg Daily Sales × Lead Time Days) + (Avg Daily Sales × Safety Stock Days)',
        },
      },
    })
  } catch (error) {
    console.error('Calculate reorder error:', error)
    return NextResponse.json(
      {
        error: 'Failed to calculate reorder settings',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
