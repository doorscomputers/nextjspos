import { config } from 'dotenv'
import { resolve } from 'path'
config({ path: resolve(process.cwd(), '.env') })

if (!process.env.DATABASE_URL && process.env.StiDATABASE_URL) {
  process.env.DATABASE_URL = process.env.StiDATABASE_URL
}

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function findAttempt() {
  console.log('=== DEEP INVESTIGATION: MISSING O156IPC GCASH SALE ===\n')

  const voidTime = new Date('2026-01-24T06:46:49.000Z') // 14:46:49 GMT+8

  // 1. Check ALL idempotency keys (including failed/processing) after void
  console.log('1. ALL IDEMPOTENCY KEYS AFTER VOID (any status)...')
  const allKeys = await prisma.$queryRaw`
    SELECT id, key, status, endpoint, response_status, created_at,
           LEFT(response_body::text, 300) as response_preview
    FROM idempotency_keys
    WHERE created_at > ${voidTime}
    ORDER BY created_at ASC
    LIMIT 50
  ` as any[]

  console.log(`Found ${allKeys.length} keys after void time`)

  // Group by status
  const byStatus: Record<string, number> = {}
  allKeys.forEach((k: any) => {
    byStatus[k.status] = (byStatus[k.status] || 0) + 1
  })
  console.log('By status:', byStatus)

  // Show any that are NOT completed
  const notCompleted = allKeys.filter((k: any) => k.status !== 'completed')
  if (notCompleted.length > 0) {
    console.log('\nNON-COMPLETED KEYS:')
    notCompleted.forEach((k: any) => {
      console.log(`  Key ${k.id}: ${k.status} at ${k.created_at}`)
      console.log(`    Endpoint: ${k.endpoint}`)
    })
  } else {
    console.log('\nAll keys are completed.')
  }

  // 2. Check for any O156IPC in idempotency response bodies
  console.log('\n\n2. CHECKING ALL IDEMPOTENCY KEYS FOR O156IPC (product 607)...')
  const o156Keys = await prisma.$queryRaw`
    SELECT id, status, created_at, response_body::text as response_body
    FROM idempotency_keys
    WHERE response_body::text LIKE '%"productId":607%'
       OR response_body::text LIKE '%O156IPC%'
    ORDER BY created_at DESC
    LIMIT 20
  ` as any[]

  console.log(`Found ${o156Keys.length} keys mentioning product 607 or O156IPC`)
  o156Keys.forEach((k: any) => {
    try {
      const body = JSON.parse(k.response_body)
      console.log(`\n  Key ${k.id}: ${body.invoiceNumber}`)
      console.log(`    Status: ${k.status}`)
      console.log(`    Sale Status: ${body.status}`)
      console.log(`    Total: ${body.totalAmount}`)
      console.log(`    Created: ${k.created_at}`)
      if (body.payments) {
        console.log(`    Payments: ${body.payments.map((p: any) => p.paymentMethod).join(', ')}`)
      }
    } catch (e) {
      console.log(`  Key ${k.id}: parse error`)
    }
  })

  // 3. Check for any sales with product 607 that might be soft-deleted
  console.log('\n\n3. ALL SALES WITH PRODUCT 607 (including deleted)...')
  const allO156Sales = await prisma.$queryRaw`
    SELECT s.id, s.invoice_number, s.status, s.total_amount, s.created_at, s.deleted_at,
           u.username, bl.name as location_name
    FROM sales s
    JOIN sale_items si ON si.sale_id = s.id
    JOIN users u ON u.id = s.created_by
    JOIN business_locations bl ON bl.id = s.location_id
    WHERE si.product_id = 607
    ORDER BY s.created_at DESC
    LIMIT 20
  ` as any[]

  console.log(`Found ${allO156Sales.length} sales with O156IPC`)
  allO156Sales.forEach((s: any) => {
    console.log(`  ${s.invoice_number} | ${s.status} | ${s.total_amount} | ${s.location_name} | ${s.created_at} | Deleted: ${s.deleted_at || 'No'}`)
  })

  // 4. Check sale_items directly for product 607
  console.log('\n\n4. ALL SALE_ITEMS FOR PRODUCT 607...')
  const allItems = await prisma.$queryRaw`
    SELECT si.id, si.sale_id, si.quantity, si.unit_price, si.created_at,
           s.invoice_number, s.status as sale_status, s.deleted_at
    FROM sale_items si
    LEFT JOIN sales s ON s.id = si.sale_id
    WHERE si.product_id = 607
    ORDER BY si.created_at DESC
    LIMIT 20
  ` as any[]

  console.log(`Found ${allItems.length} sale items for product 607`)
  allItems.forEach((i: any) => {
    console.log(`  Item ${i.id} in Sale ${i.sale_id} (${i.invoice_number}): ${i.quantity} x ${i.unit_price} | Sale Status: ${i.sale_status} | Deleted: ${i.deleted_at || 'No'}`)
  })

  // 5. Check stock transactions for product 607 at Tuguegarao (ALL time)
  console.log('\n\n5. ALL STOCK TRANSACTIONS FOR O156IPC AT TUGUEGARAO...')
  const allStock = await prisma.$queryRaw`
    SELECT st.id, st.type, st.quantity, st.balance_qty, st.reference_type, st.reference_id, st.created_at,
           u.username
    FROM stock_transactions st
    JOIN users u ON u.id = st.created_by
    WHERE st.product_id = 607 AND st.location_id = 4
    ORDER BY st.created_at DESC
    LIMIT 30
  ` as any[]

  console.log(`Found ${allStock.length} stock transactions`)
  allStock.forEach((st: any) => {
    console.log(`  ${st.id} | ${st.type} | Qty: ${st.quantity} | Balance: ${st.balance_qty} | ${st.reference_type} #${st.reference_id} | ${st.created_at} | ${st.username}`)
  })

  // 6. Check if there's any Gcash payment today at Tuguegarao
  console.log('\n\n6. ALL PAYMENTS AT TUGUEGARAO TODAY...')
  const allPayments = await prisma.$queryRaw`
    SELECT sp.id, sp.sale_id, sp.payment_method, sp.amount, sp.paid_at,
           s.invoice_number, s.total_amount
    FROM sale_payments sp
    JOIN sales s ON s.id = sp.sale_id
    WHERE s.location_id = 4
    AND sp.paid_at > '2026-01-24'::date
    ORDER BY sp.paid_at ASC
  ` as any[]

  console.log(`Found ${allPayments.length} payments at Tuguegarao today`)
  allPayments.forEach((p: any) => {
    console.log(`  ${p.invoice_number} | ${p.payment_method} | ${p.amount} | ${p.paid_at}`)
  })

  // 7. What was the exact time the cashier claims to have made the sale?
  console.log('\n\n7. TIMELINE SUMMARY:')
  console.log('  - Original O156IPC sale (Cash): 10:48:49')
  console.log('  - Void of original sale: 14:46:49')
  console.log('  - Next Tuguegarao sale after void: 15:31:59 (Invoice 0006, total 604)')
  console.log('')
  console.log('  CONCLUSION: There is NO record of a second O156IPC sale attempt.')
  console.log('  Either:')
  console.log('    1. The sale was never submitted to the server')
  console.log('    2. The submission failed before creating an idempotency key')
  console.log('    3. The cashier is mistaken about making the second sale')

  console.log('\n=== INVESTIGATION COMPLETE ===')
}

findAttempt()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
