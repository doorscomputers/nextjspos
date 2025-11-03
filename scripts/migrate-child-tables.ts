/**
 * Child Tables Migration Script
 * Migrates child/junction tables AFTER parent tables are migrated
 * Run this AFTER migrate-parent-tables.ts completes successfully
 */

import { PrismaClient } from '@prisma/client'

// Source database (local PostgreSQL)
const sourceDb = new PrismaClient({
  datasources: {
    db: {
      url: process.env.SOURCE_DATABASE_URL,
    },
  },
})

// Target database (Supabase)
const targetDb = new PrismaClient({
  datasources: {
    db: {
      url: process.env.TARGET_DATABASE_URL,
    },
  },
})

interface MigrationStats {
  tableName: string
  sourceCount: number
  migrated: number
  failed: number
  status: 'success' | 'partial' | 'failed'
}

const stats: MigrationStats[] = []

async function migrateTable<T extends Record<string, any>>(
  tableName: string,
  fetchFromSource: () => Promise<T[]>,
  insertToTarget: (record: T) => Promise<any>
): Promise<MigrationStats> {
  console.log(`\n${'='.repeat(60)}`)
  console.log(`📦 Migrating: ${tableName}`)
  console.log('='.repeat(60))

  const stat: MigrationStats = {
    tableName,
    sourceCount: 0,
    migrated: 0,
    failed: 0,
    status: 'success',
  }

  try {
    const records = await fetchFromSource()
    stat.sourceCount = records.length
    console.log(`   Found ${records.length} records in source database`)

    if (records.length === 0) {
      console.log(`   ℹ️  No records to migrate`)
      stat.status = 'success'
      stats.push(stat)
      return stat
    }

    console.log(`📤 Starting migration...`)
    for (let i = 0; i < records.length; i++) {
      const record = records[i]
      const progress = `[${i + 1}/${records.length}]`

      try {
        await insertToTarget(record)
        stat.migrated++
        process.stdout.write(`\r   ${progress} ✓ Migrated ${stat.migrated} records`)
      } catch (error: any) {
        stat.failed++
        console.log(`\n   ${progress} ✗ Failed:`)
        console.log(`      ${error.message}`)
      }
    }

    console.log(``) // New line

    console.log(`\n📊 Result:`)
    console.log(`   Migrated: ${stat.migrated}/${stat.sourceCount}`)
    console.log(`   Failed: ${stat.failed}`)

    stat.status =
      stat.failed === 0 ? 'success' : stat.migrated > 0 ? 'partial' : 'failed'
  } catch (error: any) {
    console.error(`\n❌ Error:`, error.message)
    stat.status = 'failed'
  }

  stats.push(stat)
  return stat
}

async function main() {
  console.log('\n' + '='.repeat(60))
  console.log('🚀 CHILD TABLES MIGRATION')
  console.log('='.repeat(60))
  console.log('⚠️  Make sure parent tables were migrated successfully first!')
  console.log('='.repeat(60))

  try {
    await sourceDb.$connect()
    await targetDb.$connect()
    console.log('✅ Connected to both databases\n')

    // ==========================================
    // JUNCTION TABLES
    // ==========================================

    // User Roles (depends on User, Role)
    await migrateTable(
      'UserRole',
      () => sourceDb.userRole.findMany({ orderBy: { userId: 'asc' } }),
      async (record) => {
        return targetDb.userRole.create({ data: record })
      }
    )

    // Role Permissions (depends on Role, Permission)
    await migrateTable(
      'RolePermission',
      () => sourceDb.rolePermission.findMany({ orderBy: { roleId: 'asc' } }),
      async (record) => {
        return targetDb.rolePermission.create({ data: record })
      }
    )

    // User Permissions (depends on User, Permission)
    await migrateTable(
      'UserPermission',
      () => sourceDb.userPermission.findMany({ orderBy: { userId: 'asc' } }),
      async (record) => {
        return targetDb.userPermission.create({ data: record })
      }
    )

    // ==========================================
    // MASTER DATA TABLES
    // ==========================================

    // Categories
    await migrateTable(
      'Category',
      () => sourceDb.category.findMany({ orderBy: { id: 'asc' } }),
      async (record) => {
        return targetDb.category.upsert({
          where: { id: record.id },
          create: record,
          update: record,
        })
      }
    )

    // Brands
    await migrateTable(
      'Brand',
      () => sourceDb.brand.findMany({ orderBy: { id: 'asc' } }),
      async (record) => {
        return targetDb.brand.upsert({
          where: { id: record.id },
          create: record,
          update: record,
        })
      }
    )

    // Units
    await migrateTable(
      'Unit',
      () => sourceDb.unit.findMany({ orderBy: { id: 'asc' } }),
      async (record) => {
        return targetDb.unit.upsert({
          where: { id: record.id },
          create: record,
          update: record,
        })
      }
    )

    // Taxes
    await migrateTable(
      'Tax',
      () => sourceDb.tax.findMany({ orderBy: { id: 'asc' } }),
      async (record) => {
        return targetDb.tax.upsert({
          where: { id: record.id },
          create: record,
          update: record,
        })
      }
    )

    // ==========================================
    // CONTACTS
    // ==========================================

    // Suppliers
    await migrateTable(
      'Supplier',
      () => sourceDb.supplier.findMany({ orderBy: { id: 'asc' } }),
      async (record) => {
        return targetDb.supplier.upsert({
          where: { id: record.id },
          create: record,
          update: record,
        })
      }
    )

    // Customers
    await migrateTable(
      'Customer',
      () => sourceDb.customer.findMany({ orderBy: { id: 'asc' } }),
      async (record) => {
        return targetDb.customer.upsert({
          where: { id: record.id },
          create: record,
          update: record,
        })
      }
    )

    // ==========================================
    // PRODUCTS
    // ==========================================

    // Products
    await migrateTable(
      'Product',
      () => sourceDb.product.findMany({ orderBy: { id: 'asc' } }),
      async (record) => {
        return targetDb.product.upsert({
          where: { id: record.id },
          create: record,
          update: record,
        })
      }
    )

    // Product Variations
    await migrateTable(
      'ProductVariation',
      () => sourceDb.productVariation.findMany({ orderBy: { id: 'asc' } }),
      async (record) => {
        return targetDb.productVariation.upsert({
          where: { id: record.id },
          create: record,
          update: record,
        })
      }
    )

    // Product History
    await migrateTable(
      'ProductHistory',
      () => sourceDb.productHistory.findMany({ orderBy: { id: 'asc' } }),
      async (record) => {
        return targetDb.productHistory.create({ data: record })
      }
    )

    // ==========================================
    // ACCOUNTING
    // ==========================================

    // Chart of Accounts
    await migrateTable(
      'ChartOfAccounts',
      () => sourceDb.chartOfAccounts.findMany({ orderBy: { id: 'asc' } }),
      async (record) => {
        return targetDb.chartOfAccounts.upsert({
          where: { id: record.id },
          create: record,
          update: record,
        })
      }
    )

    // Expense Categories
    await migrateTable(
      'ExpenseCategory',
      () => sourceDb.expenseCategory.findMany({ orderBy: { id: 'asc' } }),
      async (record) => {
        return targetDb.expenseCategory.upsert({
          where: { id: record.id },
          create: record,
          update: record,
        })
      }
    )

    // Expenses
    await migrateTable(
      'Expense',
      () => sourceDb.expense.findMany({ orderBy: { id: 'asc' } }),
      async (record) => {
        return targetDb.expense.upsert({
          where: { id: record.id },
          create: record,
          update: record,
        })
      }
    )

    // ==========================================
    // FINAL SUMMARY
    // ==========================================
    console.log('\n' + '='.repeat(60))
    console.log('📊 MIGRATION SUMMARY')
    console.log('='.repeat(60))

    const successCount = stats.filter((s) => s.status === 'success').length
    const partialCount = stats.filter((s) => s.status === 'partial').length
    const failedCount = stats.filter((s) => s.status === 'failed').length

    console.log('\nTable-by-Table Results:')
    console.log('-'.repeat(60))
    stats.forEach((stat) => {
      const icon =
        stat.status === 'success' ? '✅' : stat.status === 'partial' ? '⚠️ ' : '❌'
      console.log(
        `${icon} ${stat.tableName.padEnd(25)} ${stat.migrated}/${stat.sourceCount} records`
      )
    })

    console.log('\n' + '-'.repeat(60))
    console.log(`Total Tables: ${stats.length}`)
    console.log(`✅ Success: ${successCount}`)
    console.log(`⚠️  Partial: ${partialCount}`)
    console.log(`❌ Failed: ${failedCount}`)
    console.log('='.repeat(60))

    if (failedCount === 0 && partialCount === 0) {
      console.log('\n🎉 All child tables migrated successfully!')
      console.log('   Your database migration is complete.')
    } else {
      console.log('\n⚠️  Some records failed to migrate.')
      console.log('   Review the errors above.')
    }
  } catch (error) {
    console.error('\n❌ Migration failed:', error)
    process.exit(1)
  } finally {
    await sourceDb.$disconnect()
    await targetDb.$disconnect()
  }
}

main().catch((error) => {
  console.error('Fatal error:', error)
  process.exit(1)
})
