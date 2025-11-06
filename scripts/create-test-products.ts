/**
 * Create Test Products
 * Creates 3 test products with known quantities for E2E testing
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function createTestProducts() {
  console.log('\n📦 Creating test products for E2E testing...\n')

  try {
    // Get business and locations
    const business = await prisma.business.findFirst()
    if (!business) {
      throw new Error('No business found! Run: npm run db:seed')
    }

    const warehouse = await prisma.businessLocation.findFirst({
      where: { name: { contains: 'Warehouse', mode: 'insensitive' } }
    })
    if (!warehouse) {
      throw new Error('Main Warehouse not found!')
    }

    const mainStore = await prisma.businessLocation.findFirst({
      where: { name: { contains: 'Main Store', mode: 'insensitive' } }
    })

    const bambang = await prisma.businessLocation.findFirst({
      where: { name: { contains: 'Bambang', mode: 'insensitive' } }
    })

    const tuguegarao = await prisma.businessLocation.findFirst({
      where: { name: { contains: 'Tuguegarao', mode: 'insensitive' } }
    })

    // Get category and unit
    const category = await prisma.category.findFirst({
      where: { deletedAt: null }
    })
    if (!category) {
      throw new Error('No category found!')
    }

    const unit = await prisma.unit.findFirst({
      where: { deletedAt: null }
    })
    if (!unit) {
      throw new Error('No unit found!')
    }

    console.log(`   Business: ${business.name}`)
    console.log(`   Warehouse: ${warehouse.name}`)
    console.log(`   Category: ${category.name}`)
    console.log(`   Unit: ${unit.shortName}\n`)

    // Create 3 test products
    const testProducts = [
      {
        name: 'Test Product A - Computer Mouse',
        sku: 'TEST-PROD-A-001',
        cost: 150,
        price: 250,
        description: 'Test product for E2E automation - Computer accessories'
      },
      {
        name: 'Test Product B - USB Cable',
        sku: 'TEST-PROD-B-002',
        cost: 50,
        price: 100,
        description: 'Test product for E2E automation - Computer peripherals'
      },
      {
        name: 'Test Product C - HDMI Adapter',
        sku: 'TEST-PROD-C-003',
        cost: 200,
        price: 350,
        description: 'Test product for E2E automation - Computer connectors'
      }
    ]

    for (const testProd of testProducts) {
      console.log(`   Creating: ${testProd.name}...`)

      // Create product
      const product = await prisma.product.create({
        data: {
          name: testProd.name,
          sku: testProd.sku,
          description: testProd.description,
          businessId: business.id,
          categoryId: category.id,
          unitId: unit.id,
          isActive: true,
          enableStock: true,
          alertQuantity: 10
        }
      })

      // Create variation
      const variation = await prisma.productVariation.create({
        data: {
          name: 'Default',
          variationCode: testProd.sku,
          productId: product.id,
          businessId: business.id,
          defaultPurchasePrice: testProd.cost,
          defaultSellingPrice: testProd.price,
          profitMargin: testProd.price - testProd.cost
        }
      })

      // Create stock at warehouse (40 units)
      await prisma.variationLocationDetails.create({
        data: {
          productId: product.id,
          productVariationId: variation.id,
          locationId: warehouse.id,
          qtyAvailable: 40
        }
      })

      // Create empty stock records for other locations
      if (mainStore) {
        await prisma.variationLocationDetails.create({
          data: {
            productId: product.id,
            productVariationId: variation.id,
            locationId: mainStore.id,
            qtyAvailable: 0
          }
        })
      }

      if (bambang) {
        await prisma.variationLocationDetails.create({
          data: {
            productId: product.id,
            productVariationId: variation.id,
            locationId: bambang.id,
            qtyAvailable: 0
          }
        })
      }

      if (tuguegarao) {
        await prisma.variationLocationDetails.create({
          data: {
            productId: product.id,
            productVariationId: variation.id,
            locationId: tuguegarao.id,
            qtyAvailable: 0
          }
        })
      }

      console.log(`      ✅ Created with 40 units @ ${warehouse.name}`)
      console.log(`         Cost: ₱${testProd.cost} | Price: ₱${testProd.price} | Profit: ₱${testProd.price - testProd.cost}\n`)
    }

    console.log('═══════════════════════════════════════════════════════════')
    console.log('✅ Test products created successfully!')
    console.log('═══════════════════════════════════════════════════════════\n')

    console.log('📊 SUMMARY:')
    console.log('   Products Created: 3')
    console.log('   Initial Stock: 40 units each @ Main Warehouse')
    console.log('   Total Value: ₱24,000 (cost) | ₱42,000 (retail)\n')

    console.log('🎯 Ready for E2E Testing!')
    console.log('   Run: npm run test:e2e\n')

  } catch (error: any) {
    console.error('\n❌ Error creating test products:', error.message)
    console.error(error.stack)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

createTestProducts()
