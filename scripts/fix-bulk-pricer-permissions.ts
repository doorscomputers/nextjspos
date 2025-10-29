import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('🔍 Checking Bulk Pricer role...\n')

  // Find all roles
  const allRoles = await prisma.role.findMany({
    include: {
      permissions: {
        include: {
          permission: true
        }
      }
    }
  })

  console.log('📋 All roles in database:')
  allRoles.forEach(role => {
    console.log(`  - ${role.name} (ID: ${role.id})`)
    console.log(`    Permissions (${role.permissions.length}):`)
    role.permissions.forEach(rp => {
      console.log(`      • ${rp.permission.name}`)
    })
    console.log()
  })

  // Find Bulk Pricer role
  const bulkPricerRole = allRoles.find(r =>
    r.name.toLowerCase().includes('bulk') && r.name.toLowerCase().includes('pricer')
  )

  if (!bulkPricerRole) {
    console.log('❌ Bulk Pricer role not found!')
    console.log('   Available roles:', allRoles.map(r => r.name).join(', '))
    return
  }

  console.log(`\n✅ Found Bulk Pricer role: "${bulkPricerRole.name}" (ID: ${bulkPricerRole.id})`)

  // Check if it has the required permissions
  const currentPermissions = bulkPricerRole.permissions.map(rp => rp.permission.name)

  const requiredPermissions = [
    'product.price.edit',
    'product.price.edit_all',
    'product.price.bulk_edit',
    'product.price.bulk_apply_advanced',
    'product.price.multi_location_update',
    'product.view',
    'dashboard.view'
  ]

  const missingPermissions = requiredPermissions.filter(p => !currentPermissions.includes(p))

  if (missingPermissions.length === 0) {
    console.log('\n✅ Bulk Pricer role already has all required permissions!')
    return
  }

  console.log(`\n⚠️  Missing ${missingPermissions.length} permissions:`)
  missingPermissions.forEach(p => console.log(`   • ${p}`))

  console.log('\n🔧 Adding missing permissions...')

  // Find or create missing permissions and add them to the role
  for (const permName of missingPermissions) {
    let permission = await prisma.permission.findUnique({
      where: { name: permName }
    })

    if (!permission) {
      console.log(`   Creating permission: ${permName}`)
      permission = await prisma.permission.create({
        data: {
          name: permName,
          description: `Permission for ${permName}`
        }
      })
    }

    // Add permission to role
    const existing = await prisma.rolePermission.findUnique({
      where: {
        roleId_permissionId: {
          roleId: bulkPricerRole.id,
          permissionId: permission.id
        }
      }
    })

    if (!existing) {
      await prisma.rolePermission.create({
        data: {
          roleId: bulkPricerRole.id,
          permissionId: permission.id
        }
      })
      console.log(`   ✅ Added: ${permName}`)
    }
  }

  console.log('\n✨ Bulk Pricer role permissions updated successfully!')

  // Show final permissions
  const updatedRole = await prisma.role.findUnique({
    where: { id: bulkPricerRole.id },
    include: {
      permissions: {
        include: {
          permission: true
        }
      }
    }
  })

  console.log(`\n📋 Final permissions for "${bulkPricerRole.name}":`)
  updatedRole?.permissions.forEach(rp => {
    console.log(`   • ${rp.permission.name}`)
  })
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
