import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

/**
 * Investigation Script: HP VICTUS Price Change
 * SKU: 377794947713
 * Expected Price: 82,999.00
 * Current Price: 71,990
 *
 * This script investigates who changed the price and when.
 */

async function investigate() {
  const SKU = '377794947713'

  console.log('='.repeat(80))
  console.log('INVESTIGATION: HP VICTUS Price Change')
  console.log('SKU:', SKU)
  console.log('Expected Price: 82,999.00')
  console.log('Current Price Found: 71,990')
  console.log('='.repeat(80))

  // 1. Find the product by SKU
  console.log('\n1. FINDING PRODUCT BY SKU...\n')

  // First check ProductVariation (SKU is stored there)
  const variation = await prisma.productVariation.findFirst({
    where: { sku: SKU },
    include: {
      product: {
        include: {
          category: true,
          brand: true,
        }
      }
    }
  })

  if (!variation) {
    console.log('ERROR: No product variation found with SKU:', SKU)

    // Try finding in Product table directly
    const product = await prisma.product.findFirst({
      where: { sku: SKU }
    })

    if (product) {
      console.log('Found in Product table (single product):')
      console.log('  Product ID:', product.id)
      console.log('  Name:', product.name)
      console.log('  Selling Price:', product.sellingPrice?.toString())
      console.log('  Purchase Price:', product.purchasePrice?.toString())
    }
    return
  }

  console.log('PRODUCT VARIATION FOUND:')
  console.log('  Variation ID:', variation.id)
  console.log('  Product ID:', variation.productId)
  console.log('  Product Name:', variation.product.name)
  console.log('  Variation Name:', variation.name)
  console.log('  SKU:', variation.sku)
  console.log('  Category:', variation.product.category?.name || 'N/A')
  console.log('  Brand:', variation.product.brand?.name || 'N/A')
  console.log('')
  console.log('CURRENT PRICING:')
  console.log('  Selling Price:', variation.sellingPrice.toString())
  console.log('  Purchase Price:', variation.purchasePrice.toString())
  console.log('  Updated At:', variation.updatedAt?.toISOString())

  // 2. Check Price Change History (if table exists)
  console.log('\n' + '='.repeat(80))
  console.log('2. PRICE CHANGE HISTORY (from PriceChangeHistory table)')
  console.log('='.repeat(80) + '\n')

  try {
    const priceHistory = await prisma.priceChangeHistory.findMany({
      where: { productVariationId: variation.id },
      include: {
        user: {
          select: { id: true, username: true, firstName: true, lastName: true }
        },
        businessLocation: {
          select: { id: true, name: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    })

    if (priceHistory.length === 0) {
      console.log('No price change history found in PriceChangeHistory table.')
    } else {
      console.log(`Found ${priceHistory.length} price change record(s):\n`)

      for (const record of priceHistory) {
        console.log('-'.repeat(60))
        console.log('Change Date:', record.createdAt.toISOString())
        console.log('Changed By:', `${record.user.firstName || ''} ${record.user.lastName || ''} (${record.user.username}) [User ID: ${record.user.id}]`)
        console.log('Old Price:', record.oldPrice?.toString() || 'N/A')
        console.log('New Price:', record.newPrice.toString())
        console.log('Change Source:', record.changeSource)
        console.log('Location:', record.businessLocation?.name || 'Global/All Locations')
        console.log('Product Name:', record.productName || 'N/A')
      }
    }
  } catch (e: any) {
    if (e.code === 'P2021') {
      console.log('NOTE: PriceChangeHistory table does not exist in database.')
      console.log('This feature may not have been migrated yet.')
    } else {
      throw e
    }
  }

  // 3. Check Variation Location Details for location-specific pricing
  console.log('\n' + '='.repeat(80))
  console.log('3. LOCATION-SPECIFIC PRICING (VariationLocationDetails)')
  console.log('='.repeat(80) + '\n')

  const locationDetails = await prisma.variationLocationDetails.findMany({
    where: { productVariationId: variation.id },
    include: {
      lastPriceUpdatedByUser: {
        select: { id: true, username: true, firstName: true, lastName: true }
      }
    }
  })

  if (locationDetails.length === 0) {
    console.log('No location-specific pricing found.')
  } else {
    console.log(`Found ${locationDetails.length} location detail(s):\n`)

    // Get location names
    const locationIds = locationDetails.map(ld => ld.locationId)
    const locations = await prisma.businessLocation.findMany({
      where: { id: { in: locationIds } },
      select: { id: true, name: true }
    })
    const locationMap = Object.fromEntries(locations.map(l => [l.id, l.name]))

    for (const detail of locationDetails) {
      console.log('-'.repeat(60))
      console.log('Location:', locationMap[detail.locationId] || `ID: ${detail.locationId}`)
      console.log('Location ID:', detail.locationId)
      console.log('Selling Price:', detail.sellingPrice?.toString() || 'Using base price')
      console.log('Price Percentage:', detail.pricePercentage?.toString() || 'N/A')
      console.log('Qty Available:', detail.qtyAvailable.toString())
      console.log('Last Price Update:', detail.lastPriceUpdate?.toISOString() || 'N/A')

      if (detail.lastPriceUpdatedByUser) {
        const user = detail.lastPriceUpdatedByUser
        console.log('Last Price Updated By:', `${user.firstName || ''} ${user.lastName || ''} (${user.username}) [User ID: ${user.id}]`)
      } else if (detail.lastPriceUpdatedBy) {
        console.log('Last Price Updated By User ID:', detail.lastPriceUpdatedBy)
      }

      console.log('Record Updated At:', detail.updatedAt?.toISOString())
    }
  }

  // 4. Check Audit Logs for any bulk operations
  console.log('\n' + '='.repeat(80))
  console.log('4. AUDIT LOG ENTRIES (bulk operations)')
  console.log('='.repeat(80) + '\n')

  try {
    const auditLogs = await prisma.auditLog.findMany({
      where: {
        OR: [
          { entityIds: { contains: variation.id.toString() } },
          { entityIds: { contains: variation.productId.toString() } },
          { description: { contains: SKU } },
          { description: { contains: 'HP VICTUS' } },
          { description: { contains: '71990' } },
          { description: { contains: '82999' } }
        ]
      },
      include: {
        user: {
          select: { id: true, username: true, firstName: true, lastName: true }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: 20
    })

    if (auditLogs.length === 0) {
      console.log('No relevant audit log entries found.')
    } else {
      console.log(`Found ${auditLogs.length} audit log entry(ies):\n`)

      for (const log of auditLogs) {
        console.log('-'.repeat(60))
        console.log('Date:', log.createdAt.toISOString())
        console.log('User:', `${log.user.firstName || ''} ${log.user.lastName || ''} (${log.username}) [User ID: ${log.userId}]`)
        console.log('Action:', log.action)
        console.log('Entity Type:', log.entityType)
        console.log('Description:', log.description)
        if (log.metadata) {
          console.log('Metadata:', JSON.stringify(log.metadata, null, 2))
        }
      }
    }
  } catch (e: any) {
    if (e.code === 'P2021') {
      console.log('NOTE: AuditLog table does not exist in database.')
    } else {
      throw e
    }
  }

  // 5. Check Product History for any references
  console.log('\n' + '='.repeat(80))
  console.log('5. PRODUCT HISTORY (inventory transactions)')
  console.log('='.repeat(80) + '\n')

  try {
    const productHistory = await prisma.productHistory.findMany({
      where: {
        productVariationId: variation.id
      },
      orderBy: { createdAt: 'desc' },
      take: 20
    })

    if (productHistory.length === 0) {
      console.log('No product history found.')
    } else {
      console.log(`Found ${productHistory.length} product history entry(ies) (showing last 20):\n`)

      for (const entry of productHistory) {
        console.log('-'.repeat(60))
        console.log('Date:', entry.createdAt.toISOString())
        console.log('Type:', entry.transactionType)
        console.log('Reference:', entry.referenceType, '#' + entry.referenceId)
        console.log('Quantity Change:', entry.quantityChange.toString())
        console.log('Unit Cost:', entry.unitCost?.toString() || 'N/A')
        console.log('Created By:', entry.createdByName, `[ID: ${entry.createdBy}]`)
      }
    }
  } catch (e: any) {
    if (e.code === 'P2021') {
      console.log('NOTE: ProductHistory table does not exist in database.')
    } else {
      throw e
    }
  }

  // 6. Summary
  console.log('\n' + '='.repeat(80))
  console.log('INVESTIGATION SUMMARY')
  console.log('='.repeat(80) + '\n')

  console.log('Product: HP VICTUS 16-S1557AX')
  console.log('SKU:', SKU)
  console.log('Variation ID:', variation.id)
  console.log('Product ID:', variation.productId)
  console.log('Current Selling Price:', variation.sellingPrice.toString())
  console.log('Purchase Price:', variation.purchasePrice.toString())
  console.log('Expected Price: 82,999.00')
  console.log('')
  console.log('FINDING: The price was changed from 82,999 to 71,990')
  console.log('Last Updated At:', variation.updatedAt?.toISOString())
  console.log('')
  console.log('NOTE: PriceChangeHistory table is not available in database.')
  console.log('To find who made the change, we need to check:')
  console.log('  1. VariationLocationDetails.lastPriceUpdatedBy - shown above')
  console.log('  2. AuditLog entries - shown above')
  console.log('  3. Any application logs or import scripts that were run')
}

investigate()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
