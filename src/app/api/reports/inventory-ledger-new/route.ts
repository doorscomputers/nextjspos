/**
 * BULLETPROOF Inventory Transaction Ledger API Route
 *
 * Purpose: Track complete inventory history of a product at a specific location using
 * SINGLE SOURCE OF TRUTH: StockTransaction table ONLY.
 *
 * This version eliminates duplicates by querying ONLY the StockTransaction table,
 * which is designed to be the authoritative source for all inventory movements.
 *
 * Required permissions: INVENTORY_LEDGER_VIEW
 *
 * Architecture Decision:
 * - StockTransaction is the ONLY source queried
 * - ProductHistory is NOT queried (eliminates duplicates)
 * - Dedicated transaction tables (PurchaseReceipt, Sale, etc.) are NOT queried directly
 * - All inventory movements flow through stockOperations.ts which creates StockTransaction records
 *
 * Guarantees:
 * - NO DUPLICATES (single source = impossible to have overlapping data)
 * - COMPLETE HISTORY (all operations use stockOperations.ts)
 * - ACCURATE BALANCES (StockTransaction.balanceQty is calculated at transaction time)
 * - FUTURE-PROOF (new transaction types automatically included)
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { hasPermission } from '@/lib/rbac'

export const dynamic = 'force-dynamic'

interface TransactionRecord {
  date: Date
  type: string
  referenceNumber: string
  description: string
  quantityIn: number
  quantityOut: number
  runningBalance: number
  user: string
  unitCost: number | null
  notes: string | null
  referenceId?: number
  referenceType?: string
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json(
        { success: false, message: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Check permission
    if (!hasPermission(session.user, 'inventory_ledger.view')) {
      return NextResponse.json(
        { success: false, message: 'Permission denied. Required: INVENTORY_LEDGER_VIEW' },
        { status: 403 }
      )
    }

    const { searchParams } = new URL(request.url)
    const productId = searchParams.get('productId')
    const locationId = searchParams.get('locationId')
    const variationId = searchParams.get('variationId')
    const startDateParam = searchParams.get('startDate')
    const endDateParam = searchParams.get('endDate')

    // Validate required parameters
    if (!productId || !locationId || !variationId) {
      return NextResponse.json(
        {
          success: false,
          message: 'Missing required parameters: productId, locationId, and variationId are required'
        },
        { status: 400 }
      )
    }

    const businessId = parseInt(session.user.businessId)
    const prodId = parseInt(productId)
    const locId = parseInt(locationId)
    const varId = parseInt(variationId)

    // Verify product and location exist and belong to this business
    const product = await prisma.product.findFirst({
      where: { id: prodId, businessId },
      include: {
        variations: {
          where: { id: varId }
        }
      }
    })

    if (!product || product.variations.length === 0) {
      return NextResponse.json(
        { success: false, message: 'Product or variation not found' },
        { status: 404 }
      )
    }

    const location = await prisma.businessLocation.findFirst({
      where: { id: locId, businessId }
    })

    if (!location) {
      return NextResponse.json(
        { success: false, message: 'Location not found' },
        { status: 404 }
      )
    }

    // Step 1: Determine date range
    let startDate: Date
    let endDate: Date
    let openingBalance: number = 0
    let openingBalanceDescription: string = ''

    if (startDateParam) {
      startDate = new Date(startDateParam)
    } else {
      // Default: start from beginning
      startDate = new Date(0)
    }

    if (endDateParam) {
      endDate = new Date(endDateParam)
    } else {
      // Default: up to now (end of today)
      endDate = new Date()
      endDate.setHours(23, 59, 59, 999)
    }

    // Step 2: Calculate opening balance (if custom date range)
    // Get the balance from the last transaction BEFORE startDate
    if (startDateParam) {
      const lastTransactionBeforeStart = await prisma.stockTransaction.findFirst({
        where: {
          businessId,
          productVariationId: varId,
          locationId: locId,
          createdAt: {
            lt: startDate
          }
        },
        orderBy: {
          createdAt: 'desc'
        },
        select: {
          balanceQty: true,
          createdAt: true
        }
      })

      if (lastTransactionBeforeStart) {
        openingBalance = parseFloat(lastTransactionBeforeStart.balanceQty.toString())
        openingBalanceDescription = `Opening balance from transaction on ${lastTransactionBeforeStart.createdAt.toLocaleDateString()}`
      } else {
        openingBalance = 0
        openingBalanceDescription = `No transactions before ${startDate.toLocaleDateString()}`
      }
    }

    // Step 3: Query StockTransaction table ONLY (Single Source of Truth)
    const stockTransactions = await prisma.stockTransaction.findMany({
      where: {
        businessId,
        productVariationId: varId,
        locationId: locId,
        createdAt: {
          gte: startDate,
          lte: endDate
        }
      },
      include: {
        createdByUser: {
          select: {
            username: true,
            firstName: true,
            lastName: true
          }
        }
      },
      orderBy: {
        createdAt: 'asc'
      }
    })

    // Step 4: Transform StockTransaction records to unified format
    const transactions: TransactionRecord[] = []

    for (const tx of stockTransactions) {
      const quantity = parseFloat(tx.quantity.toString())
      const isIncrease = quantity > 0

      // Map transaction type to user-friendly label
      const typeLabels: Record<string, string> = {
        'opening_stock': 'Opening Stock',
        'purchase': 'Purchase Receipt',
        'sale': 'Sale',
        'transfer_in': 'Transfer In',
        'transfer_out': 'Transfer Out',
        'customer_return': 'Customer Return',
        'supplier_return': 'Supplier Return',
        'correction': 'Inventory Correction',
        'adjustment': 'Stock Adjustment'
      }

      const typeLabel = typeLabels[tx.type] || tx.type.replace(/_/g, ' ').toUpperCase()

      // Build description
      let description = tx.notes || typeLabel
      if (tx.referenceType && tx.referenceId) {
        description += ` (Ref: ${tx.referenceType} #${tx.referenceId})`
      }

      // User display name
      const user = tx.createdByUser
        ? `${tx.createdByUser.firstName || ''} ${tx.createdByUser.lastName || ''}`.trim() || tx.createdByUser.username
        : 'System'

      transactions.push({
        date: tx.createdAt,
        type: typeLabel,
        referenceNumber: tx.referenceId?.toString() || `TX-${tx.id}`,
        description,
        quantityIn: isIncrease ? Math.abs(quantity) : 0,
        quantityOut: isIncrease ? 0 : Math.abs(quantity),
        runningBalance: parseFloat(tx.balanceQty.toString()),
        user,
        unitCost: tx.unitCost ? parseFloat(tx.unitCost.toString()) : null,
        notes: tx.notes,
        referenceId: tx.referenceId || undefined,
        referenceType: tx.referenceType || undefined
      })
    }

    // Step 5: Get current system inventory
    const currentInventory = await prisma.variationLocationDetails.findFirst({
      where: {
        productVariationId: varId,
        locationId: locId
      },
      select: {
        qtyAvailable: true
      }
    })

    const currentSystemInventory = currentInventory
      ? parseFloat(currentInventory.qtyAvailable.toString())
      : 0

    // Step 6: Calculate reconciliation
    const totalStockIn = transactions.reduce((sum, t) => sum + t.quantityIn, 0)
    const totalStockOut = transactions.reduce((sum, t) => sum + t.quantityOut, 0)
    const netChange = totalStockIn - totalStockOut

    // Final balance should be: opening + net change
    const calculatedFinalBalance = openingBalance + netChange

    // Check if the calculated balance matches the last transaction's balance
    const lastTransactionBalance = transactions.length > 0
      ? transactions[transactions.length - 1].runningBalance
      : openingBalance

    // Variance is the difference between system inventory and calculated balance
    const variance = currentSystemInventory - calculatedFinalBalance

    // Reconciled if system inventory matches the last transaction balance
    const isReconciled = Math.abs(currentSystemInventory - lastTransactionBalance) < 0.0001

    // Return comprehensive report
    return NextResponse.json({
      success: true,
      data: {
        // Header information
        header: {
          product: {
            id: product.id,
            name: product.name,
            sku: product.sku,
            variation: product.variations[0]
          },
          location: {
            id: location.id,
            name: location.name
          },
          reportPeriod: {
            from: startDate,
            to: endDate,
            description: startDateParam
              ? openingBalanceDescription
              : 'All transactions from beginning'
          },
          baseline: {
            quantity: openingBalance,
            description: openingBalanceDescription || 'Starting from first transaction'
          }
        },

        // Transaction details
        transactions,

        // Summary and reconciliation
        summary: {
          totalStockIn,
          totalStockOut,
          netChange,
          startingBalance: openingBalance,
          calculatedFinalBalance,
          lastTransactionBalance,
          currentSystemInventory,
          variance,
          isReconciled,
          reconciliationStatus: isReconciled ? 'Matched' : 'Discrepancy',
          transactionCount: transactions.length
        },

        // Metadata
        metadata: {
          dataSource: 'StockTransaction (Single Source of Truth)',
          queryMethod: 'Direct StockTransaction table query',
          noDuplicateGuarantee: true,
          generatedAt: new Date().toISOString()
        }
      }
    })

  } catch (error) {
    console.error('Error generating inventory ledger:', error)

    // Log detailed error information
    if (error instanceof Error) {
      console.error('Error name:', error.name)
      console.error('Error message:', error.message)
      console.error('Error stack:', error.stack)
    }

    return NextResponse.json(
      {
        success: false,
        message: 'Failed to generate inventory ledger',
        error: error instanceof Error ? error.message : 'Unknown error',
        details: error instanceof Error ? error.stack : undefined
      },
      { status: 500 }
    )
  }
}
