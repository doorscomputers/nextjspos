const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function checkCompletePermission() {
  try {
    // Get the mainmgr user
    const user = await prisma.user.findUnique({
      where: { username: 'mainmgr' },
      include: {
        roles: {
          include: {
            role: {
              include: {
                permissions: {
                  include: {
                    permission: true
                  }
                }
              }
            }
          }
        },
        permissions: {
          include: {
            permission: true
          }
        }
      }
    })

    if (!user) {
      console.log('❌ User "mainmgr" not found')
      return
    }

    console.log('\n👤 User:', user.username)
    console.log('📧 Email:', user.email)
    console.log('🏢 Business ID:', user.businessId)

    // Get all permissions from roles
    const rolePermissions = new Set()
    user.roles.forEach(userRole => {
      console.log('\n📋 Role:', userRole.role.name)
      userRole.role.permissions.forEach(rp => {
        rolePermissions.add(rp.permission.name)
      })
    })

    // Get direct permissions
    const directPermissions = new Set()
    user.permissions.forEach(up => {
      directPermissions.add(up.permission.name)
    })

    // Combine all permissions
    const allPermissions = new Set([...rolePermissions, ...directPermissions])

    console.log('\n✅ ALL PERMISSIONS (' + allPermissions.size + '):')
    const permissionsArray = Array.from(allPermissions).sort()
    permissionsArray.forEach(p => {
      console.log('  • ' + p)
    })

    // Check for the specific permission
    const hasCompletePermission = allPermissions.has('STOCK_TRANSFER_COMPLETE')
    console.log('\n🔍 Has STOCK_TRANSFER_COMPLETE permission?', hasCompletePermission ? '✅ YES' : '❌ NO')

    if (!hasCompletePermission) {
      console.log('\n⚠️ PROBLEM FOUND: User does not have STOCK_TRANSFER_COMPLETE permission!')
      console.log('   This is why the "Complete Transfer" button is not showing.')
      console.log('\n💡 SOLUTION: Need to add STOCK_TRANSFER_COMPLETE permission to user\'s role or directly to user.')
    }

    await prisma.$disconnect()
  } catch (error) {
    console.error('❌ Error:', error.message)
    await prisma.$disconnect()
    process.exit(1)
  }
}

checkCompletePermission()
