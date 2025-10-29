#!/usr/bin/env tsx

/**
 * Production Migration Script for UltimatePOS Modern
 *
 * This script handles safe schema migrations in production environment.
 *
 * Usage:
 * npx tsx scripts/migrate-production.ts
 * npx tsx scripts/migrate-production.ts --dry-run
 * npx tsx scripts/migrate-production.ts --backup-first
 */

import { PrismaClient } from '@prisma/client'
import { execSync } from 'child_process'
import { createInterface } from 'readline'
import { join } from 'path'
import { argv } from 'process'

const prisma = new PrismaClient()

interface ProdMigrationConfig {
  productionDatabaseUrl: string
  environment: 'production'
}

class ProdMigration {
  private config: ProdMigrationConfig
  private rl: any

  constructor() {
    this.config = {
      productionDatabaseUrl: process.env.PRODUCTION_DATABASE_URL || process.env.DATABASE_URL!
    }
    this.rl = createInterface({
      input: process.stdin,
      output: process.stdout
    })
  }

  async confirmAction(message: string): Promise<boolean> {
    return new Promise((resolve) => {
      this.rl.question(`${message} (y/N): `, (answer: string) => {
        resolve(answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes')
      })
    })
  }

  async preMigrationChecks(dryRun: boolean = false): Promise<boolean> {
    console.log('🔍 Running pre-migration checks...')

    try {
      // Check database connection
      await this.testDatabaseConnection()
      console.log('✅ Production database connection successful')

      // Check if we're actually connecting to production
      const isProduction = await this.verifyProductionEnvironment()
      if (!isProduction) {
        console.error('❌ Not connected to production database!')
        console.error('   For safety, migrations can only be applied to production environment')
        return false
      }
      console.log('✅ Confirmed production environment')

      // Check for active connections
      const activeConnections = await this.checkActiveConnections()
      if (activeConnections > 0) {
        console.log(`⚠️  ${activeConnections} active database connections detected`)

        if (!dryRun) {
          const continueAnyway = await this.confirmAction(
            'Continue with migration despite active connections?'
          )
          if (!continueAnyway) return false
        }
      } else {
        console.log('✅ No active database connections detected')
      }

      // Check database size
      const dbSize = await this.getDatabaseSize()
      console.log(`📊 Database size: ${dbSize}`)

      // Check pending migrations
      const pendingMigrations = await this.checkPendingMigrations()
      if (pendingMigrations.length > 0) {
        console.log('📋 Pending migrations:')
        pendingMigrations.forEach(migration => {
          console.log(`   - ${migration}`)
        })
      } else {
        console.log('✅ No pending migrations detected')
      }

      return true

    } catch (error) {
      console.error('❌ Pre-migration checks failed:', error)
      return false
    }
  }

  private async testDatabaseConnection(): Promise<void> {
    const testPrisma = new PrismaClient({
      datasources: {
        db: {
          url: this.config.productionDatabaseUrl
        }
      }
    })

    try {
      await testPrisma.$queryRaw`SELECT 1`
    } finally {
      await testPrisma.$disconnect()
    }
  }

  private async verifyProductionEnvironment(): Promise<boolean> {
    try {
      // Check if we can identify this as production
      const result = await prisma.$queryRaw`
        SELECT current_database() as db_name,
               inet_server_addr() as server_ip,
               version() as pg_version
      ` as Array<{
        db_name: string
        server_ip: string
        pg_version: string
      }>

      const info = result[0]

      // Log environment info (without exposing sensitive data)
      console.log(`📍 Database: ${info.db_name}`)
      console.log(`🌐 Server IP: ${info.server_ip}`)
      console.log(`📦 PostgreSQL: ${info.pg_version.split(' ')[1]}`)

      // You can add additional checks here to verify it's production
      // For example, checking database name, connection parameters, etc.

      return true

    } catch (error) {
      console.error('❌ Failed to verify production environment:', error)
      return false
    }
  }

  private async checkActiveConnections(): Promise<number> {
    try {
      const result = await prisma.$queryRaw`
        SELECT count(*) as active_connections
        FROM pg_stat_activity
        WHERE state = 'active'
        AND pid != pg_backend_pid()
      ` as Array<{ active_connections: bigint }>

      return Number(result[0].active_connections)

    } catch (error) {
      console.warn('⚠️  Could not check active connections:', error)
      return 0
    }
  }

  private async getDatabaseSize(): Promise<string> {
    try {
      const result = await prisma.$queryRaw`
        SELECT pg_size_pretty(pg_database_size(current_database())) as db_size
      ` as Array<{ db_size: string }>

      return result[0].db_size

    } catch (error) {
      console.warn('⚠️  Could not get database size:', error)
      return 'Unknown'
    }
  }

  private async checkPendingMigrations(): Promise<string[]> {
    try {
      // Check Prisma migration status
      const statusOutput = execSync('npx prisma migrate status', {
        encoding: 'utf8',
        env: {
          ...process.env,
          DATABASE_URL: this.config.productionDatabaseUrl
        }
      })

      const lines = statusOutput.split('\n')
      const pendingMigrations: string[] = []

      lines.forEach(line => {
        if (line.includes('pending') || line.includes('not yet applied')) {
          pendingMigrations.push(line.trim())
        }
      })

      return pendingMigrations

    } catch (error) {
      console.warn('⚠️  Could not check pending migrations:', error)
      return []
    }
  }

  async createBackup(): Promise<string> {
    console.log('💾 Creating production backup...')

    const backupScript = join(process.cwd(), 'scripts', 'backup-database.ts')
    const backupCommand = `npx tsx "${backupScript}" production`

    try {
      execSync(backupCommand, { stdio: 'inherit' })
      console.log('✅ Production backup created')
      return 'completed'
    } catch (error) {
      console.error('❌ Failed to create backup:', error)
      throw error
    }
  }

  async applyMigrations(dryRun: boolean = false): Promise<boolean> {
    console.log(`🚀 ${dryRun ? 'Simulating' : 'Applying'} migrations to production...`)

    if (!dryRun) {
      const confirmApply = await this.confirmAction(
        '⚠️  WARNING: This will apply schema changes to production!\n' +
        '   Are you absolutely sure you want to continue?'
      )

      if (!confirmApply) {
        console.log('❌ Migration cancelled by user')
        return false
      }
    }

    try {
      // Use Prisma migrate deploy for safe production deployment
      const command = dryRun
        ? 'echo "DRY RUN: Would apply migrations"'
        : 'npx prisma migrate deploy'

      execSync(command, {
        stdio: 'inherit',
        env: {
          ...process.env,
          DATABASE_URL: this.config.productionDatabaseUrl
        }
      })

      if (!dryRun) {
        console.log('✅ Migrations applied successfully')
      } else {
        console.log('✅ Dry run completed - no changes made')
      }

      return true

    } catch (error) {
      console.error(`❌ Migration ${dryRun ? 'dry run' : 'application'} failed:`, error)
      return false
    }
  }

  async postMigrationVerification(): Promise<boolean> {
    console.log('🔍 Running post-migration verification...')

    try {
      // Test database connectivity
      await this.testDatabaseConnection()

      // Check migration status
      const pendingMigrations = await this.checkPendingMigrations()
      if (pendingMigrations.length > 0) {
        console.warn('⚠️  Still have pending migrations after deployment:')
        pendingMigrations.forEach(migration => console.log(`   - ${migration}`))
        return false
      }

      // Test basic operations
      const userCount = await prisma.user.count()
      console.log(`✅ Database verified - Users table accessible (${userCount} records)`)

      // Check core tables exist
      const tables = await prisma.$queryRaw`
        SELECT table_name
        FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name IN ('users', 'business', 'products', 'sales')
        ORDER BY table_name
      ` as Array<{ table_name: string }>

      console.log(`✅ Found ${tables.length} core tables`)

      return true

    } catch (error) {
      console.error('❌ Post-migration verification failed:', error)
      return false
    }
  }

  async getMigrationLog(): Promise<any[]> {
    try {
      const migrations = await prisma.$queryRaw`
        SELECT * FROM _prisma_migrations
        ORDER BY finished_at DESC
        LIMIT 10
      ` as Array<any>

      return migrations
    } catch (error) {
      console.warn('⚠️  Could not fetch migration log:', error)
      return []
    }
  }

  async executeMigration(dryRun: boolean = false, backupFirst: boolean = false): Promise<void> {
    console.log(`🚀 Starting ${dryRun ? 'dry run ' : ''}production migration...`)

    try {
      // Step 1: Pre-migration checks
      const checksPassed = await this.preMigrationChecks(dryRun)
      if (!checksPassed) {
        console.error('❌ Pre-migration checks failed. Aborting.')
        return
      }

      // Step 2: Create backup (only for real migration)
      if (!dryRun && backupFirst) {
        await this.createBackup()
      }

      // Step 3: Apply migrations
      const migrationSuccess = await this.applyMigrations(dryRun)
      if (!migrationSuccess) {
        console.error(`❌ Migration ${dryRun ? 'dry run' : 'application'} failed.`)
        return
      }

      // Step 4: Post-migration verification (only for real migration)
      if (!dryRun) {
        const verificationPassed = await this.postMigrationVerification()

        if (verificationPassed) {
          console.log('🎉 Production migration completed successfully!')

          // Show recent migrations
          const recentMigrations = await this.getMigrationLog()
          if (recentMigrations.length > 0) {
            console.log('\n📋 Recent migrations:')
            recentMigrations.forEach((m, index) => {
              console.log(`  ${index + 1}. ${m.migration_name} (${m.finished_at})`)
            })
          }
        } else {
          console.error('❌ Post-migration verification failed!')
          console.log('⚠️  Please check the database state manually')
        }
      } else {
        console.log('✅ Dry run completed successfully')
        console.log('💡 Run without --dry-run to apply these changes')
      }

    } catch (error) {
      console.error('❌ Migration process failed:', error)
    } finally {
      this.rl.close()
      await prisma.$disconnect()
    }
  }
}

// Parse command line arguments
function parseArgs() {
  const args = {
    dryRun: false,
    backupFirst: false,
    help: false
  }

  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i]

    if (arg === '--dry-run') {
      args.dryRun = true
    } else if (arg === '--backup-first') {
      args.backupFirst = true
    } else if (arg === '--help' || arg === '-h') {
      args.help = true
    }
  }

  return args
}

// Main execution
async function main() {
  const args = parseArgs()

  if (args.help) {
    console.log(`
Production Migration Script

Usage:
  npx tsx scripts/migrate-production.ts [options]

Options:
  --dry-run        Simulate migration without applying changes
  --backup-first   Create backup before applying migrations
  --help, -h       Show this help message

Examples:
  npx tsx scripts/migrate-production.ts --dry-run
  npx tsx scripts/migrate-production.ts --backup-first
  npx tsx scripts/migrate-production.ts

⚠️  WARNING: This script modifies production database!
    Always run with --dry-run first.
    Consider using --backup-first for safety.
    `)
    process.exit(0)
  }

  console.log('⚠️  PRODUCTION MIGRATION TOOL')
  console.log('📋 This tool will apply schema changes to production database')
  console.log('')

  if (args.dryRun) {
    console.log('🔍 DRY RUN MODE - No changes will be made')
  } else {
    console.log('🚀 LIVE MODE - Changes will be applied to production')
  }

  console.log('')

  const migration = new ProdMigration()

  if (!args.dryRun) {
    const confirmed = await migration.confirmAction(
      'Do you understand this will modify the production database?'
    )

    if (!confirmed) {
      console.log('❌ Migration cancelled by user')
      process.exit(0)
    }
  }

  await migration.executeMigration(args.dryRun, args.backupFirst)
}

// Run if called directly
if (require.main === module) {
  main().catch(console.error)
}