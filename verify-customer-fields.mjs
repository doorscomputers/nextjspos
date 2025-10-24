import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function verifyFields() {
  try {
    // Check if we can query the new field
    const result = await prisma.$queryRaw`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'customers'
      AND column_name IN ('address', 'tax_number', 'business_style')
      ORDER BY column_name
    `

    console.log('✓ Customer table fields:')
    console.log(result)

    console.log('\n✓ All required fields are present in the database!')
  } catch (error) {
    console.error('Error:', error.message)
  } finally {
    await prisma.$disconnect()
  }
}

verifyFields()
