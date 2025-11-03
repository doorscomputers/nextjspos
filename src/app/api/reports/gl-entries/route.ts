import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth.simple'
import { PERMISSIONS } from '@/lib/rbac'
import {
  getGLEntriesForPeriod,
  summarizeByAccount,
  exportToCSV,
  exportToQuickBooksIIF,
  JournalEntry
} from '@/lib/financialImpact'

/**
 * GET /api/reports/gl-entries
 * Generate General Ledger journal entries for inventory transactions
 *
 * Query Parameters:
 * - startDate: Start date for report period (ISO string)
 * - endDate: End date for report period (ISO string)
 * - transactionTypes: Comma-separated list (Sale,Purchase,Adjustment)
 * - format: Output format (json, csv, quickbooks)
 */
export async function GET(request: NextRequest) {
  try {
    // Authentication
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = session.user as any
    const businessId = parseInt(String(user.businessId))
    if (!businessId) {
      return NextResponse.json({ error: 'No business associated with user' }, { status: 400 })
    }

    // Permission check - requires financial reporting permission
    if (!user.permissions?.includes(PERMISSIONS.REPORT_VIEW)) {
      return NextResponse.json(
        { error: 'Forbidden - Requires REPORT_VIEW permission' },
        { status: 403 }
      )
    }

    // Parse query parameters
    const { searchParams } = new URL(request.url)
    const startDateParam = searchParams.get('startDate')
    const endDateParam = searchParams.get('endDate')
    const transactionTypesParam = searchParams.get('transactionTypes')
    const format = searchParams.get('format') || 'json'

    // Default to last 30 days if no dates provided
    const endDate = endDateParam ? new Date(endDateParam) : new Date()
    const startDate = startDateParam
      ? new Date(startDateParam)
      : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)

    // Parse transaction types filter
    const transactionTypes = transactionTypesParam
      ? transactionTypesParam.split(',').map(t => t.trim())
      : undefined

    // Generate GL entries
    const entries = await getGLEntriesForPeriod(
      parseInt(businessId),
      startDate,
      endDate,
      transactionTypes
    )

    // Return format based on request
    if (format === 'csv') {
      const csv = exportToCSV(entries)
      return new NextResponse(csv, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="gl-entries-${startDate.toISOString().split('T')[0]}-${endDate.toISOString().split('T')[0]}.csv"`
        }
      })
    }

    if (format === 'quickbooks' || format === 'iif') {
      const iif = exportToQuickBooksIIF(entries)
      return new NextResponse(iif, {
        headers: {
          'Content-Type': 'text/plain',
          'Content-Disposition': `attachment; filename="gl-entries-${startDate.toISOString().split('T')[0]}-${endDate.toISOString().split('T')[0]}.iif"`
        }
      })
    }

    // JSON format (default)
    const summary = summarizeByAccount(entries)

    // Calculate totals
    const totalDebits = entries.reduce((sum, e) => sum + e.totalDebit, 0)
    const totalCredits = entries.reduce((sum, e) => sum + e.totalCredit, 0)
    const allBalanced = entries.every(e => e.balanced)

    return NextResponse.json({
      success: true,
      period: {
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString()
      },
      entries,
      accountSummary: summary,
      summary: {
        totalEntries: entries.length,
        totalJournalLines: entries.reduce((sum, e) => sum + e.lines.length, 0),
        totalDebits,
        totalCredits,
        allBalanced,
        transactionTypes: {
          sales: entries.filter(e => e.referenceType === 'Sale').length,
          purchases: entries.filter(e => e.referenceType === 'PurchaseReceipt').length,
          adjustments: entries.filter(e => e.referenceType === 'InventoryCorrection').length
        }
      }
    })

  } catch (error: any) {
    console.error('Error generating GL entries report:', error)
    return NextResponse.json(
      { error: 'Failed to generate GL entries report', details: error.message },
      { status: 500 }
    )
  }
}
