import { config } from 'dotenv'
import { resolve } from 'path'
config({ path: resolve(process.cwd(), '.env') })

if (!process.env.DATABASE_URL && process.env.StiDATABASE_URL) {
  process.env.DATABASE_URL = process.env.StiDATABASE_URL
}

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function findMissingSale() {
  console.log('=== INVESTIGATING MISSING GCASH SALE FOR O156IPC ===\n')

  // The void happened at 14:46:49 on Jan 24, 2026
  // The second sale (Gcash) would have been made AFTER this time
  const voidTime = new Date('2026-01-24T06:46:49.000Z') // UTC time (14:46 GMT+8)

  console.log('Looking for sales AFTER the void time:', voidTime.toISOString())
  console.log('')

  // 1. Check all sales at Tuguegarao after the void
  console.log('1. ALL SALES AT TUGUEGARAO AFTER VOID TIME...')
  const salesAfterVoid = await prisma.sale.findMany({
    where: {
      locationId: 4, // Tuguegarao
      createdAt: { gte: voidTime }
    },
    include: {
      items: {
        include: {
          product: { select: { sku: true, name: true } }
        }
      },
      payments: true,
      creator: { select: { username: true } }
    },
    orderBy: { createdAt: 'asc' }
  })

  console.log(`Found ${salesAfterVoid.length} sales after void time`)
  salesAfterVoid.forEach(s => {
    const items = s.items.map(i => `${i.product?.sku}:${i.quantity}x@${i.unitPrice}`).join(', ')
    const payments = s.payments.map(p => `${p.method}:${p.amount}`).join(', ')
    console.log(`\n  Invoice: ${s.invoiceNumber}`)
    console.log(`    Status: ${s.status}`)
    console.log(`    Total: ${s.totalAmount}`)
    console.log(`    Created: ${s.createdAt}`)
    console.log(`    Cashier: ${s.creator?.username}`)
    console.log(`    Items: ${items}`)
    console.log(`    Payments: ${payments}`)
  })

  // 2. Check for O156IPC sales specifically (anywhere, any status)
  console.log('\n\n2. ALL O156IPC SALES TODAY (any location, any status)...')
  const today = new Date('2026-01-24T00:00:00.000Z')
  const tomorrow = new Date('2026-01-25T00:00:00.000Z')

  const o156Sales = await prisma.sale.findMany({
    where: {
      createdAt: { gte: today, lt: tomorrow },
      items: {
        some: { productId: 607 }
      }
    },
    include: {
      items: {
        where: { productId: 607 }
      },
      payments: true,
      creator: { select: { username: true } },
      location: { select: { name: true } }
    },
    orderBy: { createdAt: 'asc' }
  })

  console.log(`Found ${o156Sales.length} sales with O156IPC today`)
  o156Sales.forEach(s => {
    const payments = s.payments.map(p => `${p.method}:${p.amount}`).join(', ')
    console.log(`\n  Invoice: ${s.invoiceNumber}`)
    console.log(`    Location: ${s.location.name}`)
    console.log(`    Status: ${s.status}`)
    console.log(`    Total: ${s.totalAmount}`)
    console.log(`    Created: ${s.createdAt}`)
    console.log(`    Payments: ${payments}`)
    console.log(`    Deleted: ${s.deletedAt || 'No'}`)
  })

  // 3. Check idempotency keys around the time of the missing sale
  console.log('\n\n3. IDEMPOTENCY KEYS AROUND VOID TIME (checking for failures)...')
  const keysAroundVoid = await prisma.$queryRaw`
    SELECT id, key, status, endpoint, created_at, response_status,
           LEFT(response_body::text, 200) as response_preview
    FROM idempotency_keys
    WHERE created_at > ${voidTime}
    AND endpoint LIKE '%sales%'
    ORDER BY created_at ASC
    LIMIT 20
  ` as any[]

  console.log(`Found ${keysAroundVoid.length} idempotency keys for sales after void`)
  keysAroundVoid.forEach((k: any) => {
    console.log(`\n  Key ID: ${k.id}`)
    console.log(`    Status: ${k.status}`)
    console.log(`    Response Status: ${k.response_status}`)
    console.log(`    Created: ${k.created_at}`)
    console.log(`    Preview: ${k.response_preview?.substring(0, 100) || 'N/A'}...`)
  })

  // 4. Check stock transactions for O156IPC after void
  console.log('\n\n4. STOCK TRANSACTIONS FOR O156IPC AFTER VOID...')
  const stockAfterVoid = await prisma.stockTransaction.findMany({
    where: {
      productId: 607,
      locationId: 4,
      createdAt: { gte: voidTime }
    },
    include: {
      createdByUser: { select: { username: true } }
    },
    orderBy: { createdAt: 'asc' }
  })

  console.log(`Found ${stockAfterVoid.length} stock transactions after void`)
  stockAfterVoid.forEach(st => {
    console.log(`\n  ID: ${st.id}`)
    console.log(`    Type: ${st.type}`)
    console.log(`    Qty: ${st.quantity}`)
    console.log(`    Balance: ${st.balanceQty}`)
    console.log(`    Ref: ${st.referenceType} #${st.referenceId}`)
    console.log(`    Created: ${st.createdAt}`)
    console.log(`    User: ${st.createdByUser?.username}`)
  })

  // 5. Check current stock level
  console.log('\n\n5. CURRENT STOCK LEVEL FOR O156IPC AT TUGUEGARAO...')
  const currentStock = await prisma.variationLocationDetails.findFirst({
    where: {
      productVariationId: 607,
      locationId: 4
    }
  })

  if (currentStock) {
    console.log(`  Qty Available: ${currentStock.qtyAvailable}`)
    console.log(`  Selling Price: ${currentStock.sellingPrice}`)
  }

  // 6. Check for any sales with Gcash payment at Tuguegarao today
  console.log('\n\n6. ALL GCASH SALES AT TUGUEGARAO TODAY...')
  const gcashSales = await prisma.sale.findMany({
    where: {
      locationId: 4,
      createdAt: { gte: today, lt: tomorrow },
      payments: {
        some: {
          method: { in: ['gcash', 'Gcash', 'GCASH', 'GCash'] }
        }
      }
    },
    include: {
      items: true,
      payments: true,
      creator: { select: { username: true } }
    },
    orderBy: { createdAt: 'asc' }
  })

  console.log(`Found ${gcashSales.length} Gcash sales at Tuguegarao today`)
  gcashSales.forEach(s => {
    const items = s.items.map(i => `${i.productId}:${i.quantity}x@${i.unitPrice}`).join(', ')
    console.log(`\n  Invoice: ${s.invoiceNumber}`)
    console.log(`    Status: ${s.status}`)
    console.log(`    Total: ${s.totalAmount}`)
    console.log(`    Created: ${s.createdAt}`)
    console.log(`    Items: ${items}`)
  })

  // 7. Check for orphaned sale items (items without parent sale)
  console.log('\n\n7. CHECKING FOR ORPHANED SALE ITEMS (product 607)...')
  const orphanedItems = await prisma.$queryRaw`
    SELECT si.*
    FROM sale_items si
    LEFT JOIN sales s ON s.id = si.sale_id
    WHERE si.product_id = 607
    AND s.id IS NULL
  ` as any[]

  console.log(`Found ${orphanedItems.length} orphaned sale items`)

  // 8. Raw check - any sale with amount 3990 today at Tuguegarao
  console.log('\n\n8. ANY SALE WITH AMOUNT 3990 TODAY AT TUGUEGARAO...')
  const sales3990 = await prisma.sale.findMany({
    where: {
      locationId: 4,
      createdAt: { gte: today, lt: tomorrow },
      OR: [
        { totalAmount: 3990 },
        { subtotal: 3990 }
      ]
    },
    include: {
      items: true,
      payments: true
    }
  })

  console.log(`Found ${sales3990.length} sales with amount 3990`)
  sales3990.forEach(s => {
    console.log(`  Invoice: ${s.invoiceNumber}, Status: ${s.status}, Total: ${s.totalAmount}, Payments: ${s.payments.map(p => p.method).join(',')}`)
  })

  console.log('\n=== INVESTIGATION COMPLETE ===')
}

findMissingSale()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
