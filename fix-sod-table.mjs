import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function fixSODTable() {
  console.log('Fixing business_sod_settings table...\n')

  try {
    // Drop the existing table
    console.log('1. Dropping existing table...')
    await prisma.$executeRawUnsafe(`DROP TABLE IF EXISTS business_sod_settings CASCADE;`)
    console.log('✓ Table dropped')

    // Recreate with correct schema
    console.log('\n2. Creating table with correct schema...')
    await prisma.$executeRawUnsafe(`
      CREATE TABLE business_sod_settings (
        id SERIAL PRIMARY KEY,
        business_id INTEGER UNIQUE NOT NULL,

        -- TRANSFER SOD RULES
        enforce_transfer_sod BOOLEAN NOT NULL DEFAULT true,
        allow_creator_to_check BOOLEAN NOT NULL DEFAULT false,
        allow_creator_to_send BOOLEAN NOT NULL DEFAULT false,
        allow_checker_to_send BOOLEAN NOT NULL DEFAULT false,
        allow_creator_to_receive BOOLEAN NOT NULL DEFAULT false,
        allow_sender_to_complete BOOLEAN NOT NULL DEFAULT false,
        allow_creator_to_complete BOOLEAN NOT NULL DEFAULT false,
        allow_receiver_to_complete BOOLEAN NOT NULL DEFAULT true,

        -- PURCHASE SOD RULES
        enforce_purchase_sod BOOLEAN NOT NULL DEFAULT true,
        allow_amendment_creator_to_approve BOOLEAN NOT NULL DEFAULT false,
        allow_po_creator_to_approve BOOLEAN NOT NULL DEFAULT false,
        allow_grn_creator_to_approve BOOLEAN NOT NULL DEFAULT false,

        -- RETURN SOD RULES
        enforce_return_sod BOOLEAN NOT NULL DEFAULT true,
        allow_customer_return_creator_to_approve BOOLEAN NOT NULL DEFAULT false,
        allow_supplier_return_creator_to_approve BOOLEAN NOT NULL DEFAULT false,

        -- GENERAL SOD OVERRIDES
        exempt_roles TEXT DEFAULT 'Super Admin,System Administrator',
        min_staff_warning_threshold INTEGER NOT NULL DEFAULT 3,

        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

        -- Foreign key constraint
        CONSTRAINT fk_business_sod_settings_business
          FOREIGN KEY (business_id)
          REFERENCES business(id)
          ON DELETE CASCADE
      );
    `)
    console.log('✓ Table created successfully')

    // Create index
    console.log('\n3. Creating index...')
    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS idx_business_sod_settings_business_id
      ON business_sod_settings(business_id);
    `)
    console.log('✓ Index created')

    // Insert default settings for existing businesses
    console.log('\n4. Inserting default settings...')
    const result = await prisma.$executeRawUnsafe(`
      INSERT INTO business_sod_settings (business_id)
      SELECT id FROM business
      WHERE id NOT IN (SELECT business_id FROM business_sod_settings)
      ON CONFLICT (business_id) DO NOTHING;
    `)
    console.log(`✓ Inserted default settings for ${result} business(es)`)

    // Verify
    console.log('\n5. Verifying the fix...')
    const settings = await prisma.businessSODSettings.findMany()
    console.log(`✓ Found ${settings.length} SOD settings record(s)`)
    console.log('\n📊 Current settings:', settings[0])

    console.log('\n✅ Table fixed successfully!')

  } catch (error) {
    console.error('❌ Error:', error.message)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

fixSODTable()
