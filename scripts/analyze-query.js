const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function analyze() {
  // The slow query from the API
  const query = `
    EXPLAIN ANALYZE
    SELECT * FROM products
    WHERE business_id = 1
    AND is_active = true
    AND (
      name ILIKE '%a%'
      OR EXISTS (
        SELECT 1 FROM product_variations
        WHERE product_variations.product_id = products.id
        AND product_variations.name ILIKE '%a%'
      )
    )
    LIMIT 20
  `
  
  console.log('Analyzing query performance...\n')
  const result = await prisma.$queryRawUnsafe(query)
  
  result.forEach(row => {
    console.log(row['QUERY PLAN'])
  })
  
  await prisma.$disconnect()
}

analyze()
