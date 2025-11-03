/**
 * Trial Balance API Route
 * Generates trial balance with validation
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth.simple'
import { hasPermission, PERMISSIONS } from '@/lib/rbac'
import { generateTrialBalance } from '@/lib/financialStatements'

/**
 * GET /api/accounting/trial-balance
 *
 * Query Parameters:
 * - asOfDate: Date to generate trial balance for (defaults to today)
 *
 * FOR NON-ACCOUNTANTS:
 * This endpoint generates your trial balance - a validation check that ensures
 * all your accounting entries are correct. It verifies that total debits equal
 * total credits (the golden rule of accounting).
 *
 * Think of it as a "sanity check" for your books!
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

    // Check specific permission for trial balance
    if (!hasPermission(session.user, PERMISSIONS.ACCOUNTING_TRIAL_BALANCE_VIEW)) {
      return NextResponse.json(
        { error: 'You do not have permission to view trial balance' },
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

    // Generate trial balance
    const trialBalance = await generateTrialBalance(
      parseInt(session.user.businessId),
      asOfDate
    )

    return NextResponse.json({
      success: true,
      data: trialBalance,
      meta: {
        generatedAt: new Date().toISOString(),
        generatedBy: session.user.username,
        businessId: parseInt(session.user.businessId),
      },
    })
  } catch (error) {
    console.error('Trial Balance API Error:', error)
    return NextResponse.json(
      {
        error: 'Failed to generate trial balance',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
