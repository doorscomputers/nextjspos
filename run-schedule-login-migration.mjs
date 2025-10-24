/**
 * Migration Script: Schedule-Based Login Configuration
 *
 * This script creates the schedule_login_configurations table in the database
 * and sets up default configurations for all existing businesses.
 *
 * Usage: node run-schedule-login-migration.mjs
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function runMigration() {
  console.log('========================================')
  console.log('Schedule-Based Login Configuration Migration')
  console.log('========================================\n')

  try {
    // Check if table already exists
    console.log('Step 1: Checking if table exists...')
    const tableExists = await prisma.$queryRaw`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_name = 'schedule_login_configurations'
    `

    if (tableExists && tableExists.length > 0) {
      console.log('✓ Table schedule_login_configurations already exists')

      // Count existing configurations
      const count = await prisma.scheduleLoginConfiguration.count()
      console.log(`✓ Found ${count} existing configuration(s)`)

      // Show configurations
      const configs = await prisma.scheduleLoginConfiguration.findMany({
        include: {
          business: {
            select: {
              id: true,
              name: true
            }
          }
        }
      })

      console.log('\nExisting Configurations:')
      configs.forEach(config => {
        console.log(`  - Business: ${config.business.name} (ID: ${config.businessId})`)
        console.log(`    Enforce: ${config.enforceScheduleLogin}`)
        console.log(`    Early Grace: ${config.earlyClockInGraceMinutes} min`)
        console.log(`    Late Grace: ${config.lateClockOutGraceMinutes} min`)
        console.log(`    Exempt Roles: ${config.exemptRoles}`)
        console.log('')
      })
    } else {
      console.log('✗ Table does not exist. Creating now...')

      // Create table using raw SQL
      console.log('\nStep 2: Creating schedule_login_configurations table...')
      await prisma.$executeRaw`
        CREATE TABLE IF NOT EXISTS schedule_login_configurations (
          id SERIAL PRIMARY KEY,
          business_id INT NOT NULL,
          enforce_schedule_login BOOLEAN NOT NULL DEFAULT true,
          early_clock_in_grace_minutes INT NOT NULL DEFAULT 30,
          late_clock_out_grace_minutes INT NOT NULL DEFAULT 60,
          exempt_roles TEXT DEFAULT 'Super Admin,System Administrator,Super Admin (Legacy),Admin (Legacy)',
          too_early_message TEXT,
          too_late_message TEXT,
          created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT uq_schedule_login_config_business UNIQUE (business_id),
          CONSTRAINT fk_schedule_login_config_business
            FOREIGN KEY (business_id)
            REFERENCES business(id)
            ON DELETE CASCADE
        )
      `
      console.log('✓ Table created successfully')

      // Create index
      console.log('\nStep 3: Creating index...')
      await prisma.$executeRaw`
        CREATE INDEX IF NOT EXISTS idx_schedule_login_config_business
          ON schedule_login_configurations(business_id)
      `
      console.log('✓ Index created successfully')

      // Insert default configurations for all businesses
      console.log('\nStep 4: Creating default configurations for existing businesses...')
      const businesses = await prisma.business.findMany({
        select: { id: true, name: true }
      })

      console.log(`Found ${businesses.length} business(es)`)

      for (const business of businesses) {
        try {
          const config = await prisma.scheduleLoginConfiguration.create({
            data: {
              businessId: business.id,
              enforceScheduleLogin: true,
              earlyClockInGraceMinutes: 30,
              lateClockOutGraceMinutes: 60,
              exemptRoles: "Super Admin,System Administrator,Super Admin (Legacy),Admin (Legacy)"
            }
          })
          console.log(`  ✓ Created configuration for: ${business.name} (ID: ${business.id})`)
        } catch (err) {
          if (err.code === 'P2002') {
            console.log(`  ⚠ Configuration already exists for: ${business.name} (ID: ${business.id})`)
          } else {
            throw err
          }
        }
      }
    }

    console.log('\n========================================')
    console.log('✓ Migration completed successfully!')
    console.log('========================================\n')

    console.log('Next Steps:')
    console.log('1. Run: npx prisma generate')
    console.log('2. Refresh your browser at: http://localhost:3000/dashboard/settings/schedule-login')
    console.log('3. Configure grace periods and exempt roles as needed')
    console.log('')

  } catch (error) {
    console.error('\n✗ Migration failed!')
    console.error('Error:', error.message)
    console.error('\nFull error:', error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

runMigration()
