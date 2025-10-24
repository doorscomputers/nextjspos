import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function checkAttendanceTable() {
  console.log('Checking attendances table...\n')

  try {
    const result = await prisma.$queryRawUnsafe(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'attendances'
      ORDER BY ordinal_position;
    `)

    console.log('📊 Columns in attendances table:')
    result.forEach(col => {
      console.log(`   ${col.column_name} (${col.data_type}) ${col.is_nullable === 'YES' ? 'NULL' : 'NOT NULL'}`)
    })

    const count = await prisma.$queryRawUnsafe(`
      SELECT COUNT(*) as count FROM attendances;
    `)
    console.log(`\n📝 Total records: ${count[0].count}`)

  } catch (error) {
    console.error('❌ Error:', error.message)
  } finally {
    await prisma.$disconnect()
  }
}

checkAttendanceTable()
