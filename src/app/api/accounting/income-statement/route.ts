/**
 * Income Statement (Profit & Loss) API Route
 * Generates income statement with profit/loss explanations
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth.simple'
import { hasPermission, PERMISSIONS } from '@/lib/rbac'
import { generateIncomeStatement } from '@/lib/financialStatements'

/**
 * GET /api/accounting/income-statement
 *
 * Query Parameters:
 * - startDate: Beginning of period (required)
 * - endDate: End of period (required)
 *
 * FOR NON-ACCOUNTANTS:
 * This endpoint generates your income statement (also called Profit & Loss or P&L).
 * It shows whether you made money during a specific period by comparing
 * your revenue (money earned) to your expenses (money spent).
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check ACCOUNTING_ACCESS permission
    if (!hasPermission(session.user, PERMISSIONS.ACCOUNTING_ACCESS)) {
      return NextResponse.json(
        { error: 'You do not have permission to access accounting features' },
        { status: 403 }
      )
    }

    // Check specific permission for income statement
    if (!hasPermission(session.user, PERMISSIONS.ACCOUNTING_INCOME_STATEMENT_VIEW)) {
      return NextResponse.json(
        { error: 'You do not have permission to view income statements' },
        { status: 403 }
      )
    }

    const { searchParams } = new URL(request.url)
    const startDateParam = searchParams.get('startDate')
    const endDateParam = searchParams.get('endDate')

    // Validate required parameters
    if (!startDateParam || !endDateParam) {
      return NextResponse.json(
        { error: 'Both startDate and endDate are required. Use YYYY-MM-DD format' },
        { status: 400 }
      )
    }

    const startDate = new Date(startDateParam)
    const endDate = new Date(endDateParam)

    // Validate dates
    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      return NextResponse.json(
        { error: 'Invalid date format. Use YYYY-MM-DD' },
        { status: 400 }
      )
    }

    if (startDate > endDate) {
      return NextResponse.json(
        { error: 'Start date must be before or equal to end date' },
        { status: 400 }
      )
    }

    // Generate income statement
    const incomeStatement = await generateIncomeStatement(
      parseInt(session.user.businessId),
      startDate,
      endDate
    )

    return NextResponse.json({
      success: true,
      data: incomeStatement,
      meta: {
        generatedAt: new Date().toISOString(),
        generatedBy: session.user.username,
        businessId: parseInt(session.user.businessId),
        periodStart: startDate.toISOString(),
        periodEnd: endDate.toISOString(),
      },
    })
  } catch (error) {
    console.error('Income Statement API Error:', error)
    return NextResponse.json(
      {
        error: 'Failed to generate income statement',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
