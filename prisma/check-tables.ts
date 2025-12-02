import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  try {
    const tables = await prisma.$queryRaw`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_name LIKE 'package%'
    ` as any[]

    console.log('Package tables found:', tables.map(t => t.table_name))

    // Try to count categories
    const count = await prisma.packageCategory.count()
    console.log('PackageCategory count:', count)

  } catch (e) {
    console.error('Error:', e)
  } finally {
    await prisma.$disconnect()
  }
}

main()
