const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function testCashInOutAPIs() {
  try {
    console.log('=== Testing Cash In/Out API Direct ===\n')

    // Get cashiermain user and open shift
    const user = await prisma.user.findUnique({
      where: { username: 'cashiermain' },
      include: {
        roles: {
          include: {
            role: {
              include: {
                permissions: {
                  include: {
                    permission: true,
                  },
                },
              },
            },
          },
        },
      },
    })

    if (!user) {
      console.log('❌ User cashiermain not found')
      return
    }

    console.log(`Found user: ${user.username} (ID: ${user.id})`)

    // Check permissions
    const rolePermissions = []
    for (const userRole of user.roles) {
      for (const rp of userRole.role.permissions) {
        rolePermissions.push(rp.permission.name)
      }
    }

    const hasCashInOut = rolePermissions.includes('cash.in_out')
    console.log(`Has cash.in_out permission: ${hasCashInOut ? '✅ YES' : '❌ NO'}\n`)

    // Get open shift for this user
    const shift = await prisma.cashierShift.findFirst({
      where: {
        userId: user.id,
        status: 'open',
      },
    })

    if (!shift) {
      console.log('❌ No open shift found for cashiermain')
      console.log('Please open a shift first')
      return
    }

    console.log(`Found open shift: ${shift.shiftNumber} (ID: ${shift.id})`)
    console.log(`Beginning Cash: ₱${parseFloat(shift.beginningCash).toFixed(2)}`)
    console.log(`Location ID: ${shift.locationId}\n`)

    // Test Cash In
    console.log('=== Testing Cash In ===')
    try {
      const cashInRecord = await prisma.cashInOut.create({
        data: {
          businessId: user.businessId,
          shiftId: shift.id,
          locationId: shift.locationId,
          type: 'cash_in',
          amount: 100.00,
          remarks: 'Test cash in from script',
          recordedBy: user.id,
          recordedAt: new Date(),
        },
      })

      console.log('✅ Cash In Record Created:')
      console.log(`   ID: ${cashInRecord.id}`)
      console.log(`   Amount: ₱${parseFloat(cashInRecord.amount).toFixed(2)}`)
      console.log(`   Remarks: ${cashInRecord.remarks}`)
    } catch (error) {
      console.log('❌ Cash In Failed:')
      console.log(`   Error: ${error.message}`)
      console.log(`   Details:`, error)
    }

    // Test Cash Out
    console.log('\n=== Testing Cash Out ===')
    try {
      const cashOutRecord = await prisma.cashInOut.create({
        data: {
          businessId: user.businessId,
          shiftId: shift.id,
          locationId: shift.locationId,
          type: 'cash_out',
          amount: 50.00,
          remarks: 'Test cash out from script',
          recordedBy: user.id,
          recordedAt: new Date(),
        },
      })

      console.log('✅ Cash Out Record Created:')
      console.log(`   ID: ${cashOutRecord.id}`)
      console.log(`   Amount: ₱${parseFloat(cashOutRecord.amount).toFixed(2)}`)
      console.log(`   Remarks: ${cashOutRecord.remarks}`)
    } catch (error) {
      console.log('❌ Cash Out Failed:')
      console.log(`   Error: ${error.message}`)
      console.log(`   Details:`, error)
    }

    // Check CashInOutRecord table structure
    console.log('\n=== Checking CashInOutRecord Table Structure ===')
    const records = await prisma.cashInOut.findMany({
      where: {
        shiftId: shift.id,
      },
      take: 5,
      orderBy: {
        recordedAt: 'desc',
      },
    })

    console.log(`Found ${records.length} recent records for this shift:`)
    for (const record of records) {
      console.log(`  - ${record.type}: ₱${parseFloat(record.amount).toFixed(2)} - ${record.remarks || 'No remarks'}`)
    }
  } catch (error) {
    console.error('Error:', error)
  } finally {
    await prisma.$disconnect()
  }
}

testCashInOutAPIs()
