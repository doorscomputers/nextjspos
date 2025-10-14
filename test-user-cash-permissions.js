const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function checkUserCashPermissions() {
  try {
    console.log('=== Checking User Cash In/Out Permissions ===\n')

    // Get all users with their roles and permissions
    const users = await prisma.user.findMany({
      where: {
        businessId: 1,
      },
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
        permissions: {
          include: {
            permission: true,
          },
        },
      },
    })

    console.log(`Found ${users.length} users\n`)

    for (const user of users) {
      const fullName = `${user.firstName} ${user.lastName || ''}`.trim()
      console.log(`\n👤 User: ${user.username} (${fullName})`)
      console.log(`   ID: ${user.id}`)
      console.log(`   Allow Login: ${user.allowLogin ? 'Yes' : 'No'}`)

      // Get role permissions
      const rolePermissions = []
      for (const userRole of user.roles) {
        const role = userRole.role
        console.log(`   📋 Role: ${role.name}`)
        for (const rp of role.permissions) {
          rolePermissions.push(rp.permission.name)
        }
      }

      // Get direct user permissions
      const userPermissions = user.permissions.map((up) => up.permission.name)

      // Combine all permissions
      const allPermissions = [...new Set([...rolePermissions, ...userPermissions])]

      // Check for cash.in_out permission
      const hasCashInOut = allPermissions.includes('cash.in_out')

      console.log(`   💰 Has 'cash.in_out' permission: ${hasCashInOut ? '✅ YES' : '❌ NO'}`)

      if (hasCashInOut) {
        console.log(`   ✨ This user SHOULD be able to use Cash In/Out`)
      } else {
        console.log(`   ⚠️ This user CANNOT use Cash In/Out - Missing 'cash.in_out' permission`)
      }

      // Show all permissions (first 10)
      if (allPermissions.length > 0) {
        console.log(`   📜 Total permissions: ${allPermissions.length}`)
        console.log(`   First 10 permissions:`)
        allPermissions.slice(0, 10).forEach((perm) => {
          console.log(`      - ${perm}`)
        })
      } else {
        console.log(`   ⚠️ NO PERMISSIONS ASSIGNED!`)
      }
    }

    // Check for open shifts
    console.log('\n\n=== Checking Open Shifts ===\n')
    const openShifts = await prisma.cashierShift.findMany({
      where: {
        status: 'open',
      },
      include: {
        user: true,
        location: true,
      },
    })

    console.log(`Found ${openShifts.length} open shifts\n`)
    for (const shift of openShifts) {
      const userFullName = `${shift.user.firstName} ${shift.user.lastName || ''}`.trim()
      console.log(`🕐 Shift #${shift.shiftNumber}`)
      console.log(`   User: ${shift.user.username} (${userFullName})`)
      console.log(`   Location: ${shift.location.name}`)
      console.log(`   Beginning Cash: ₱${parseFloat(shift.beginningCash).toFixed(2)}`)
      console.log(`   Status: ${shift.status}`)
    }
  } catch (error) {
    console.error('Error:', error)
  } finally {
    await prisma.$disconnect()
  }
}

checkUserCashPermissions()
