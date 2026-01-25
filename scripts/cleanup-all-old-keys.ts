import { config } from 'dotenv'
import { resolve } from 'path'
config({ path: resolve(process.cwd(), '.env') })

if (!process.env.DATABASE_URL && process.env.StiDATABASE_URL) {
  process.env.DATABASE_URL = process.env.StiDATABASE_URL
}

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function cleanupAllOldKeys() {
  console.log('=== CLEANING UP ALL OLD IDEMPOTENCY KEYS ===\n')

  // First show what we have
  console.log('1. CURRENT IDEMPOTENCY KEYS:')
  const currentKeys = await prisma.$queryRaw`
    SELECT id, status, endpoint, created_at,
           LEFT(response_body::text, 100) as preview
    FROM idempotency_keys
    ORDER BY created_at DESC
    LIMIT 30
  ` as any[]

  console.log(`   Total keys: ${currentKeys.length}`)
  currentKeys.forEach((k: any) => {
    console.log(`   ${k.id} | ${k.status} | ${k.created_at} | ${k.preview?.substring(0, 50)}...`)
  })

  // Delete ALL keys older than 1 hour
  console.log('\n2. DELETING ALL KEYS OLDER THAN 1 HOUR...')
  const deleted = await prisma.$executeRaw`
    DELETE FROM idempotency_keys
    WHERE created_at < NOW() - INTERVAL '1 hour'
  `
  console.log(`   Deleted: ${deleted} keys`)

  // Also delete any keys with Service Fee to be safe
  console.log('\n3. DELETING ANY REMAINING SERVICE FEE KEYS...')
  const deletedService = await prisma.$executeRaw`
    DELETE FROM idempotency_keys
    WHERE response_body::text ILIKE '%service%fee%'
  `
  console.log(`   Deleted: ${deletedService} keys`)

  // Show remaining
  console.log('\n4. REMAINING KEYS AFTER CLEANUP:')
  const remaining = await prisma.$queryRaw`
    SELECT COUNT(*) as count FROM idempotency_keys
  ` as any[]
  console.log(`   Total remaining: ${remaining[0].count}`)

  console.log('\n✅ CLEANUP COMPLETE! Users can now sell Service Fee and other items.')
}

cleanupAllOldKeys()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
