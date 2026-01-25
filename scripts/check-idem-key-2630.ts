import { config } from 'dotenv'
import { resolve } from 'path'
config({ path: resolve(process.cwd(), '.env') })

if (!process.env.DATABASE_URL && process.env.StiDATABASE_URL) {
  process.env.DATABASE_URL = process.env.StiDATABASE_URL
}

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function checkKey() {
  console.log('=== CHECKING IDEMPOTENCY KEY 2630 ===\n')

  // Get the full idempotency key record
  const keyRecord = await prisma.$queryRaw`
    SELECT id, key, status, endpoint, created_at, response_status,
           response_body::text as response_body
    FROM idempotency_keys
    WHERE id = 2630
  ` as any[]

  if (keyRecord.length > 0) {
    const k = keyRecord[0]
    console.log('IDEMPOTENCY KEY DETAILS:')
    console.log(`  ID: ${k.id}`)
    console.log(`  Status: ${k.status}`)
    console.log(`  Endpoint: ${k.endpoint}`)
    console.log(`  Response Status: ${k.response_status}`)
    console.log(`  Created: ${k.created_at}`)
    console.log('')

    if (k.response_body) {
      try {
        const body = JSON.parse(k.response_body)
        console.log('RESPONSE BODY (parsed):')
        console.log(`  Sale ID: ${body.id}`)
        console.log(`  Invoice: ${body.invoiceNumber}`)
        console.log(`  Location ID: ${body.locationId}`)
        console.log(`  Total: ${body.totalAmount}`)
        console.log(`  Status: ${body.status}`)
        console.log(`  Created At: ${body.createdAt}`)

        if (body.items) {
          console.log(`  Items:`)
          body.items.forEach((item: any) => {
            console.log(`    - Product ${item.productId}, Variation ${item.productVariationId}: ${item.quantity} x ${item.unitPrice}`)
          })
        }

        if (body.payments) {
          console.log(`  Payments:`)
          body.payments.forEach((p: any) => {
            console.log(`    - ${p.paymentMethod}: ${p.amount}`)
          })
        }

        // Now check if this sale actually exists in the database
        console.log(`\n\nCHECKING IF SALE ${body.id} EXISTS IN DATABASE...`)
        const sale = await prisma.sale.findUnique({
          where: { id: body.id },
          include: {
            items: true,
            payments: true
          }
        })

        if (sale) {
          console.log(`  SALE FOUND:`)
          console.log(`    Invoice: ${sale.invoiceNumber}`)
          console.log(`    Status: ${sale.status}`)
          console.log(`    Total: ${sale.totalAmount}`)
          console.log(`    Items count: ${sale.items.length}`)
          console.log(`    Payments count: ${sale.payments.length}`)
        } else {
          console.log(`  *** SALE NOT FOUND IN DATABASE! ***`)
          console.log(`  This confirms the bug - idempotency key shows success but sale doesn't exist.`)
        }

      } catch (e) {
        console.log('Failed to parse response body:', e)
        console.log('Raw body (first 1000 chars):', k.response_body?.substring(0, 1000))
      }
    }
  } else {
    console.log('Idempotency key 2630 not found')
  }

  // Also check all idempotency keys for Tuguegarao (location 4) today
  console.log('\n\n=== ALL IDEMPOTENCY KEYS FOR TUGUEGARAO SALES TODAY ===')
  const tugueKeys = await prisma.$queryRaw`
    SELECT id, key, status, response_status, created_at,
           response_body::text as response_body
    FROM idempotency_keys
    WHERE endpoint LIKE '%sales%'
    AND response_body::text LIKE '%locationId":4%'
    AND created_at > '2026-01-24'::date
    ORDER BY created_at ASC
  ` as any[]

  console.log(`Found ${tugueKeys.length} keys for Tuguegarao`)
  tugueKeys.forEach((k: any) => {
    try {
      const body = k.response_body ? JSON.parse(k.response_body) : null
      console.log(`\n  Key ${k.id}: ${body?.invoiceNumber || 'N/A'}`)
      console.log(`    Status: ${k.status}, Response: ${k.response_status}`)
      console.log(`    Total: ${body?.totalAmount || 'N/A'}`)
      console.log(`    Created: ${k.created_at}`)

      // Check each sale
      if (body?.id) {
        console.log(`    Sale ID: ${body.id}`)
      }
    } catch (e) {
      console.log(`  Key ${k.id}: Failed to parse`)
    }
  })

  console.log('\n=== DONE ===')
}

checkKey()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
