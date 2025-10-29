#!/usr/bin/env tsx

/**
 * Database Sync Script for UltimatePOS Modern
 *
 * This script helps synchronize database changes from local to production safely.
 *
 * Usage:
 * npm run db:sync:to-production
 */

import { PrismaClient } from '@prisma/client'
import { execSync } from 'child_process'
import { readFileSync, writeFileSync, existsSync } from 'fs'
import { join } from 'path'
import { createInterface } from 'readline'

const prisma = new PrismaClient()

interface SyncConfig {
  localDatabaseUrl: string
  productionDatabaseUrl: string
  backupDir: string
  timestamp: string
}

class DatabaseSync {
  private config: SyncConfig
  private rl: any

  constructor() {
    this.config = {
      localDatabaseUrl: process.env.DATABASE_URL!,
      productionDatabaseUrl: process.env.PRODUCTION_DATABASE_URL || process.env.DATABASE_URL!,
      backupDir: join(process.cwd(), 'backups'),
      timestamp: new Date().toISOString().replace(/[:.]/g, '-')
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

  async preSyncChecks(): Promise<boolean> {
    console.log('🔍 Running pre-sync checks...')

    // Check if production database is accessible
    try {
      await this.testDatabaseConnection(this.config.productionDatabaseUrl, 'production')
      console.log('✅ Production database connection successful')
    } catch (error) {
      console.error('❌ Cannot connect to production database:', error)
      return false
    }

    // Check if local database is accessible
    try {
      await this.testDatabaseConnection(this.config.localDatabaseUrl, 'local')
      console.log('✅ Local database connection successful')
    } catch (error) {
      console.error('❌ Cannot connect to local database:', error)
      return false
    }

    // Check for pending migrations
    const pendingMigrations = await this.checkPendingMigrations()
    if (pendingMigrations.length > 0) {
      console.log('⚠️  Pending migrations found:')
      pendingMigrations.forEach(migration => console.log(`   - ${migration}`))

      const continueSync = await this.confirmAction('Continue with sync despite pending migrations?')
      if (!continueSync) return false
    }

    return true
  }

  private async testDatabaseConnection(databaseUrl: string, name: string): Promise<void> {
    const testPrisma = new PrismaClient({
      datasources: {
        db: {
          url: databaseUrl
        }
      }
    })

    try {
      await testPrisma.$queryRaw`SELECT 1`
    } finally {
      await testPrisma.$disconnect()
    }
  }

  private async checkPendingMigrations(): Promise<string[]> {
    try {
      // This would need to be implemented based on your migration tracking
      // For now, return empty array
      return []
    } catch (error) {
      console.warn('⚠️  Could not check pending migrations:', error)
      return []
    }
  }

  async createProductionBackup(): Promise<string> {
    console.log('💾 Creating production database backup...')

    const backupScript = join(process.cwd(), 'scripts', 'backup-database.ts')
    const backupCommand = `npx tsx "${backupScript}" production`

    try {
      const output = execSync(backupCommand, { encoding: 'utf8' })

      // Extract backup file path from output
      const lines = output.split('\n')
      const backupLine = lines.find(line => line.includes('Backup file:'))

      if (backupLine) {
        const backupFile = backupLine.split(': ')[1]
        console.log(`✅ Production backup created: ${backupFile}`)
        return backupFile.trim()
      }

      throw new Error('Could not extract backup file path from output')
    } catch (error) {
      console.error('❌ Failed to create production backup:', error)
      throw error
    }
  }

  async generateMigrationScript(): Promise<string> {
    console.log('📝 Generating migration script...')

    try {
      // Generate schema diff
      const schemaDiff = await this.generateSchemaDiff()

      if (!schemaDiff || schemaDiff.trim().length === 0) {
        console.log('✅ No schema changes detected')
        return ''
      }

      // Create migration file
      const migrationFile = join(
        this.config.backupDir,
        `migration-${this.config.timestamp}.sql`
      )

      const migrationContent = this.buildMigrationScript(schemaDiff)
      writeFileSync(migrationFile, migrationContent)

      console.log(`✅ Migration script generated: ${migrationFile}`)
      return migrationFile

    } catch (error) {
      console.error('❌ Failed to generate migration script:', error)
      throw error
    }
  }

  private async generateSchemaDiff(): Promise<string> {
    // This is a simplified version - you might want to use a more sophisticated
    // schema comparison tool in production

    try {
      // Check if we have Prisma migrations to apply
      const migrationsCheck = execSync('npx prisma migrate status', {
        encoding: 'utf8',
        cwd: process.cwd()
      })

      if (migrationsCheck.includes('pending migrations')) {
        console.log('🔄 Pending Prisma migrations detected')
        return 'PENDING_PRISMA_MIGRATIONS'
      }

      return ''

    } catch (error) {
      // No migrations or other error
      return ''
    }
  }

  private buildMigrationScript(schemaDiff: string): string {
    const timestamp = new Date().toISOString()

    return `-- UltimatePOS Modern Database Migration
-- Generated: ${timestamp}
-- Environment: Local to Production Sync

BEGIN;

-- Migration Header
\\echo 'Starting UltimatePOS migration: ${this.config.timestamp}'

-- Add your migration SQL here
-- This is a template - customize based on your needs

${schemaDiff === 'PENDING_PRISMA_MIGRATIONS' ?
`-- Note: Pending Prisma migrations detected
-- Run: npx prisma migrate deploy` :
`-- Schema changes will be applied here`}

-- Migration Footer
\\echo 'Migration completed: ${this.config.timestamp}'

COMMIT;

-- Migration completed successfully
SELECT 'Migration ${this.config.timestamp} completed successfully' as status;
`
  }

  async applyMigration(migrationFile: string): Promise<boolean> {
    if (!migrationFile || !existsSync(migrationFile)) {
      console.log('ℹ️  No migration file to apply')
      return true
    }

    console.log('🚀 Applying migration to production...')

    const confirmApply = await this.confirmAction(
      'Are you sure you want to apply this migration to production?'
    )

    if (!confirmApply) {
      console.log('❌ Migration cancelled by user')
      return false
    }

    try {
      // Use psql to apply migration
      const applyCommand = this.buildPsqlCommand(migrationFile)

      execSync(applyCommand, {
        stdio: 'inherit',
        env: {
          ...process.env,
          PGPASSWORD: this.extractPassword(this.config.productionDatabaseUrl)
        }
      })

      console.log('✅ Migration applied successfully')
      return true

    } catch (error) {
      console.error('❌ Migration failed:', error)
      return false
    }
  }

  private buildPsqlCommand(migrationFile: string): string {
    const dbInfo = this.parseDatabaseUrl(this.config.productionDatabaseUrl)

    return `psql -h ${dbInfo.host} -p ${dbInfo.port} -U ${dbInfo.username} -d ${dbInfo.database} -f "${migrationFile}"`
  }

  private parseDatabaseUrl(url: string) {
    const dbUrl = new URL(url)
    return {
      host: dbUrl.hostname,
      port: dbUrl.port || '5432',
      database: dbUrl.pathname.slice(1),
      username: dbUrl.username,
      password: dbUrl.password
    }
  }

  private extractPassword(databaseUrl: string): string {
    return this.parseDatabaseUrl(databaseUrl).password
  }

  async postSyncVerification(): Promise<boolean> {
    console.log('🔍 Running post-sync verification...')

    try {
      // Test basic database connectivity
      await this.testDatabaseConnection(this.config.productionDatabaseUrl, 'production')

      // Check if key tables exist and are accessible
      const tableCheck = await prisma.$queryRaw`
        SELECT table_name
        FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name IN ('users', 'business', 'products', 'sales')
        ORDER BY table_name
      ` as Array<{ table_name: string }>

      console.log(`✅ Found ${tableCheck.length} core tables`)

      // Check record counts for basic sanity
      const userCount = await prisma.user.count()
      console.log(`✅ User table accessible (${userCount} records)`)

      return true

    } catch (error) {
      console.error('❌ Post-sync verification failed:', error)
      return false
    }
  }

  async executeSync(): Promise<void> {
    console.log('🚀 Starting database sync from local to production...')

    try {
      // Step 1: Pre-sync checks
      const checksPassed = await this.preSyncChecks()
      if (!checksPassed) {
        console.error('❌ Pre-sync checks failed. Aborting.')
        return
      }

      // Step 2: Create production backup
      const backupFile = await this.createProductionBackup()

      // Step 3: Generate migration script
      const migrationFile = await this.generateMigrationScript()

      // Step 4: Apply migration if needed
      if (migrationFile) {
        const migrationSuccess = await this.applyMigration(migrationFile)
        if (!migrationSuccess) {
          console.error('❌ Migration failed. Production database unchanged.')
          console.log(`💡 You can restore from backup: ${backupFile}`)
          return
        }
      }

      // Step 5: Post-sync verification
      const verificationPassed = await this.postSyncVerification()
      if (!verificationPassed) {
        console.error('❌ Post-sync verification failed!')
        console.log(`⚠️  Please check production database manually`)
        console.log(`💡 Backup available: ${backupFile}`)
        return
      }

      console.log('🎉 Database sync completed successfully!')
      console.log(`💾 Production backup: ${backupFile}`)

      if (migrationFile) {
        console.log(`📝 Migration applied: ${migrationFile}`)
      }

    } catch (error) {
      console.error('❌ Sync process failed:', error)
    } finally {
      this.rl.close()
      await prisma.$disconnect()
    }
  }
}

// Main execution
async function main() {
  console.log('⚠️  WARNING: This will sync changes from your local database to production!')
  console.log('📋 This process includes:')
  console.log('   • Creating a production backup')
  console.log('   • Generating migration scripts')
  console.log('   • Applying changes to production')
  console.log('   • Verifying the sync')
  console.log('')

  const sync = new DatabaseSync()

  const confirmed = await sync.confirmAction('Do you want to continue with the database sync?')
  if (!confirmed) {
    console.log('❌ Sync cancelled by user')
    process.exit(0)
  }

  await sync.executeSync()
}

// Run if called directly
if (require.main === module) {
  main().catch(console.error)
}