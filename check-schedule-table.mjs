import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function checkScheduleTable() {
  console.log('Checking employee_schedules table...\n')

  try {
    // Check if table exists by querying it
    const result = await prisma.$queryRawUnsafe(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'employee_schedules'
      ORDER BY ordinal_position;
    `)

    console.log('📊 Columns in employee_schedules table:')
    console.log(result)

    // Try to count records
    const count = await prisma.$queryRawUnsafe(`
      SELECT COUNT(*) as count FROM employee_schedules;
    `)
    console.log(`\n📝 Total records: ${count[0].count}`)

  } catch (error) {
    console.error('❌ Error:', error.message)

    if (error.message.includes('does not exist')) {
      console.log('\n⚠️  The employee_schedules table does not exist in the database!')
      console.log('This means the schema needs to be synced with the database.')
      console.log('\nSolutions:')
      console.log('1. Run: npx prisma db push')
      console.log('2. Or run: npx prisma migrate dev')
    }
  } finally {
    await prisma.$disconnect()
  }
}

checkScheduleTable()
