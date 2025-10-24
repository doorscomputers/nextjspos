import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('🔄 Adding allowSenderToCheck column to business_sod_settings table...')

  try {
    // Add the new column using raw SQL
    await prisma.$executeRawUnsafe(`
      ALTER TABLE business_sod_settings
      ADD COLUMN IF NOT EXISTS allow_sender_to_check BOOLEAN NOT NULL DEFAULT FALSE;
    `)

    console.log('✅ Column added successfully!')

    // Verify the column exists
    const result = await prisma.$queryRawUnsafe(`
      SELECT column_name, data_type, column_default
      FROM information_schema.columns
      WHERE table_name = 'business_sod_settings'
        AND column_name = 'allow_sender_to_check';
    `)

    if (result && result.length > 0) {
      console.log('✅ Verification successful:')
      console.log(result[0])
    } else {
      console.log('⚠️  Warning: Column not found in verification query')
    }

    // Show current SOD settings for first business
    const settings = await prisma.businessSODSettings.findFirst()
    if (settings) {
      console.log('\n📊 Current SOD settings (first business):')
      console.log(`  - enforceTransferSOD: ${settings.enforceTransferSOD}`)
      console.log(`  - allowCreatorToCheck: ${settings.allowCreatorToCheck}`)
      console.log(`  - allowSenderToCheck: ${settings.allowSenderToCheck}`)
      console.log(`  - allowCheckerToSend: ${settings.allowCheckerToSend}`)
    }

    console.log('\n✨ Migration completed successfully!')
  } catch (error) {
    console.error('❌ Error running migration:', error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

main()
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
