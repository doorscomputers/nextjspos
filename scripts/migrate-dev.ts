#!/usr/bin/env tsx

/**
 * Development Migration Script for UltimatePOS Modern
 *
 * This script handles schema migrations in development environment.
 *
 * Usage:
 * npx tsx scripts/migrate-dev.ts
 * npx tsx scripts/migrate-dev.ts --name "add_user_preferences"
 * npx tsx scripts/migrate-dev.ts --reset
 */

import { PrismaClient } from '@prisma/client'
import { execSync } from 'child_process'
import { existsSync, mkdirSync } from 'fs'
import { join } from 'path'
import { argv } from 'process'

const prisma = new PrismaClient()

interface DevMigrationConfig {
  databaseUrl: string
  migrationsDir: string
  environment: 'development'
}

class DevMigration {
  private config: DevMigrationConfig

  constructor() {
    this.config = {
      databaseUrl: process.env.DATABASE_URL!,
      migrationsDir: join(process.cwd(), 'prisma', 'migrations'),
      environment: 'development'
    }
  }

  async createMigration(name?: string, reset: boolean = false): Promise<void> {
    console.log('🔄 Starting development migration...')

    try {
      // Ensure migrations directory exists
      if (!existsSync(this.config.migrationsDir)) {
        mkdirSync(this.config.migrationsDir, { recursive: true })
        console.log('📁 Created migrations directory')
      }

      if (reset) {
        console.log('⚠️  Resetting development database...')
        await this.resetDatabase()
      }

      // Generate Prisma Client first
      console.log('🔧 Generating Prisma Client...')
      execSync('npx prisma generate', { stdio: 'inherit' })

      // Create migration
      if (name) {
        console.log(`📝 Creating migration: ${name}`)
        execSync(`npx prisma migrate dev --name "${name}"`, { stdio: 'inherit' })
      } else {
        console.log('📝 Creating migration...')
        execSync('npx prisma migrate dev', { stdio: 'inherit' })
      }

      // Verify migration
      await this.verifyMigration()

      console.log('✅ Development migration completed successfully!')

    } catch (error) {
      console.error('❌ Development migration failed:', error)
      throw error
    }
  }

  private async resetDatabase(): Promise<void> {
    try {
      execSync('npx prisma migrate reset --force --skip-seed', { stdio: 'inherit' })
      console.log('✅ Database reset completed')
    } catch (error) {
      console.error('❌ Database reset failed:', error)
      throw error
    }
  }

  private async verifyMigration(): Promise<void> {
    try {
      // Test database connection
      await prisma.$queryRaw`SELECT 1`

      // Check migration status
      const statusOutput = execSync('npx prisma migrate status', { encoding: 'utf8' })
      console.log('📊 Migration Status:', statusOutput.trim())

      // Test basic operations
      const userCount = await prisma.user.count()
      console.log(`✅ Database verified - Users table accessible (${userCount} records)`)

    } catch (error) {
      console.error('❌ Migration verification failed:', error)
      throw error
    }
  }

  async syncSchema(): Promise<void> {
    console.log('🔄 Syncing schema without migration files...')

    try {
      // Alternative to db:push with more control
      execSync('npx prisma db push', { stdio: 'inherit' })
      console.log('✅ Schema synced successfully')

      await this.verifyMigration()

    } catch (error) {
      console.error('❌ Schema sync failed:', error)
      throw error
    }
  }

  async seedDatabase(): Promise<void> {
    console.log('🌱 Seeding development database...')

    try {
      execSync('npm run db:seed', { stdio: 'inherit' })
      console.log('✅ Database seeded successfully')

    } catch (error) {
      console.error('❌ Database seeding failed:', error)
      throw error
    }
  }

  async getMigrationHistory(): Promise<any[]> {
    try {
      const migrations = await prisma.$queryRaw`
        SELECT * FROM _prisma_migrations
        ORDER BY finished_at DESC
      ` as Array<any>

      return migrations
    } catch (error) {
      console.warn('⚠️  Could not fetch migration history:', error)
      return []
    }
  }
}

// Parse command line arguments
function parseArgs() {
  const args = {
    name: undefined as string | undefined,
    reset: false,
    sync: false,
    seed: false,
    history: false
  }

  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i]

    if (arg === '--name' && i + 1 < argv.length) {
      args.name = argv[++i]
    } else if (arg === '--reset') {
      args.reset = true
    } else if (arg === '--sync') {
      args.sync = true
    } else if (arg === '--seed') {
      args.seed = true
    } else if (arg === '--history') {
      args.history = true
    } else if (arg === '--help' || arg === '-h') {
      console.log(`
Development Migration Script

Usage:
  npx tsx scripts/migrate-dev.ts [options]

Options:
  --name <name>    Create migration with specific name
  --reset          Reset database before migration
  --sync           Sync schema without migration files
  --seed           Seed database after migration
  --history        Show migration history
  --help, -h       Show this help message

Examples:
  npx tsx scripts/migrate-dev.ts --name "add_user_preferences"
  npx tsx scripts/migrate-dev.ts --reset --seed
  npx tsx scripts/migrate-dev.ts --sync
  npx tsx scripts/migrate-dev.ts --history
      `)
      process.exit(0)
    }
  }

  return args
}

// Main execution
async function main() {
  const args = parseArgs()
  const migration = new DevMigration()

  try {
    if (args.history) {
      const history = await migration.getMigrationHistory()

      if (history.length === 0) {
        console.log('📝 No migrations found')
      } else {
        console.log('📜 Migration History:')
        history.forEach((m, index) => {
          console.log(`  ${index + 1}. ${m.migration_name} (${m.finished_at})`)
        })
      }
      return
    }

    if (args.sync) {
      await migration.syncSchema()
    } else {
      await migration.createMigration(args.name, args.reset)
    }

    if (args.seed) {
      await migration.seedDatabase()
    }

  } catch (error) {
    console.error('❌ Development migration process failed:', error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

// Run if called directly
if (require.main === module) {
  main()
}