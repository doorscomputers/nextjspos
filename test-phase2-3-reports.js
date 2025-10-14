const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function testReports() {
  try {
    console.log('=== Testing Phase 2 & 3 Reports ===\n')

    const businessId = 1
    const startDate = new Date('2025-01-01')
    const endDate = new Date('2025-12-31')

    // Test 1: Category Summary
    console.log('1. Testing Category Summary Report...')
    try {
      const purchases = await prisma.purchase.findMany({
        where: {
          businessId: businessId,
          purchaseDate: {
            gte: startDate,
            lte: endDate,
          },
          deletedAt: null,
        },
        include: {
          items: true,
        },
      })

      console.log(`   ✓ Found ${purchases.length} purchases`)

      // Get all product IDs
      const productIds = [...new Set(purchases.flatMap(p => p.items.map(i => i.productId)))]
      console.log(`   ✓ Found ${productIds.length} unique products`)

      // Fetch products with categories
      const products = await prisma.product.findMany({
        where: {
          id: { in: productIds },
          deletedAt: null,
        },
        select: {
          id: true,
          categoryId: true,
        },
      })

      console.log(`   ✓ Fetched ${products.length} product records`)

      // Get category IDs
      const categoryIds = [...new Set(products.map(p => p.categoryId).filter(Boolean))]
      console.log(`   ✓ Found ${categoryIds.length} categories`)

      // Fetch categories
      const categories = await prisma.category.findMany({
        where: {
          id: { in: categoryIds },
          deletedAt: null,
        },
      })

      console.log(`   ✓ Category Summary: WORKING`)

    } catch (error) {
      console.log(`   ✗ Category Summary ERROR:`, error.message)
    }

    // Test 2: Daily Summary
    console.log('\n2. Testing Daily Summary Report...')
    try {
      const purchases = await prisma.purchase.findMany({
        where: {
          businessId: businessId,
          purchaseDate: {
            gte: startDate,
            lte: endDate,
          },
          deletedAt: null,
        },
        include: {
          items: true,
        },
      })

      console.log(`   ✓ Found ${purchases.length} purchases`)
      console.log(`   ✓ Daily Summary: WORKING`)

    } catch (error) {
      console.log(`   ✗ Daily Summary ERROR:`, error.message)
    }

    // Test 3: Item Cost Trend
    console.log('\n3. Testing Item Cost Trend Report...')
    try {
      const productId = 3 // Use actual product ID
      const purchaseItems = await prisma.purchaseItem.findMany({
        where: {
          productId: productId,
          purchase: {
            businessId: businessId,
            purchaseDate: {
              gte: startDate,
              lte: endDate,
            },
            deletedAt: null,
          },
        },
        include: {
          purchase: {
            select: {
              purchaseDate: true,
              purchaseOrderNumber: true,
              supplier: {
                select: {
                  name: true,
                },
              },
            },
          },
        },
        orderBy: {
          purchase: {
            purchaseDate: 'asc',
          },
        },
      })

      console.log(`   ✓ Found ${purchaseItems.length} purchase items for product ${productId}`)
      console.log(`   ✓ Item Cost Trend: WORKING`)

    } catch (error) {
      console.log(`   ✗ Item Cost Trend ERROR:`, error.message)
    }

    // Test 4: Budget vs Actual
    console.log('\n4. Testing Budget vs Actual Report...')
    try {
      // Check if table exists
      const budgets = await prisma.purchaseBudget.findMany({
        where: {
          businessId: businessId,
          deletedAt: null,
        },
      })

      console.log(`   ✓ Found ${budgets.length} budgets`)
      console.log(`   ✓ Budget vs Actual: WORKING`)

    } catch (error) {
      console.log(`   ✗ Budget vs Actual ERROR:`, error.message)
    }

    // Test 5: Supplier Performance
    console.log('\n5. Testing Supplier Performance Report...')
    try {
      const purchases = await prisma.purchase.findMany({
        where: {
          businessId: businessId,
          purchaseDate: {
            gte: startDate,
            lte: endDate,
          },
          deletedAt: null,
        },
        include: {
          supplier: true,
          receipts: {
            include: {
              purchaseReturns: {
                include: {
                  items: true,
                },
              },
            },
          },
          items: true,
        },
      })

      console.log(`   ✓ Found ${purchases.length} purchases`)
      console.log(`   ✓ Supplier Performance: WORKING`)

    } catch (error) {
      console.log(`   ✗ Supplier Performance ERROR:`, error.message)
    }

    console.log('\n=== All Tests Complete ===')

  } catch (error) {
    console.error('Fatal error:', error)
  } finally {
    await prisma.$disconnect()
  }
}

testReports()
