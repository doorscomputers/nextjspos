/**
 * Stock Reconciliation Detective
 *
 * Detects and investigates discrepancies between:
 * - Ledger balances (StockTransaction) vs System stock (VariationLocationDetails)
 * - System stock vs Physical counts
 * - Inventory valuation vs General Ledger
 *
 * Identifies data integrity issues, missing transactions, and variances requiring correction.
 */

import { prisma } from '@/lib/prisma'
import { createAuditLog } from '@/lib/auditLogger'

export enum ReconciliationType {
  LEDGER_VS_SYSTEM = 'LEDGER_VS_SYSTEM',    // StockTransaction vs VariationLocationDetails
  SYSTEM_VS_PHYSICAL = 'SYSTEM_VS_PHYSICAL', // VariationLocationDetails vs physical count
  VALUATION_VS_GL = 'VALUATION_VS_GL'        // Inventory value vs GL
}

export type VarianceType = 'overage' | 'shortage' | 'match'

export interface VarianceDetection {
  variationId: number
  locationId: number
  productId: number
  productName: string
  productSku: string
  variationName: string
  locationName: string

  ledgerBalance: number        // From StockTransaction
  systemBalance: number        // From VariationLocationDetails
  physicalCount: number | null // From physical count (if available)

  variance: number
  variancePercentage: number
  varianceType: VarianceType

  lastTransactionDate: Date | null
  lastTransactionType: string | null

  unitCost: number
  varianceValue: number        // variance * unitCost

  requiresInvestigation: boolean
  autoFixable: boolean

  metadata?: {
    totalTransactions: number
    recentTransactionCount: number
    suspiciousActivity: boolean
  }
}

export interface ReconciliationReport {
  reportDate: Date
  businessId: number
  locationId?: number
  reconciliationType: ReconciliationType

  variances: VarianceDetection[]

  summary: {
    totalVariances: number
    overages: number
    shortages: number
    matches: number

    totalVarianceValue: number
    totalOverageValue: number
    totalShortageValue: number

    requiresInvestigation: number
    autoFixable: number
  }

  fixResults?: {
    fixed: number
    errors: string[]
    totalFixed: number
  }
}

/**
 * Reconcile ledger balance (StockTransaction) vs system balance (VariationLocationDetails)
 * This is the primary reconciliation to detect data integrity issues
 */
export async function reconcileLedgerVsSystem(
  businessId: number,
  locationId?: number
): Promise<VarianceDetection[]> {

  const where: any = {
    productVariation: {
      product: { businessId }
    }
  }

  if (locationId) {
    where.locationId = locationId
  }

  // Get all stock records
  const stockRecords = await prisma.variationLocationDetails.findMany({
    where,
    include: {
      productVariation: {
        include: {
          product: {
            select: {
              id: true,
              name: true,
              sku: true
            }
          }
        }
      },
      location: {
        select: {
          id: true,
          name: true
        }
      }
    }
  })

  const variances: VarianceDetection[] = []

  for (const record of stockRecords) {
    // Get ledger balance (last transaction balance)
    const lastTransaction = await prisma.stockTransaction.findFirst({
      where: {
        businessId,
        productVariationId: record.productVariationId,
        locationId: record.locationId
      },
      orderBy: { createdAt: 'desc' },
      select: {
        balanceQty: true,
        createdAt: true,
        type: true,
        unitCost: true
      }
    })

    // Count total transactions for this variation/location
    const totalTransactions = await prisma.stockTransaction.count({
      where: {
        businessId,
        productVariationId: record.productVariationId,
        locationId: record.locationId
      }
    })

    // Count recent transactions (last 30 days)
    const recentTransactionCount = await prisma.stockTransaction.count({
      where: {
        businessId,
        productVariationId: record.productVariationId,
        locationId: record.locationId,
        createdAt: {
          gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
        }
      }
    })

    const ledgerBalance = lastTransaction?.balanceQty ? parseFloat(lastTransaction.balanceQty.toString()) : 0
    const systemBalance = parseFloat(record.qtyAvailable.toString())
    const variance = systemBalance - ledgerBalance
    const unitCost = lastTransaction?.unitCost ? parseFloat(lastTransaction.unitCost.toString()) : 0
    const varianceValue = variance * unitCost

    // Determine if requires investigation
    // Criteria: variance > 5% OR absolute variance > 10 units OR variance value > 1000
    const variancePercentage = ledgerBalance !== 0 ? Math.abs((variance / ledgerBalance) * 100) : 0
    const requiresInvestigation =
      variancePercentage > 5 ||
      Math.abs(variance) > 10 ||
      Math.abs(varianceValue) > 1000

    // Auto-fixable if: variance <= 5% AND absolute variance <= 10 AND variance value <= 1000
    const autoFixable =
      variancePercentage <= 5 &&
      Math.abs(variance) <= 10 &&
      Math.abs(varianceValue) <= 1000

    // Check for suspicious activity patterns
    const suspiciousActivity =
      (totalTransactions === 0 && systemBalance > 0) || // Stock without transactions
      (recentTransactionCount > 100) || // Very high activity
      (ledgerBalance < 0) // Negative ledger balance

    variances.push({
      variationId: record.productVariationId,
      locationId: record.locationId,
      productId: record.productVariation.product.id,
      productName: record.productVariation.product.name,
      productSku: record.productVariation.product.sku || 'N/A',
      variationName: record.productVariation.name || 'Default',
      locationName: record.location.name,

      ledgerBalance,
      systemBalance,
      physicalCount: null,

      variance,
      variancePercentage,
      varianceType: variance > 0 ? 'overage' : variance < 0 ? 'shortage' : 'match',

      lastTransactionDate: lastTransaction?.createdAt || null,
      lastTransactionType: lastTransaction?.type || null,

      unitCost,
      varianceValue,

      requiresInvestigation,
      autoFixable,

      metadata: {
        totalTransactions,
        recentTransactionCount,
        suspiciousActivity
      }
    })
  }

  // Return only variances (exclude matches)
  return variances.filter(v => v.variance !== 0)
}

/**
 * Automatically fix small ledger vs system variances
 * Only fixes variances that are auto-fixable (small and low-value)
 */
export async function fixLedgerVsSystemVariances(
  businessId: number,
  userId: number,
  username: string,
  locationId?: number,
  variationIds?: number[] // Specific variations to fix
): Promise<{ fixed: number; errors: string[]; details: any[] }> {

  const variances = await reconcileLedgerVsSystem(businessId, locationId)
  const results = {
    fixed: 0,
    errors: [] as string[],
    details: [] as any[]
  }

  // Filter to only auto-fixable variances
  let fixableVariances = variances.filter(v => v.autoFixable && v.variance !== 0)

  // If specific variations provided, filter further
  if (variationIds && variationIds.length > 0) {
    fixableVariances = fixableVariances.filter(v => variationIds.includes(v.variationId))
  }

  for (const variance of fixableVariances) {
    try {
      await prisma.$transaction(async (tx) => {
        // Create correction transaction to align ledger with system
        const correction = await tx.stockTransaction.create({
          data: {
            businessId,
            productId: variance.productId,
            variationId: variance.variationId,
            locationId: variance.locationId,
            transactionType: 'correction',
            quantity: variance.variance,
            unitCost: 0, // Reconciliation doesn't affect cost
            totalCost: 0,
            balance: variance.systemBalance, // New ledger balance = system balance
            userId,
            referenceType: 'Reconciliation',
            referenceId: `AUTO-RECON-${Date.now()}`,
            notes: `Auto-reconciliation: Ledger ${variance.ledgerBalance} → System ${variance.systemBalance} (Variance: ${variance.variance})`,
            createdAt: new Date()
          }
        })

        // Audit log
        await createAuditLog({
          businessId,
          userId,
          username,
          action: 'INVENTORY_RECONCILIATION_AUTO_FIX',
          entityType: 'STOCK_TRANSACTION',
          entityIds: [correction.id.toString()],
          description: `Auto-reconciled variance for ${variance.productName} (${variance.variationName}) at ${variance.locationName}`,
          metadata: {
            variationId: variance.variationId,
            locationId: variance.locationId,
            productName: variance.productName,
            ledgerBalance: variance.ledgerBalance,
            systemBalance: variance.systemBalance,
            variance: variance.variance,
            varianceValue: variance.varianceValue,
            fixed: true,
            correctionId: correction.id
          }
        })

        results.fixed++
        results.details.push({
          variationId: variance.variationId,
          productName: variance.productName,
          variance: variance.variance,
          correctionId: correction.id,
          success: true
        })
      })
    } catch (error: any) {
      const errorMsg = `${variance.productName} (${variance.variationName}): ${error.message}`
      results.errors.push(errorMsg)
      results.details.push({
        variationId: variance.variationId,
        productName: variance.productName,
        variance: variance.variance,
        error: error.message,
        success: false
      })
    }
  }

  return results
}

/**
 * Investigate a specific variance by analyzing transaction history
 * Returns detailed transaction history and potential root causes
 */
export async function investigateVariance(
  businessId: number,
  variationId: number,
  locationId: number,
  daysBack: number = 90
): Promise<{
  variance: VarianceDetection | null
  transactions: any[]
  analysis: {
    missingTransactions: boolean
    unusualPatterns: string[]
    suspectedCauses: string[]
    recommendations: string[]
  }
}> {

  // Get current variance
  const variances = await reconcileLedgerVsSystem(businessId, locationId)
  const variance = variances.find(v => v.variationId === variationId && v.locationId === locationId)

  if (!variance) {
    return {
      variance: null,
      transactions: [],
      analysis: {
        missingTransactions: false,
        unusualPatterns: [],
        suspectedCauses: ['No variance detected'],
        recommendations: ['No action required']
      }
    }
  }

  // Get transaction history
  const cutoffDate = new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000)
  const transactions = await prisma.stockTransaction.findMany({
    where: {
      businessId,
      variationId,
      locationId,
      createdAt: {
        gte: cutoffDate
      }
    },
    orderBy: { createdAt: 'desc' },
    take: 100
  })

  // Analyze patterns
  const analysis = {
    missingTransactions: false,
    unusualPatterns: [] as string[],
    suspectedCauses: [] as string[],
    recommendations: [] as string[]
  }

  // Check for missing transactions
  if (transactions.length === 0 && variance.systemBalance > 0) {
    analysis.missingTransactions = true
    analysis.suspectedCauses.push('Stock exists but no transactions found')
    analysis.recommendations.push('Review beginning inventory setup')
  }

  // Check for balance inconsistencies
  let expectedBalance = 0
  for (let i = transactions.length - 1; i >= 0; i--) {
    const tx = transactions[i]
    expectedBalance = tx.balance

    if (i > 0) {
      const prevTx = transactions[i - 1]
      const calculatedBalance = prevTx.balance - tx.quantity

      if (Math.abs(calculatedBalance - tx.balance) > 0.01) {
        analysis.unusualPatterns.push(
          `Balance mismatch at ${tx.createdAt.toISOString()}: Expected ${calculatedBalance}, Found ${tx.balance}`
        )
      }
    }
  }

  // Check for large time gaps
  for (let i = 0; i < transactions.length - 1; i++) {
    const current = transactions[i]
    const next = transactions[i + 1]
    const daysDiff = Math.abs((current.createdAt.getTime() - next.createdAt.getTime()) / (1000 * 60 * 60 * 24))

    if (daysDiff > 30) {
      analysis.unusualPatterns.push(
        `Large time gap: ${daysDiff.toFixed(0)} days between ${next.createdAt.toISOString()} and ${current.createdAt.toISOString()}`
      )
    }
  }

  // Check for negative balances
  const negativeBalances = transactions.filter(tx => tx.balance < 0)
  if (negativeBalances.length > 0) {
    analysis.unusualPatterns.push(`${negativeBalances.length} transactions with negative balance`)
    analysis.suspectedCauses.push('Sales occurred without sufficient stock')
    analysis.recommendations.push('Review sales transactions and enable stock validation')
  }

  // Check for suspicious transaction types
  const corrections = transactions.filter(tx => tx.transactionType === 'correction')
  if (corrections.length > 5) {
    analysis.unusualPatterns.push(`High number of corrections: ${corrections.length}`)
    analysis.suspectedCauses.push('Frequent manual adjustments may indicate underlying issue')
    analysis.recommendations.push('Review inventory management process')
  }

  // General recommendations based on variance
  if (variance.varianceType === 'shortage') {
    analysis.recommendations.push('Check for unrecorded sales or wastage')
    analysis.recommendations.push('Review shrinkage policies')
  } else if (variance.varianceType === 'overage') {
    analysis.recommendations.push('Check for unrecorded purchases or returns')
    analysis.recommendations.push('Verify physical count accuracy')
  }

  if (analysis.unusualPatterns.length === 0) {
    analysis.suspectedCauses.push('No obvious transaction anomalies detected')
    analysis.recommendations.push('Perform physical count verification')
    analysis.recommendations.push('Review beginning inventory setup')
  }

  return {
    variance,
    transactions,
    analysis
  }
}

/**
 * Generate comprehensive reconciliation report
 */
export async function getReconciliationReport(
  businessId: number,
  locationId?: number,
  reconciliationType: ReconciliationType = ReconciliationType.LEDGER_VS_SYSTEM
): Promise<ReconciliationReport> {

  let variances: VarianceDetection[] = []

  if (reconciliationType === ReconciliationType.LEDGER_VS_SYSTEM) {
    variances = await reconcileLedgerVsSystem(businessId, locationId)
  }
  // Add other reconciliation types in future (SYSTEM_VS_PHYSICAL, VALUATION_VS_GL)

  // Calculate summary statistics
  const overages = variances.filter(v => v.varianceType === 'overage')
  const shortages = variances.filter(v => v.varianceType === 'shortage')
  const matches = variances.filter(v => v.varianceType === 'match')

  const totalVarianceValue = variances.reduce((sum, v) => sum + Math.abs(v.varianceValue), 0)
  const totalOverageValue = overages.reduce((sum, v) => sum + v.varianceValue, 0)
  const totalShortageValue = shortages.reduce((sum, v) => sum + Math.abs(v.varianceValue), 0)

  const requiresInvestigation = variances.filter(v => v.requiresInvestigation).length
  const autoFixable = variances.filter(v => v.autoFixable).length

  return {
    reportDate: new Date(),
    businessId,
    locationId,
    reconciliationType,
    variances,
    summary: {
      totalVariances: variances.length,
      overages: overages.length,
      shortages: shortages.length,
      matches: matches.length,
      totalVarianceValue,
      totalOverageValue,
      totalShortageValue,
      requiresInvestigation,
      autoFixable
    }
  }
}

/**
 * Get reconciliation history for a specific product/variation
 */
export async function getReconciliationHistory(
  businessId: number,
  variationId: number,
  locationId?: number,
  limit: number = 50
): Promise<any[]> {

  const where: any = {
    businessId,
    transactionType: 'correction',
    referenceType: 'Reconciliation',
    variationId
  }

  if (locationId) {
    where.locationId = locationId
  }

  const reconciliations = await prisma.stockTransaction.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: limit,
    include: {
      user: {
        select: {
          id: true,
          username: true,
          firstName: true,
          lastName: true
        }
      },
      product: {
        select: {
          id: true,
          name: true,
          sku: true
        }
      },
      productVariation: {
        select: {
          id: true,
          name: true
        }
      },
      location: {
        select: {
          id: true,
          name: true
        }
      }
    }
  })

  return reconciliations.map(recon => ({
    id: recon.id,
    date: recon.createdAt,
    productName: recon.product.name,
    variationName: recon.productVariation?.name || 'Default',
    locationName: recon.location.name,
    quantity: recon.quantity,
    balance: recon.balance,
    notes: recon.notes,
    performedBy: recon.user ? `${recon.user.firstName} ${recon.user.lastName}` : 'System',
    referenceId: recon.referenceId
  }))
}

/**
 * Lock products requiring investigation to prevent further transactions
 */
export async function lockProductsRequiringInvestigation(
  businessId: number,
  userId: number,
  username: string,
  locationId?: number
): Promise<{ locked: number; productIds: number[] }> {

  const variances = await reconcileLedgerVsSystem(businessId, locationId)
  const requiresInvestigation = variances.filter(v => v.requiresInvestigation)

  const productIds = [...new Set(requiresInvestigation.map(v => v.productId))]

  for (const productId of productIds) {
    await prisma.product.update({
      where: { id: productId },
      data: {
        status: 'inactive', // Lock product
        updatedAt: new Date()
      }
    })

    // Audit log
    await createAuditLog({
      businessId,
      userId,
      username,
      action: 'PRODUCT_LOCKED_FOR_INVESTIGATION',
      entityType: 'PRODUCT',
      entityIds: [productId.toString()],
      description: `Product locked due to stock variance requiring investigation`,
      metadata: {
        reason: 'Stock variance investigation',
        locationId
      }
    })
  }

  return {
    locked: productIds.length,
    productIds
  }
}

/**
 * Export reconciliation report to CSV format
 */
export function exportReconciliationToCSV(report: ReconciliationReport): string {
  const headers = [
    'Product Name',
    'SKU',
    'Variation',
    'Location',
    'Ledger Balance',
    'System Balance',
    'Variance',
    'Variance %',
    'Variance Type',
    'Unit Cost',
    'Variance Value',
    'Last Transaction Date',
    'Last Transaction Type',
    'Requires Investigation',
    'Auto Fixable'
  ]

  const rows = report.variances.map(v => [
    v.productName,
    v.productSku,
    v.variationName,
    v.locationName,
    v.ledgerBalance.toString(),
    v.systemBalance.toString(),
    v.variance.toString(),
    v.variancePercentage.toFixed(2),
    v.varianceType,
    v.unitCost.toFixed(2),
    v.varianceValue.toFixed(2),
    v.lastTransactionDate?.toISOString() || 'N/A',
    v.lastTransactionType || 'N/A',
    v.requiresInvestigation ? 'YES' : 'NO',
    v.autoFixable ? 'YES' : 'NO'
  ])

  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
  ].join('\n')

  return csvContent
}
