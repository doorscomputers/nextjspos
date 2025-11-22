/**
 * Add SELL_VOID Permission to Sales Cashier Roles
 *
 * This script fixes the issue where SELL_VOID permission was added to the code
 * (rbac.ts line 1282) but not synced to existing database roles.
 *
 * What it does:
 * 1. Finds the 'sell.void' permission in database
 * 2. Finds all "Sales Cashier" roles across all businesses
 * 3. Adds the permission to each role (if not already present)
 * 4. Safe to run multiple times (idempotent)
 *
 * Usage:
 *   npx tsx scripts/add-sell-void-to-cashiers.ts
 *
 * After running:
 *   Users must logout and login again to refresh their session permissions
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function addSellVoidToCashiers() {
  console.log('🔄 Adding SELL_VOID permission to Sales Cashier roles...\n')

  try {
    // Step 1: Find SELL_VOID permission
    console.log('Step 1: Looking for sell.void permission...')
    const permission = await prisma.permission.findUnique({
      where: { name: 'sell.void' }
    })

    if (!permission) {
      console.error('❌ ERROR: Permission "sell.void" not found in database!')
      console.log('\nThis means the permission was not created during seed.')
      console.log('Run: npm run db:seed to create all permissions')
      return
    }

    console.log(`✅ Found permission: ${permission.name} (ID: ${permission.id})\n`)

    // Step 2: Find all Sales Cashier roles across all businesses
    console.log('Step 2: Finding Sales Cashier roles...')
    const cashierRoles = await prisma.role.findMany({
      where: { name: 'Sales Cashier' },
      include: {
        business: {
          select: {
            id: true,
            name: true
          }
        },
        permissions: {
          where: {
            permission: {
              name: 'sell.void'
            }
          }
        }
      }
    })

    if (cashierRoles.length === 0) {
      console.log('⚠️  No "Sales Cashier" roles found in database')
      console.log('This might mean roles have different names or haven\'t been seeded yet.')
      return
    }

    console.log(`📋 Found ${cashierRoles.length} Sales Cashier role(s)\n`)

    // Step 3: Add permission to each role
    let addedCount = 0
    let alreadyHadCount = 0

    for (const role of cashierRoles) {
      const businessName = role.business?.name || `Business #${role.businessId}`
      console.log(`Processing: ${role.name} for ${businessName}`)

      // Check if already has permission (via the include above)
      if (role.permissions.length > 0) {
        console.log(`  ✓ Already has sell.void permission\n`)
        alreadyHadCount++
        continue
      }

      // Add permission to role
      try {
        await prisma.rolePermission.create({
          data: {
            roleId: role.id,
            permissionId: permission.id
          }
        })

        console.log(`  ✅ Added sell.void permission to role\n`)
        addedCount++
      } catch (error: any) {
        if (error.code === 'P2002') {
          // Unique constraint violation - permission already exists
          console.log(`  ✓ Permission already exists (caught race condition)\n`)
          alreadyHadCount++
        } else {
          console.error(`  ❌ Error adding permission: ${error.message}\n`)
        }
      }
    }

    // Summary
    console.log('═'.repeat(60))
    console.log('📊 SUMMARY')
    console.log('═'.repeat(60))
    console.log(`Total Sales Cashier roles found: ${cashierRoles.length}`)
    console.log(`Permissions added: ${addedCount}`)
    console.log(`Already had permission: ${alreadyHadCount}`)
    console.log('═'.repeat(60))

    if (addedCount > 0) {
      console.log('\n✅ SUCCESS! Permissions updated.')
      console.log('\n⚠️  IMPORTANT: Users must LOGOUT and LOGIN again')
      console.log('   to refresh their session and get the new permission.')
      console.log('\n📋 Next steps:')
      console.log('   1. Logout from pcinet.shop')
      console.log('   2. Login again')
      console.log('   3. Go to Reports → Sales Today')
      console.log('   4. Check browser console: hasVoidPermission should be TRUE')
      console.log('   5. Verify Void button appears in Action column')
    } else {
      console.log('\n✅ All Sales Cashier roles already have the permission!')
    }

  } catch (error) {
    console.error('\n❌ Fatal error:', error)
    throw error
  }
}

// Run the script
addSellVoidToCashiers()
  .catch((error) => {
    console.error('Script failed:', error)
    process.exit(1)
  })
  .finally(() => {
    prisma.$disconnect()
  })
