/**
 * Find your current or most recent shift
 * Usage: npx tsx scripts/find-my-shift.ts <username>
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function findShift() {
  const username = process.argv[2]

  if (!username) {
    console.error('❌ Please provide your username')
    console.log('Usage: npx tsx scripts/find-my-shift.ts <username>')
    process.exit(1)
  }

  console.log(`\n🔍 Finding shifts for user: ${username}\n`)

  // Find user
  const user = await prisma.user.findFirst({
    where: { username },
  })

  if (!user) {
    console.error(`❌ User "${username}" not found`)
    process.exit(1)
  }

  // Find shifts for this user (most recent first)
  const shifts = await prisma.cashierShift.findMany({
    where: { userId: user.id },
    orderBy: { openedAt: 'desc' },
    take: 10,
    include: {
      location: {
        select: { name: true },
      },
    },
  })

  if (shifts.length === 0) {
    console.log(`⚠️  No shifts found for user "${username}"`)
    process.exit(0)
  }

  console.log(`✅ Found ${shifts.length} shift(s):\n`)

  shifts.forEach((shift: any, index: number) => {
    const isOpen = shift.status === 'open'
    const statusEmoji = isOpen ? '🟢' : '🔴'

    console.log(`${index + 1}. ${statusEmoji} Shift ID: ${shift.id}`)
    console.log(`   - Shift Number: ${shift.shiftNumber}`)
    console.log(`   - Status: ${shift.status.toUpperCase()}`)
    console.log(`   - Location: ${shift.location?.name || 'Unknown'}`)
    console.log(`   - Opened: ${shift.openedAt}`)
    console.log(`   - Closed: ${shift.closedAt || 'Not closed yet'}`)
    console.log(`   - Beginning Cash: ₱${parseFloat(shift.beginningCash.toString()).toFixed(2)}`)
    console.log('')
  })

  console.log(`\n💡 To check cash in/out for a shift, run:`)
  console.log(`   npx tsx scripts/check-cash-in-out.ts <shift-id>`)
}

findShift().catch((error) => {
  console.error('Error:', error)
  process.exit(1)
})
