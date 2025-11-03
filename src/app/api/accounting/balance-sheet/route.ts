/**
 * Balance Sheet API Route
 * Generates balance sheet with educational tooltips
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth.simple'
import { hasPermission, PERMISSIONS } from '@/lib/rbac'
import { generateBalanceSheet } from '@/lib/financialStatements'

/**
 * GET /api/accounting/balance-sheet
 *
 * Query Parameters:
 * - asOfDate: Date to generate balance sheet for (defaults to today)
 *
 * FOR NON-ACCOUNTANTS:
 * This endpoint generates your balance sheet - a snapshot of what your business
 * owns (assets), owes (liabilities), and the owner's stake (equity).
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

    // Check specific permission for balance sheet
    if (!hasPermission(session.user, PERMISSIONS.ACCOUNTING_BALANCE_SHEET_VIEW)) {
      return NextResponse.json(
        { error: 'You do not have permission to view balance sheets' },
        { status: 403 }
      )
    }

    const { searchParams } = new URL(request.url)
    const asOfDateParam = searchParams.get('asOfDate')

    // Default to today if no date specified
    const asOfDate = asOfDateParam ? new Date(asOfDateParam) : new Date()

    // Validate date
    if (isNaN(asOfDate.getTime())) {
      return NextResponse.json(
        { error: 'Invalid date format. Use YYYY-MM-DD' },
        { status: 400 }
      )
    }

    // Generate balance sheet
    const balanceSheet = await generateBalanceSheet(
      parseInt(session.user.businessId),
      asOfDate
    )

    return NextResponse.json({
      success: true,
      data: balanceSheet,
      meta: {
        generatedAt: new Date().toISOString(),
        generatedBy: session.user.username,
        businessId: parseInt(session.user.businessId),
      },
    })
  } catch (error) {
    console.error('Balance Sheet API Error:', error)
    return NextResponse.json(
      {
        error: 'Failed to generate balance sheet',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
