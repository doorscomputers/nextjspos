import { prisma } from '../src/lib/prisma.simple'

/**
 * Add shift.close permission to Sales Cashier role
 * Cashiers need to be able to close their own shifts
 */
async function addShiftClosePermission() {
  console.log('🔧 Adding shift.close permission to Sales Cashier role...\n')

  try {
    // Find or create shift.close permission
    const shiftClosePermission = await prisma.permission.upsert({
      where: { name: 'shift.close' },
      update: {},
      create: {
        name: 'shift.close',
        guardName: 'web',
      },
    })

    console.log('✅ shift.close permission:', shiftClosePermission.name)

    // Find all Sales Cashier roles across all businesses
    const salesCashierRoles = await prisma.role.findMany({
      where: {
        name: 'Sales Cashier',
      },
      include: {
        permissions: {
          include: {
            permission: true,
          },
        },
      },
    })

    console.log(`\n📋 Found ${salesCashierRoles.length} Sales Cashier role(s)\n`)

    for (const role of salesCashierRoles) {
      // Check if permission already exists
      const hasPermission = role.permissions.some(
        (rp) => rp.permission.name === 'shift.close'
      )

      if (hasPermission) {
        console.log(`✅ Role "${role.name}" (ID: ${role.id}) already has shift.close permission`)
        continue
      }

      // Add permission to role
      await prisma.rolePermission.create({
        data: {
          roleId: role.id,
          permissionId: shiftClosePermission.id,
        },
      })

      console.log(`✅ Added shift.close to role "${role.name}" (ID: ${role.id})`)
    }

    // Also add to Cashier role if it exists
    const cashierRoles = await prisma.role.findMany({
      where: {
        name: 'Cashier',
      },
      include: {
        permissions: {
          include: {
            permission: true,
          },
        },
      },
    })

    console.log(`\n📋 Found ${cashierRoles.length} Cashier role(s)\n`)

    for (const role of cashierRoles) {
      const hasPermission = role.permissions.some(
        (rp) => rp.permission.name === 'shift.close'
      )

      if (hasPermission) {
        console.log(`✅ Role "${role.name}" (ID: ${role.id}) already has shift.close permission`)
        continue
      }

      await prisma.rolePermission.create({
        data: {
          roleId: role.id,
          permissionId: shiftClosePermission.id,
        },
      })

      console.log(`✅ Added shift.close to role "${role.name}" (ID: ${role.id})`)
    }

    console.log('\n✅ Successfully added shift.close permission to all cashier roles!')
    console.log('\n📝 Note: Users need to log out and log back in for permissions to take effect.')
  } catch (error) {
    console.error('❌ Error adding shift.close permission:', error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

addShiftClosePermission()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
