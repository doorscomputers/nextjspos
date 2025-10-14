const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function applyConstraint() {
  try {
    console.log('Creating partial unique index on customers table...')

    await prisma.$executeRaw`
      CREATE UNIQUE INDEX IF NOT EXISTS customers_business_id_name_unique
      ON customers (business_id, name)
      WHERE deleted_at IS NULL
    `

    console.log('✅ Unique constraint applied successfully!')
    console.log('Customer names will now be unique within each business (excluding soft-deleted records)')

  } catch (error) {
    if (error.code === 'P2010' || error.message.includes('already exists')) {
      console.log('ℹ️  Index already exists')
    } else {
      console.error('Error:', error)
    }
  } finally {
    await prisma.$disconnect()
  }
}

applyConstraint()
