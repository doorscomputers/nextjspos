import { PrismaClient } from '@prisma/client'
import fs from 'fs'

const prisma = new PrismaClient()

async function main() {
  console.log('📋 Creating inactivity_settings table...')

  try {
    console.log('Step 1: Creating table...')
    // Create table
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS inactivity_settings (
        id SERIAL PRIMARY KEY,
        business_id INTEGER NOT NULL UNIQUE,
        enabled BOOLEAN NOT NULL DEFAULT true,
        super_admin_timeout INTEGER NOT NULL DEFAULT 60,
        admin_timeout INTEGER NOT NULL DEFAULT 45,
        manager_timeout INTEGER NOT NULL DEFAULT 30,
        cashier_timeout INTEGER NOT NULL DEFAULT 15,
        default_timeout INTEGER NOT NULL DEFAULT 30,
        warning_time INTEGER NOT NULL DEFAULT 2,
        warning_message TEXT DEFAULT 'You have been inactive. You will be logged out soon.',
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT fk_inactivity_settings_business
          FOREIGN KEY (business_id)
          REFERENCES business(id)
          ON DELETE CASCADE
      )
    `)
    console.log('✅ Table created')

    console.log('Step 2: Creating index...')
    // Create index
    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS idx_inactivity_settings_business_id
        ON inactivity_settings(business_id)
    `)
    console.log('✅ Index created')

    console.log('Step 3: Inserting default settings...')
    // Insert default settings for existing businesses
    await prisma.$executeRawUnsafe(`
      INSERT INTO inactivity_settings (business_id, enabled)
      SELECT id, true
      FROM business
      WHERE NOT EXISTS (
        SELECT 1 FROM inactivity_settings WHERE business_id = business.id
      )
    `)
    console.log('✅ Default settings inserted')

    console.log('✅ All steps completed successfully!')

    // Verify the table exists
    const result = await prisma.$queryRaw`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_name = 'inactivity_settings'
    `

    if (result.length > 0) {
      console.log('✅ Table verified in database')

      // Check if any records were created
      const count = await prisma.$queryRaw`
        SELECT COUNT(*) as count FROM inactivity_settings
      `
      console.log(`📊 Inactivity settings records: ${count[0].count}`)
    }

  } catch (error) {
    console.error('❌ Error creating table:', error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

main()
