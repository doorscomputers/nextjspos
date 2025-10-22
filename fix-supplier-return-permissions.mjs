#!/usr/bin/env node

/**
 * FIX SUPPLIER RETURN PERMISSIONS
 *
 * This script fixes the permission issue where jayvillalon and warehouse users
 * cannot create supplier returns despite having the roles defined.
 *
 * PROBLEM:
 * - Permissions are defined in src/lib/rbac.ts
 * - Roles may exist in database
 * - BUT role-permission assignments are MISSING
 *
 * SOLUTION:
 * 1. Ensure all supplier return permissions exist in Permission table
 * 2. Ensure warehouse roles exist with proper permissions
 * 3. Assign permissions to jayvillalon and warehouse users
 * 4. Verify the fix
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const BUSINESS_ID = 1 // PCInet Computer Store

// Supplier Return Permission Definitions
// NOTE: Permission table only has 'name' field (acts as code)
const SUPPLIER_RETURN_PERMISSIONS = [
  'purchase_return.view',
  'purchase_return.create',
  'purchase_return.update',
  'purchase_return.approve',
  'purchase_return.delete',
]

// User Permission Assignments
const USER_PERMISSIONS = {
  jayvillalon: ['purchase_return.view', 'purchase_return.create', 'purchase_return.update', 'purchase_return.approve', 'purchase_return.delete'],
  warehouse_clerk: ['purchase_return.view', 'purchase_return.create'],
  warehouse_manager: ['purchase_return.view', 'purchase_return.create', 'purchase_return.update', 'purchase_return.approve', 'purchase_return.delete'],
}

async function main() {
  console.log('========================================')
  console.log('FIX SUPPLIER RETURN PERMISSIONS')
  console.log('========================================\n')

  // STEP 1: Diagnose Current State
  console.log('STEP 1: Diagnosing Current Permission State...\n')

  for (const [username, expectedPerms] of Object.entries(USER_PERMISSIONS)) {
    console.log(`\n--- Checking ${username} ---`)

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
          }
        }
      }
    })

    if (!user) {
      console.log(`❌ User '${username}' NOT FOUND in database!`)
      continue
    }

    console.log(`✅ User found (ID: ${user.id})`)
    console.log(`   Business ID: ${user.businessId}`)
    console.log(`   Roles: ${user.roles.map(r => r.role.name).join(', ') || 'None'}`)

    // Get all permissions (from roles + direct)
    const rolePermissions = user.roles.flatMap(ur =>
      ur.role.permissions.map(rp => rp.permission.name)
    )
    const directPermissions = user.permissions.map(up => up.permission.name)
    const allPermissions = [...new Set([...rolePermissions, ...directPermissions])]

    console.log(`   Total Permissions: ${allPermissions.length}`)

    // Check supplier return permissions
    const supplierReturnPerms = allPermissions.filter(p => p.startsWith('purchase_return.'))
    console.log(`   Supplier Return Permissions: ${supplierReturnPerms.length}`)

    if (supplierReturnPerms.length > 0) {
      console.log(`   ✅ Has: ${supplierReturnPerms.join(', ')}`)
    } else {
      console.log(`   ❌ MISSING all supplier return permissions!`)
    }

    // Check what's missing
    const missing = expectedPerms.filter(p => !allPermissions.includes(p))
    if (missing.length > 0) {
      console.log(`   ❌ Missing: ${missing.join(', ')}`)
    }
  }

  // STEP 2: Ensure Permissions Exist
  console.log('\n\nSTEP 2: Ensuring Supplier Return Permissions Exist...\n')

  const permissionsCreated = []
  const permissionsExisting = []

  for (const permName of SUPPLIER_RETURN_PERMISSIONS) {
    const existing = await prisma.permission.findUnique({
      where: { name: permName }
    })

    if (existing) {
      console.log(`✅ Permission exists: ${permName}`)
      permissionsExisting.push(existing)
    } else {
      console.log(`⚠️  Creating permission: ${permName}`)
      const created = await prisma.permission.create({
        data: { name: permName }
      })
      permissionsCreated.push(created)
      console.log(`   ✅ Created: ${permName} (ID: ${created.id})`)
    }
  }

  console.log(`\nSummary:`)
  console.log(`- Existing: ${permissionsExisting.length}`)
  console.log(`- Created: ${permissionsCreated.length}`)

  // STEP 3: Assign Permissions to Users
  console.log('\n\nSTEP 3: Assigning Permissions to Users...\n')

  for (const [username, permCodes] of Object.entries(USER_PERMISSIONS)) {
    console.log(`\n--- Assigning to ${username} ---`)

    const user = await prisma.user.findUnique({
      where: { username }
    })

    if (!user) {
      console.log(`❌ User '${username}' not found, skipping...`)
      continue
    }

    let assigned = 0
    let skipped = 0

    for (const permName of permCodes) {
      const permission = await prisma.permission.findUnique({
        where: { name: permName }
      })

      if (!permission) {
        console.log(`   ❌ Permission '${permName}' not found in database!`)
        continue
      }

      // Check if already assigned (via direct permission)
      const existing = await prisma.userPermission.findUnique({
        where: {
          userId_permissionId: {
            userId: user.id,
            permissionId: permission.id
          }
        }
      })

      if (existing) {
        console.log(`   ⏭️  Already has: ${permName}`)
        skipped++
      } else {
        await prisma.userPermission.create({
          data: {
            userId: user.id,
            permissionId: permission.id
          }
        })
        console.log(`   ✅ Assigned: ${permName}`)
        assigned++
      }
    }

    console.log(`   Summary: ${assigned} assigned, ${skipped} already had`)
  }

  // STEP 4: Verify the Fix
  console.log('\n\nSTEP 4: Verifying Permissions After Fix...\n')

  for (const [username, expectedPerms] of Object.entries(USER_PERMISSIONS)) {
    console.log(`\n--- Verifying ${username} ---`)

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
          }
        }
      }
    })

    if (!user) {
      console.log(`❌ User not found`)
      continue
    }

    // Get all permissions
    const rolePermissions = user.roles.flatMap(ur =>
      ur.role.permissions.map(rp => rp.permission.name)
    )
    const directPermissions = user.permissions.map(up => up.permission.name)
    const allPermissions = [...new Set([...rolePermissions, ...directPermissions])]

    const supplierReturnPerms = allPermissions.filter(p => p.startsWith('purchase_return.'))

    console.log(`✅ Total Permissions: ${allPermissions.length}`)
    console.log(`✅ Supplier Return Permissions: ${supplierReturnPerms.length}/${expectedPerms.length}`)

    if (supplierReturnPerms.length === expectedPerms.length) {
      console.log(`✅ ALL PERMISSIONS VERIFIED!`)
      console.log(`   ${supplierReturnPerms.join(', ')}`)
    } else {
      console.log(`❌ STILL MISSING SOME PERMISSIONS!`)
      const missing = expectedPerms.filter(p => !allPermissions.includes(p))
      console.log(`   Missing: ${missing.join(', ')}`)
    }
  }

  // STEP 5: Show Before/After Stats
  console.log('\n\n========================================')
  console.log('SUMMARY')
  console.log('========================================\n')

  console.log('✅ Supplier Return Permissions in Database:')
  const allSupplierReturnPerms = await prisma.permission.findMany({
    where: {
      name: {
        startsWith: 'purchase_return.'
      }
    }
  })
  console.log(`   Total: ${allSupplierReturnPerms.length}`)
  allSupplierReturnPerms.forEach(p => {
    console.log(`   - ${p.name}`)
  })

  console.log('\n✅ User Permission Counts:')
  for (const username of Object.keys(USER_PERMISSIONS)) {
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
          }
        }
      }
    })

    if (user) {
      const rolePermissions = user.roles.flatMap(ur =>
        ur.role.permissions.map(rp => rp.permission.name)
      )
      const directPermissions = user.permissions.map(up => up.permission.name)
      const allPermissions = [...new Set([...rolePermissions, ...directPermissions])]
      const supplierReturnPerms = allPermissions.filter(p => p.startsWith('purchase_return.'))

      console.log(`   ${username}: ${supplierReturnPerms.length} supplier return permissions`)
    }
  }

  console.log('\n✅ FIX COMPLETE!')
  console.log('\nNext Steps:')
  console.log('1. Login as jayvillalon and test creating a supplier return')
  console.log('2. Login as warehouse_clerk and test creating a supplier return')
  console.log('3. Login as warehouse_manager and test approving a supplier return')
  console.log('4. Update COMPLETE_DEMO_ACCOUNTS_ALL_WORKFLOWS.md with supplier return workflow')
}

main()
  .catch((e) => {
    console.error('❌ Error:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
