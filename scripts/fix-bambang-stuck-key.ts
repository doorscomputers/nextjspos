import { config } from 'dotenv'
import { resolve } from 'path'
config({ path: resolve(process.cwd(), '.env') })

if (!process.env.DATABASE_URL && process.env.StiDATABASE_URL) {
  process.env.DATABASE_URL = process.env.StiDATABASE_URL
}

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function fixBambangStuckKey() {
  console.log('=== FIXING STUCK IDEMPOTENCY KEY AT BAMBANG ===\n')

  // Find Bambang location ID
  const bambang = await prisma.businessLocation.findFirst({
    where: { name: { contains: 'Bambang' } }
  })

  if (!bambang) {
    console.log('Bambang location not found')
    return
  }

  console.log(`Bambang location ID: ${bambang.id}`)

  // Find the sale with invoice 0018 at Bambang
  console.log('\n1. FINDING SALE WITH INVOICE 0018 AT BAMBANG...')
  const sale0018 = await prisma.$queryRaw`
    SELECT id, invoice_number, status, total_amount, created_at
    FROM sales
    WHERE location_id = ${bambang.id}
    AND invoice_number LIKE '%0018%'
    ORDER BY created_at DESC
    LIMIT 5
  ` as any[]

  if (sale0018.length > 0) {
    console.log('Found sales with 0018:')
    sale0018.forEach((s: any) => {
      console.log(`  Sale ${s.id}: ${s.invoice_number} | ${s.status} | ${s.total_amount} | ${s.created_at}`)
    })
  }

  // Find ALL idempotency keys for Bambang location
  console.log('\n2. FINDING ALL IDEMPOTENCY KEYS FOR BAMBANG...')
  const bambangKeys = await prisma.$queryRaw`
    SELECT id, key, status, endpoint, created_at, response_status,
           LEFT(response_body::text, 300) as preview
    FROM idempotency_keys
    WHERE response_body::text LIKE '%"locationId":${bambang.id}%'
    ORDER BY created_at DESC
    LIMIT 20
  ` as any[]

  console.log(`Found ${bambangKeys.length} idempotency keys for Bambang`)

  // Find keys that reference voided or old sales
  console.log('\n3. CHECKING FOR STUCK KEYS (voided sales or old invoices)...')
  const keysToDelete: number[] = []

  for (const k of bambangKeys) {
    try {
      const body = JSON.parse(k.preview.replace(/\.\.\..*$/, '') + '"}]}') // Try to parse partial JSON
    } catch {
      // Can't parse, check differently
    }

    // Check if this key references a voided sale
    if (k.preview) {
      const idMatch = k.preview.match(/"id":(\d+)/)
      if (idMatch) {
        const saleId = parseInt(idMatch[1])
        const sale = await prisma.sale.findUnique({
          where: { id: saleId },
          select: { id: true, status: true, invoiceNumber: true }
        })

        if (sale) {
          console.log(`  Key ${k.id} -> Sale ${sale.id} (${sale.invoiceNumber}): ${sale.status}`)
          if (sale.status === 'voided' || sale.status === 'cancelled') {
            console.log(`    *** STUCK KEY - Sale is ${sale.status}! Adding to delete list.`)
            keysToDelete.push(k.id)
          }
        }
      }
    }
  }

  // Also find keys with ACER in the response
  console.log('\n4. FINDING KEYS WITH ACER PRODUCTS...')
  const acerKeys = await prisma.$queryRaw`
    SELECT id, status, created_at,
           response_body::text as response_body
    FROM idempotency_keys
    WHERE response_body::text LIKE '%ACER%'
    OR response_body::text LIKE '%AL14%'
    ORDER BY created_at DESC
    LIMIT 20
  ` as any[]

  console.log(`Found ${acerKeys.length} keys with ACER products`)
  for (const k of acerKeys) {
    try {
      const body = JSON.parse(k.response_body)
      console.log(`  Key ${k.id}: Sale ${body.id} (${body.invoiceNumber}) - ${body.status} - Total: ${body.totalAmount}`)

      // Check current sale status
      const currentSale = await prisma.sale.findUnique({
        where: { id: body.id },
        select: { status: true }
      })

      if (currentSale && (currentSale.status === 'voided' || currentSale.status === 'cancelled')) {
        console.log(`    *** STUCK KEY - Sale is now ${currentSale.status}! Adding to delete list.`)
        if (!keysToDelete.includes(k.id)) {
          keysToDelete.push(k.id)
        }
      }
    } catch (e) {
      // Skip parse errors
    }
  }

  // Delete stuck keys
  if (keysToDelete.length > 0) {
    console.log(`\n5. DELETING ${keysToDelete.length} STUCK KEYS...`)
    for (const keyId of keysToDelete) {
      await prisma.$executeRaw`DELETE FROM idempotency_keys WHERE id = ${keyId}`
      console.log(`  Deleted key ${keyId}`)
    }
    console.log('\n✅ STUCK KEYS DELETED! User can now create new sales.')
  } else {
    console.log('\n⚠️ No obvious stuck keys found. Let me check ALL keys for voided sales...')

    // Broader check - find ALL keys and check if their sales are voided
    const allSalesKeys = await prisma.$queryRaw`
      SELECT id, response_body::text as response_body
      FROM idempotency_keys
      WHERE endpoint = '/api/sales'
      AND status = 'completed'
    ` as any[]

    console.log(`Checking ${allSalesKeys.length} completed sales keys...`)
    let deletedCount = 0

    for (const k of allSalesKeys) {
      try {
        const body = JSON.parse(k.response_body)
        if (body.id) {
          const sale = await prisma.sale.findUnique({
            where: { id: body.id },
            select: { status: true, invoiceNumber: true, locationId: true }
          })

          if (sale && (sale.status === 'voided' || sale.status === 'cancelled')) {
            console.log(`  Found stuck key ${k.id} for voided sale ${body.id} (${sale.invoiceNumber})`)
            await prisma.$executeRaw`DELETE FROM idempotency_keys WHERE id = ${k.id}`
            deletedCount++
          }
        }
      } catch (e) {
        // Skip
      }
    }

    if (deletedCount > 0) {
      console.log(`\n✅ Deleted ${deletedCount} stuck keys for voided sales!`)
    } else {
      console.log('\nNo stuck keys found for voided sales.')
    }
  }

  console.log('\n=== DONE ===')
}

fixBambangStuckKey()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
