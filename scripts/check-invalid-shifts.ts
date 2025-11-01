/**
 * Script to check for and report invalid shifts (open shifts with no beginning cash)
 * Usage: npx tsx scripts/check-invalid-shifts.ts
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('🔍 Checking for invalid open shifts...\n')

  try {
    // Find all open shifts
    const openShifts = await prisma.cashierShift.findMany({
      where: {
        status: 'open',
      },
      orderBy: {
        openedAt: 'asc',
      },
    })

    // Fetch all unique user IDs and location IDs
    const userIds = [...new Set(openShifts.map((shift) => shift.userId))]
    const locationIds = [...new Set(openShifts.map((shift) => shift.locationId))]

    // Batch fetch users and locations
    const [users, locations] = await Promise.all([
      prisma.user.findMany({
        where: { id: { in: userIds } },
        select: {
          id: true,
          username: true,
          firstName: true,
          lastName: true,
        },
      }),
      prisma.businessLocation.findMany({
        where: { id: { in: locationIds } },
        select: {
          id: true,
          name: true,
        },
      }),
    ])

    // Create lookup maps
    const userMap = new Map(users.map((u) => [u.id, u]))
    const locationMap = new Map(locations.map((l) => [l.id, l]))

    // Attach user and location data to shifts
    const shiftsWithDetails = openShifts.map((shift) => ({
      ...shift,
      user: userMap.get(shift.userId),
      location: locationMap.get(shift.locationId),
    }))

    console.log(`Found ${shiftsWithDetails.length} open shift(s)\n`)

    if (shiftsWithDetails.length === 0) {
      console.log('✅ No open shifts found')
      return
    }

    // Check for invalid shifts
    const invalidShifts = shiftsWithDetails.filter(
      (shift) => !shift.beginningCash || parseFloat(shift.beginningCash.toString()) <= 0
    )

    if (invalidShifts.length === 0) {
      console.log('✅ All open shifts have valid beginning cash')
      console.log('\nValid shifts:')
      shiftsWithDetails.forEach((shift) => {
        console.log(`  - ${shift.shiftNumber} | User: ${shift.user?.username || 'Unknown'} | Beginning Cash: ₱${shift.beginningCash} | Location: ${shift.location?.name || 'Unknown'}`)
      })
      return
    }

    // Report invalid shifts
    console.log(`⚠️  Found ${invalidShifts.length} INVALID shift(s) with missing or zero beginning cash:\n`)

    invalidShifts.forEach((shift) => {
      const userName = shift.user
        ? `${shift.user.firstName} ${shift.user.lastName || ''}`.trim() || shift.user.username
        : 'Unknown User'

      console.log('━'.repeat(80))
      console.log(`❌ INVALID SHIFT: ${shift.shiftNumber}`)
      console.log(`   User: ${userName} (ID: ${shift.userId})`)
      console.log(`   Location: ${shift.location?.name || 'Unknown'} (ID: ${shift.locationId})`)
      console.log(`   Beginning Cash: ${shift.beginningCash || 'NULL'}`)
      console.log(`   Opened At: ${shift.openedAt}`)
      console.log(`   Shift ID: ${shift.id}`)
      console.log('━'.repeat(80))
      console.log()
    })

    console.log('\n⚠️  RECOMMENDED ACTION:')
    console.log('These shifts should be closed immediately to prevent POS errors.')
    console.log('Users will not be able to complete sales with these invalid shifts.\n')

    console.log('To close these shifts, run:')
    invalidShifts.forEach((shift) => {
      console.log(
        `  UPDATE "CashierShift" SET status = 'closed', "closedAt" = NOW() WHERE id = ${shift.id};`
      )
    })

    console.log('\nOr use Prisma Studio: npx prisma studio')
  } catch (error) {
    console.error('❌ Error checking shifts:', error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

main()
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
