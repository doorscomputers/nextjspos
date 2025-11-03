import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { PERMISSIONS } from '@/lib/rbac'
import {
  findAllDiscrepancies,
  performIntegrityCheck,
  getTransactionHistory,
  syncPhysicalToLedger,
} from '@/lib/stockValidation'

/**
 * GET /api/reports/inventory-reconciliation
 * Get inventory discrepancies between physical stock and ledger
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = session.user as any
    const businessId = user.businessId

    // Check permission - require either view reports or manage inventory
    if (
      !user.permissions?.includes(PERMISSIONS.REPORT_VIEW) &&
      !user.permissions?.includes(PERMISSIONS.INVENTORY_MANAGE)
    ) {
      return NextResponse.json(
        { error: 'Forbidden - Requires REPORT_VIEW or INVENTORY_MANAGE permission' },
        { status: 403 }
      )
    }

    // Get query parameters
    const searchParams = request.nextUrl.searchParams
    const action = searchParams.get('action') || 'check'
    const variationId = searchParams.get('variationId')
    const locationId = searchParams.get('locationId') ? parseInt(searchParams.get('locationId')!) : null

    // Action: Get transaction history for specific product/location
    if (action === 'history' && variationId && locationId) {
      const history = await getTransactionHistory(
        parseInt(variationId),
        parseInt(locationId)
      )

      return NextResponse.json({
        productVariationId: parseInt(variationId),
        locationId: parseInt(locationId),
        transactionCount: history.length,
        transactions: history.map(tx => ({
          id: tx.id,
          date: tx.createdAt,
          type: tx.type,
          quantity: parseFloat(tx.quantity.toString()),
          balanceAfter: parseFloat(tx.balanceQty.toString()),
          referenceType: tx.referenceType,
          referenceId: tx.referenceId,
          notes: tx.notes,
          createdBy: tx.user
            ? `${tx.user.firstName || ''} ${tx.user.lastName || ''}`.trim() ||
              tx.user.username
            : 'Unknown',
        })),
      })
    }

    // Action: Perform full integrity check
    const integrityCheck = await performIntegrityCheck(parseInt(businessId))

    return NextResponse.json({
      status: integrityCheck.discrepanciesFound === 0 ? 'healthy' : 'discrepancies_found',
      summary: {
        totalVariations: integrityCheck.totalVariations,
        discrepanciesFound: integrityCheck.discrepanciesFound,
        totalVariance: integrityCheck.totalVariance,
        healthPercentage: integrityCheck.totalVariations > 0
          ? ((integrityCheck.totalVariations - integrityCheck.discrepanciesFound) / integrityCheck.totalVariations * 100).toFixed(2)
          : 100,
      },
      discrepancies: integrityCheck.discrepancies,
      timestamp: new Date().toISOString(),
    })
  } catch (error: any) {
    console.error('Error generating inventory reconciliation report:', error)
    return NextResponse.json(
      { error: 'Failed to generate report', details: error.message },
      { status: 500 }
    )
  }
}

/**
 * POST /api/reports/inventory-reconciliation
 * Fix discrepancies by syncing physical stock to ledger
 * ⚠️ DANGEROUS: Only use this with proper authorization
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = session.user as any
    const businessId = user.businessId

    // Require INVENTORY_MANAGE permission to fix discrepancies
    if (!user.permissions?.includes(PERMISSIONS.INVENTORY_MANAGE)) {
      return NextResponse.json(
        { error: 'Forbidden - Requires INVENTORY_MANAGE permission to fix discrepancies' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { action, productVariationId, locationId, fixAll } = body

    if (action !== 'sync_to_ledger') {
      return NextResponse.json(
        { error: 'Invalid action. Supported: sync_to_ledger' },
        { status: 400 }
      )
    }

    // Fix all discrepancies
    if (fixAll === true) {
      const discrepancies = await findAllDiscrepancies(parseInt(businessId))

      const fixes = []
      for (const discrepancy of discrepancies) {
        const result = await syncPhysicalToLedger(
          discrepancy.productVariationId,
          discrepancy.locationId
        )

        fixes.push({
          productVariationId: discrepancy.productVariationId,
          locationId: discrepancy.locationId,
          productName: discrepancy.productName,
          variationName: discrepancy.variationName,
          oldStock: result.oldStock,
          newStock: result.newStock,
          variance: result.variance,
        })
      }

      return NextResponse.json({
        message: `Fixed ${fixes.length} discrepancies`,
        fixes,
      })
    }

    // Fix single discrepancy
    if (!productVariationId || !locationId) {
      return NextResponse.json(
        { error: 'productVariationId and locationId required for single fix' },
        { status: 400 }
      )
    }

    const result = await syncPhysicalToLedger(
      parseInt(productVariationId),
      parseInt(locationId)
    )

    return NextResponse.json({
      message: 'Discrepancy fixed - physical stock synced to ledger',
      productVariationId: parseInt(productVariationId),
      locationId: parseInt(locationId),
      oldStock: result.oldStock,
      newStock: result.newStock,
      variance: result.variance,
    })
  } catch (error: any) {
    console.error('Error fixing inventory discrepancy:', error)
    return NextResponse.json(
      { error: 'Failed to fix discrepancy', details: error.message },
      { status: 500 }
    )
  }
}
