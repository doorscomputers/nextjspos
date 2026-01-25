import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('Checking for stale idempotency keys...\n')

  // Find all keys that are still 'processing'
  const processingKeys = await prisma.$queryRaw<any[]>`
    SELECT
      id,
      key,
      business_id,
      user_id,
      endpoint,
      status,
      created_at,
      expires_at,
      EXTRACT(EPOCH FROM (NOW() - created_at)) as age_seconds
    FROM idempotency_keys
    WHERE status = 'processing'
    ORDER BY created_at DESC
    LIMIT 20
  `

  if (processingKeys.length === 0) {
    console.log('No stuck "processing" keys found.\n')
  } else {
    console.log(`Found ${processingKeys.length} keys still in "processing" status:\n`)
    for (const key of processingKeys) {
      const ageMinutes = Math.round(Number(key.age_seconds) / 60)
      const keyPreview = String(key.key).substring(0, 30)
      console.log(`ID: ${key.id}`)
      console.log(`  Key: ${keyPreview}...`)
      console.log(`  Business: ${key.business_id}, User: ${key.user_id}`)
      console.log(`  Endpoint: ${key.endpoint}`)
      console.log(`  Created: ${key.created_at}`)
      console.log(`  Age: ${ageMinutes} minutes (${Math.round(Number(key.age_seconds))} seconds)`)
      console.log(`  Status: ${key.status}`)
      console.log('')
    }
  }

  // Also check recent completed/failed keys for context
  const recentKeys = await prisma.$queryRaw<any[]>`
    SELECT
      status,
      COUNT(*) as count,
      MIN(created_at) as oldest,
      MAX(created_at) as newest
    FROM idempotency_keys
    WHERE endpoint = '/api/sales'
    GROUP BY status
    ORDER BY status
  `

  console.log('\nIdempotency key summary for /api/sales:')
  for (const row of recentKeys) {
    console.log(`  ${row.status}: ${row.count} keys (${row.oldest} to ${row.newest})`)
  }

  // Check for any sales created today to correlate
  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)

  const todaySales = await prisma.sale.count({
    where: {
      createdAt: { gte: todayStart }
    }
  })
  console.log(`\nSales created today: ${todaySales}`)
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
