import { config } from 'dotenv'
import { resolve } from 'path'
config({ path: resolve(process.cwd(), '.env') })

// Use StiDATABASE_URL if DATABASE_URL is not set (typo in .env file)
if (!process.env.DATABASE_URL && process.env.StiDATABASE_URL) {
  process.env.DATABASE_URL = process.env.StiDATABASE_URL
}

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function investigate() {
  console.log('=== INVESTIGATING STUCK IDEMPOTENCY KEYS ===\n')

  // 1. Find stuck idempotency keys with status='processing'
  console.log('1. STUCK IDEMPOTENCY KEYS (status=processing, last 7 days)...')
  const stuckKeys = await prisma.$queryRaw`
    SELECT id, key, status, endpoint, created_at, user_id
    FROM idempotency_keys
    WHERE status = 'processing'
    AND created_at > NOW() - INTERVAL '7 days'
    ORDER BY created_at DESC
    LIMIT 50
  ` as any[]

  console.log(`Found ${stuckKeys.length} stuck keys`)
  if (stuckKeys.length > 0) {
    stuckKeys.forEach((k: any) => {
      const age = Math.round((Date.now() - new Date(k.created_at).getTime()) / 1000)
      console.log(`  ID: ${k.id}`)
      console.log(`    Key: ${k.key.substring(0, 30)}...`)
      console.log(`    Endpoint: ${k.endpoint}`)
      console.log(`    Age: ${age} seconds`)
      console.log(`    Created: ${k.created_at}`)
      console.log('')
    })
  }

  // 2. Find product O156IPC
  console.log('\n2. FINDING PRODUCT O156IPC...')
  const variations = await prisma.productVariation.findMany({
    where: {
      sku: { contains: 'O156IPC', mode: 'insensitive' }
    },
    include: {
      product: true
    }
  })

  if (variations.length > 0) {
    variations.forEach(v => {
      console.log(`  Product ID: ${v.productId}`)
      console.log(`  Product Name: ${v.product.name}`)
      console.log(`  Variation ID: ${v.id}`)
      console.log(`  Variation SKU: ${v.sku}`)
      console.log(`  Selling Price: ${v.sellingPrice}`)
    })
  } else {
    // Try searching in products table
    const products = await prisma.product.findMany({
      where: {
        sku: { contains: 'O156IPC', mode: 'insensitive' }
      }
    })
    if (products.length > 0) {
      products.forEach(p => {
        console.log(`  Product ID: ${p.id}`)
        console.log(`  Name: ${p.name}`)
        console.log(`  SKU: ${p.sku}`)
      })
    } else {
      console.log('  Product NOT FOUND')
    }
  }

  // 3. Find Tuguegarao location
  console.log('\n3. FINDING TUGUEGARAO LOCATION...')
  const locations = await prisma.businessLocation.findMany({
    where: {
      OR: [
        { name: { contains: 'Tuguegarao', mode: 'insensitive' } },
        { city: { contains: 'Tuguegarao', mode: 'insensitive' } }
      ]
    }
  })

  if (locations.length > 0) {
    locations.forEach(l => {
      console.log(`  Location ID: ${l.id}`)
      console.log(`  Name: ${l.name}`)
      console.log(`  City: ${l.city || 'N/A'}`)
    })
  } else {
    console.log('  Tuguegarao NOT FOUND. Listing all locations:')
    const allLocs = await prisma.businessLocation.findMany({
      select: { id: true, name: true, city: true }
    })
    allLocs.forEach(l => console.log(`    ${l.id}: ${l.name} (${l.city || 'N/A'})`))
  }

  // 4. Recent sales at the location (if found)
  if (locations.length > 0 && variations.length > 0) {
    const locationId = locations[0].id
    const productId = variations[0].productId

    console.log(`\n4. RECENT SALES OF O156IPC AT TUGUEGARAO (location ${locationId})...`)

    const today = new Date()
    today.setDate(today.getDate() - 7)

    const recentSales = await prisma.sale.findMany({
      where: {
        locationId: locationId,
        createdAt: { gte: today },
        deletedAt: null,
        items: {
          some: { productId: productId }
        }
      },
      include: {
        items: {
          where: { productId: productId }
        },
        creator: {
          select: { username: true }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: 20
    })

    console.log(`  Found ${recentSales.length} sales`)
    recentSales.forEach(s => {
      console.log(`\n  Invoice: ${s.invoiceNumber}`)
      console.log(`    Date: ${s.createdAt}`)
      console.log(`    Status: ${s.status}`)
      console.log(`    Total: ${s.totalAmount}`)
      console.log(`    Cashier: ${s.creator?.username || 'N/A'}`)
      s.items.forEach(si => {
        console.log(`    Item: qty=${si.quantity} @ ${si.unitPrice}`)
      })
    })

    // 5. Check stock transactions
    console.log(`\n5. STOCK TRANSACTIONS FOR O156IPC AT TUGUEGARAO (last 7 days)...`)
    const stockTxns = await prisma.stockTransaction.findMany({
      where: {
        productId: productId,
        locationId: locationId,
        createdAt: { gte: today }
      },
      include: {
        createdByUser: { select: { username: true } }
      },
      orderBy: { createdAt: 'desc' },
      take: 20
    })

    console.log(`  Found ${stockTxns.length} transactions`)
    stockTxns.forEach(t => {
      console.log(`\n  ID: ${t.id}`)
      console.log(`    Type: ${t.type}`)
      console.log(`    Qty: ${t.quantity}`)
      console.log(`    Balance: ${t.balanceQty}`)
      console.log(`    Ref: ${t.referenceType} #${t.referenceId}`)
      console.log(`    Date: ${t.createdAt}`)
      console.log(`    User: ${t.createdByUser?.username || 'N/A'}`)
    })

    // 6. Current stock level
    console.log(`\n6. CURRENT STOCK LEVEL AT TUGUEGARAO...`)
    const stock = await prisma.variationLocationDetails.findMany({
      where: {
        productId: productId,
        locationId: locationId
      },
      include: {
        productVariation: true
      }
    })

    if (stock.length > 0) {
      stock.forEach(s => {
        console.log(`  Variation: ${s.productVariation.sku}`)
        console.log(`    Qty Available: ${s.qtyAvailable}`)
        console.log(`    Selling Price: ${s.sellingPrice}`)
      })
    } else {
      console.log('  No stock records found')
    }
  }

  console.log('\n=== INVESTIGATION COMPLETE ===')
}

investigate()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
