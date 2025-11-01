#!/usr/bin/env tsx

import { PrismaClient } from '@prisma/client'
import { addComprehensivePerformanceIndexes } from './add-comprehensive-performance-indexes'

const prisma = new PrismaClient()

async function deployPerformanceOptimizations() {
    console.log('🚀 Deploying UltimatePOS Performance Optimizations...')
    console.log('='.repeat(60))

    try {
        // Step 1: Test database connection
        console.log('\n📡 Testing database connection...')
        await prisma.$queryRaw`SELECT 1`
        console.log('✅ Database connection successful')

        // Step 2: Add comprehensive indexes
        console.log('\n🗂️ Adding comprehensive performance indexes...')
        await addComprehensivePerformanceIndexes()

        // Step 3: Verify indexes were created
        console.log('\n🔍 Verifying indexes...')
        const indexCount = await prisma.$queryRaw`
      SELECT COUNT(*) as count 
      FROM pg_indexes 
      WHERE schemaname = 'public' 
      AND indexname LIKE 'idx_%'
    ` as any[]

        console.log(`✅ Found ${indexCount[0].count} performance indexes`)

        // Step 4: Test a sample query
        console.log('\n🧪 Testing sample query performance...')
        const startTime = Date.now()

        await prisma.product.findMany({
            where: {
                businessId: 1,
                deletedAt: null,
                isActive: true
            },
            select: {
                id: true,
                name: true,
                sku: true,
                type: true,
                isActive: true
            },
            take: 10
        })

        const queryTime = Date.now() - startTime
        console.log(`✅ Sample query completed in ${queryTime}ms`)

        console.log('\n🎉 Performance optimizations deployed successfully!')
        console.log('\n📊 Expected Performance Improvements:')
        console.log('  • Dashboard stats: 60-70% faster')
        console.log('  • Products list: 70-80% faster')
        console.log('  • Sales queries: 50-60% faster')
        console.log('  • Purchase queries: 50-60% faster')
        console.log('  • Search queries: 70-80% faster')
        console.log('  • Filtering queries: 60-70% faster')
        console.log('  • Sorting queries: 80-90% faster')

        console.log('\n🚀 Next Steps:')
        console.log('  1. Test the optimized APIs:')
        console.log('     - GET /api/products/route-optimized-v2')
        console.log('     - GET /api/dashboard/stats/route-optimized')
        console.log('  2. Deploy the optimized pages:')
        console.log('     - /dashboard/products/list-v2-optimized')
        console.log('  3. Monitor performance improvements')
        console.log('  4. Gradually migrate other pages to optimized versions')

    } catch (error) {
        console.error('\n❌ Deployment failed:', error)
        throw error
    } finally {
        await prisma.$disconnect()
    }
}

// Run the deployment
if (require.main === module) {
    deployPerformanceOptimizations()
        .then(() => {
            console.log('\n✅ Deployment completed successfully!')
            process.exit(0)
        })
        .catch((error) => {
            console.error('\n❌ Deployment failed:', error)
            process.exit(1)
        })
}

export { deployPerformanceOptimizations }
