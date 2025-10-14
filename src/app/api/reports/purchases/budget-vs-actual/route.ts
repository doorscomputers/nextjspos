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
    const monthlyBudget = parseFloat(searchParams.get('monthlyBudget') || '0')

    if (monthlyBudget === 0) {
      return NextResponse.json({ error: 'Monthly budget is required' }, { status: 400 })
    }

    const startDate = new Date(`${year}-01-01`)
    const endDate = new Date(`${year}-12-31`)

    // Get all purchases for the year
    const purchases = await prisma.purchase.findMany({
      where: {
        businessId: businessId,
        purchaseDate: {
          gte: startDate,
          lte: endDate,
        },
        status: {
          in: ['approved', 'received', 'partial'],
        },
      },
    })

    // Group by month
    const monthlyData = new Map()

    // Initialize all 12 months
    for (let m = 1; m <= 12; m++) {
      const monthKey = `${year}-${String(m).padStart(2, '0')}`
      monthlyData.set(monthKey, {
        month: monthKey,
        monthName: new Date(parseInt(year), m - 1).toLocaleString('default', { month: 'long' }),
        budget: monthlyBudget,
        actual: 0,
        numberOfPOs: 0,
      })
    }

    // Aggregate actual spending
    purchases.forEach((purchase) => {
      const date = new Date(purchase.purchaseDate)
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`

      if (monthlyData.has(monthKey)) {
        const data = monthlyData.get(monthKey)
        data.actual += Number(purchase.totalAmount || 0)
        data.numberOfPOs++
      }
    })

    // Calculate variances
    const budgetComparison = Array.from(monthlyData.values()).map((data) => {
      const variance = data.actual - data.budget
      const variancePercent = data.budget > 0 ? (variance / data.budget) * 100 : 0
      const status = variance > 0 ? 'over' : variance < 0 ? 'under' : 'on-budget'

      return {
        ...data,
        variance,
        variancePercent,
        status,
      }
    })

    // Calculate summary
    const totalBudget = monthlyBudget * 12
    const totalActual = budgetComparison.reduce((sum, m) => sum + m.actual, 0)
    const totalVariance = totalActual - totalBudget
    const totalVariancePercent = totalBudget > 0 ? (totalVariance / totalBudget) * 100 : 0
    const monthsOverBudget = budgetComparison.filter((m) => m.status === 'over').length
    const monthsUnderBudget = budgetComparison.filter((m) => m.status === 'under').length

    const summary = {
      year,
      totalBudget,
      totalActual,
      totalVariance,
      totalVariancePercent,
      monthsOverBudget,
      monthsUnderBudget,
      monthsOnBudget: 12 - monthsOverBudget - monthsUnderBudget,
      avgMonthlySpending: totalActual / 12,
      remainingBudget: totalBudget - totalActual,
    }

    return NextResponse.json({
      success: true,
      data: {
        summary,
        months: budgetComparison,
      },
    })
  } catch (error) {
    console.error('Budget vs actual report error:', error)
    return NextResponse.json(
      { error: 'Failed to generate budget vs actual report' },
      { status: 500 }
    )
  }
}
