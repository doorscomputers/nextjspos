import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('\n=== CHECKING USER PERMISSIONS (Direct + Role-Based) ===\n')

  const users = await prisma.user.findMany({
    where: {
      allowLogin: true  // Only users allowed to login
    },
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
    },
    orderBy: {
      username: 'asc'
    }
  })

  console.log(`Found ${users.length} ACTIVE users\n`)

  users.forEach(user => {
    console.log(`USER: ${user.username} (${user.name || 'No name'})`)
    console.log(`   Roles: ${user.roles.map(ur => ur.role.name).join(', ') || 'NONE'}`)

    // Get permissions from roles
    const rolePermissions = new Set()
    user.roles.forEach(userRole => {
      if (userRole.role && userRole.role.permissions) {
        userRole.role.permissions.forEach(rp => {
          rolePermissions.add(rp.permission.name)
        })
      }
    })

    // Get direct permissions
    const directPermissions = user.permissions.map(up => up.permission.name)

    const totalPerms = rolePermissions.size + directPermissions.length
    console.log(`   Total Permissions: ${totalPerms}`)

    if (rolePermissions.size > 0) {
      const sample = Array.from(rolePermissions).slice(0, 3).join(', ')
      console.log(`   Role Perms (${rolePermissions.size}): ${sample}...`)
    }

    if (directPermissions.length > 0) {
      const sample = directPermissions.slice(0, 3).join(', ')
      console.log(`   Direct Perms (${directPermissions.length}): ${sample}...`)
    }

    // Check specific inventory permissions
    const hasInventoryCorr = Array.from(rolePermissions).some(p => p.includes('inventory_correction')) ||
                              directPermissions.some(p => p.includes('inventory_correction'))
    const hasPhysicalInv = Array.from(rolePermissions).some(p => p.includes('physical_inventory')) ||
                            directPermissions.some(p => p.includes('physical_inventory'))

    if (hasInventoryCorr || hasPhysicalInv) {
      console.log(`   🚨 HAS INVENTORY ACCESS:`)
      if (hasInventoryCorr) console.log(`      ✓ Inventory Corrections`)
      if (hasPhysicalInv) console.log(`      ✓ Physical Inventory`)
    }

    console.log('')
  })
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
