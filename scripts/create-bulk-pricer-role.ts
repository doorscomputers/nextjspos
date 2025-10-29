import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('🔧 Creating Bulk Pricer role...\n')

  // Get the first business (or you can specify a specific businessId)
  const business = await prisma.business.findFirst()

  if (!business) {
    console.log('❌ No business found in database!')
    return
  }

  console.log(`✅ Found business: ${business.name} (ID: ${business.id})`)

  // Check if Bulk Pricer role already exists
  const existingRole = await prisma.role.findFirst({
    where: {
      businessId: business.id,
      name: 'Bulk Pricer'
    }
  })

  if (existingRole) {
    console.log('⚠️  Bulk Pricer role already exists!')
    console.log(`   Role ID: ${existingRole.id}`)
    console.log('   Updating permissions...\n')
  }

  // Define required permissions for Bulk Pricer
  const requiredPermissionNames = [
    'dashboard.view',
    'product.view',
    'product.price.edit',
    'product.price.edit_all',
    'product.price.bulk_edit',
    'product.price.bulk_apply_advanced',
    'product.price.multi_location_update',
    'product.price.export',
    'product.view_purchase_price',      // Can see cost prices (needed for markup/margin)
    'product.view_profit_margin',        // Can see profit margins
    'access_all_locations',              // Can access all business locations (needed to see all locations)
  ]

  console.log('📝 Required permissions:')
  requiredPermissionNames.forEach(p => console.log(`   • ${p}`))
  console.log()

  // Find or create each permission
  const permissionIds: number[] = []
  for (const permName of requiredPermissionNames) {
    let permission = await prisma.permission.findUnique({
      where: { name: permName }
    })

    if (!permission) {
      console.log(`   Creating permission: ${permName}`)
      permission = await prisma.permission.create({
        data: {
          name: permName
        }
      })
    }

    permissionIds.push(permission.id)
  }

  // Create or update the Bulk Pricer role
  const role = existingRole || await prisma.role.create({
    data: {
      name: 'Bulk Pricer',
      description: 'Can bulk edit product prices across multiple locations',
      businessId: business.id,
      isActive: true
    }
  })

  console.log(`\n✅ Role created/found: ${role.name} (ID: ${role.id})`)

  // Clear existing permissions and add new ones
  if (existingRole) {
    await prisma.rolePermission.deleteMany({
      where: { roleId: role.id }
    })
    console.log('   Cleared existing permissions')
  }

  // Add all permissions to the role
  for (const permissionId of permissionIds) {
    await prisma.rolePermission.create({
      data: {
        roleId: role.id,
        permissionId: permissionId
      }
    })
  }

  console.log(`   Added ${permissionIds.length} permissions to role`)

  // Show final role details
  const finalRole = await prisma.role.findUnique({
    where: { id: role.id },
    include: {
      permissions: {
        include: {
          permission: true
        }
      }
    }
  })

  console.log(`\n📋 Final Bulk Pricer role permissions:`)
  finalRole?.permissions.forEach(rp => {
    console.log(`   ✓ ${rp.permission.name}`)
  })

  console.log('\n✨ Bulk Pricer role is ready!')
  console.log(`\n📌 To assign this role to a user:`)
  console.log(`   1. Go to Users management`)
  console.log(`   2. Edit the user`)
  console.log(`   3. Assign "Bulk Pricer" role`)
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
