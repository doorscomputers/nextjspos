/**
 * Add PAYMENT_COLLECT_AR Permission to Database
 * Safely adds the missing permission record without affecting other data
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function addARPaymentPermission() {
  try {
    console.log('🔍 Checking for payment.collect_ar permission...\n')

    // Check if permission already exists
    const existingPermission = await prisma.permission.findUnique({
      where: {
        name: 'payment.collect_ar',
      },
    })

    if (existingPermission) {
      console.log('✅ Permission already exists!')
      console.log(`   ID: ${existingPermission.id}`)
      console.log(`   Name: ${existingPermission.name}`)
      console.log('\n✅ No action needed - permission is already in the database')
      return
    }

    console.log('❌ Permission not found in database')
    console.log('📝 Creating permission record...\n')

    // Create the permission
    const newPermission = await prisma.permission.create({
      data: {
        name: 'payment.collect_ar',
        guardName: 'web',
      },
    })

    console.log('✅ Permission created successfully!')
    console.log(`   ID: ${newPermission.id}`)
    console.log(`   Name: ${newPermission.name}`)
    console.log(`   Guard: ${newPermission.guardName}`)

    console.log('\n📋 Next step: Run the update script to assign this permission to Sales Cashier role:')
    console.log('   npx tsx scripts/update-cashier-permissions.ts')
  } catch (error) {
    console.error('❌ Error adding permission:', error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

addARPaymentPermission()
  .then(() => {
    console.log('\n✅ Script completed successfully')
    process.exit(0)
  })
  .catch((error) => {
    console.error('\n❌ Script failed:', error)
    process.exit(1)
  })
