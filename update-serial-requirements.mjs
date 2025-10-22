import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function updateSerialRequirements() {
  try {
    console.log('🔧 Updating product serial requirements...\n')

    // Step 1: Enable serial tracking for ALL products
    console.log('Step 1: Enabling serial tracking for all products...')
    const step1 = await prisma.$executeRaw`
      UPDATE products
      SET enable_product_info = true
      WHERE deleted_at IS NULL
    `
    console.log(`✅ Updated ${step1} products to require serial numbers\n`)

    // Step 2: Disable serial tracking for exceptions
    console.log('Step 2: Disabling serial tracking for low-value items and cables...')
    const step2 = await prisma.$executeRaw`
      UPDATE products
      SET enable_product_info = false
      WHERE deleted_at IS NULL
        AND (
          selling_price < 100
          OR name ILIKE '%mouse%'
          OR name ILIKE '%keyboard%'
          OR name ILIKE '%cable%'
          OR name ILIKE '%lan cable%'
          OR name ILIKE '%wire%'
          OR name ILIKE '%adapter%'
        )
    `
    console.log(`✅ Updated ${step2} products to NOT require serial numbers\n`)

    // Step 3: Verify the updates
    console.log('📊 Verification Results:')
    const stats = await prisma.$queryRaw`
      SELECT
        COUNT(*) as total_products,
        COUNT(CASE WHEN enable_product_info = true THEN 1 END) as requires_serial,
        COUNT(CASE WHEN enable_product_info = false THEN 1 END) as no_serial
      FROM products
      WHERE deleted_at IS NULL
    `

    const result = stats[0]
    console.log(`   Total Products: ${result.total_products}`)
    console.log(`   Requires Serial: ${result.requires_serial}`)
    console.log(`   No Serial: ${result.no_serial}`)
    console.log('')

    // Show examples of products that don't require serial
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

    console.log('✅ Serial requirement update completed successfully!\n')

  } catch (error) {
    console.error('❌ Error updating serial requirements:', error)
  } finally {
    await prisma.$disconnect()
  }
}

updateSerialRequirements()
