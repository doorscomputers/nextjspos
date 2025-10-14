/**
 * Inventory Transaction Ledger API Route
 *
 * Purpose: Track complete inventory history of a product at a specific location,
 * proving current system inventory matches reality by showing all transactions
 * since the last inventory correction.
 *
 * Required permissions: INVENTORY_LEDGER_VIEW
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { hasPermission, getLocationWhereClause } from '@/lib/rbac'
import { Prisma } from '@prisma/client'

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
  relatedLocation?: string
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

    const businessId = parseInt(session.user.businessId.toString())
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

    // Step 1: Find the LAST (most recent) inventory correction for this product/location/variation
    const lastCorrection = await prisma.inventoryCorrection.findFirst({
      where: {
        businessId,
        locationId: locId,
        productId: prodId,
        productVariationId: varId,
        status: 'approved'
      },
      orderBy: { createdAt: 'desc' },
      include: {
        createdByUser: {
          select: { username: true }
        }
      }
    })

    // Step 2: Determine date range
    // FROM: Last correction date (or override from query params)
    // TO: Current date/time (or override from query params)
    let startDate: Date
    let baselineQuantity: number = 0
    let baselineDescription: string = ''
    let isCustomDateRange = false

    if (startDateParam) {
      // User has overridden the start date - we need to calculate opening balance
      startDate = new Date(startDateParam)
      isCustomDateRange = true
      baselineDescription = 'Custom date range - Opening balance calculated from historical transactions'
    } else if (lastCorrection) {
      startDate = lastCorrection.createdAt
      baselineQuantity = parseFloat(lastCorrection.physicalCount.toString())
      baselineDescription = `Last Inventory Correction (${lastCorrection.reason})`
    } else {
      // No correction found - start from beginning of time or first transaction
      startDate = new Date(0)
      baselineDescription = 'No correction found - Starting from first transaction'
    }

    // End date: NOW (inclusive of today's transactions)
    const endDate = endDateParam ? new Date(endDateParam) : new Date()

    // Ensure endDate includes the entire day (end of day timestamp)
    if (!endDateParam) {
      endDate.setHours(23, 59, 59, 999)
    }

    // Step 2.5: Calculate opening balance for custom date ranges
    // If user provided custom start date, we must calculate opening balance
    // from ALL transactions BEFORE that date
    if (isCustomDateRange) {
      console.log('[Ledger] Custom date range detected. Calculating opening balance...')

      // Query all transactions BEFORE the start date to calculate opening balance
      const [
        receiptsBefore,
        salesBefore,
        transfersOutBefore,
        transfersInBefore,
        correctionsBefore
      ] = await Promise.all([
        // Purchase Receipts before start date
        prisma.purchaseReceipt.findMany({
          where: {
            businessId,
            locationId: locId,
            status: 'approved',
            approvedAt: { lt: startDate },
            items: {
              some: {
                productId: prodId,
                productVariationId: varId
              }
            }
          },
          include: {
            items: {
              where: {
                productId: prodId,
                productVariationId: varId
              }
            }
          }
        }),

        // Sales before start date
        prisma.sale.findMany({
          where: {
            businessId,
            locationId: locId,
            status: 'completed',
            createdAt: { lt: startDate },
            items: {
              some: {
                productId: prodId,
                productVariationId: varId
              }
            }
          },
          include: {
            items: {
              where: {
                productId: prodId,
                productVariationId: varId
              }
            }
          }
        }),

        // Transfers Out before start date
        prisma.stockTransfer.findMany({
          where: {
            businessId,
            fromLocationId: locId,
            status: 'completed',
            completedAt: { lt: startDate },
            items: {
              some: {
                productId: prodId,
                productVariationId: varId
              }
            }
          },
          include: {
            items: {
              where: {
                productId: prodId,
                productVariationId: varId
              }
            }
          }
        }),

        // Transfers In before start date
        prisma.stockTransfer.findMany({
          where: {
            businessId,
            toLocationId: locId,
            status: 'completed',
            completedAt: { lt: startDate },
            items: {
              some: {
                productId: prodId,
                productVariationId: varId
              }
            }
          },
          include: {
            items: {
              where: {
                productId: prodId,
                productVariationId: varId
              }
            }
          }
        }),

        // Inventory Corrections before start date
        prisma.inventoryCorrection.findMany({
          where: {
            businessId,
            locationId: locId,
            productId: prodId,
            productVariationId: varId,
            status: 'approved',
            approvedAt: { lt: startDate }
          },
          orderBy: { approvedAt: 'desc' }
        })
      ])

      // Check if there's a correction before the start date
      // If yes, use that as the baseline and add subsequent transactions
      if (correctionsBefore.length > 0) {
        const lastCorrectionBeforeStart = correctionsBefore[0] // Most recent
        baselineQuantity = parseFloat(lastCorrectionBeforeStart.physicalCount.toString())
        baselineDescription = `Opening balance from correction on ${lastCorrectionBeforeStart.createdAt.toLocaleDateString()} (${lastCorrectionBeforeStart.reason})`

        // Add transactions AFTER that correction but BEFORE the start date
        const correctionDate = lastCorrectionBeforeStart.createdAt

        for (const receipt of receiptsBefore) {
          if ((receipt.approvedAt || receipt.createdAt) > correctionDate) {
            const item = receipt.items[0]
            if (item) {
              baselineQuantity += parseFloat(item.quantityReceived.toString())
            }
          }
        }

        for (const sale of salesBefore) {
          if (sale.createdAt > correctionDate) {
            const item = sale.items[0]
            if (item) {
              baselineQuantity -= parseFloat(item.quantity.toString())
            }
          }
        }

        for (const transfer of transfersOutBefore) {
          if ((transfer.completedAt || transfer.createdAt) > correctionDate) {
            const item = transfer.items[0]
            if (item) {
              baselineQuantity -= parseFloat(item.quantity.toString())
            }
          }
        }

        for (const transfer of transfersInBefore) {
          if ((transfer.completedAt || transfer.createdAt) > correctionDate) {
            const item = transfer.items[0]
            if (item) {
              baselineQuantity += parseFloat(item.quantity.toString())
            }
          }
        }
      } else {
        // No correction exists before start date
        // Calculate opening balance from ALL transactions before start date
        for (const receipt of receiptsBefore) {
          const item = receipt.items[0]
          if (item) {
            baselineQuantity += parseFloat(item.quantityReceived.toString())
          }
        }

        for (const sale of salesBefore) {
          const item = sale.items[0]
          if (item) {
            baselineQuantity -= parseFloat(item.quantity.toString())
          }
        }

        for (const transfer of transfersOutBefore) {
          const item = transfer.items[0]
          if (item) {
            baselineQuantity -= parseFloat(item.quantity.toString())
          }
        }

        for (const transfer of transfersInBefore) {
          const item = transfer.items[0]
          if (item) {
            baselineQuantity += parseFloat(item.quantity.toString())
          }
        }

        baselineDescription = `Opening balance calculated from ${receiptsBefore.length + salesBefore.length + transfersOutBefore.length + transfersInBefore.length} transaction(s) before ${startDate.toLocaleDateString()}`
      }

      console.log(`[Ledger] Opening balance calculated: ${baselineQuantity} units`)
      console.log(`[Ledger] Description: ${baselineDescription}`)
    }

    // Step 3: Query all transaction types in parallel
    const [
      purchaseReceipts,
      sales,
      transfersOut,
      transfersIn,
      corrections,
      purchaseReturns,
      customerReturns
    ] = await Promise.all([
      // a) Stock Received (Purchase Receipts/GRN)
      prisma.purchaseReceipt.findMany({
        where: {
          businessId,
          locationId: locId,
          status: 'approved',
          approvedAt: {
            gte: startDate,
            lte: endDate
          },
          items: {
            some: {
              productId: prodId,
              productVariationId: varId
            }
          }
        },
        include: {
          items: {
            where: {
              productId: prodId,
              productVariationId: varId
            }
          },
          purchase: {
            select: { purchaseOrderNumber: true }
          }
        },
        orderBy: { approvedAt: 'asc' }
      }),

      // b) Stock Sold (Sales)
      prisma.sale.findMany({
        where: {
          businessId,
          locationId: locId,
          status: { in: ['completed'] }, // Only completed sales
          createdAt: {
            gte: startDate,
            lte: endDate
          },
          items: {
            some: {
              productId: prodId,
              productVariationId: varId
            }
          }
        },
        include: {
          items: {
            where: {
              productId: prodId,
              productVariationId: varId
            }
          }
        },
        orderBy: { createdAt: 'asc' }
      }),

      // c) Stock Transferred Out
      prisma.stockTransfer.findMany({
        where: {
          businessId,
          fromLocationId: locId,
          status: 'completed',
          completedAt: {
            gte: startDate,
            lte: endDate
          },
          items: {
            some: {
              productId: prodId,
              productVariationId: varId
            }
          }
        },
        include: {
          items: {
            where: {
              productId: prodId,
              productVariationId: varId
            }
          },
          toLocation: {
            select: { name: true }
          }
        },
        orderBy: { completedAt: 'asc' }
      }),

      // d) Stock Transferred In
      prisma.stockTransfer.findMany({
        where: {
          businessId,
          toLocationId: locId,
          status: 'completed',
          completedAt: {
            gte: startDate,
            lte: endDate
          },
          items: {
            some: {
              productId: prodId,
              productVariationId: varId
            }
          }
        },
        include: {
          items: {
            where: {
              productId: prodId,
              productVariationId: varId
            }
          },
          fromLocation: {
            select: { name: true }
          }
        },
        orderBy: { completedAt: 'asc' }
      }),

      // e) Inventory Corrections (after baseline)
      prisma.inventoryCorrection.findMany({
        where: {
          businessId,
          locationId: locId,
          productId: prodId,
          productVariationId: varId,
          status: 'approved',
          approvedAt: {
            gt: startDate, // Greater than (not equal) to exclude baseline correction
            lte: endDate
          }
        },
        include: {
          createdByUser: {
            select: { username: true }
          }
        },
        orderBy: { approvedAt: 'asc' }
      }),

      // f) Purchase Returns
      prisma.purchaseReturn.findMany({
        where: {
          businessId,
          locationId: locId,
          status: 'approved',
          approvedAt: {
            gte: startDate,
            lte: endDate
          },
          items: {
            some: {
              productId: prodId,
              productVariationId: varId
            }
          }
        },
        include: {
          items: {
            where: {
              productId: prodId,
              productVariationId: varId
            }
          }
        },
        orderBy: { approvedAt: 'asc' }
      }),

      // g) Customer Returns (Sales Returns/Refunds)
      prisma.customerReturn.findMany({
        where: {
          businessId,
          locationId: locId,
          status: 'approved',
          approvedAt: {
            gte: startDate,
            lte: endDate
          },
          items: {
            some: {
              productId: prodId,
              productVariationId: varId
            }
          }
        },
        include: {
          items: {
            where: {
              productId: prodId,
              productVariationId: varId
            }
          },
          sale: {
            select: { invoiceNumber: true }
          }
        },
        orderBy: { approvedAt: 'asc' }
      })
    ])

    // Step 4: Merge all transactions into a unified array
    const transactions: TransactionRecord[] = []

    // Add purchase receipts
    for (const receipt of purchaseReceipts) {
      const item = receipt.items[0] // We filtered to only include matching items
      if (!item) continue

      transactions.push({
        date: receipt.approvedAt || receipt.createdAt,
        type: 'Stock Received',
        referenceNumber: receipt.receiptNumber,
        description: `Stock Received - GRN #${receipt.receiptNumber}${receipt.purchase ? ` (PO #${receipt.purchase.purchaseOrderNumber})` : ' (Direct Entry)'}`,
        quantityIn: parseFloat(item.quantityReceived.toString()),
        quantityOut: 0,
        runningBalance: 0, // Will calculate later
        user: 'System',
        referenceId: receipt.id,
        referenceType: 'purchase_receipt'
      })
    }

    // Add sales
    for (const sale of sales) {
      const item = sale.items[0]
      if (!item) continue

      transactions.push({
        date: sale.createdAt,
        type: 'Stock Sold',
        referenceNumber: sale.invoiceNumber,
        description: `Stock Sold - Invoice #${sale.invoiceNumber}`,
        quantityIn: 0,
        quantityOut: parseFloat(item.quantity.toString()),
        runningBalance: 0,
        user: 'Cashier',
        referenceId: sale.id,
        referenceType: 'sale'
      })
    }

    // Add transfers out
    for (const transfer of transfersOut) {
      const item = transfer.items[0]
      if (!item) continue

      transactions.push({
        date: transfer.completedAt || transfer.createdAt,
        type: 'Transfer Out',
        referenceNumber: transfer.transferNumber,
        description: `Transfer Out to ${transfer.toLocation?.name || 'Unknown'} - TR #${transfer.transferNumber}`,
        quantityIn: 0,
        quantityOut: parseFloat(item.quantity.toString()),
        runningBalance: 0,
        user: 'System',
        relatedLocation: transfer.toLocation?.name,
        referenceId: transfer.id,
        referenceType: 'transfer_out'
      })
    }

    // Add transfers in
    for (const transfer of transfersIn) {
      const item = transfer.items[0]
      if (!item) continue

      transactions.push({
        date: transfer.completedAt || transfer.createdAt,
        type: 'Transfer In',
        referenceNumber: transfer.transferNumber,
        description: `Transfer In from ${transfer.fromLocation?.name || 'Unknown'} - TR #${transfer.transferNumber}`,
        quantityIn: parseFloat(item.quantity.toString()),
        quantityOut: 0,
        runningBalance: 0,
        user: 'System',
        relatedLocation: transfer.fromLocation?.name,
        referenceId: transfer.id,
        referenceType: 'transfer_in'
      })
    }

    // Add corrections
    for (const correction of corrections) {
      const difference = parseFloat(correction.difference.toString())

      transactions.push({
        date: correction.approvedAt || correction.createdAt,
        type: 'Inventory Correction',
        referenceNumber: `COR-${correction.id}`,
        description: `Inventory Correction - Reason: ${correction.reason}${correction.remarks ? ` (${correction.remarks})` : ''}`,
        quantityIn: difference > 0 ? difference : 0,
        quantityOut: difference < 0 ? Math.abs(difference) : 0,
        runningBalance: 0,
        user: correction.createdByUser.username,
        referenceId: correction.id,
        referenceType: 'correction'
      })
    }

    // Add purchase returns
    for (const returnDoc of purchaseReturns) {
      const item = returnDoc.items[0]
      if (!item) continue

      transactions.push({
        date: returnDoc.approvedAt || returnDoc.createdAt,
        type: 'Purchase Return',
        referenceNumber: returnDoc.returnNumber,
        description: `Purchase Return - RET #${returnDoc.returnNumber} (Reason: ${returnDoc.returnReason})`,
        quantityIn: 0,
        quantityOut: parseFloat(item.quantityReturned.toString()),
        runningBalance: 0,
        user: 'System',
        referenceId: returnDoc.id,
        referenceType: 'purchase_return'
      })
    }

    // Add customer returns
    for (const returnDoc of customerReturns) {
      const item = returnDoc.items[0]
      if (!item) continue

      transactions.push({
        date: returnDoc.approvedAt || returnDoc.createdAt,
        type: 'Sales Return',
        referenceNumber: returnDoc.returnNumber,
        description: `Sales Return - REF #${returnDoc.returnNumber}${returnDoc.sale ? ` (Invoice #${returnDoc.sale.invoiceNumber})` : ''}`,
        quantityIn: parseFloat(item.quantity.toString()), // Fixed: use 'quantity' not 'quantityReturned'
        quantityOut: 0,
        runningBalance: 0,
        user: 'System',
        referenceId: returnDoc.id,
        referenceType: 'customer_return'
      })
    }

    // Step 5: Sort all transactions chronologically
    transactions.sort((a, b) => a.date.getTime() - b.date.getTime())

    // Step 6: Calculate running balance
    let runningBalance = baselineQuantity
    for (const transaction of transactions) {
      runningBalance += transaction.quantityIn - transaction.quantityOut
      transaction.runningBalance = runningBalance
    }

    // Step 7: Query current system inventory
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

    // Step 8: Calculate reconciliation
    const calculatedFinalBalance = runningBalance
    const variance = calculatedFinalBalance - currentSystemInventory
    const isReconciled = Math.abs(variance) < 0.0001 // Account for floating point precision

    // Calculate summary statistics
    const totalStockIn = transactions.reduce((sum, t) => sum + t.quantityIn, 0)
    const totalStockOut = transactions.reduce((sum, t) => sum + t.quantityOut, 0)
    const netChange = totalStockIn - totalStockOut

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
            description: `${baselineDescription}`
          },
          baseline: {
            quantity: baselineQuantity,
            date: lastCorrection?.createdAt || null,
            description: baselineDescription
          }
        },

        // Transaction details
        transactions,

        // Summary and reconciliation
        summary: {
          totalStockIn,
          totalStockOut,
          netChange,
          startingBalance: baselineQuantity,
          calculatedFinalBalance,
          currentSystemInventory,
          variance,
          isReconciled,
          reconciliationStatus: isReconciled ? 'Matched' : 'Discrepancy',
          transactionCount: transactions.length
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
