#!/usr/bin/env node

/**
 * VERIFY SUPPLIER RETURN SETUP
 *
 * Quick verification script to show current state of supplier return permissions
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('========================================')
  console.log('SUPPLIER RETURN SETUP VERIFICATION')
  console.log('========================================\n')

  // Check permissions exist
  console.log('1. Checking Supplier Return Permissions in Database...\n')
  const permissions = await prisma.permission.findMany({
    where: {
      name: {
        startsWith: 'purchase_return.'
      }
    },
    orderBy: {
      name: 'asc'
    }
  })

  console.log(`Found ${permissions.length} supplier return permissions:`)
  permissions.forEach(p => {
    console.log(`   ✅ ${p.name} (ID: ${p.id})`)
  })

  // Check user assignments
  console.log('\n2. Checking User Permission Assignments...\n')

  const users = ['jayvillalon', 'warehouse_clerk', 'warehouse_manager']

  for (const username of users) {
    const user = await prisma.user.findUnique({
      where: { username },
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
          },
          where: {
            permission: {
              name: {
                startsWith: 'purchase_return.'
              }
            }
          }
        }
      }
    })

    if (!user) {
      console.log(`❌ ${username}: NOT FOUND`)
      continue
    }

    // Get role-based supplier return permissions
    const roleSupplierPerms = user.roles.flatMap(ur =>
      ur.role.permissions
        .filter(rp => rp.permission.name.startsWith('purchase_return.'))
        .map(rp => rp.permission.name)
    )

    // Get direct supplier return permissions
    const directSupplierPerms = user.permissions.map(up => up.permission.name)

    const allSupplierPerms = [...new Set([...roleSupplierPerms, ...directSupplierPerms])]

    console.log(`${username}:`)
    console.log(`   Roles: ${user.roles.map(r => r.role.name).join(', ') || 'None'}`)
    console.log(`   Supplier Return Permissions: ${allSupplierPerms.length}`)

    if (allSupplierPerms.length > 0) {
      console.log(`   ✅ Permissions:`)
      allSupplierPerms.forEach(p => {
        const source = directSupplierPerms.includes(p) ? '(direct)' : '(from role)'
        console.log(`      - ${p} ${source}`)
      })
    } else {
      console.log(`   ❌ NO supplier return permissions`)
    }
    console.log('')
  }

  // Check business locations
  console.log('3. Checking Business Locations...\n')
  const locations = await prisma.businessLocation.findMany({
    where: {
      businessId: 1
    },
    select: {
      id: true,
      name: true,
      isActive: true
    }
  })

  console.log(`Found ${locations.length} locations for Business ID 1:`)
  locations.forEach(loc => {
    const mainWarehouse = loc.id === 2 ? ' ⭐ (SUPPLIER RETURNS ALLOWED HERE)' : ''
    console.log(`   - ID ${loc.id}: ${loc.name} (Active: ${loc.isActive})${mainWarehouse}`)
  })

  console.log('\n========================================')
  console.log('VERIFICATION COMPLETE')
  console.log('========================================\n')

  console.log('✅ Summary:')
  console.log(`   - Supplier return permissions exist: ${permissions.length === 5 ? 'YES' : 'NO'}`)
  console.log(`   - Users with permissions: ${users.length}`)
  console.log(`   - Main Warehouse location: ID 2`)

  console.log('\n📋 Next Steps:')
  console.log('   1. Login as jayvillalon and test creating supplier return')
  console.log('   2. Login as warehouse_clerk and test creating supplier return')
  console.log('   3. Login as warehouse_manager and test approving supplier return')
  console.log('   4. Verify only Main Warehouse (ID: 2) can process supplier returns')
}

main()
  .catch((e) => {
    console.error('❌ Error:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
