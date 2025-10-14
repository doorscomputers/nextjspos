const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function debugSessionPermissions() {
  try {
    // Get the mainmgr user with complete data
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
      console.log('❌ User not found')
      return
    }

    // Collect all permissions
    const allPermissions = []

    // From roles
    user.roles.forEach(userRole => {
      userRole.role.permissions.forEach(rp => {
        if (!allPermissions.includes(rp.permission.name)) {
          allPermissions.push(rp.permission.name)
        }
      })
    })

    // From direct permissions
    user.permissions.forEach(up => {
      if (!allPermissions.includes(up.permission.name)) {
        allPermissions.push(up.permission.name)
      }
    })

    console.log('\n📊 Session Data for mainmgr:')
    console.log('─────────────────────────────')
    console.log('ID:', user.id)
    console.log('Username:', user.username)
    console.log('Business ID:', user.businessId)
    console.log('\nPermissions Array (' + allPermissions.length + '):')
    console.log(JSON.stringify(allPermissions.sort(), null, 2))

    // Check specific permission
    const hasComplete = allPermissions.includes('stock_transfer.complete')
    console.log('\n✅ Has stock_transfer.complete:', hasComplete)

    // Check what the frontend sees
    console.log('\n🔍 Frontend Check:')
    console.log('PERMISSIONS.STOCK_TRANSFER_COMPLETE = "stock_transfer.complete"')
    console.log('can(PERMISSIONS.STOCK_TRANSFER_COMPLETE) =', hasComplete)
    console.log('transfer.status = "verified"')
    console.log('Should show button:', hasComplete && 'verified' === 'verified' ? '✅ YES' : '❌ NO')

    await prisma.$disconnect()
  } catch (error) {
    console.error('❌ Error:', error.message)
    await prisma.$disconnect()
    process.exit(1)
  }
}

debugSessionPermissions()
