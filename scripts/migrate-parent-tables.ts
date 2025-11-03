/**
 * Parent Tables Migration Script
 * Migrates only parent tables first to establish foundation
 * Run this BEFORE migrating child tables
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
  targetCount: number
  migrated: number
  failed: number
  status: 'success' | 'partial' | 'failed'
}

const stats: MigrationStats[] = []

async function migrateTable<T extends Record<string, any>>(
  tableName: string,
  fetchFromSource: () => Promise<T[]>,
  insertToTarget: (record: T) => Promise<any>,
  options: {
    skipIfExists?: boolean
    clearTargetFirst?: boolean
  } = {}
): Promise<MigrationStats> {
  console.log(`\n${'='.repeat(60)}`)
  console.log(`📦 Migrating: ${tableName}`)
  console.log('='.repeat(60))

  const stat: MigrationStats = {
    tableName,
    sourceCount: 0,
    targetCount: 0,
    migrated: 0,
    failed: 0,
    status: 'success',
  }

  try {
    // Fetch source data
    console.log(`📥 Fetching records from source...`)
    const records = await fetchFromSource()
    stat.sourceCount = records.length
    console.log(`   Found ${records.length} records in source database`)

    if (records.length === 0) {
      console.log(`   ℹ️  No records to migrate`)
      stat.status = 'success'
      stats.push(stat)
      return stat
    }

    // Clear target if requested
    if (options.clearTargetFirst) {
      console.log(`🗑️  Clearing existing records in target...`)
      // Note: Will be implemented per table
    }

    // Migrate each record
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
        console.log(`\n   ${progress} ✗ Failed to migrate:`)
        console.log(`      Error: ${error.message}`)
        if (error.meta) {
          console.log(`      Details: ${JSON.stringify(error.meta)}`)
        }
      }
    }

    console.log(``) // New line after progress

    // Check target count
    console.log(`\n📊 Verification:`)
    console.log(`   Source: ${stat.sourceCount} records`)
    console.log(`   Migrated: ${stat.migrated} records`)
    console.log(`   Failed: ${stat.failed} records`)

    if (stat.failed === 0) {
      stat.status = 'success'
      console.log(`   ✅ Status: SUCCESS`)
    } else if (stat.migrated > 0) {
      stat.status = 'partial'
      console.log(`   ⚠️  Status: PARTIAL (some records failed)`)
    } else {
      stat.status = 'failed'
      console.log(`   ❌ Status: FAILED (no records migrated)`)
    }
  } catch (error: any) {
    console.error(`\n❌ Error migrating ${tableName}:`, error.message)
    stat.status = 'failed'
  }

  stats.push(stat)
  return stat
}

async function main() {
  console.log('\n' + '='.repeat(60))
  console.log('🚀 PARENT TABLES MIGRATION')
  console.log('='.repeat(60))
  console.log('📍 Source:', process.env.SOURCE_DATABASE_URL?.split('@')[1])
  console.log('📍 Target:', process.env.TARGET_DATABASE_URL?.split('@')[1])
  console.log('='.repeat(60))

  try {
    // Test connections
    console.log('\n🔌 Testing database connections...')
    await sourceDb.$connect()
    console.log('   ✅ Connected to source database')
    await targetDb.$connect()
    console.log('   ✅ Connected to target database')

    // ==========================================
    // 1. CURRENCIES (no dependencies)
    // ==========================================
    await migrateTable(
      'Currency',
      () => sourceDb.currency.findMany({
        orderBy: { id: 'asc' },
      }),
      async (record) => {
        return targetDb.currency.upsert({
          where: { id: record.id },
          create: record,
          update: record,
        })
      }
    )

    // ==========================================
    // 2. BUSINESSES (depends on Currency)
    // ==========================================
    await migrateTable(
      'Business',
      () => sourceDb.business.findMany({
        orderBy: { id: 'asc' },
      }),
      async (record) => {
        return targetDb.business.upsert({
          where: { id: record.id },
          create: record,
          update: record,
        })
      }
    )

    // ==========================================
    // 3. BUSINESS LOCATIONS (depends on Business)
    // ==========================================
    await migrateTable(
      'BusinessLocation',
      () => sourceDb.businessLocation.findMany({
        orderBy: { id: 'asc' },
      }),
      async (record) => {
        return targetDb.businessLocation.upsert({
          where: { id: record.id },
          create: record,
          update: record,
        })
      }
    )

    // ==========================================
    // 4. PERMISSIONS (no dependencies)
    // ==========================================
    await migrateTable(
      'Permission',
      () => sourceDb.permission.findMany({
        orderBy: { id: 'asc' },
      }),
      async (record) => {
        return targetDb.permission.upsert({
          where: { id: record.id },
          create: record,
          update: record,
        })
      }
    )

    // ==========================================
    // 5. ROLES (depends on Business)
    // ==========================================
    await migrateTable(
      'Role',
      () => sourceDb.role.findMany({
        orderBy: { id: 'asc' },
      }),
      async (record) => {
        return targetDb.role.upsert({
          where: { id: record.id },
          create: record,
          update: record,
        })
      }
    )

    // ==========================================
    // 6. USERS (depends on Business)
    // ==========================================
    await migrateTable(
      'User',
      () => sourceDb.user.findMany({
        orderBy: { id: 'asc' },
      }),
      async (record) => {
        return targetDb.user.upsert({
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
      const statusColor =
        stat.status === 'success'
          ? stat.tableName
          : stat.status === 'partial'
          ? stat.tableName
          : stat.tableName

      console.log(
        `${icon} ${statusColor.padEnd(25)} ${stat.migrated}/${stat.sourceCount} records`
      )
    })

    console.log('\n' + '-'.repeat(60))
    console.log(`Total Tables: ${stats.length}`)
    console.log(`✅ Success: ${successCount}`)
    console.log(`⚠️  Partial: ${partialCount}`)
    console.log(`❌ Failed: ${failedCount}`)
    console.log('='.repeat(60))

    if (failedCount > 0 || partialCount > 0) {
      console.log('\n⚠️  WARNING: Some parent tables failed to migrate completely.')
      console.log('   Please review the errors above before migrating child tables.')
      console.log('   Child tables depend on these parent tables.')
    } else {
      console.log('\n🎉 All parent tables migrated successfully!')
      console.log('   You can now run the child tables migration script.')
    }
  } catch (error) {
    console.error('\n❌ Migration failed:', error)
    process.exit(1)
  } finally {
    await sourceDb.$disconnect()
    await targetDb.$disconnect()
  }
}

main()
  .catch((error) => {
    console.error('Fatal error:', error)
    process.exit(1)
  })
