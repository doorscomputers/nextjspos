/**
 * Verification script to confirm database fixes
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('🔍 Verifying database fixes...\n')

  try {
    // Check invoice_sequences constraint
    console.log('1️⃣ Checking invoice_sequences table...')
    const invoiceConstraints = await prisma.$queryRaw<any[]>`
      SELECT
        conname AS constraint_name,
        array_agg(a.attname ORDER BY t.ord) AS columns
      FROM pg_constraint c
      JOIN pg_class cl ON c.conrelid = cl.oid
      CROSS JOIN LATERAL unnest(c.conkey) WITH ORDINALITY AS t(attnum, ord)
      JOIN pg_attribute a ON a.attnum = t.attnum AND a.attrelid = c.conrelid
      WHERE cl.relname = 'invoice_sequences'
        AND c.contype = 'u'
      GROUP BY conname
    `

    console.log('   Unique constraints:', invoiceConstraints)

    const hasCorrectConstraint = invoiceConstraints.some((constraint: any) =>
      constraint.columns.includes('business_id') &&
      constraint.columns.includes('location_id') &&
      constraint.columns.includes('year') &&
      constraint.columns.includes('month')
    )

    if (hasCorrectConstraint) {
      console.log('   ✅ Correct constraint exists (includes location_id)')
    } else {
      console.log('   ❌ Constraint missing location_id!')
    }

    // Check idempotency_keys table
    console.log('\n2️⃣ Checking idempotency_keys table...')
    const idempotencyTable = await prisma.$queryRaw<any[]>`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'idempotency_keys'
      ORDER BY ordinal_position
    `

    if (idempotencyTable.length > 0) {
      console.log('   ✅ Table exists with columns:')
      idempotencyTable.forEach((col: any) => {
        console.log(`      - ${col.column_name} (${col.data_type})`)
      })
    } else {
      console.log('   ❌ Table does not exist!')
    }

    console.log('\n✅ Verification complete!')
    console.log('\n📝 You can now restart your dev server and test the POS system.')

  } catch (error) {
    console.error('❌ Error during verification:', error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

main()
  .catch((error) => {
    console.error('Fatal error:', error)
    process.exit(1)
  })
