/**
 * Final verification of stock history data
 */

import { PrismaClient } from '@prisma/client'

const PRODUCTION_DATABASE_URL = 'postgresql://postgres.ydytljrzuhvimrtixinw:Mtip12_14T%21@aws-1-ap-southeast-1.pooler.supabase.com:5432/postgres'

const prisma = new PrismaClient({
  datasources: { db: { url: PRODUCTION_DATABASE_URL } }
})

async function main() {
  console.log('=== FINAL VERIFICATION ===\n')

  const productId = 321
  const variationId = 321
  const locationId = 4

  // Current stock
  const stock = await prisma.$queryRaw<any[]>`
    SELECT qty_available FROM variation_location_details
    WHERE product_id = ${productId} AND product_variation_id = ${variationId} AND location_id = ${locationId}
  `
  console.log('Current Stock in DB:', stock[0]?.qty_available)

  // Count non-deleted corrections
  const corrections = await prisma.$queryRaw<any[]>`
    SELECT COUNT(*) as count FROM inventory_corrections
    WHERE product_id = ${productId} AND location_id = ${locationId} AND deleted_at IS NULL AND status = 'approved'
  `
  console.log('Active InventoryCorrections:', corrections[0]?.count)

  // List all records that would appear on stock history
  console.log('\n=== Expected Stock History Display ===')

  // ProductHistory (non-sale)
  const history = await prisma.$queryRaw<any[]>`
    SELECT id, transaction_type, reference_type, reference_id, quantity_change, balance_quantity, transaction_date
    FROM product_history
    WHERE product_id = ${productId} AND product_variation_id = ${variationId} AND location_id = ${locationId}
    AND transaction_type != 'sale'
    ORDER BY transaction_date ASC
  `

  // Sales
  const sales = await prisma.$queryRaw<any[]>`
    SELECT si.id, si.quantity, s.invoice_number, s.sale_date
    FROM sale_items si
    JOIN sales s ON s.id = si.sale_id
    WHERE si.product_id = ${productId} AND si.product_variation_id = ${variationId} AND s.location_id = ${locationId}
    ORDER BY s.sale_date ASC
  `

  console.log('\nHistory records (non-sale):')
  for (const h of history) {
    console.log(`  ${h.transaction_date}: ${h.transaction_type} ${h.quantity_change > 0 ? '+' : ''}${h.quantity_change} (ID: ${h.id}, refType: ${h.reference_type})`)
  }

  console.log('\nSales:')
  for (const s of sales) {
    console.log(`  ${s.sale_date}: sale -${s.quantity} (Invoice: ${s.invoice_number})`)
  }

  // Calculate expected running balance
  console.log('\n=== Expected Running Balance ===')
  let balance = 0
  const allEvents: any[] = []

  for (const h of history) {
    allEvents.push({ date: h.transaction_date, type: h.transaction_type, change: parseFloat(h.quantity_change) })
  }
  for (const s of sales) {
    allEvents.push({ date: s.sale_date, type: 'sale', change: -parseFloat(s.quantity) })
  }

  allEvents.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())

  for (const e of allEvents) {
    balance += e.change
    console.log(`  ${e.type}: ${e.change > 0 ? '+' : ''}${e.change} => Balance: ${balance}`)
  }

  console.log('\n=== CONCLUSION ===')
  console.log(`Expected final balance: ${balance}`)
  console.log(`Actual stock in DB: ${stock[0]?.qty_available}`)
  console.log(`Match: ${balance === parseFloat(stock[0]?.qty_available) ? 'YES' : 'NO'}`)
}

main().catch(console.error).finally(() => prisma.$disconnect())
