/**
 * Test script to verify open shifts query
 */

import { prisma } from '../src/lib/prisma'

async function testOpenShifts() {
  console.log('Testing Open Shifts Query...\n')

  try {
    // Get a business ID to test with
    const firstBusiness = await prisma.business.findFirst({
      select: { id: true, name: true }
    })

    if (!firstBusiness) {
      console.log('❌ No business found in database')
      return
    }

    console.log(`✓ Testing with business: ${firstBusiness.name} (ID: ${firstBusiness.id})\n`)

    // Query for all open shifts
    const allOpenShifts = await prisma.cashierShift.findMany({
      where: {
        closedAt: null, // Still open
        businessId: firstBusiness.id
      },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            firstName: true,
            lastName: true,
            surname: true,
            email: true,
            roles: {
              include: {
                role: {
                  select: {
                    name: true
                  }
                }
              }
            }
          }
        },
        location: {
          select: {
            id: true,
            name: true,
            locationCode: true,
            isActive: true
          }
        }
      },
      orderBy: {
        openedAt: 'asc' // Oldest shifts first
      }
    })

    console.log(`✓ Found ${allOpenShifts.length} open shifts\n`)

    if (allOpenShifts.length === 0) {
      console.log('ℹ️  No open shifts found. This is normal if all shifts are closed.')
      console.log('   To create a test shift, open POS and start a shift.')
      return
    }

    // Display each shift
    allOpenShifts.forEach((shift, index) => {
      const now = new Date()
      const shiftDurationMs = now.getTime() - shift.openedAt.getTime()
      const shiftDurationHours = shiftDurationMs / (1000 * 60 * 60)
      const roles = shift.user.roles.map(ur => ur.role.name)

      console.log(`--- Shift ${index + 1} ---`)
      console.log(`  Cashier: ${shift.user.firstName} ${shift.user.lastName} (@${shift.user.username})`)
      console.log(`  Roles: ${roles.join(', ')}`)
      console.log(`  Location: ${shift.location.name} (${shift.location.locationCode || 'N/A'})`)
      console.log(`  Shift Number: ${shift.shiftNumber}`)
      console.log(`  Opened At: ${shift.openedAt.toLocaleString('en-PH')}`)
      console.log(`  Duration: ${Math.floor(shiftDurationHours)}h ${Math.floor((shiftDurationMs / (1000 * 60)) % 60)}m`)
      console.log(`  Long Running: ${shiftDurationHours > 12 ? '⚠️  YES (>12 hours!)' : 'No'}`)
      console.log(`  Beginning Cash: ₱${shift.beginningCash.toString()}`)
      console.log(`  Transactions: ${shift.runningTransactions}`)
      console.log(`  Gross Sales: ₱${shift.runningGrossSales.toString()}`)
      console.log()
    })

    console.log('✅ Query successful - API should work!\n')

  } catch (error) {
    console.error('❌ Error:', error)
  } finally {
    await prisma.$disconnect()
  }
}

testOpenShifts()
