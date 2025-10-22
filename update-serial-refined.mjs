import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function updateSerialRefined() {
  try {
    console.log('🔧 Updating product serial requirements (REFINED VERSION)...\n')

    // Enable serial tracking for ALL products first
    console.log('Step 1: Enabling serial tracking for all products...')
    const step1 = await prisma.$executeRaw`
      UPDATE products
      SET enable_product_info = true
      WHERE deleted_at IS NULL
    `
    console.log(`✅ Updated ${step1} products to require serial numbers\n`)

    // Disable serial tracking ONLY for:
    // 1. Items below 100 pesos (regardless of name)
    // 2. OR items containing cable/wire/adapter keywords (regardless of price)
    console.log('Step 2: Disabling serial for low-value items and cables/wires/adapters...')
    const step2 = await prisma.$executeRaw`
      UPDATE products
      SET enable_product_info = false
      WHERE deleted_at IS NULL
        AND (
          -- Low value items (below 100)
          selling_price < 100
          -- OR cables, wires, adapters regardless of price
          OR name ILIKE '%cable%'
          OR name ILIKE '%wire%'
          OR name ILIKE '%adapter%'
          OR name ILIKE '%cord%'
          OR name ILIKE '%charger%'
        )
    `
    console.log(`✅ Updated ${step2} products to NOT require serial numbers\n`)

    // Verification
    const stats = await prisma.$queryRaw`
      SELECT
        COUNT(*) as total_products,
        COUNT(CASE WHEN enable_product_info = true THEN 1 END) as requires_serial,
        COUNT(CASE WHEN enable_product_info = false THEN 1 END) as no_serial
      FROM products
      WHERE deleted_at IS NULL
    `

    const result = stats[0]
    console.log('📊 Verification Results:')
    console.log(`   Total Products: ${result.total_products}`)
    console.log(`   Requires Serial: ${result.requires_serial}`)
    console.log(`   No Serial: ${result.no_serial}`)
    console.log('')

    // Show examples
    console.log('📋 Sample products NOT requiring serial numbers:')
    const noSerialExamples = await prisma.product.findMany({
      where: {
        enableProductInfo: false,
        deletedAt: null,
      },
      select: {
        id: true,
        name: true,
        sku: true,
        sellingPrice: true,
      },
      take: 20,
      orderBy: {
        name: 'asc',
      },
    })

    noSerialExamples.forEach(p => {
      console.log(`   - ${p.name} (SKU: ${p.sku}, Price: ${p.sellingPrice || 'N/A'})`)
    })
    console.log('')

    console.log('✅ Refined serial requirement update completed!\n')
    console.log('Note: This version keeps serial tracking for keyboards, mice, and')
    console.log('      headphones EXCEPT if they are below 100 pesos.\n')

  } catch (error) {
    console.error('❌ Error:', error)
  } finally {
    await prisma.$disconnect()
  }
}

updateSerialRefined()
