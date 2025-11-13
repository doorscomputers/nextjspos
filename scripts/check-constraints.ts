import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function check() {
  const constraints = await prisma.$queryRaw<Array<{ constraint_name: string, constraint_type: string }>>`
    SELECT constraint_name, constraint_type
    FROM information_schema.table_constraints
    WHERE table_name = 'invoice_sequences'
    ORDER BY constraint_name
  `

  console.log('Invoice Sequences Constraints:')
  constraints.forEach(c => {
    console.log(`  - ${c.constraint_name} (${c.constraint_type})`)
  })

  console.log('\nChecking for UNIQUE constraints on (business_id, location_id, year, month):')
  const uniqueConstraints = await prisma.$queryRaw<Array<any>>`
    SELECT
      tc.constraint_name,
      STRING_AGG(kcu.column_name, ', ' ORDER BY kcu.ordinal_position) as columns
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name = kcu.constraint_name
      AND tc.table_schema = kcu.table_schema
    WHERE tc.table_name = 'invoice_sequences'
      AND tc.constraint_type = 'UNIQUE'
    GROUP BY tc.constraint_name
  `

  uniqueConstraints.forEach(uc => {
    console.log(`  ${uc.constraint_name}: ${uc.columns}`)
  })

  await prisma.$disconnect()
}

check()
