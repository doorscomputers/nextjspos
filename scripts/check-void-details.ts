import { config } from 'dotenv'
import { resolve } from 'path'
config({ path: resolve(process.cwd(), '.env') })

if (!process.env.DATABASE_URL && process.env.StiDATABASE_URL) {
  process.env.DATABASE_URL = process.env.StiDATABASE_URL
}

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function checkVoid() {
  console.log('=== CHECKING VOID DETAILS FOR O156IPC SALE ===\n')

  // Find the sale first
  const sale = await prisma.sale.findFirst({
    where: {
      invoiceNumber: 'InvTuguega01_24_2026_0001'
    },
    include: {
      creator: { select: { id: true, username: true, firstName: true, lastName: true } },
      location: { select: { name: true } }
    }
  })

  if (!sale) {
    console.log('Sale not found!')
    return
  }

  console.log('SALE DETAILS:')
  console.log(`  Invoice: ${sale.invoiceNumber}`)
  console.log(`  Status: ${sale.status}`)
  console.log(`  Total: ${sale.totalAmount}`)
  console.log(`  Location: ${sale.location.name}`)
  console.log(`  Created By: ${sale.creator.username} (ID: ${sale.creator.id})`)
  console.log(`  Created At: ${sale.createdAt}`)
  console.log(`  Updated At: ${sale.updatedAt}`)

  // Check void_transactions table using raw query
  console.log('\n=== VOID TRANSACTION DETAILS ===')
  const voidTxns = await prisma.$queryRaw`
    SELECT vt.*,
           u1.username as voided_by_username, u1.first_name as voided_by_first_name,
           u2.username as approved_by_username, u2.first_name as approved_by_first_name
    FROM void_transactions vt
    LEFT JOIN users u1 ON u1.id = vt.voided_by
    LEFT JOIN users u2 ON u2.id = vt.approved_by
    WHERE vt.sale_id = ${sale.id}
  ` as any[]

  if (voidTxns.length === 0) {
    console.log('No void transactions found in void_transactions table.')

    // Try checking stock transactions for void reference
    console.log('\nChecking stock transactions for void info...')
    const stockVoid = await prisma.$queryRaw`
      SELECT st.*, u.username, u.first_name
      FROM stock_transactions st
      LEFT JOIN users u ON u.id = st.created_by
      WHERE st.reference_type = 'sale_void' AND st.reference_id = ${sale.id}
      LIMIT 1
    ` as any[]

    if (stockVoid.length > 0) {
      const sv = stockVoid[0]
      console.log('\nFound void info in stock_transactions:')
      console.log(`  Voided By: ${sv.username} (ID: ${sv.created_by})`)
      console.log(`  Void Date: ${sv.created_at}`)
      console.log(`  Qty Restored: ${sv.quantity}`)
    }
  } else {
    voidTxns.forEach((v: any) => {
      console.log(`\n  Void ID: ${v.id}`)
      console.log(`  Reason: ${v.reason || 'No reason provided'}`)
      console.log(`  Voided By: ${v.voided_by_username || 'N/A'} (${v.voided_by_first_name || ''}) (ID: ${v.voided_by || 'N/A'})`)
      console.log(`  Approved By: ${v.approved_by_username || 'N/A'} (${v.approved_by_first_name || ''}) (ID: ${v.approved_by || 'N/A'})`)
      console.log(`  Void Date: ${v.created_at}`)
    })
  }

  // Also check product history for any void-related entries
  console.log('\n=== PRODUCT HISTORY FOR THIS SALE ===')
  const prodHistory = await prisma.productHistory.findMany({
    where: {
      OR: [
        { referenceId: sale.id, referenceType: 'sale' },
        { referenceId: sale.id, referenceType: 'sale_void' }
      ]
    },
    include: {
      createdByUser: { select: { username: true } }
    },
    orderBy: { createdAt: 'asc' }
  })

  if (prodHistory.length > 0) {
    prodHistory.forEach(ph => {
      console.log(`  ${ph.transactionType} | Qty: ${ph.quantityChange} | By: ${ph.createdByUser?.username} | Date: ${ph.createdAt}`)
    })
  } else {
    console.log('  No product history entries found for this sale.')
  }

  // Check all stock transactions related to this sale
  console.log('\n=== ALL STOCK TRANSACTIONS FOR THIS SALE ===')
  const allStockTxns = await prisma.stockTransaction.findMany({
    where: {
      OR: [
        { referenceId: sale.id, referenceType: 'sale' },
        { referenceId: sale.id, referenceType: 'sale_void' }
      ]
    },
    include: {
      createdByUser: { select: { id: true, username: true } },
      productVariation: { select: { sku: true } }
    },
    orderBy: { createdAt: 'asc' }
  })

  if (allStockTxns.length > 0) {
    allStockTxns.forEach(st => {
      console.log(`  ${st.type} | ${st.productVariation?.sku} | Qty: ${st.quantity} | Balance: ${st.balanceQty} | By: ${st.createdByUser?.username} (ID: ${st.createdByUser?.id}) | Date: ${st.createdAt}`)
    })
  }

  console.log('\n=== COMPLETE ===')
}

checkVoid()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
