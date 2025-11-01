/**
 * Remove Opening Stock Permission from Branch Admin Role
 *
 * This script removes the PRODUCT_OPENING_STOCK permission from Branch Admin roles.
 * This prevents Branch Admin users from accessing the "Add/Edit Opening Stock" menu.
 *
 * Usage: node scripts/remove-opening-stock-permission.mjs
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function removeOpeningStockPermission() {
  console.log('🚀 Starting Opening Stock Permission Removal...\n')

  try {
    // Get all businesses
    const businesses = await prisma.business.findMany({
      select: {
        id: true,
        name: true,
      },
    })

    console.log(`📊 Found ${businesses.length} business(es) in the database\n`)

    let updatedCount = 0
    let notFoundCount = 0

    for (const business of businesses) {
      console.log(`\n${'='.repeat(60)}`)
      console.log(`Processing: ${business.name} (ID: ${business.id})`)
      console.log('='.repeat(60))

      // Find Branch Admin role for this business
      const branchAdminRole = await prisma.role.findFirst({
        where: {
          name: 'Branch Admin',
          businessId: business.id,
        },
        include: {
          _count: {
            select: { users: true },
          },
        },
      })

      if (!branchAdminRole) {
        console.log(`⚠️  No Branch Admin role found for business: ${business.name}`)
        notFoundCount++
        continue
      }

      console.log(`✅ Found Branch Admin role (ID: ${branchAdminRole.id})`)
      console.log(`   Assigned to ${branchAdminRole._count.users} user(s)`)

      // Find the PRODUCT_OPENING_STOCK permission
      const permission = await prisma.permission.findUnique({
        where: { name: 'product.opening_stock' },
      })

      if (!permission) {
        console.log(`⚠️  PRODUCT_OPENING_STOCK permission not found in database`)
        continue
      }

      // Check if this role has this permission
      const rolePermission = await prisma.rolePermission.findUnique({
        where: {
          roleId_permissionId: {
            roleId: branchAdminRole.id,
            permissionId: permission.id,
          },
        },
      })

      if (!rolePermission) {
        console.log(`✅ Role already doesn't have PRODUCT_OPENING_STOCK permission`)
        continue
      }

      // Remove the permission
      await prisma.rolePermission.delete({
        where: {
          roleId_permissionId: {
            roleId: branchAdminRole.id,
            permissionId: permission.id,
          },
        },
      })

      console.log(`✅ REMOVED: product.opening_stock permission from Branch Admin`)
      updatedCount++

      // Count final permissions
      const finalPermissionCount = await prisma.rolePermission.count({
        where: { roleId: branchAdminRole.id },
      })

      console.log(`✅ Update complete for ${business.name}`)
      console.log(`   Final permission count: ${finalPermissionCount}`)
    }

    // Summary
    console.log(`\n${'='.repeat(60)}`)
    console.log('SUMMARY')
    console.log('='.repeat(60))
    console.log(`✅ Businesses processed: ${businesses.length}`)
    console.log(`✅ Branch Admin roles updated: ${updatedCount}`)
    if (notFoundCount > 0) {
      console.log(`⚠️  Businesses without Branch Admin role: ${notFoundCount}`)
    }
    console.log(`\n✅ Opening Stock permission has been removed successfully!`)

    console.log(`\n${'='.repeat(60)}`)
    console.log('NEXT STEPS')
    console.log('='.repeat(60))
    console.log(`1. Ask all Branch Admin users to LOGOUT and LOGIN again`)
    console.log(`2. Verify the "Add/Edit Opening Stock" menu is hidden`)
    console.log(`3. Test with a Branch Admin account`)
    console.log(`\nℹ️  Branch Admin users will no longer see the "Add/Edit Opening Stock" option in the product actions menu.`)

  } catch (error) {
    console.error('\n❌ Error removing Opening Stock permission:', error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

// Run the update
removeOpeningStockPermission()
  .then(() => {
    console.log('\n✅ Script completed successfully')
    process.exit(0)
  })
  .catch((error) => {
    console.error('\n❌ Script failed:', error)
    process.exit(1)
  })
