/**
 * Check specific shifts for EricsonChanCashierTugue and JASMINKATECashierMain
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function checkSpecificShifts() {
  try {
    console.log('🔍 Checking shifts for EricsonChanCashierTugue and JASMINKATECashierMain...\n')

    // Find users
    const users = await prisma.user.findMany({
      where: {
        username: {
          in: ['EricsonChanCashierTugue', 'JASMINKATECashierMain'],
        },
      },
      select: {
        id: true,
        username: true,
        firstName: true,
        lastName: true,
      },
    })

    if (users.length === 0) {
      console.log('❌ No users found with those usernames')
      return
    }

    console.log(`Found ${users.length} user(s):\n`)
    users.forEach((u) => {
      console.log(`   - ${u.username} (${u.firstName} ${u.lastName})`)
    })
    console.log('')

    // Check their shifts
    for (const user of users) {
      console.log(`\n📊 Shifts for ${user.username}:`)
      console.log('─'.repeat(60))

      const shifts = await prisma.cashierShift.findMany({
        where: {
          userId: user.id,
        },
        orderBy: {
          openedAt: 'desc',
        },
        take: 5, // Get last 5 shifts
      })

      if (shifts.length === 0) {
        console.log('   No shifts found')
        continue
      }

      for (const shift of shifts) {
        const location = await prisma.businessLocation.findUnique({
          where: { id: shift.locationId },
          select: { name: true },
        })

        const duration = shift.closedAt
          ? Math.floor((new Date(shift.closedAt).getTime() - new Date(shift.openedAt).getTime()) / (1000 * 60 * 60))
          : Math.floor((new Date().getTime() - new Date(shift.openedAt).getTime()) / (1000 * 60 * 60))

        console.log(`\n   📌 ${shift.shiftNumber}`)
        console.log(`      Location: ${location?.name || 'Unknown'}`)
        console.log(`      Status: ${shift.status === 'open' ? '🟢 OPEN' : '🔴 CLOSED'}`)
        console.log(`      Opened: ${new Date(shift.openedAt).toLocaleString()}`)
        if (shift.closedAt) {
          console.log(`      Closed: ${new Date(shift.closedAt).toLocaleString()}`)
        }
        console.log(`      Duration: ${duration} hours`)
        console.log(`      Beginning Cash: ₱${shift.beginningCash}`)
        if (shift.endingCash) {
          console.log(`      Ending Cash: ₱${shift.endingCash}`)
        }
        if (shift.closingNotes) {
          console.log(`      Closing Notes: ${shift.closingNotes}`)
        }
      }
    }

    // Check for any OPEN shifts for these users
    console.log('\n\n🔓 OPEN SHIFTS CHECK:')
    console.log('─'.repeat(60))

    const openShifts = await prisma.cashierShift.findMany({
      where: {
        userId: { in: users.map((u) => u.id) },
        status: 'open',
      },
    })

    if (openShifts.length === 0) {
      console.log('✅ No open shifts! Both users can start new shifts.')
    } else {
      console.log(`⚠️  Found ${openShifts.length} open shift(s) that need to be closed!`)
      for (const shift of openShifts) {
        const user = users.find((u) => u.id === shift.userId)
        const location = await prisma.businessLocation.findUnique({
          where: { id: shift.locationId },
          select: { name: true },
        })
        console.log(`   - ${shift.shiftNumber} (${user?.username} at ${location?.name})`)
      }
    }
  } catch (error) {
    console.error('❌ Error:', error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

checkSpecificShifts()
  .then(() => {
    console.log('\n\n✅ Check completed')
    process.exit(0)
  })
  .catch((error) => {
    console.error('\n💥 Check failed:', error)
    process.exit(1)
  })
