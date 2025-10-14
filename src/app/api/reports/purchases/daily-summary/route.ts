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

    const user = session.user as any
    const businessId = parseInt(user.businessId)

    const searchParams = request.nextUrl.searchParams
    const year = searchParams.get('year') || new Date().getFullYear().toString()
    const month = searchParams.get('month') || (new Date().getMonth() + 1).toString()

    const startDate = new Date(`${year}-${month.padStart(2, '0')}-01`)
    const endDate = new Date(startDate.getFullYear(), startDate.getMonth() + 1, 0)

    // Get all purchases for the month
    const purchases = await prisma.purchase.findMany({
      where: {
        businessId: businessId,
        purchaseDate: {
          gte: startDate,
          lte: endDate,
        },
      },
      include: {
        items: true,
        supplier: {
          select: {
            name: true,
          },
        },
      },
    })

    // Group purchases by day
    const dailyMetrics = new Map()

    purchases.forEach((purchase) => {
      const day = new Date(purchase.purchaseDate).getDate()

      if (!dailyMetrics.has(day)) {
        dailyMetrics.set(day, {
          day,
          date: new Date(purchase.purchaseDate).toISOString().split('T')[0],
          numberOfPOs: 0,
          totalAmount: 0,
          totalItems: 0,
          uniqueSuppliers: new Set(),
          approvedPOs: 0,
          pendingPOs: 0,
          receivedPOs: 0,
        })
      }

      const metric = dailyMetrics.get(day)
      metric.numberOfPOs++
      metric.totalAmount += Number(purchase.totalAmount || 0)
      metric.totalItems += purchase.items.length
      metric.uniqueSuppliers.add(purchase.supplierId)

      if (purchase.status === 'approved') metric.approvedPOs++
      else if (purchase.status === 'pending') metric.pendingPOs++
      else if (purchase.status === 'received') metric.receivedPOs++
    })

    // Convert to array and calculate final metrics
    const dailySummary = Array.from(dailyMetrics.values()).map((day) => ({
      ...day,
      uniqueSuppliers: day.uniqueSuppliers.size,
    }))

    // Sort by day
    dailySummary.sort((a, b) => a.day - b.day)

    // Calculate summary
    const summary = {
      totalDays: dailySummary.length,
      totalPOs: dailySummary.reduce((sum, d) => sum + d.numberOfPOs, 0),
      totalAmount: dailySummary.reduce((sum, d) => sum + d.totalAmount, 0),
      avgDailyAmount: dailySummary.length > 0
        ? dailySummary.reduce((sum, d) => sum + d.totalAmount, 0) / dailySummary.length
        : 0,
      avgDailyPOs: dailySummary.length > 0
        ? dailySummary.reduce((sum, d) => sum + d.numberOfPOs, 0) / dailySummary.length
        : 0,
      peakDay: dailySummary.length > 0
        ? dailySummary.reduce((max, d) => (d.totalAmount > max.totalAmount ? d : max))
        : null,
    }

    return NextResponse.json({
      success: true,
      data: {
        period: {
          year,
          month,
          monthName: new Date(startDate).toLocaleString('default', { month: 'long' }),
          startDate: startDate.toISOString().split('T')[0],
          endDate: endDate.toISOString().split('T')[0],
        },
        summary,
        days: dailySummary,
      },
    })
  } catch (error) {
    console.error('Daily summary report error:', error)
    return NextResponse.json(
      { error: 'Failed to generate daily summary report' },
      { status: 500 }
    )
  }
}
