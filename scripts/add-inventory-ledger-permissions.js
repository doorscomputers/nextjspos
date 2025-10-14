/**
 * Add Inventory Ledger Permissions to Existing Roles
 *
 * This script adds the new inventory ledger permissions to existing roles:
 * - Branch Admin: INVENTORY_LEDGER_VIEW, INVENTORY_LEDGER_EXPORT
 * - Branch Manager: INVENTORY_LEDGER_VIEW
 * - Accounting Staff: INVENTORY_LEDGER_VIEW, INVENTORY_LEDGER_EXPORT
 *
 * Run with: node scripts/add-inventory-ledger-permissions.js
 */

const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

const NEW_PERMISSIONS = [
  {
    name: 'inventory_ledger.view',
    guardName: 'web'
  },
  {
    name: 'inventory_ledger.export',
    guardName: 'web'
  }
]

const ROLE_PERMISSIONS = {
  'Super Admin': ['inventory_ledger.view', 'inventory_ledger.export'],
  'Branch Admin': ['inventory_ledger.view', 'inventory_ledger.export'],
  'Branch Manager': ['inventory_ledger.view'],
  'Accounting Staff': ['inventory_ledger.view', 'inventory_ledger.export']
}

async function main() {
  console.log('Starting inventory ledger permissions migration...\n')

  try {
    // Step 1: Create or update permissions
    console.log('Step 1: Creating/updating permissions...')
    for (const perm of NEW_PERMISSIONS) {
      const permission = await prisma.permission.upsert({
        where: { name: perm.name },
        update: {
          guardName: perm.guardName
        },
        create: {
          name: perm.name,
          guardName: perm.guardName
        }
      })
      console.log(`  ✓ Permission: ${permission.name}`)
    }

    // Step 2: Get all businesses
    console.log('\nStep 2: Fetching businesses...')
    const businesses = await prisma.business.findMany({
      select: { id: true, name: true }
    })
    console.log(`  Found ${businesses.length} business(es)`)

    // Step 3: For each business, add permissions to roles
    console.log('\nStep 3: Adding permissions to roles...')
    for (const business of businesses) {
      console.log(`\n  Business: ${business.name} (ID: ${business.id})`)

      for (const [roleName, permissionNames] of Object.entries(ROLE_PERMISSIONS)) {
        // Find role
        const role = await prisma.role.findFirst({
          where: {
            businessId: business.id,
            name: roleName
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
          console.log(`    ⚠ Role "${roleName}" not found - skipping`)
          continue
        }

        // Get permissions to add
        const permissions = await prisma.permission.findMany({
          where: {
            name: { in: permissionNames }
          }
        })

        // Add permissions to role (skip if already exists)
        let addedCount = 0
        for (const permission of permissions) {
          // Check if already exists
          const existing = role.permissions.find(
            rp => rp.permissionId === permission.id
          )

          if (!existing) {
            await prisma.rolePermission.create({
              data: {
                roleId: role.id,
                permissionId: permission.id
              }
            })
            addedCount++
          }
        }

        if (addedCount > 0) {
          console.log(`    ✓ Added ${addedCount} permission(s) to "${roleName}"`)
        } else {
          console.log(`    - "${roleName}" already has these permissions`)
        }
      }
    }

    console.log('\n✅ Migration completed successfully!')
    console.log('\nSummary:')
    console.log(`  - Created/updated ${NEW_PERMISSIONS.length} permissions`)
    console.log(`  - Updated roles in ${businesses.length} business(es)`)
    console.log('\nInventory Ledger permissions have been added to:')
    console.log('  - Super Admin (view, export)')
    console.log('  - Branch Admin (view, export)')
    console.log('  - Branch Manager (view only)')
    console.log('  - Accounting Staff (view, export)')

  } catch (error) {
    console.error('\n❌ Error during migration:', error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

main()
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
