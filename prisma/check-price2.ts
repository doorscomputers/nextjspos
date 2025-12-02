import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function check() {
  console.log('=== RAW SQL Check for SKU 4894947088827 ===\n')

  // Raw query to see actual columns
  const result: any[] = await prisma.$queryRaw`
    SELECT
      pv.id,
      pv.sku,
      pv.default_selling_price,
      pv.updated_at,
      p.name as product_name
    FROM product_variations pv
    JOIN products p ON p.id = pv.product_id
    WHERE pv.sku = '4894947088827'
  `

  console.log('Current DB State:')
  if (result.length > 0) {
    const r = result[0]
    console.log('  Product:', r.product_name)
    console.log('  SKU:', r.sku)
    console.log('  default_selling_price:', r.default_selling_price)
    console.log('  updated_at:', r.updated_at)
  } else {
    console.log('  Not found!')
  }

  // Check price history
  console.log('\n=== Price History ===')
  const history: any[] = await prisma.$queryRaw`
    SELECT
      event_type,
      old_selling_price,
      new_selling_price,
      notes,
      created_at
    FROM product_history
    WHERE sku = '4894947088827'
    ORDER BY created_at DESC
    LIMIT 10
  `

  if (history.length === 0) {
    console.log('  No history records')
  } else {
    history.forEach((h, i) => {
      console.log(`\n  [${i+1}] ${h.event_type}`)
      console.log(`      Old: ${h.old_selling_price} -> New: ${h.new_selling_price}`)
      console.log(`      Notes: ${h.notes}`)
      console.log(`      Date: ${h.created_at}`)
    })
  }

  // Check location prices
  console.log('\n=== Location Prices ===')
  const locPrices: any[] = await prisma.$queryRaw`
    SELECT
      lp.selling_price,
      bl.name as location_name
    FROM location_prices lp
    JOIN business_locations bl ON bl.id = lp.location_id
    JOIN product_variations pv ON pv.id = lp.product_variation_id
    WHERE pv.sku = '4894947088827'
  `

  if (locPrices.length === 0) {
    console.log('  No location-specific prices')
  } else {
    locPrices.forEach(lp => {
      console.log(`  ${lp.location_name}: ${lp.selling_price}`)
    })
  }

  await prisma.$disconnect()
}

check().catch(e => {
  console.error('Error:', e)
  process.exit(1)
})
