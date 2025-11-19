import { PrismaClient } from '@prisma/client'
import { PERMISSIONS } from '../src/lib/rbac'

const prisma = new PrismaClient()

async function checkAllBranchAdminPermissions() {
  try {
    console.log('🔍 Checking "All Branch Admin" role permissions...\n')

    // Find the role
    const role = await prisma.role.findFirst({
      where: {
        name: 'All Branch Admin'
      },
      include: {
        permissions: {
          include: {
            permission: true
          }
        }
      }
    })

    if (!role) {
      console.error('❌ "All Branch Admin" role not found')
      return
    }

    console.log(`✅ Role found: ${role.name} (ID: ${role.id})`)
    console.log(`   Business ID: ${role.businessId}`)
    console.log(`   Is Default: ${role.isDefault}`)
    console.log(`   Total Permissions: ${role.permissions.length}\n`)

    // Check for ACCESS_ALL_LOCATIONS permission
    const hasAccessAllLocations = role.permissions.some(
      rp => rp.permission.name === PERMISSIONS.ACCESS_ALL_LOCATIONS
    )

    if (hasAccessAllLocations) {
      console.log('✅ HAS "ACCESS_ALL_LOCATIONS" permission')
    } else {
      console.log('❌ MISSING "ACCESS_ALL_LOCATIONS" permission')
      console.log('\n⚠️ This role needs ACCESS_ALL_LOCATIONS to see all business locations!')
    }

    // List all permissions
    console.log('\n📋 All Permissions assigned to "All Branch Admin":')
    console.log('─'.repeat(60))

    const permissionsByCategory: { [key: string]: string[] } = {}

    role.permissions.forEach(rp => {
      const permName = rp.permission.name
      const category = permName.split('.')[0] || 'OTHER'

      if (!permissionsByCategory[category]) {
        permissionsByCategory[category] = []
      }
      permissionsByCategory[category].push(permName)
    })

    Object.keys(permissionsByCategory).sort().forEach(category => {
      console.log(`\n${category}:`)
      permissionsByCategory[category].sort().forEach(perm => {
        console.log(`  • ${perm}`)
      })
    })

    console.log('\n─'.repeat(60))

  } catch (error) {
    console.error('❌ Error:', error)
  } finally {
    await prisma.$disconnect()
  }
}

checkAllBranchAdminPermissions()
