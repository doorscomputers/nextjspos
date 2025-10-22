import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function verifyWarehousePermissions() {
  try {
    console.log('🔍 Verifying warehouse manager setup...\n')

    // Find the warehouse manager user
    const user = await prisma.user.findFirst({
      where: {
        username: 'warehouse_manager',
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

    if (!user) {
      console.log('❌ warehouse_manager user not found!')
      return
    }

    console.log(`✅ Found user: ${user.username} (ID: ${user.id})`)
    console.log(`   Business ID: ${user.businessId}`)
    console.log(`   Roles: ${user.roles.map(ur => ur.role.name).join(', ')}`)

    // Collect all permissions from roles and direct permissions
    const allPermissions = new Set()

    // From roles
    user.roles.forEach(ur => {
      ur.role.permissions.forEach(rp => {
        allPermissions.add(rp.permission.name)
      })
    })

    // Direct permissions
    user.permissions.forEach(up => {
      allPermissions.add(up.permission.name)
    })

    console.log(`\n📋 Total permissions: ${allPermissions.size}`)

    const hasAccessAll = allPermissions.has('access_all_locations')
    const hasPurchaseReturnView = allPermissions.has('purchase_return.view')

    console.log(`   ✓ access_all_locations: ${hasAccessAll ? '✅' : '❌'}`)
    console.log(`   ✓ purchase_return.view: ${hasPurchaseReturnView ? '✅' : '❌'}`)

    if (!hasPurchaseReturnView) {
      console.log('\n⚠️  MISSING purchase_return.view permission!')
      console.log('   User will get 403 Forbidden error.')
    }

    // Check if there are any purchase returns in the database
    const returns = await prisma.purchaseReturn.findMany({
      where: {
        businessId: user.businessId,
      },
    })

    console.log(`\n📦 Purchase returns in database: ${returns.length}`)
    if (returns.length > 0) {
      console.log('   Sample returns:')
      returns.slice(0, 5).forEach(r => {
        console.log(`   - ID: ${r.id}, Status: ${r.status}, Total: ${r.totalAmount}`)
      })
    }

  } catch (error) {
    console.error('❌ Error:', error)
  } finally {
    await prisma.$disconnect()
  }
}

verifyWarehousePermissions()
