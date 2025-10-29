#!/usr/bin/env tsx

/**
 * Database Backup Script for UltimatePOS Modern
 *
 * Usage:
 * npm run db:backup:local     # Backup local database
 * npm run db:backup:production   # Backup production database
 */

import { PrismaClient } from '@prisma/client'
import { execSync } from 'child_process'
import { writeFileSync, mkdirSync } from 'fs'
import { join } from 'path'
import { argv } from 'process'

const prisma = new PrismaClient()

interface BackupConfig {
  environment: 'local' | 'production'
  databaseUrl: string
  backupDir: string
  timestamp: string
}

class DatabaseBackup {
  private config: BackupConfig

  constructor(environment: 'local' | 'production') {
    this.config = {
      environment,
      databaseUrl: environment === 'production'
        ? process.env.PRODUCTION_DATABASE_URL || process.env.DATABASE_URL!
        : process.env.DATABASE_URL!,
      backupDir: join(process.cwd(), 'backups', environment),
      timestamp: new Date().toISOString().replace(/[:.]/g, '-')
    }
  }

  async createBackup(): Promise<string> {
    console.log(`🔄 Starting ${this.config.environment} database backup...`)

    try {
      // Ensure backup directory exists
      mkdirSync(this.config.backupDir, { recursive: true })

      // Create backup filename
      const backupFile = join(
        this.config.backupDir,
        `ultimatepos-backup-${this.config.timestamp}.sql`
      )

      console.log(`📁 Backup will be saved to: ${backupFile}`)

      // Extract database info from connection URL
      const dbInfo = this.parseDatabaseUrl(this.config.databaseUrl)

      // Create pg_dump command
      const dumpCommand = this.buildDumpCommand(dbInfo, backupFile)

      console.log(`🚀 Executing backup command...`)

      // Execute backup
      execSync(dumpCommand, { stdio: 'inherit' })

      // Create metadata file
      await this.createMetadata(backupFile, dbInfo)

      console.log(`✅ Backup completed successfully!`)
      console.log(`📄 Backup file: ${backupFile}`)

      return backupFile

    } catch (error) {
      console.error(`❌ Backup failed:`, error)
      throw error
    }
  }

  private parseDatabaseUrl(url: string) {
    try {
      const dbUrl = new URL(url)
      return {
        host: dbUrl.hostname,
        port: dbUrl.port || '5432',
        database: dbUrl.pathname.slice(1), // Remove leading slash
        username: dbUrl.username,
        password: dbUrl.password,
        ssl: dbUrl.searchParams.get('sslmode') || 'prefer'
      }
    } catch (error) {
      console.error('❌ Failed to parse database URL:', error)
      throw error
    }
  }

  private buildDumpCommand(dbInfo: any, outputFile: string): string {
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
      '--format=custom',
      '--compress=9',
      '--locks=no-access',
      '--exclude-table-data=_prisma_migrations',
      '--file=' + outputFile
    ]

    // Add SSL options for production
    if (this.config.environment === 'production' && dbInfo.ssl !== 'disable') {
      options.push('--sslmode=' + dbInfo.ssl)
    }

    return `PGPASSWORD="${dbInfo.password}" pg_dump ${options.join(' ')}`
  }

  private async createMetadata(backupFile: string, dbInfo: any): Promise<void> {
    const metadata = {
      environment: this.config.environment,
      timestamp: this.config.timestamp,
      database: {
        host: dbInfo.host,
        port: dbInfo.port,
        database: dbInfo.database,
        username: dbInfo.username
      },
      backupFile: backupFile,
      createdAt: new Date().toISOString(),
      version: '1.0.0'
    }

    const metadataFile = backupFile.replace('.sql', '.metadata.json')
    writeFileSync(metadataFile, JSON.stringify(metadata, null, 2))

    console.log(`📋 Metadata saved to: ${metadataFile}`)
  }

  async verifyBackup(backupFile: string): Promise<boolean> {
    console.log(`🔍 Verifying backup file: ${backupFile}`)

    try {
      const listCommand = `pg_restore --list "${backupFile}"`
      const output = execSync(listCommand, { encoding: 'utf8' })

      const lineCount = output.split('\n').length
      console.log(`✓ Backup contains ${lineCount} items`)

      return lineCount > 0
    } catch (error) {
      console.error(`❌ Backup verification failed:`, error)
      return false
    }
  }

  async listBackups(): Promise<string[]> {
    const fs = require('fs')
    try {
      const files = fs.readdirSync(this.config.backupDir)
      return files
        .filter((file: string) => file.endsWith('.sql'))
        .sort()
        .reverse()
    } catch (error) {
      return []
    }
  }
}

// Main execution
async function main() {
  const environment = argv[2] as 'local' | 'production'

  if (!environment || !['local', 'production'].includes(environment)) {
    console.error('❌ Please specify environment: local or production')
    console.log('Usage: npm run db:backup:local')
    console.log('Usage: npm run db:backup:production')
    process.exit(1)
  }

  const backup = new DatabaseBackup(environment)

  try {
    const backupFile = await backup.createBackup()
    const isValid = await backup.verifyBackup(backupFile)

    if (isValid) {
      console.log(`🎉 ${environment} backup completed successfully!`)

      // List recent backups
      const backups = await backup.listBackups()
      if (backups.length > 1) {
        console.log(`\n📚 Recent backups (${backups.length} total):`)
        backups.slice(0, 5).forEach((file, index) => {
          console.log(`  ${index + 1}. ${file}`)
        })
      }
    } else {
      console.error(`❌ Backup verification failed!`)
      process.exit(1)
    }

  } catch (error) {
    console.error(`❌ Backup process failed:`, error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

// Run if called directly
if (require.main === module) {
  main()
}