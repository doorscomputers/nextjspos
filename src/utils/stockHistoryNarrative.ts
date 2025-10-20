import { StockHistoryEntry } from '@/types/product'

interface StockSummary {
  totalIn: number
  totalOut: number
  expectedStock: number
  actualStock: number
  discrepancy: number
  details: {
    openingStock: number
    purchases: number
    sellReturns: number
    transfersIn: number
    sales: number
    adjustments: number
    purchaseReturns: number
    transfersOut: number
  }
}

/**
 * Calculate stock summary from history entries
 */
export function calculateStockSummary(history: StockHistoryEntry[]): StockSummary {
  const details = {
    openingStock: history.filter(h => h.transactionType === 'opening_stock').reduce((sum, h) => sum + h.quantityAdded, 0),
    purchases: history.filter(h => h.transactionType === 'purchase').reduce((sum, h) => sum + h.quantityAdded, 0),
    sellReturns: history.filter(h => h.transactionType === 'sell_return').reduce((sum, h) => sum + h.quantityAdded, 0),
    transfersIn: history.filter(h => h.transactionType === 'transfer_in').reduce((sum, h) => sum + h.quantityAdded, 0),
    sales: history.filter(h => h.transactionType === 'sale').reduce((sum, h) => sum + h.quantityRemoved, 0),
    adjustments: history.filter(h => h.transactionType === 'adjustment').reduce((sum, h) => sum + h.quantityRemoved, 0),
    purchaseReturns: history.filter(h => h.transactionType === 'purchase_return').reduce((sum, h) => sum + h.quantityRemoved, 0),
    transfersOut: history.filter(h => h.transactionType === 'transfer_out').reduce((sum, h) => sum + h.quantityRemoved, 0),
  }

  const totalIn = details.openingStock + details.purchases + details.sellReturns + details.transfersIn
  const totalOut = details.sales + details.adjustments + details.purchaseReturns + details.transfersOut
  const expectedStock = totalIn - totalOut
  const actualStock = history.length > 0 ? history[0].runningBalance : 0
  const discrepancy = actualStock - expectedStock

  return {
    totalIn,
    totalOut,
    expectedStock,
    actualStock,
    discrepancy,
    details
  }
}

/**
 * Generate a human-readable narrative explaining the product stock history
 */
export function generateStockHistoryNarrative(
  history: StockHistoryEntry[],
  productName: string,
  locationName: string
): string {
  if (history.length === 0) {
    return `No transaction history available for ${productName} at ${locationName}.`
  }

  const summary = calculateStockSummary(history)
  const { details } = summary

  // Build narrative sections
  const sections: string[] = []

  // Opening line
  sections.push(`📊 **Stock Story for ${productName} at ${locationName}**\n`)

  // Starting point
  if (details.openingStock > 0) {
    sections.push(`You started with **${details.openingStock.toFixed(2)} units** as opening stock.`)
  } else {
    sections.push(`This product started with no opening stock.`)
  }

  // What came in (additions)
  const additions: string[] = []
  if (details.purchases > 0) {
    additions.push(`${details.purchases.toFixed(2)} units from purchases`)
  }
  if (details.sellReturns > 0) {
    additions.push(`${details.sellReturns.toFixed(2)} units from customer returns`)
  }
  if (details.transfersIn > 0) {
    additions.push(`${details.transfersIn.toFixed(2)} units from location transfers (incoming)`)
  }

  if (additions.length > 0) {
    sections.push(`\n✅ **Stock added:** ${additions.join(', ')}.`)
  }

  // What went out (removals)
  const removals: string[] = []
  if (details.sales > 0) {
    removals.push(`${details.sales.toFixed(2)} units sold to customers`)
  }
  if (details.adjustments > 0) {
    removals.push(`${details.adjustments.toFixed(2)} units via stock adjustments`)
  }
  if (details.purchaseReturns > 0) {
    removals.push(`${details.purchaseReturns.toFixed(2)} units returned to suppliers`)
  }
  if (details.transfersOut > 0) {
    removals.push(`${details.transfersOut.toFixed(2)} units transferred to other locations`)
  }

  if (removals.length > 0) {
    sections.push(`\n❌ **Stock removed:** ${removals.join(', ')}.`)
  }

  // The math
  sections.push(`\n🔢 **The Calculation:**`)
  sections.push(`- Stock IN: ${summary.totalIn.toFixed(2)} units (opening + purchases + returns + transfers in)`)
  sections.push(`- Stock OUT: ${summary.totalOut.toFixed(2)} units (sales + adjustments + returns + transfers out)`)
  sections.push(`- **Expected Stock**: ${summary.expectedStock.toFixed(2)} units`)
  sections.push(`- **Actual Current Stock**: ${summary.actualStock.toFixed(2)} units`)

  // Discrepancy analysis
  if (Math.abs(summary.discrepancy) > 0.01) {
    sections.push(`\n⚠️ **Discrepancy Detected: ${Math.abs(summary.discrepancy).toFixed(2)} units ${summary.discrepancy > 0 ? 'MORE' : 'LESS'} than expected!**`)

    if (summary.discrepancy < 0) {
      sections.push(`\nThis means you have **${Math.abs(summary.discrepancy).toFixed(2)} units less** than the math suggests. Possible reasons:`)
      sections.push(`- Some transactions may have been manually deleted from the database`)
      sections.push(`- Unrecorded shrinkage, theft, or damage`)
      sections.push(`- Data integrity issues`)
      sections.push(`- Voided sales that removed stock but aren't reflected in the history`)
    } else {
      sections.push(`\nThis means you have **${summary.discrepancy.toFixed(2)} units more** than expected. Possible reasons:`)
      sections.push(`- Some removal transactions may have been deleted`)
      sections.push(`- Unrecorded inventory corrections`)
      sections.push(`- Data was manually adjusted in the database`)
    }
  } else {
    sections.push(`\n✅ **Perfect Match!** The math checks out. Current stock matches the expected stock based on all recorded transactions.`)
  }

  // Transaction count
  sections.push(`\n📝 **Total Transactions Recorded:** ${history.length}`)

  return sections.join('\n')
}

/**
 * Generate a concise one-line summary
 */
export function generateStockSummarySentence(history: StockHistoryEntry[]): string {
  if (history.length === 0) {
    return "No stock movements recorded."
  }

  const summary = calculateStockSummary(history)

  if (Math.abs(summary.discrepancy) > 0.01) {
    return `Started with ${summary.details.openingStock.toFixed(2)}, added ${(summary.totalIn - summary.details.openingStock).toFixed(2)}, removed ${summary.totalOut.toFixed(2)}, but current stock is ${summary.actualStock.toFixed(2)} (expected ${summary.expectedStock.toFixed(2)} – discrepancy of ${Math.abs(summary.discrepancy).toFixed(2)} units).`
  }

  return `Started with ${summary.details.openingStock.toFixed(2)}, added ${(summary.totalIn - summary.details.openingStock).toFixed(2)}, removed ${summary.totalOut.toFixed(2)}, current stock: ${summary.actualStock.toFixed(2)} ✓`
}
