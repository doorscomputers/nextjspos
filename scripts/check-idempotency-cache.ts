/**
 * Check idempotency cache for admin physical inventory uploads
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('=== Checking Idempotency Cache ===\n')

  // Check for any cached responses related to physical inventory
  const cached = await prisma.$queryRaw<any[]>`
    SELECT id, key, endpoint, status, response_status, created_at, expires_at,
           LEFT(response_body::text, 500) as response_preview
    FROM idempotency_keys
    WHERE endpoint LIKE '%physical-inventory%' OR endpoint LIKE '%admin%'
    ORDER BY created_at DESC
    LIMIT 10
  `

  console.log(`Found ${cached.length} cached responses:`)
  for (const c of cached) {
    console.log(`\n  ID: ${c.id}`)
    console.log(`  Key: ${c.key}`)
    console.log(`  Endpoint: ${c.endpoint}`)
    console.log(`  Status: ${c.status}`)
    console.log(`  Response Status: ${c.response_status}`)
    console.log(`  Created: ${c.created_at}`)
    console.log(`  Expires: ${c.expires_at}`)
    console.log(`  Response Preview: ${c.response_preview?.substring(0, 200)}...`)
  }

  // Check ALL recent idempotency keys
  console.log('\n\n=== ALL Recent Idempotency Keys ===')
  const allKeys = await prisma.$queryRaw<any[]>`
    SELECT id, key, endpoint, status, response_status, created_at
    FROM idempotency_keys
    ORDER BY created_at DESC
    LIMIT 20
  `

  console.log(`Found ${allKeys.length} keys:`)
  for (const k of allKeys) {
    console.log(`  ${k.id} | ${k.endpoint} | ${k.status} | ${k.response_status} | ${k.created_at}`)
  }
}

main()
  .catch((e) => {
    console.error('Error:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
