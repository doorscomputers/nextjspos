const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function checkIndexes() {
  try {
    // Check PostgreSQL indexes
    const indexes = await prisma.$queryRaw`
      SELECT 
        tablename,
        indexname,
        indexdef
      FROM pg_indexes
      WHERE schemaname = 'public'
      AND tablename IN ('products', 'product_variations')
      ORDER BY tablename, indexname
    `
    
    console.log('=== Database Indexes ===\n')
    indexes.forEach(idx => {
      console.log(`Table: ${idx.tablename}`)
      console.log(`Index: ${idx.indexname}`)
      console.log(`Definition: ${idx.indexdef}`)
      console.log('')
    })
    
  } catch (error) {
    console.error('Error:', error.message)
  } finally {
    await prisma.$disconnect()
  }
}

checkIndexes()
