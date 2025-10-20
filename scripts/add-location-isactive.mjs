import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function addIsActiveColumn() {
  try {
    console.log('🔧 Adding isActive column to business_locations table...\n')

    // Add column if it doesn't exist
    await prisma.$executeRawUnsafe(`
      ALTER TABLE business_locations
      ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;
    `)

    console.log('✅ Column added successfully')

    // Verify the change
    const result = await prisma.$queryRawUnsafe(`
      SELECT column_name, data_type, column_default
      FROM information_schema.columns
      WHERE table_name = 'business_locations'
      AND column_name = 'is_active';
    `)

    console.log('\n📋 Column details:', result)

    // Check current locations
    const locations = await prisma.businessLocation.findMany({
      select: { id: true, name: true }
    })

    console.log(`\n📍 Found ${locations.length} business locations`)
    console.log('   All locations are now active by default\n')

    console.log('✨ Migration complete!')

  } catch (error) {
    console.error('❌ Error:', error)
  } finally {
    await prisma.$disconnect()
  }
}

addIsActiveColumn()
