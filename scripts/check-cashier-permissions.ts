/**
 * DRY RUN: Check Cashier Permissions (NO DATABASE CHANGES)
 * This script only READS and SHOWS what would be changed
 * Safe to run - makes NO modifications
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function checkCashierPermissions() {
  try {
    console.log('🔍 CHECKING Cashier permissions (DRY RUN - NO CHANGES WILL BE MADE)\n')
    console.log('='.repeat(80))

    // Find all businesses
    const businesses = await prisma.business.findMany({
      select: { id: true, name: true },
    })

    console.log(`\n📊 Found ${businesses.length} business(es)\n`)

    let needsUpdate = false

    for (const business of businesses) {
      console.log(`\n📋 Business: ${business.name} (ID: ${business.id})`)
      console.log('-'.repeat(80))

      // Find Sales Cashier role for this business
      const cashierRole = await prisma.role.findFirst({
        where: {
          businessId: business.id,
          name: 'Sales Cashier',
        },
      })

      if (!cashierRole) {
        console.log(`  ⚠️ No 'Sales Cashier' role found`)
        continue
      }

      console.log(`  ✅ Found 'Sales Cashier' role (ID: ${cashierRole.id})`)

      // Get ALL current permissions for this role
      const allPermissions = await prisma.rolePermission.findMany({
        where: { roleId: cashierRole.id },
        select: { permission: true },
      })

      console.log(`  📝 Current permissions count: ${allPermissions.length}`)

      // Check if PAYMENT_COLLECT_AR permission exists
      const hasPermission = allPermissions.some(p => p.permission === 'payment.collect_ar')

      if (hasPermission) {
        console.log(`  ✅ PAYMENT_COLLECT_AR permission: EXISTS (no action needed)`)
      } else {
        console.log(`  ❌ PAYMENT_COLLECT_AR permission: MISSING`)
        console.log(`  🔧 ACTION NEEDED: Would add 'payment.collect_ar' permission`)
        needsUpdate = true
      }

      // Count users with this role
      const userRoles = await prisma.userRole.findMany({
        where: { roleId: cashierRole.id },
        include: {
          user: {
            select: {
              username: true,
              firstName: true,
              lastName: true,
            },
          },
        },
      })

      console.log(`  👥 Users with this role: ${userRoles.length}`)

      if (userRoles.length > 0) {
        console.log(`  📋 Affected users:`)
        userRoles.forEach(ur => {
          const name = `${ur.user.firstName || ''} ${ur.user.lastName || ''}`.trim() || ur.user.username
          console.log(`     - ${name} (${ur.user.username})`)
        })
      }
    }

    console.log('\n' + '='.repeat(80))

    if (needsUpdate) {
      console.log('\n⚠️ ACTION REQUIRED: Some cashier roles are missing PAYMENT_COLLECT_AR permission')
      console.log('\n📝 To apply the changes, run:')
      console.log('   npx tsx scripts/update-cashier-permissions.ts')
      console.log('\n💡 Or manually run this SQL:')
      console.log(`
   INSERT INTO role_permissions (role_id, permission)
   SELECT r.id, 'payment.collect_ar'
   FROM roles r
   WHERE r.name = 'Sales Cashier'
   AND NOT EXISTS (
     SELECT 1 FROM role_permissions rp
     WHERE rp.role_id = r.id AND rp.permission = 'payment.collect_ar'
   );
      `)
    } else {
      console.log('\n✅ All cashier roles already have PAYMENT_COLLECT_AR permission!')
      console.log('   No changes needed.')
    }

    console.log('\n' + '='.repeat(80))
    console.log('✅ Dry run completed - NO changes were made to the database\n')
  } catch (error) {
    console.error('❌ Error checking permissions:', error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

checkCashierPermissions()
  .then(() => {
    process.exit(0)
  })
  .catch((error) => {
    console.error('\n❌ Script failed:', error)
    process.exit(1)
  })
