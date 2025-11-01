import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function checkTableSchema() {
    console.log('🔍 Checking table schemas...\n')

    const tables = [
        'sales',
        'sale_items',
        'purchases',
        'purchase_items',
        'products',
        'product_variations',
        'variation_location_details',
        'customers',
        'suppliers',
        'business_locations',
        'accounts_payable',
        'customer_returns',
        'supplier_returns'
    ]

    for (const table of tables) {
        try {
            console.log(`\n📋 Table: ${table}`)
            const columns = await prisma.$queryRaw<Array<{ column_name: string, data_type: string }>>`
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_name = '${table}' 
        AND table_schema = 'public'
        ORDER BY ordinal_position
      `

            console.log(`   Columns: ${columns.map(c => c.column_name).join(', ')}`)

            // Check for specific columns we're interested in
            const hasDeletedAt = columns.some(c => c.column_name === 'deleted_at')
            const hasPaymentStatus = columns.some(c => c.column_name === 'payment_status')
            const hasSaleDate = columns.some(c => c.column_name === 'sale_date')
            const hasCreatedAt = columns.some(c => c.column_name === 'created_at')
            const hasBusinessId = columns.some(c => c.column_name === 'business_id')

            console.log(`   - deleted_at: ${hasDeletedAt ? '✅' : '❌'}`)
            console.log(`   - payment_status: ${hasPaymentStatus ? '✅' : '❌'}`)
            console.log(`   - sale_date: ${hasSaleDate ? '✅' : '❌'}`)
            console.log(`   - created_at: ${hasCreatedAt ? '✅' : '❌'}`)
            console.log(`   - business_id: ${hasBusinessId ? '✅' : '❌'}`)

        } catch (error: any) {
            console.error(`❌ Error checking ${table}:`, error.message)
        }
    }

    await prisma.$disconnect()
}

checkTableSchema()
    .catch((error) => {
        console.error('Fatal error:', error)
        process.exit(1)
    })

