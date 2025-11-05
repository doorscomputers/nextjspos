import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function enableStockHistoryV3() {
  console.log('🔧 Enabling Stock History V3 (Admin) Access...\n')

  try {
    // Step 1: Check if the permission exists
    const permissionName = 'report.stock.history_v3.view'
    let permission = await prisma.permission.findFirst({
      where: { name: permissionName },
    })

    if (!permission) {
      console.log(`⚠️  Permission "${permissionName}" does not exist. Creating it...\n`)
      permission = await prisma.permission.create({
        data: {
          name: permissionName,
          description: 'View Stock History V3 (Admin) - Advanced stock history for admins with all locations',
        },
      })
      console.log(`✅ Created permission: ${permission.name} (ID: ${permission.id})\n`)
    } else {
      console.log(`✅ Permission exists: ${permission.name} (ID: ${permission.id})\n`)
    }

    // Step 2: Find roles to add this permission to
    const rolesToUpdate = [
      'Super Admin',
      'Admin',
      
      'All Branch Admin', // This is the one user specifically wants
    ]

    console.log('📋 Adding permission to roles:\n')

    for (const roleName of rolesToUpdate) {
      const role = await prisma.role.findFirst({
        where: { name: roleName },
      })

      if (!role) {
        console.log(`   ⏭️  Role "${roleName}" not found - skipping`)
        continue
      }

      // Check if permission already assigned
      const existingRolePermission = await prisma.rolePermission.findUnique({
        where: {
          roleId_permissionId: {
            roleId: role.id,
            permissionId: permission.id,
          },
        },
      })

      if (existingRolePermission) {
        console.log(`   ⏭️  "${roleName}" already has this permission`)
      } else {
        await prisma.rolePermission.create({
          data: {
            roleId: role.id,
            permissionId: permission.id,
          },
        })
        console.log(`   ✅ Added permission to "${roleName}"`)
      }
    }

    // Step 3: Check/Create menu permission record
    console.log('\n📋 Checking Menu Permission Record...\n')

    const menuKey = 'stock_history_v3_admin'
    let menuPermission = await prisma.menuPermission.findFirst({
      where: { key: menuKey },
    })

    if (!menuPermission) {
      console.log(`⚠️  Menu permission "${menuKey}" does not exist. Creating it...\n`)

      // Find the Inventory Reports parent menu
      const inventoryReportsMenu = await prisma.menuPermission.findFirst({
        where: { key: 'inventory_reports' },
      })

      menuPermission = await prisma.menuPermission.create({
        data: {
          key: menuKey,
          name: 'Stock History V3 (Admin)',
          href: '/dashboard/reports/stock-history-v3',
          icon: 'ClipboardDocumentListIcon',
          parentId: inventoryReportsMenu?.id || null,
          order: 4,
        },
      })
      console.log(`✅ Created menu permission: ${menuPermission.name} (ID: ${menuPermission.id})\n`)
    } else {
      console.log(`✅ Menu permission exists: ${menuPermission.name} (ID: ${menuPermission.id})\n`)
    }

    // Step 4: Link menu permission to roles
    console.log('📋 Linking menu permission to roles:\n')

    for (const roleName of rolesToUpdate) {
      const role = await prisma.role.findFirst({
        where: { name: roleName },
      })

      if (!role) continue

      const existingLink = await prisma.roleMenuPermission.findUnique({
        where: {
          roleId_menuPermissionId: {
            roleId: role.id,
            menuPermissionId: menuPermission.id,
          },
        },
      })

      if (existingLink) {
        console.log(`   ⏭️  Menu already linked to "${roleName}"`)
      } else {
        await prisma.roleMenuPermission.create({
          data: {
            roleId: role.id,
            menuPermissionId: menuPermission.id,
          },
        })
        console.log(`   ✅ Linked menu to "${roleName}"`)
      }
    }

    // Step 5: Summary
    console.log('\n✅ Stock History V3 Setup Complete!\n')
    console.log('📊 Summary:')
    console.log(`   ✅ RBAC Permission: ${permission.name}`)
    console.log(`   ✅ Menu Permission: ${menuPermission.name}`)
    console.log(`   ✅ Roles with access: ${rolesToUpdate.join(', ')}`)
    console.log()
    console.log('📝 Next Steps:')
    console.log('   1. Users with these roles must LOGOUT and LOGIN again')
    console.log('   2. Stock History V3 (Admin) will appear under Reports → Inventory Reports')
    console.log('   3. Page URL: /dashboard/reports/stock-history-v3')
    console.log()
    console.log('⚠️  Optional: To enable for Warehouse Manager:')
    console.log('   - Modify rolesToUpdate array in this script to include "Warehouse Manager"')
    console.log('   - Run this script again\n')

    await prisma.$disconnect()
  } catch (error) {
    console.error('❌ Error:', error)
    throw error
  }
}

enableStockHistoryV3()
  .then(() => {
    console.log('✅ Script completed successfully!')
    process.exit(0)
  })
  .catch((error) => {
    console.error('❌ Script failed:', error)
    process.exit(1)
  })
