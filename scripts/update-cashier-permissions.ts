/**
 * Update Cashier Role with PAYMENT_COLLECT_AR Permission
 * Run this script to add AR payment collection permission to existing cashier users
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function updateCashierPermissions() {
  try {
    console.log('🔄 Updating Cashier role permissions...')

    // Find all businesses
    const businesses = await prisma.business.findMany({
      select: { id: true, name: true },
    })

    console.log(`Found ${businesses.length} businesses`)

    for (const business of businesses) {
      console.log(`\n📋 Processing business: ${business.name} (ID: ${business.id})`)

      // Find Sales Cashier role for this business
      const cashierRole = await prisma.role.findFirst({
        where: {
          businessId: business.id,
          name: 'Sales Cashier',
        },
      })

      if (!cashierRole) {
        console.log(`  ⚠️ No Sales Cashier role found for business ${business.name}`)
        continue
      }

      console.log(`  ✅ Found Sales Cashier role (ID: ${cashierRole.id})`)

      // Check if PAYMENT_COLLECT_AR permission already exists
      const existingPermission = await prisma.rolePermission.findFirst({
        where: {
          roleId: cashierRole.id,
          permission: 'payment.collect_ar',
        },
      })

      if (existingPermission) {
        console.log(`  ℹ️ PAYMENT_COLLECT_AR permission already exists`)
        continue
      }

      // Add PAYMENT_COLLECT_AR permission to the role
      await prisma.rolePermission.create({
        data: {
          roleId: cashierRole.id,
          permission: 'payment.collect_ar',
        },
      })

      console.log(`  ✅ Added PAYMENT_COLLECT_AR permission to Sales Cashier role`)

      // Count how many users have this role
      const userCount = await prisma.userRole.count({
        where: { roleId: cashierRole.id },
      })

      console.log(`  👥 ${userCount} cashier users will be affected`)
    }

    console.log('\n✅ All businesses updated successfully!')
    console.log('\n⚠️ IMPORTANT: All affected users must log out and log back in for changes to take effect!')
  } catch (error) {
    console.error('❌ Error updating permissions:', error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

updateCashierPermissions()
  .then(() => {
    console.log('\n✅ Script completed successfully')
    process.exit(0)
  })
  .catch((error) => {
    console.error('\n❌ Script failed:', error)
    process.exit(1)
  })
