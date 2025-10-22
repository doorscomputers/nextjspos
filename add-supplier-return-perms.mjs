import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function addSupplierReturnPermissions() {
  try {
    console.log('🔧 Adding supplier return permissions to warehouse roles...\n')

    // Find all warehouse-related roles
    const warehouseRoles = await prisma.role.findMany({
      where: {
        OR: [
          { name: { contains: 'Warehouse', mode: 'insensitive' } },
          { name: { contains: 'Transfer', mode: 'insensitive' } },
          { name: { contains: 'GRN', mode: 'insensitive' } },
          { name: { contains: 'Purchase', mode: 'insensitive' } },
        ],
      },
    })

    console.log(`Found ${warehouseRoles.length} warehouse-related roles\n`)

    // Find the permissions
    const supplierReturnView = await prisma.permission.findUnique({
      where: { name: 'supplier_return.view' },
    })

    const supplierReturnCreate = await prisma.permission.findUnique({
      where: { name: 'supplier_return.create' },
    })

    if (!supplierReturnView || !supplierReturnCreate) {
      console.log('❌ Supplier return permissions not found in database!')
      return
    }

    console.log('✅ Found permissions:')
    console.log(`   - supplier_return.view (ID: ${supplierReturnView.id})`)
    console.log(`   - supplier_return.create (ID: ${supplierReturnCreate.id})\n`)

    let addedCount = 0

    for (const role of warehouseRoles) {
      // Check if permissions already exist
      const existingViewPerm = await prisma.rolePermission.findUnique({
        where: {
          roleId_permissionId: {
            roleId: role.id,
            permissionId: supplierReturnView.id,
          },
        },
      })

      const existingCreatePerm = await prisma.rolePermission.findUnique({
        where: {
          roleId_permissionId: {
            roleId: role.id,
            permissionId: supplierReturnCreate.id,
          },
        },
      })

      let added = false

      // Add view permission if missing
      if (!existingViewPerm) {
        await prisma.rolePermission.create({
          data: {
            roleId: role.id,
            permissionId: supplierReturnView.id,
          },
        })
        console.log(`✅ Added supplier_return.view to: ${role.name} (ID: ${role.id})`)
        added = true
      }

      // Add create permission if missing
      if (!existingCreatePerm) {
        await prisma.rolePermission.create({
          data: {
            roleId: role.id,
            permissionId: supplierReturnCreate.id,
          },
        })
        console.log(`✅ Added supplier_return.create to: ${role.name} (ID: ${role.id})`)
        added = true
      }

      if (added) {
        addedCount++
      } else {
        console.log(`⏭️  Skipped ${role.name} - already has permissions`)
      }
    }

    console.log(`\n🎉 Successfully updated ${addedCount} roles!`)
    console.log('\n⚠️  IMPORTANT: Users must log out and log back in for permissions to take effect!')

  } catch (error) {
    console.error('❌ Error:', error)
  } finally {
    await prisma.$disconnect()
  }
}

addSupplierReturnPermissions()
