import { prisma } from '../src/lib/prisma.simple'

async function investigate() {
  // Get all locations
  const locations = await prisma.businessLocation.findMany({
    where: { businessId: 1 },
    select: { id: true, name: true }
  })
  console.log('=== ALL LOCATIONS ===')
  locations.forEach(l => console.log(l.id, '-', l.name))

  // Get stock at all locations for product 188
  console.log('\n=== CURRENT STOCK AT ALL LOCATIONS FOR SKU 4711474261960 ===')
  const stock = await prisma.variationLocationDetails.findMany({
    where: { productId: 188 }
  })
  for (const s of stock) {
    const loc = locations.find(l => l.id === s.locationId)
    console.log(loc?.name || s.locationId, ':', s.qtyAvailable.toString())
  }

  // Check stock transactions at non-Main Warehouse locations
  console.log('\n=== STOCK TRANSACTIONS AT ALL NON-WAREHOUSE LOCATIONS ===')
  const allTx = await prisma.stockTransaction.findMany({
    where: {
      productId: 188,
      locationId: { not: 1 } // Exclude main warehouse
    },
    orderBy: { createdAt: 'asc' }
  })

  const locMap: Record<number, string> = {}
  for (const l of locations) locMap[l.id] = l.name

  for (const tx of allTx) {
    const qty = parseFloat(tx.quantity.toString())
    console.log(`[${tx.createdAt.toISOString().slice(0, 19)}]`,
      `Loc: ${locMap[tx.locationId] || tx.locationId}`.padEnd(25),
      tx.type.padEnd(15),
      (qty > 0 ? '+' : '') + qty,
      '→ Bal:', tx.balanceQty.toString(),
      '| Ref:', tx.referenceType || '-', '#' + (tx.referenceId || '-'))
  }

  // Check void transactions
  console.log('\n=== ALL VOID TRANSACTIONS ===')
  const voids = await prisma.voidTransaction.findMany({
    where: { businessId: 1 },
    orderBy: { createdAt: 'desc' },
    take: 50,
    include: {
      sale: {
        include: {
          items: true,
          location: { select: { name: true } }
        }
      }
    }
  })

  // Filter to show only voids involving product 188
  const voidsWithProduct = voids.filter(v =>
    v.sale?.items?.some(i => i.productId === 188)
  )

  console.log(`Total voids: ${voids.length}, Voids with product 188: ${voidsWithProduct.length}`)

  for (const v of voidsWithProduct) {
    console.log(`\n[${v.createdAt.toISOString()}] Void ID: ${v.id}`)
    console.log(`  Sale ID: ${v.saleId}, Invoice: ${v.sale?.invoiceNumber}`)
    console.log(`  Location: ${v.sale?.location?.name}`)
    console.log(`  Reason: ${v.voidReason}`)
    console.log(`  Items:`)
    for (const item of v.sale?.items || []) {
      if (item.productId === 188) {
        console.log(`    - Product 188: qty=${item.quantity}`)
      }
    }
  }

  // Check for duplicate void records on same sale
  console.log('\n=== CHECKING FOR DUPLICATE VOIDS ===')
  const saleIds = voids.map(v => v.saleId)
  const uniqueSaleIds = [...new Set(saleIds)]
  const duplicates = uniqueSaleIds.filter(saleId =>
    saleIds.filter(id => id === saleId).length > 1
  )
  if (duplicates.length > 0) {
    console.log('⚠️ DUPLICATE VOID RECORDS FOUND for sales:', duplicates)
    for (const saleId of duplicates) {
      const dupVoids = voids.filter(v => v.saleId === saleId)
      console.log(`\nSale ${saleId} has ${dupVoids.length} void records:`)
      for (const v of dupVoids) {
        console.log(`  - Void ID ${v.id} at ${v.createdAt.toISOString()}, Reason: ${v.voidReason}`)
      }
    }
  } else {
    console.log('✅ No duplicate void records found')
  }

  // Check recent sales with this product that are voided
  console.log('\n=== VOIDED SALES WITH THIS PRODUCT ===')
  const voidedSales = await prisma.sale.findMany({
    where: {
      status: 'voided',
      items: {
        some: { productId: 188 }
      }
    },
    include: {
      items: { where: { productId: 188 } },
      location: { select: { name: true } }
    },
    orderBy: { createdAt: 'desc' }
  })

  for (const sale of voidedSales) {
    console.log(`\n[${sale.createdAt.toISOString()}] Sale ${sale.id}, Invoice: ${sale.invoiceNumber}`)
    console.log(`  Location: ${sale.location?.name}`)
    console.log(`  Status: ${sale.status}`)
    for (const item of sale.items) {
      console.log(`  - Product 188: qty=${item.quantity}`)
    }
  }

  // Check stock transactions with sale_void type
  console.log('\n=== SALE VOID STOCK TRANSACTIONS FOR PRODUCT 188 ===')
  const voidTxs = await prisma.stockTransaction.findMany({
    where: {
      productId: 188,
      OR: [
        { type: 'sale_void' },
        { type: 'adjustment', referenceType: 'sale_void' }
      ]
    },
    orderBy: { createdAt: 'asc' }
  })

  if (voidTxs.length === 0) {
    console.log('  No sale_void stock transactions found')
  } else {
    console.log(`  Found ${voidTxs.length} void stock transactions:`)
    for (const tx of voidTxs) {
      console.log(`  [${tx.createdAt.toISOString()}] Loc: ${locMap[tx.locationId] || tx.locationId}`,
        `qty: +${tx.quantity}, bal: ${tx.balanceQty}`,
        `ref: ${tx.referenceType}#${tx.referenceId}`)
    }
  }
}

investigate().catch(console.error).finally(() => prisma.$disconnect())
