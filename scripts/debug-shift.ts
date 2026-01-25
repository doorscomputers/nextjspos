import { config } from 'dotenv'
import { resolve } from 'path'
config({ path: resolve(process.cwd(), '.env') })

if (!process.env.DATABASE_URL && process.env.StiDATABASE_URL) {
  process.env.DATABASE_URL = process.env.StiDATABASE_URL
}

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function check() {
  console.log('=== DEBUG SHIFT QUERY ===\n')

  // Get user 9's details
  const user = await prisma.user.findUnique({
    where: { id: 9 },
    select: { id: true, username: true, businessId: true }
  })
  console.log('USER 9:', JSON.stringify(user))

  // Get the exact shift query that Sales API would use
  const shift = await prisma.cashierShift.findFirst({
    where: {
      userId: 9,
      status: 'open',
      businessId: user?.businessId || 0,
      locationId: 2
    }
  })
  console.log('\nSHIFT QUERY RESULT:', shift ? 'FOUND' : 'NOT FOUND!')
  if (shift) {
    console.log('  Shift ID:', shift.id)
    console.log('  User ID:', shift.userId)
    console.log('  Business ID:', shift.businessId)
    console.log('  Location ID:', shift.locationId)
    console.log('  Status:', shift.status)
    console.log('  Opened At:', shift.openedAt)
  }

  // Check what location the POS would send
  const posShift = await prisma.cashierShift.findFirst({
    where: {
      userId: 9,
      status: 'open'
    }
  })
  console.log('\nPOS SHIFT (without location filter):')
  if (posShift) {
    console.log('  Shift ID:', posShift.id)
    console.log('  Location ID:', posShift.locationId)
  }

  await prisma.$disconnect()
}

check().catch(e => {
  console.error(e)
  process.exit(1)
})
