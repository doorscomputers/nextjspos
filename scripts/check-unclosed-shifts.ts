/**
 * Check for any unclosed shifts in the database
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function checkUnclosedShifts() {
  try {
    console.log('🔍 Checking for unclosed shifts...\n')

    // Get all open shifts
    const openShifts = await prisma.cashierShift.findMany({
      where: {
        status: 'open',
      },
      orderBy: {
        openedAt: 'asc',
      },
    })

    if (openShifts.length === 0) {
      console.log('✅ No unclosed shifts found! All shifts are properly closed.')
      return
    }

    console.log(`⚠️  Found ${openShifts.length} unclosed shift(s):\n`)

    for (const shift of openShifts) {
      // Fetch user and location data separately
      const user = await prisma.user.findUnique({
        where: { id: shift.userId },
        select: { username: true, firstName: true, lastName: true },
      })

      const location = await prisma.businessLocation.findUnique({
        where: { id: shift.locationId },
        select: { name: true },
      })

      const now = new Date()
      const shiftStart = new Date(shift.openedAt)
      const hoursSinceOpen = Math.floor(
        (now.getTime() - shiftStart.getTime()) / (1000 * 60 * 60)
      )
      const daysSinceOpen = Math.floor(hoursSinceOpen / 24)

      console.log(`📌 Shift #${shift.shiftNumber}`)
      console.log(`   User: ${user?.username || 'Unknown'} (${user?.firstName || ''} ${user?.lastName || ''})`)
      console.log(`   Location: ${location?.name || 'Unknown'}`)
      console.log(`   Opened: ${shift.openedAt.toLocaleString()}`)
      console.log(`   Duration: ${daysSinceOpen > 0 ? `${daysSinceOpen} day(s), ` : ''}${hoursSinceOpen % 24} hour(s)`)
      console.log(`   Beginning Cash: ₱${shift.beginningCash}`)
      console.log(`   Status: ${shift.status}\n`)
    }
  } catch (error) {
    console.error('❌ Error checking unclosed shifts:', error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

checkUnclosedShifts()
  .then(() => {
    console.log('\n✅ Check completed')
    process.exit(0)
  })
  .catch((error) => {
    console.error('\n💥 Check failed:', error)
    process.exit(1)
  })
