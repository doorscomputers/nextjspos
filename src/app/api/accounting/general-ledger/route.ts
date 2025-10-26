/**
 * General Ledger API Route
 * Generates detailed transaction history for accounts
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { hasPermission, PERMISSIONS } from '@/lib/rbac'
import { generateGeneralLedger } from '@/lib/financialStatements'

/**
 * GET /api/accounting/general-ledger
 *
 * Query Parameters:
 * - startDate: Beginning of period (required)
 * - endDate: End of period (required)
 * - accountCode: Filter by specific account code (optional)
 * - accountType: Filter by account type (optional)
 *
 * FOR NON-ACCOUNTANTS:
 * This endpoint generates your general ledger - a detailed list of all
 * transactions for each account. It's like viewing your complete transaction
 * history, account by account.
 *
 * Use this to:
 * - Drill down into specific account activity
 * - Review what transactions affected an account
 * - Verify individual entries
 * - Audit your accounting records
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

    // Check specific permission for general ledger
    if (!hasPermission(session.user, PERMISSIONS.ACCOUNTING_GENERAL_LEDGER_VIEW)) {
      return NextResponse.json(
        { error: 'You do not have permission to view general ledger' },
        { status: 403 }
      )
    }

    const { searchParams } = new URL(request.url)
    const startDateParam = searchParams.get('startDate')
    const endDateParam = searchParams.get('endDate')
    const accountCode = searchParams.get('accountCode') || undefined
    const accountType = searchParams.get('accountType') || undefined

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

    // Generate general ledger
    const generalLedger = await generateGeneralLedger(
      session.user.businessId,
      startDate,
      endDate,
      accountCode,
      accountType as 'asset' | 'liability' | 'equity' | 'revenue' | 'expense' | undefined
    )

    return NextResponse.json({
      success: true,
      data: generalLedger,
      meta: {
        generatedAt: new Date().toISOString(),
        generatedBy: session.user.username,
        businessId: session.user.businessId,
        periodStart: startDate.toISOString(),
        periodEnd: endDate.toISOString(),
        filters: {
          accountCode: accountCode || 'All accounts',
          accountType: accountType || 'All types',
        },
      },
    })
  } catch (error) {
    console.error('General Ledger API Error:', error)
    return NextResponse.json(
      {
        error: 'Failed to generate general ledger',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
