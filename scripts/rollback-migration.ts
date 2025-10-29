#!/usr/bin/env tsx

/**
 * Database Migration Rollback Script for UltimatePOS Modern
 *
 * This script helps rollback migrations safely in production.
 *
 * Usage:
 * npm run db:rollback
 */

import { PrismaClient } from '@prisma/client'
import { execSync } from 'child_process'
import { readFileSync, writeFileSync, existsSync, readdirSync } from 'fs'
import { join } from 'path'
import { createInterface } from 'readline'

const prisma = new PrismaClient()

interface RollbackConfig {
  productionDatabaseUrl: string
  backupDir: string
  timestamp: string
}

class MigrationRollback {
  private config: RollbackConfig
  private rl: any

  constructor() {
    this.config = {
      productionDatabaseUrl: process.env.PRODUCTION_DATABASE_URL || process.env.DATABASE_URL!,
      backupDir: join(process.cwd(), 'backups', 'production'),
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

  async listAvailableBackups(): Promise<string[]> {
    console.log('📚 Scanning for available backups...')

    try {
      if (!existsSync(this.config.backupDir)) {
        console.log('❌ No backup directory found')
        return []
      }

      const files = readdirSync(this.config.backupDir)
      const backups = files
        .filter((file: string) => file.endsWith('.sql'))
        .sort()
        .reverse() // Most recent first

      console.log(`✅ Found ${backups.length} backup files`)
      return backups

    } catch (error) {
      console.error('❌ Failed to list backups:', error)
      return []
    }
  }

  async selectBackup(): Promise<string | null> {
    const backups = await this.listAvailableBackups()

    if (backups.length === 0) {
      console.log('❌ No backups available for rollback')
      return null
    }

    console.log('\n📋 Available backups:')
    backups.forEach((backup, index) => {
      const metadataFile = backup.replace('.sql', '.metadata.json')
      const metadataPath = join(this.config.backupDir, metadataFile)

      let info = `  ${index + 1}. ${backup}`

      if (existsSync(metadataPath)) {
        try {
          const metadata = JSON.parse(readFileSync(metadataPath, 'utf8'))
          info += ` (${metadata.timestamp})`
        } catch (error) {
          // Ignore metadata read errors
        }
      }

      console.log(info)
    })

    console.log('  0. Cancel rollback')

    while (true) {
      const selection = await this.askQuestion('\nSelect backup to restore (number): ')
      const selectionNum = parseInt(selection)

      if (selectionNum === 0) {
        console.log('❌ Rollback cancelled')
        return null
      }

      if (selectionNum >= 1 && selectionNum <= backups.length) {
        const selectedBackup = backups[selectionNum - 1]
        console.log(`✅ Selected backup: ${selectedBackup}`)
        return selectedBackup
      }

      console.log('❌ Invalid selection. Please try again.')
    }
  }

  private askQuestion(question: string): Promise<string> {
    return new Promise((resolve) => {
      this.rl.question(question, (answer: string) => {
        resolve(answer.trim())
      })
    })
  }

  async createPreRollbackBackup(): Promise<string> {
    console.log('💾 Creating pre-rollback backup...')

    const backupScript = join(process.cwd(), 'scripts', 'backup-database.ts')
    const backupCommand = `npx tsx "${backupScript}" production`

    try {
      execSync(backupCommand, { stdio: 'inherit' })
      console.log('✅ Pre-rollback backup created')
      return 'completed'
    } catch (error) {
      console.error('❌ Failed to create pre-rollback backup:', error)
      throw error
    }
  }

  async verifyBackup(backupFile: string): Promise<boolean> {
    console.log(`🔍 Verifying backup file: ${backupFile}`)

    try {
      const backupPath = join(this.config.backupDir, backupFile)

      // Check if file exists
      if (!existsSync(backupPath)) {
        console.error('❌ Backup file does not exist')
        return false
      }

      // Get file size
      const stats = require('fs').statSync(backupPath)
      const fileSizeMB = stats.size / (1024 * 1024)

      console.log(`📁 Backup file size: ${fileSizeMB.toFixed(2)} MB`)

      if (fileSizeMB < 0.1) {
        console.warn('⚠️  Backup file seems too small, may be corrupted')
        const continueAnyway = await this.confirmAction('Continue anyway?')
        if (!continueAnyway) return false
      }

      // Test backup file integrity
      const listCommand = `pg_restore --list "${backupPath}"`
      execSync(listCommand, { stdio: 'pipe' })

      console.log('✅ Backup file integrity verified')
      return true

    } catch (error) {
      console.error('❌ Backup verification failed:', error)
      return false
    }
  }

  async performRollback(backupFile: string): Promise<boolean> {
    console.log(`🔄 Starting rollback using backup: ${backupFile}`)

    const confirmRollback = await this.confirmAction(
      `⚠️  WARNING: This will COMPLETELY REPLACE the production database with the selected backup!\n` +
      '   All data added after the backup will be PERMANENTLY LOST!\n' +
      '   Are you absolutely sure you want to continue?'
    )

    if (!confirmRollback) {
      console.log('❌ Rollback cancelled by user')
      return false
    }

    // Double confirmation
    const confirmAgain = await this.confirmAction(
      'Type "yes" to confirm you understand this will destroy current production data'
    )

    if (!confirmAgain) {
      console.log('❌ Rollback cancelled - second confirmation failed')
      return false
    }

    try {
      const backupPath = join(this.config.backupDir, backupFile)
      const restoreCommand = this.buildRestoreCommand(backupPath)

      console.log('🚀 Starting database restore...')
      console.log('   This may take several minutes for large databases...')

      execSync(restoreCommand, { stdio: 'inherit' })

      console.log('✅ Database rollback completed successfully')
      return true

    } catch (error) {
      console.error('❌ Rollback failed:', error)
      console.log('⚠️  Production database may be in an inconsistent state!')
      console.log('💡 Please check the database and restore from a different backup if needed')
      return false
    }
  }

  private buildRestoreCommand(backupPath: string): string {
    const dbInfo = this.parseDatabaseUrl(this.config.productionDatabaseUrl)

    const options = [
      '--host=' + dbInfo.host,
      '--port=' + dbInfo.port,
      '--username=' + dbInfo.username,
      '--dbname=' + dbInfo.database,
      '--no-password',
      '--verbose',
      '--clean',
      '--if-exists',
      '--create',
      '--jobs=4' // Parallel restore
    ]

    const command = `PGPASSWORD="${dbInfo.password}" pg_restore ${options.join(' ')} "${backupPath}"`
    return command
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

  async postRollbackVerification(): Promise<boolean> {
    console.log('🔍 Running post-rollback verification...')

    try {
      // Test database connectivity
      const testPrisma = new PrismaClient({
        datasources: {
          db: {
            url: this.config.productionDatabaseUrl
          }
        }
      })

      await testPrisma.$queryRaw`SELECT 1`
      console.log('✅ Database connection successful')

      // Check core tables
      const tables = await testPrisma.$queryRaw`
        SELECT table_name
        FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name IN ('users', 'business', 'products', 'sales')
        ORDER BY table_name
      ` as Array<{ table_name: string }>

      console.log(`✅ Found ${tables.length} core tables`)

      // Check basic data integrity
      const userCount = await testPrisma.user.count()
      console.log(`✅ User table accessible (${userCount} records)`)

      await testPrisma.$disconnect()

      return true

    } catch (error) {
      console.error('❌ Post-rollback verification failed:', error)
      return false
    }
  }

  async createRollbackLog(backupFile: string, success: boolean, error?: string): Promise<void> {
    const logEntry = {
      timestamp: new Date().toISOString(),
      backupFile,
      success,
      error: error || null,
      environment: 'production',
      operation: 'rollback'
    }

    const logFile = join(process.cwd(), 'backups', 'rollback-log.json')
    let logs: any[] = []

    try {
      if (existsSync(logFile)) {
        logs = JSON.parse(readFileSync(logFile, 'utf8'))
      }
    } catch (error) {
      // Start with empty log if file is corrupted
    }

    logs.push(logEntry)

    // Keep only last 50 rollback entries
    if (logs.length > 50) {
      logs = logs.slice(-50)
    }

    writeFileSync(logFile, JSON.stringify(logs, null, 2))
    console.log(`📝 Rollback logged to: ${logFile}`)
  }

  async executeRollback(): Promise<void> {
    console.log('🔄 Starting database rollback process...')

    try {
      // Step 1: Select backup to restore from
      const selectedBackup = await this.selectBackup()
      if (!selectedBackup) {
        console.log('❌ No backup selected. Aborting rollback.')
        return
      }

      // Step 2: Verify backup file
      const backupValid = await this.verifyBackup(selectedBackup)
      if (!backupValid) {
        console.error('❌ Backup verification failed. Aborting rollback.')
        return
      }

      // Step 3: Create pre-rollback backup
      const preBackupSuccess = await this.createPreRollbackBackup()
      if (!preBackupSuccess) {
        console.error('❌ Failed to create pre-rollback backup. Aborting.')
        return
      }

      // Step 4: Perform rollback
      const rollbackSuccess = await this.performRollback(selectedBackup)

      // Step 5: Post-rollback verification
      if (rollbackSuccess) {
        const verificationPassed = await this.postRollbackVerification()

        if (verificationPassed) {
          console.log('🎉 Rollback completed successfully!')
          console.log(`📦 Restored from backup: ${selectedBackup}`)
        } else {
          console.error('❌ Rollback verification failed!')
          console.log('⚠️  Please check the database state manually')
        }

        // Log the rollback attempt
        await this.createRollbackLog(selectedBackup, verificationPassed)
      } else {
        // Log failed rollback
        await this.createRollbackLog(selectedBackup, false, 'Rollback operation failed')
      }

    } catch (error) {
      console.error('❌ Rollback process failed:', error)
      await this.createRollbackLog('', false, String(error))
    } finally {
      this.rl.close()
      await prisma.$disconnect()
    }
  }
}

// Main execution
async function main() {
  console.log('⚠️  DANGER: This will rollback your production database!')
  console.log('📋 This process includes:')
  console.log('   • Creating a pre-rollback backup')
  console.log('   • Completely replacing production database')
  console.log('   • Verifying the rollback')
  console.log('   • Logging the rollback operation')
  console.log('')

  const rollback = new MigrationRollback()

  const confirmed = await rollback.confirmAction(
    'Do you understand that this will PERMANENTLY DELETE all production data added after the backup?'
  )

  if (!confirmed) {
    console.log('❌ Rollback cancelled by user')
    process.exit(0)
  }

  await rollback.executeRollback()
}

// Run if called directly
if (require.main === module) {
  main().catch(console.error)
}