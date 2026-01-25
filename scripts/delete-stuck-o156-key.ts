import { config } from 'dotenv'
import { resolve } from 'path'
config({ path: resolve(process.cwd(), '.env') })

if (!process.env.DATABASE_URL && process.env.StiDATABASE_URL) {
  process.env.DATABASE_URL = process.env.StiDATABASE_URL
}

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function deleteStuckKey() {
  console.log('=== DELETING STUCK IDEMPOTENCY KEY FOR O156IPC VOIDED SALE ===\n')

  // The voided sale ID is 3178 (InvTuguega01_24_2026_0001)
  const voidedSaleId = 3178

  // Find and show the idempotency key first
  console.log('Looking for idempotency key with voided sale...')
  const keys = await prisma.$queryRaw`
    SELECT id, key, status, endpoint, created_at,
           LEFT(response_body::text, 200) as preview
    FROM idempotency_keys
    WHERE response_body::text LIKE ${`%"id":${voidedSaleId},%`}
    AND endpoint = '/api/sales'
  ` as any[]

  if (keys.length === 0) {
    console.log('No idempotency key found for sale ID', voidedSaleId)
    console.log('The key may have already been deleted or expired.')
    return
  }

  console.log(`Found ${keys.length} idempotency key(s):`)
  keys.forEach((k: any) => {
    console.log(`\n  Key ID: ${k.id}`)
    console.log(`  Status: ${k.status}`)
    console.log(`  Created: ${k.created_at}`)
    console.log(`  Preview: ${k.preview}...`)
  })

  // Delete the key(s)
  console.log('\nDeleting idempotency key(s)...')
  const deleted = await prisma.$executeRaw`
    DELETE FROM idempotency_keys
    WHERE response_body::text LIKE ${`%"id":${voidedSaleId},%`}
    AND endpoint = '/api/sales'
  `

  console.log(`\nDeleted ${deleted} idempotency key(s).`)
  console.log('The cashier can now create a new sale with O156IPC!')

  console.log('\n=== DONE ===')
}

deleteStuckKey()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
