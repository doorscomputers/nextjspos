import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { PERMISSIONS } from '@/lib/rbac'
import {
  reconcileLedgerVsSystem,
  fixLedgerVsSystemVariances,
  investigateVariance,
  getReconciliationReport,
  getReconciliationHistory,
  exportReconciliationToCSV,
  ReconciliationType
} from '@/lib/reconciliation'

/**
 * GET /api/reports/reconciliation
 * Stock Reconciliation Detective - Detect and fix variances
 *
 * Query Parameters:
 * - locationId: Filter by location (optional)
 * - autoFix: Auto-fix small variances (boolean, requires permission)
 * - format: Output format (json, csv)
 * - variationId: Investigate specific variation (optional)
 * - history: Get reconciliation history for variation (boolean)
 */
export async function GET(request: NextRequest) {
  try {
    // Authentication
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = session.user as any
    const businessId = user.businessId

    if (!businessId) {
      return NextResponse.json({ error: 'No business associated with user' }, { status: 400 })
    }

    // Permission check
    if (!user.permissions?.includes(PERMISSIONS.REPORT_VIEW)) {
      return NextResponse.json(
        { error: 'Forbidden - Requires REPORT_VIEW permission' },
        { status: 403 }
      )
    }

    // Parse query parameters
    const { searchParams } = new URL(request.url)
    const locationIdParam = searchParams.get('locationId')
    const autoFix = searchParams.get('autoFix') === 'true'
    const format = searchParams.get('format') || 'json'
    const variationIdParam = searchParams.get('variationId')
    const historyParam = searchParams.get('history') === 'true'

    const locationId = locationIdParam ? parseInt(locationIdParam) : undefined
    const variationId = variationIdParam ? parseInt(variationIdParam) : undefined

    // Handle reconciliation history request
    if (historyParam && variationId) {
      const history = await getReconciliationHistory(
        parseInt(businessId),
        variationId,
        locationId,
        50
      )

      return NextResponse.json({
        success: true,
        history,
        count: history.length
      })
    }

    // Handle variance investigation request
    if (variationId && locationId) {
      const investigation = await investigateVariance(
        parseInt(businessId),
        variationId,
        locationId,
        90
      )

      return NextResponse.json({
        success: true,
        investigation
      })
    }

    // Generate reconciliation report
    const report = await getReconciliationReport(
      parseInt(businessId),
      locationId,
      ReconciliationType.LEDGER_VS_SYSTEM
    )

    // Auto-fix small variances if requested and user has permission
    let fixResults = null
    if (autoFix) {
      // Check for auto-fix permission (using INVENTORY_CORRECTION as proxy)
      if (!user.permissions?.includes(PERMISSIONS.INVENTORY_CORRECTION)) {
        return NextResponse.json(
          { error: 'Forbidden - Requires INVENTORY_CORRECTION permission for auto-fix' },
          { status: 403 }
        )
      }

      // Only fix auto-fixable variances
      fixResults = await fixLedgerVsSystemVariances(
        parseInt(businessId),
        user.id,
        user.username,
        locationId
      )

      // Add fix results to report
      report.fixResults = fixResults
    }

    // Export to CSV if requested
    if (format === 'csv') {
      const csv = exportReconciliationToCSV(report)
      return new NextResponse(csv, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="reconciliation-${new Date().toISOString().split('T')[0]}.csv"`
        }
      })
    }

    // Return JSON report
    return NextResponse.json({
      success: true,
      report
    })

  } catch (error: any) {
    console.error('Reconciliation error:', error)
    return NextResponse.json(
      { error: error.message || 'Reconciliation failed' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/reports/reconciliation/fix
 * Manually fix specific variances
 *
 * Body:
 * - variationIds: Array of variation IDs to fix
 * - locationId: Location ID (optional)
 */
export async function POST(request: NextRequest) {
  try {
    // Authentication
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = session.user as any
    const businessId = user.businessId

    if (!businessId) {
      return NextResponse.json({ error: 'No business associated with user' }, { status: 400 })
    }

    // Permission check - requires inventory correction permission
    if (!user.permissions?.includes(PERMISSIONS.INVENTORY_CORRECTION)) {
      return NextResponse.json(
        { error: 'Forbidden - Requires INVENTORY_CORRECTION permission' },
        { status: 403 }
      )
    }

    // Parse request body
    const body = await request.json()
    const { variationIds, locationId } = body

    if (!variationIds || !Array.isArray(variationIds) || variationIds.length === 0) {
      return NextResponse.json(
        { error: 'variationIds array is required' },
        { status: 400 }
      )
    }

    // Fix specific variances
    const fixResults = await fixLedgerVsSystemVariances(
      parseInt(businessId),
      user.id,
      user.username,
      locationId,
      variationIds
    )

    return NextResponse.json({
      success: true,
      fixResults
    })

  } catch (error: any) {
    console.error('Reconciliation fix error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fix variances' },
      { status: 500 }
    )
  }
}
