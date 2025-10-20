/**
 * Test the new bulletproof inventory ledger
 */

import fetch from 'node-fetch'

async function testNewLedger() {
  console.log('='.repeat(80))
  console.log('TESTING NEW BULLETPROOF INVENTORY LEDGER')
  console.log('='.repeat(80))
  console.log()

  // Test product: 1826DJNTY LEATHERETTE EXECUTIVE CHAIR
  const productId = 306
  const variationId = 306
  const locationId = 2

  const url = `http://localhost:3000/api/reports/inventory-ledger-new?productId=${productId}&variationId=${variationId}&locationId=${locationId}`

  console.log('Testing URL:', url)
  console.log()

  try {
    const response = await fetch(url)
    const data = await response.json()

    if (!data.success) {
      console.error('API Error:', data.message)
      return
    }

    console.log('RESULT:')
    console.log(JSON.stringify(data, null, 2))

    console.log()
    console.log('='.repeat(80))
    console.log('SUMMARY')
    console.log('='.repeat(80))

    const summary = data.data.summary
    console.log(`Total Stock In:  ${summary.totalStockIn}`)
    console.log(`Total Stock Out: ${summary.totalStockOut}`)
    console.log(`Net Change:      ${summary.netChange}`)
    console.log(`Starting Balance: ${summary.startingBalance}`)
    console.log(`Calculated Final: ${summary.calculatedFinalBalance}`)
    console.log(`System Inventory: ${summary.currentSystemInventory}`)
    console.log(`Variance:         ${summary.variance}`)
    console.log(`Status:           ${summary.reconciliationStatus}`)
    console.log(`Transaction Count: ${summary.transactionCount}`)

    console.log()
    console.log('TRANSACTIONS:')
    data.data.transactions.forEach((tx, idx) => {
      console.log(`${idx + 1}. ${tx.type} | In: ${tx.quantityIn} | Out: ${tx.quantityOut} | Balance: ${tx.runningBalance} | ${tx.date}`)
    })

    console.log()
    if (summary.variance === 0 && summary.isReconciled) {
      console.log('SUCCESS: Inventory is reconciled with NO variance!')
    } else {
      console.log(`WARNING: Variance detected: ${summary.variance}`)
    }

  } catch (error) {
    console.error('Test failed:', error)
  }
}

testNewLedger()
