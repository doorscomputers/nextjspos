/**
 * Assign users to specific business locations for branch-level access control
 * Run this with: npx tsx scripts/assign-user-locations.ts
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('🔧 Assigning users to specific branch locations...\n')

  try {
    // Find all users and locations
    const users = await prisma.user.findMany({
      where: {
        username: { in: ['branchmanager', 'warehousemanager', 'staff', 'cashier'] }
      }
    })

    const locations = await prisma.businessLocation.findMany()

    console.log(`Found ${users.length} users and ${locations.length} locations\n`)

    // Clear existing user-location assignments
    await prisma.userLocation.deleteMany({})
    console.log('✅ Cleared existing user-location assignments\n')

    // Find specific locations (match existing names exactly)
    const mainStore = locations.find(l => l.name === 'Main Store')
    const warehouse = locations.find(l => l.name === 'Warehouse')
    const bambang = locations.find(l => l.name === 'Bambang')
    const downtown = locations.find(l => l.name.includes('Tuguegarao'))

    console.log('Location mapping:')
    console.log('  Main Store:', mainStore?.id || 'NOT FOUND')
    console.log('  Warehouse:', warehouse?.id || 'NOT FOUND')
    console.log('  Bambang:', bambang?.id || 'NOT FOUND')
    console.log('  Downtown:', downtown?.id || 'NOT FOUND')
    console.log('')

    if (!mainStore || !warehouse || !bambang || !downtown) {
      console.error('❌ Could not find all required locations')
      console.log('Available locations:', locations.map(l => `"${l.name}"`))
      return
    }

    if (users.length === 0) {
      console.error('❌ No users found. Please run database seed first: npm run db:seed')
      return
    }

    // Assign locations to users
    for (const user of users) {
      switch (user.username) {
        case 'branchmanager':
          // Assign to Main Store only
          await prisma.userLocation.create({
            data: {
              userId: user.id,
              locationId: mainStore.id
            }
          })
          console.log(`✅ ${user.username} -> Main Store`)
          break

        case 'warehousemanager':
          // Assign to Warehouse only
          await prisma.userLocation.create({
            data: {
              userId: user.id,
              locationId: warehouse.id
            }
          })
          console.log(`✅ ${user.username} -> Warehouse`)
          break

        case 'staff':
          // Assign to Main Store and Bambang
          await prisma.userLocation.createMany({
            data: [
              { userId: user.id, locationId: mainStore.id },
              { userId: user.id, locationId: bambang.id }
            ]
          })
          console.log(`✅ ${user.username} -> Main Store + Bambang`)
          break

        case 'cashier':
          // Assign to Tuguegarao Downtown only
          await prisma.userLocation.create({
            data: {
              userId: user.id,
              locationId: downtown.id
            }
          })
          console.log(`✅ ${user.username} -> Tuguegarao Downtown`)
          break
      }
    }

    console.log('\n✅ Branch-level access control configured successfully!')
    console.log('\n📋 Summary:')
    console.log('  - branchmanager -> Main Store only')
    console.log('  - warehousemanager -> Warehouse only')
    console.log('  - staff -> Main Store + Bambang')
    console.log('  - cashier -> Tuguegarao Downtown only')
    console.log('\n  - superadmin & branchadmin have ACCESS_ALL_LOCATIONS permission')
    console.log('\n💡 Users need to log out and log back in for changes to take effect!')

  } catch (error) {
    console.error('❌ Error:', error)
    throw error
  }
}

main()
  .catch((e) => {
    console.error('❌ Fatal error:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
