import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function resetProducts() {
  console.log('============================================')
  console.log('RESETTING ALL PRODUCTS AND RELATED DATA')
  console.log('============================================\n')

  try {
    // Start a transaction
    await prisma.$transaction(async (tx) => {
      console.log('1. Deleting product serial numbers...')
      const serialNumbers = await tx.productSerialNumber.deleteMany({})
      console.log(`   ✓ Deleted ${serialNumbers.count} serial numbers`)

      console.log('2. Deleting product history (audit trail)...')
      const history = await tx.productHistory.deleteMany({})
      console.log(`   ✓ Deleted ${history.count} history records`)

      console.log('3. Deleting stock transactions...')
      const transactions = await tx.stockTransaction.deleteMany({})
      console.log(`   ✓ Deleted ${transactions.count} transactions`)

      console.log('4. Deleting variation location details (stock)...')
      const locationDetails = await tx.variationLocationDetails.deleteMany({})
      console.log(`   ✓ Deleted ${locationDetails.count} location details`)

      console.log('5. Deleting freebie logs...')
      const freebies = await tx.freebieLog.deleteMany({})
      console.log(`   ✓ Deleted ${freebies.count} freebie logs`)

      console.log('6. Deleting quotation items...')
      const quotationItems = await tx.quotationItem.deleteMany({})
      console.log(`   ✓ Deleted ${quotationItems.count} quotation items`)

      console.log('7. Deleting combo products...')
      const comboProducts = await tx.comboProduct.deleteMany({})
      console.log(`   ✓ Deleted ${comboProducts.count} combo products`)

      console.log('8. Deleting inventory corrections...')
      const corrections = await tx.inventoryCorrection.deleteMany({})
      console.log(`   ✓ Deleted ${corrections.count} inventory corrections`)

      console.log('9. Deleting product variations...')
      const variations = await tx.productVariation.deleteMany({})
      console.log(`   ✓ Deleted ${variations.count} variations`)

      console.log('10. Deleting products...')
      const products = await tx.product.deleteMany({})
      console.log(`   ✓ Deleted ${products.count} products`)
    })

    console.log('\n✅ All product data deleted successfully!')

    // Reset sequences using raw SQL
    console.log('\n11. Resetting auto-increment sequences...')
    await prisma.$executeRawUnsafe('ALTER SEQUENCE products_id_seq RESTART WITH 1')
    await prisma.$executeRawUnsafe('ALTER SEQUENCE product_variations_id_seq RESTART WITH 1')
    await prisma.$executeRawUnsafe('ALTER SEQUENCE variation_location_details_id_seq RESTART WITH 1')
    await prisma.$executeRawUnsafe('ALTER SEQUENCE stock_transactions_id_seq RESTART WITH 1')
    await prisma.$executeRawUnsafe('ALTER SEQUENCE product_history_id_seq RESTART WITH 1')
    await prisma.$executeRawUnsafe('ALTER SEQUENCE product_serial_numbers_id_seq RESTART WITH 1')
    await prisma.$executeRawUnsafe('ALTER SEQUENCE inventory_corrections_id_seq RESTART WITH 1')
    await prisma.$executeRawUnsafe('ALTER SEQUENCE combo_products_id_seq RESTART WITH 1')
    await prisma.$executeRawUnsafe('ALTER SEQUENCE freebie_logs_id_seq RESTART WITH 1')
    console.log('   ✓ All sequences reset to 1')

    // Verify
    console.log('\n============================================')
    console.log('VERIFICATION - Remaining Records:')
    console.log('============================================')
    const counts = await Promise.all([
      prisma.product.count(),
      prisma.productVariation.count(),
      prisma.variationLocationDetails.count(),
      prisma.stockTransaction.count(),
      prisma.productHistory.count()
    ])

    console.log(`Products:                    ${counts[0]}`)
    console.log(`Product Variations:          ${counts[1]}`)
    console.log(`Variation Location Details:  ${counts[2]}`)
    console.log(`Stock Transactions:          ${counts[3]}`)
    console.log(`Product History:             ${counts[4]}`)
    console.log('\n✅ All done! Database is clean and ready for fresh import.')

  } catch (error) {
    console.error('\n❌ Error during reset:', error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

resetProducts()
  .then(() => {
    console.log('\n✅ Script completed successfully!')
    process.exit(0)
  })
  .catch((error) => {
    console.error('\n❌ Script failed:', error)
    process.exit(1)
  })
