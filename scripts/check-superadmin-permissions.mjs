import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function checkSuperAdminPermissions() {
  try {
    const user = await prisma.user.findUnique({
      where: { username: 'superadmin' },
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
      console.log('Super Admin user not found')
      return
    }

    console.log('\n=== Super Admin User Details ===')
    console.log('ID:', user.id)
    console.log('Username:', user.username)
    console.log('Business ID:', user.businessId)
    console.log('\nRoles:', user.roles.map(r => r.role.name))

    const rolePermissions = user.roles.flatMap(r => r.role.permissions.map(p => p.permission.name))
    const directPermissions = user.permissions.map(p => p.permission.name)
    const allPermissions = [...new Set([...rolePermissions, ...directPermissions])]

    console.log('\nTotal Permissions:', allPermissions.length)
    console.log('\nHas PRODUCT_OPENING_STOCK:', allPermissions.includes('product.opening_stock'))
    console.log('Has PRODUCT_CREATE:', allPermissions.includes('product.create'))
    console.log('Has PRODUCT_VIEW:', allPermissions.includes('product.view'))
    console.log('Has PRODUCT_UPDATE:', allPermissions.includes('product.update'))

    console.log('\nAll Permissions:')
    allPermissions.sort().forEach(p => console.log('  -', p))

  } catch (error) {
    console.error('Error:', error)
  } finally {
    await prisma.$disconnect()
  }
}

checkSuperAdminPermissions()
