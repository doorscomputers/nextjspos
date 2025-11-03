import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function fixUserPermissions() {
  console.log('🔧 User Permission Management Tool\n')
  console.log('═══════════════════════════════════════════════════════\n')

  try {
    // Get all users with their roles
    const users = await prisma.user.findMany({
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
        },
        business: true
      },
      orderBy: [
        { businessId: 'asc' },
        { username: 'asc' }
      ]
    })

    console.log(`📊 Total Users: ${users.length}\n`)

    let currentBusinessId: number | null = null

    for (const user of users) {
      // Print business header when it changes
      if (user.businessId !== currentBusinessId) {
        currentBusinessId = user.businessId
        console.log('\n═══════════════════════════════════════════════════════')
        console.log(`🏢 Business: ${user.business.name}`)
        console.log('═══════════════════════════════════════════════════════\n')
      }

      // User header
      console.log(`👤 User: ${user.username} (${user.firstName} ${user.lastName})`)
      console.log(`   Email: ${user.email || 'N/A'}`)
      console.log(`   Status: ${user.status}`)

      // Get role-based permissions
      const rolePermissions = new Map<number, string>()
      const roles: string[] = []

      user.roles.forEach(ur => {
        roles.push(ur.role.name)
        ur.role.permissions.forEach(rp => {
          rolePermissions.set(rp.permission.id, rp.permission.name)
        })
      })

      // Get direct permissions
      const directPermissions = new Map<number, string>()
      user.permissions.forEach(up => {
        directPermissions.set(up.permission.id, up.permission.name)
      })

      console.log(`   Roles: ${roles.length > 0 ? roles.join(', ') : 'NONE ⚠️'}`)
      console.log(`   Role Permissions: ${rolePermissions.size}`)
      console.log(`   Direct Permissions: ${directPermissions.size}`)
      console.log(`   Total Effective Permissions: ${new Set([...rolePermissions.values(), ...directPermissions.values()]).size}`)

      // Check for issues
      const issues: string[] = []

      if (roles.length === 0) {
        issues.push('⚠️  NO ROLE ASSIGNED')
      }

      if (rolePermissions.size === 0 && roles.length > 0) {
        issues.push('⚠️  ROLE HAS NO PERMISSIONS')
      }

      if (directPermissions.size === 0 && rolePermissions.size === 0) {
        issues.push('🚫 NO PERMISSIONS AT ALL')
      }

      if (issues.length > 0) {
        console.log(`   Issues: ${issues.join(', ')}`)
      } else {
        console.log(`   ✅ Permissions OK`)
      }

      console.log()
    }

    console.log('\n═══════════════════════════════════════════════════════')
    console.log('📝 RECOMMENDATIONS')
    console.log('═══════════════════════════════════════════════════════\n')

    console.log('To fix specific users, run one of these scripts:')
    console.log('')
    console.log('1. Sync all users with their role permissions:')
    console.log('   npx tsx scripts/sync-user-role-permissions.ts')
    console.log('')
    console.log('2. Assign a role to a specific user:')
    console.log('   npx tsx scripts/assign-user-role.ts <username> <rolename>')
    console.log('')
    console.log('3. Fix Super Admin permissions (already done):')
    console.log('   npx tsx scripts/fix-super-admin-permissions.ts')
    console.log('')

  } catch (error) {
    console.error('❌ Error:', error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

fixUserPermissions()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
