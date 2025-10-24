import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function debugSupplierReturnQuery() {
  console.log('================================================================================')
  console.log('DEBUG: Supplier Return Query for Stock History')
  console.log('================================================================================')
  console.log()

  try {
    // Find the ADATA product and variation
    const product = await prisma.product.findFirst({
      where: {
        name: { contains: 'ADATA 512GB' }
      },
      include: {
        variations: true
      }
    })

    if (!product) {
      console.log('❌ Product not found!')
      return
    }

    console.log(`✅ Product Found: ${product.name} (ID: ${product.id})`)
    console.log(`   Variations:`, product.variations.map(v => `${v.name} (ID: ${v.id})`).join(', '))
    console.log()

    const variationId = product.variations[0].id

    // Find Main Warehouse location
    const location = await prisma.businessLocation.findFirst({
      where: {
        name: 'Main Warehouse'
      }
    })

    if (!location) {
      console.log('❌ Main Warehouse not found!')
      return
    }

    console.log(`✅ Location Found: ${location.name} (ID: ${location.id})`)
    console.log()

    // Query 1: Get ALL supplier returns for this business
    console.log('Query 1: ALL Supplier Returns')
    console.log('=' .repeat(80))
    const allReturns = await prisma.supplierReturn.findMany({
      where: {
        businessId: product.businessId
      },
      include: {
        items: true,
        supplier: true
      }
    })

    console.log(`Found ${allReturns.length} supplier return(s) total`)
    for (const sr of allReturns) {
      console.log(`  ${sr.returnNumber}:`)
      console.log(`    Status: ${sr.status}`)
      console.log(`    Approved: ${sr.approvedAt ? 'YES' : 'NO'}`)
      console.log(`    ApprovedAt: ${sr.approvedAt}`)
      console.log(`    Location ID: ${sr.locationId}`)
      console.log(`    Supplier: ${sr.supplier.name}`)
      console.log(`    Items: ${sr.items.length}`)
      for (const item of sr.items) {
        console.log(`      - Product ID: ${item.productId}, Variation ID: ${item.productVariationId}, Qty: ${item.quantity}`)
      }
    }
    console.log()

    // Query 2: Supplier returns matching stock-history.ts criteria
    console.log('Query 2: Supplier Returns matching stock-history.ts criteria')
    console.log('=' .repeat(80))
    const matchingReturns = await prisma.supplierReturn.findMany({
      where: {
        businessId: product.businessId,
        locationId: location.id,
        status: 'approved',
        approvedAt: {
          gte: new Date('1970-01-01'),
          lte: new Date('2099-12-31')
        }
      },
      include: {
        items: {
          where: {
            productId: product.id,
            productVariationId: variationId
          }
        },
        supplier: { select: { name: true } }
      },
      orderBy: { approvedAt: 'asc' }
    })

    console.log(`Found ${matchingReturns.length} matching supplier return(s)`)
    for (const sr of matchingReturns) {
      console.log(`  ${sr.returnNumber}:`)
      console.log(`    Items matching filter: ${sr.items.length}`)
      if (sr.items.length > 0) {
        console.log(`    ✅ WOULD BE INCLUDED in stock history`)
      } else {
        console.log(`    ❌ EXCLUDED - no items match product/variation filter`)
      }
    }
    console.log()

    // Query 3: Check individual supplier return
    console.log('Query 3: Individual Supplier Return SR-202510-0001')
    console.log('=' .repeat(80))
    const specificReturn = await prisma.supplierReturn.findFirst({
      where: {
        returnNumber: 'SR-202510-0001'
      },
      include: {
        items: true,
        supplier: true,
        location: true
      }
    })

    if (specificReturn) {
      console.log(`✅ Found: ${specificReturn.returnNumber}`)
      console.log(`   Business ID: ${specificReturn.businessId}`)
      console.log(`   Location: ${specificReturn.location.name} (ID: ${specificReturn.locationId})`)
      console.log(`   Status: ${specificReturn.status}`)
      console.log(`   Approved: ${specificReturn.approvedAt ? 'YES' : 'NO'}`)
      console.log(`   ApprovedAt: ${specificReturn.approvedAt}`)
      console.log(`   ApprovedBy: ${specificReturn.approvedBy}`)
      console.log(`   Supplier: ${specificReturn.supplier.name}`)
      console.log()
      console.log(`   Items:`)
      for (const item of specificReturn.items) {
        console.log(`     - Product ID: ${item.productId} (need: ${product.id}) ${item.productId === product.id ? '✅' : '❌'}`)
        console.log(`       Variation ID: ${item.productVariationId} (need: ${variationId}) ${item.productVariationId === variationId ? '✅' : '❌'}`)
        console.log(`       Quantity: ${item.quantity}`)
        console.log(`       Unit Cost: ${item.unitCost}`)
      }
    } else {
      console.log(`❌ Not found!`)
    }

    console.log()
    console.log('=' .repeat(80))
    console.log('DIAGNOSIS')
    console.log('=' .repeat(80))

    if (matchingReturns.length === 0) {
      console.log('❌ PROBLEM: No supplier returns match the stock-history.ts query criteria')
      console.log()
      console.log('Possible causes:')
      console.log('1. approvedAt is NULL (not approved)')
      console.log('2. locationId mismatch')
      console.log('3. No items match the product/variation filter')
      console.log('4. status is not "approved"')
    } else {
      const hasItems = matchingReturns.some(sr => sr.items.length > 0)
      if (!hasItems) {
        console.log('❌ PROBLEM: Supplier returns found, but no items match product/variation filter')
        console.log('   This is why they are excluded from stock history!')
      } else {
        console.log('✅ GOOD: Supplier returns should be showing in stock history')
        console.log('   If not showing, check frontend rendering logic')
      }
    }

  } catch (error) {
    console.error('❌ Error:', error)
  } finally {
    await prisma.$disconnect()
  }
}

debugSupplierReturnQuery()
  .catch(console.error)
