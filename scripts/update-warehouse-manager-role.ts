import { PrismaClient } from '@prisma/client'
import { ROLE_DEFINITIONS } from './role-definitions'

const prisma = new PrismaClient()

async function updateWarehouseManagerRole() {
  console.log('🔧 Updating Warehouse Manager Role...\n')

  const roleDefinition = ROLE_DEFINITIONS.WAREHOUSE_MANAGER

  try {
    const businesses = await prisma.business.findMany()

    for (const business of businesses) {
      console.log(`📋 Processing business: ${business.name}`)

      // Get or create Warehouse Manager role
      let role = await prisma.role.findFirst({
        where: {
          businessId: business.id,
          name: roleDefinition.name
        }
      })

      if (!role) {
        role = await prisma.role.create({
          data: {
            name: roleDefinition.name,
            businessId: business.id,
            guardName: 'web',
            isDefault: false
          }
        })
        console.log(`   ✅ Role created (ID: ${role.id})`)
      } else {
        console.log(`   ℹ️  Role exists (ID: ${role.id})`)
      }

      // Clear all existing permissions
      await prisma.rolePermission.deleteMany({
        where: { roleId: role.id }
      })
      console.log('   🗑️  Cleared existing permissions')

      // Add permissions from definition
      let addedCount = 0
      for (const permissionName of roleDefinition.permissions) {
        const permission = await prisma.permission.findFirst({
          where: { name: permissionName }
        })

        if (permission) {
          try {
            await prisma.rolePermission.create({
              data: {
                roleId: role.id,
                permissionId: permission.id
              }
            })
            addedCount++
          } catch (e) {
            // Ignore duplicate errors
          }
        } else {
          console.log(`   ⚠️  Permission not found: ${permissionName}`)
        }
      }

      console.log(`   ✅ Added ${addedCount} permissions`)
      console.log()
    }

    console.log('🎉 Warehouse Manager role updated!')
    console.log()
    console.log('═══════════════════════════════════════════════════════')
    console.log(`📋 Warehouse Manager`)
    console.log('═══════════════════════════════════════════════════════')
    console.log()
    console.log(`Description: ${roleDefinition.description}`)
    console.log(`Permissions: ${roleDefinition.permissions.length}`)
    console.log()
    console.log('✅ CAN DO:')
    console.log('   - View/Create/Edit/Delete Products')
    console.log('   - View/Create/Edit/Delete Categories, Brands, Units')
    console.log('   - View/Create/Edit/Delete Suppliers')
    console.log('   - View/Create/Approve/Edit Purchases')
    console.log('   - View/Create/Approve/Send/Receive Transfers')
    console.log('   - View Stock Levels')
    console.log('   - View Reports (Purchase & Transfer related)')
    console.log('   - Edit Product Prices')
    console.log()

  } catch (error) {
    console.error('❌ Error:', error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

updateWarehouseManagerRole()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
