import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth.simple'
import { prisma } from '@/lib/prisma.simple'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const period = searchParams.get('period') || 'month' // month|quarter|year
    const year = searchParams.get('year') || new Date().getFullYear().toString()
    const compareYears = searchParams.get('compareYears') === 'true' // Enable year-over-year comparison
    const locationId = searchParams.get('locationId') ? parseInt(searchParams.get('locationId')!) : null

    const businessId = parseInt(session.user.businessId)

    // Build base where clause
    const baseWhere: any = {
      businessId,
      status: { in: ['approved', 'received'] },
    }

    if (locationId) baseWhere.locationId = parseInt(locationId)

    let trendData: any[] = []
    let comparisonData: any[] = []

    if (period === 'month') {
      // Monthly trend for the selected year
      const yearNum = parseInt(year)
      const months = []

      for (let month = 1; month <= 12; month++) {
        const dateFrom = new Date(yearNum, month - 1, 1)
        const dateTo = new Date(yearNum, month, 0)
        dateFrom.setHours(0, 0, 0, 0)
        dateTo.setHours(23, 59, 59, 999)

        const purchases = await prisma.purchase.findMany({
          where: {
            ...baseWhere,
            createdAt: {
              gte: dateFrom,
              lte: dateTo,
            },
          },
          select: {
            totalAmount: true,
          },
        })

        const totalAmount = purchases.reduce(
          (sum, p) => sum + parseFloat(p.totalAmount.toString()),
          0
        )
        const numberOfPOs = purchases.length

        months.push({
          period: `${yearNum}-${String(month).padStart(2, '0')}`,
          label: new Date(yearNum, month - 1).toLocaleString('default', { month: 'short' }),
          month,
          year: yearNum,
          totalAmount: Math.round(totalAmount * 100) / 100,
          numberOfPOs,
          avgPOValue: numberOfPOs > 0 ? Math.round((totalAmount / numberOfPOs) * 100) / 100 : 0,
        })
      }

      trendData = months

      // Year-over-year comparison if requested
      if (compareYears) {
        const previousYearNum = yearNum - 1
        const previousMonths = []

        for (let month = 1; month <= 12; month++) {
          const dateFrom = new Date(previousYearNum, month - 1, 1)
          const dateTo = new Date(previousYearNum, month, 0)
          dateFrom.setHours(0, 0, 0, 0)
          dateTo.setHours(23, 59, 59, 999)

          const purchases = await prisma.purchase.findMany({
            where: {
              ...baseWhere,
              createdAt: {
                gte: dateFrom,
                lte: dateTo,
              },
            },
            select: {
              totalAmount: true,
            },
          })

          const totalAmount = purchases.reduce(
            (sum, p) => sum + parseFloat(p.totalAmount.toString()),
            0
          )
          const numberOfPOs = purchases.length

          previousMonths.push({
            period: `${previousYearNum}-${String(month).padStart(2, '0')}`,
            label: new Date(previousYearNum, month - 1).toLocaleString('default', {
              month: 'short',
            }),
            month,
            year: previousYearNum,
            totalAmount: Math.round(totalAmount * 100) / 100,
            numberOfPOs,
            avgPOValue:
              numberOfPOs > 0 ? Math.round((totalAmount / numberOfPOs) * 100) / 100 : 0,
          })
        }

        comparisonData = previousMonths
      }
    } else if (period === 'quarter') {
      // Quarterly trend for the selected year
      const yearNum = parseInt(year)
      const quarters = ['Q1', 'Q2', 'Q3', 'Q4']
      const quarterMap: Record<string, { start: string; end: string }> = {
        Q1: { start: '01-01', end: '03-31' },
        Q2: { start: '04-01', end: '06-30' },
        Q3: { start: '07-01', end: '09-30' },
        Q4: { start: '10-01', end: '12-31' },
      }

      const quarterlyData = []

      for (const quarter of quarters) {
        const q = quarterMap[quarter]
        const dateFrom = new Date(`${yearNum}-${q.start}`)
        const dateTo = new Date(`${yearNum}-${q.end}`)
        dateFrom.setHours(0, 0, 0, 0)
        dateTo.setHours(23, 59, 59, 999)

        const purchases = await prisma.purchase.findMany({
          where: {
            ...baseWhere,
            createdAt: {
              gte: dateFrom,
              lte: dateTo,
            },
          },
          select: {
            totalAmount: true,
          },
        })

        const totalAmount = purchases.reduce(
          (sum, p) => sum + parseFloat(p.totalAmount.toString()),
          0
        )
        const numberOfPOs = purchases.length

        quarterlyData.push({
          period: `${yearNum}-${quarter}`,
          label: quarter,
          quarter,
          year: yearNum,
          totalAmount: Math.round(totalAmount * 100) / 100,
          numberOfPOs,
          avgPOValue: numberOfPOs > 0 ? Math.round((totalAmount / numberOfPOs) * 100) / 100 : 0,
        })
      }

      trendData = quarterlyData

      // Year-over-year comparison if requested
      if (compareYears) {
        const previousYearNum = yearNum - 1
        const previousQuarterlyData = []

        for (const quarter of quarters) {
          const q = quarterMap[quarter]
          const dateFrom = new Date(`${previousYearNum}-${q.start}`)
          const dateTo = new Date(`${previousYearNum}-${q.end}`)
          dateFrom.setHours(0, 0, 0, 0)
          dateTo.setHours(23, 59, 59, 999)

          const purchases = await prisma.purchase.findMany({
            where: {
              ...baseWhere,
              createdAt: {
                gte: dateFrom,
                lte: dateTo,
              },
            },
            select: {
              totalAmount: true,
            },
          })

          const totalAmount = purchases.reduce(
            (sum, p) => sum + parseFloat(p.totalAmount.toString()),
            0
          )
          const numberOfPOs = purchases.length

          previousQuarterlyData.push({
            period: `${previousYearNum}-${quarter}`,
            label: quarter,
            quarter,
            year: previousYearNum,
            totalAmount: Math.round(totalAmount * 100) / 100,
            numberOfPOs,
            avgPOValue:
              numberOfPOs > 0 ? Math.round((totalAmount / numberOfPOs) * 100) / 100 : 0,
          })
        }

        comparisonData = previousQuarterlyData
      }
    } else if (period === 'year') {
      // Yearly trend for the last 5 years
      const currentYear = parseInt(year)
      const yearlyData = []

      for (let y = currentYear - 4; y <= currentYear; y++) {
        const dateFrom = new Date(`${y}-01-01`)
        const dateTo = new Date(`${y}-12-31`)
        dateFrom.setHours(0, 0, 0, 0)
        dateTo.setHours(23, 59, 59, 999)

        const purchases = await prisma.purchase.findMany({
          where: {
            ...baseWhere,
            createdAt: {
              gte: dateFrom,
              lte: dateTo,
            },
          },
          select: {
            totalAmount: true,
          },
        })

        const totalAmount = purchases.reduce(
          (sum, p) => sum + parseFloat(p.totalAmount.toString()),
          0
        )
        const numberOfPOs = purchases.length

        yearlyData.push({
          period: `${y}`,
          label: `${y}`,
          year: y,
          totalAmount: Math.round(totalAmount * 100) / 100,
          numberOfPOs,
          avgPOValue: numberOfPOs > 0 ? Math.round((totalAmount / numberOfPOs) * 100) / 100 : 0,
        })
      }

      trendData = yearlyData
    }

    // Calculate trend indicators
    const trendsWithIndicators = trendData.map((item, index) => {
      let trendDirection = 'stable'
      let trendPercentage = 0

      if (index > 0) {
        const previous = trendData[index - 1]
        if (previous.totalAmount > 0) {
          trendPercentage =
            ((item.totalAmount - previous.totalAmount) / previous.totalAmount) * 100
          if (trendPercentage > 5) trendDirection = 'increasing'
          else if (trendPercentage < -5) trendDirection = 'decreasing'
        }
      }

      return {
        ...item,
        trendDirection,
        trendPercentage: Math.round(trendPercentage * 100) / 100,
      }
    })

    // Calculate comparison indicators if year-over-year enabled
    let comparisons: any[] = []
    if (compareYears && comparisonData.length > 0) {
      comparisons = trendData.map((current, index) => {
        const previous = comparisonData[index]
        if (!previous) return null

        const amountChange = current.totalAmount - previous.totalAmount
        const percentChange =
          previous.totalAmount > 0 ? (amountChange / previous.totalAmount) * 100 : 0

        return {
          period: current.period,
          label: current.label,
          currentYear: {
            year: current.year,
            totalAmount: current.totalAmount,
            numberOfPOs: current.numberOfPOs,
          },
          previousYear: {
            year: previous.year,
            totalAmount: previous.totalAmount,
            numberOfPOs: previous.numberOfPOs,
          },
          change: {
            amount: Math.round(amountChange * 100) / 100,
            percentage: Math.round(percentChange * 100) / 100,
            direction: percentChange > 0 ? 'increase' : percentChange < 0 ? 'decrease' : 'stable',
          },
        }
      }).filter(Boolean)
    }

    // Calculate summary statistics
    const totalAmount = trendsWithIndicators.reduce((sum, item) => sum + item.totalAmount, 0)
    const totalPOs = trendsWithIndicators.reduce((sum, item) => sum + item.numberOfPOs, 0)
    const avgPeriodAmount = trendsWithIndicators.length > 0 ? totalAmount / trendsWithIndicators.length : 0

    // Find peak and lowest periods
    const peakPeriod = trendsWithIndicators.reduce(
      (max, item) => (item.totalAmount > max.totalAmount ? item : max),
      trendsWithIndicators[0] || { totalAmount: 0 }
    )

    const lowestPeriod = trendsWithIndicators.reduce(
      (min, item) => (item.totalAmount < min.totalAmount ? item : min),
      trendsWithIndicators[0] || { totalAmount: Infinity }
    )

    const summary = {
      totalAmount: Math.round(totalAmount * 100) / 100,
      totalPOs,
      avgPeriodAmount: Math.round(avgPeriodAmount * 100) / 100,
      avgPOValue: totalPOs > 0 ? Math.round((totalAmount / totalPOs) * 100) / 100 : 0,
      peakPeriod: {
        period: peakPeriod?.period || '',
        label: peakPeriod?.label || '',
        amount: peakPeriod?.totalAmount || 0,
      },
      lowestPeriod: {
        period: lowestPeriod?.period || '',
        label: lowestPeriod?.label || '',
        amount: lowestPeriod?.totalAmount || 0,
      },
      overallTrend:
        trendsWithIndicators.length > 1
          ? trendsWithIndicators[trendsWithIndicators.length - 1].totalAmount >
            trendsWithIndicators[0].totalAmount
            ? 'increasing'
            : trendsWithIndicators[trendsWithIndicators.length - 1].totalAmount <
              trendsWithIndicators[0].totalAmount
            ? 'decreasing'
            : 'stable'
          : 'stable',
    }

    return NextResponse.json({
      success: true,
      data: {
        period: {
          type: period,
          year,
          compareYears,
        },
        summary,
        trends: trendsWithIndicators,
        comparisons: compareYears ? comparisons : undefined,
      },
    })
  } catch (error) {
    console.error('Purchase Trend Analysis Report error:', error)
    return NextResponse.json(
      {
        error: 'Failed to generate purchase trend analysis report',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
