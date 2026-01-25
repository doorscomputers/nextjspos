import { config } from 'dotenv'
import { resolve } from 'path'
config({ path: resolve(process.cwd(), '.env') })

if (!process.env.DATABASE_URL && process.env.StiDATABASE_URL) {
  process.env.DATABASE_URL = process.env.StiDATABASE_URL
}

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function deleteOldKeys() {
  console.log('=== DELETING OLD IDEMPOTENCY KEYS ===\n')

  // Delete the specific key 2551 that's returning old sale 3164
  console.log('1. Deleting key 2551 (returning old Jan 23 sale)...')
  const deleted1 = await prisma.$executeRaw`
    DELETE FROM idempotency_keys WHERE id = 2551
  `
  console.log(`   Deleted: ${deleted1}`)

  // Delete any keys older than 12 hours
  console.log('\n2. Deleting all keys older than 12 hours...')
  const deleted2 = await prisma.$executeRaw`
    DELETE FROM idempotency_keys
    WHERE created_at < NOW() - INTERVAL '12 hours'
  `
  console.log(`   Deleted: ${deleted2}`)

  // Show remaining keys count
  const remaining = await prisma.$queryRaw`
    SELECT COUNT(*) as count FROM idempotency_keys
  ` as any[]
  console.log(`\n3. Remaining keys: ${remaining[0].count}`)

  console.log('\n✅ DONE! User can now make the ACER sale.')
}

deleteOldKeys()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
