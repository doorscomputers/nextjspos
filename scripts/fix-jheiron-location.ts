import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function fixJheironLocation() {
  try {
    console.log('🔧 Fixing Jheiron user location assignments...\n')

    // Get Jheiron user
    const user = await prisma.user.findFirst({
      where: { username: 'Jheiron' },
      include: {
        userLocations: {
          include: {
            location: true
          }
        }
      }
    })

    if (!user) {
      console.log('❌ User "Jheiron" not found')
      return
    }

    console.log('📋 Current User Details:')
    console.log('  ID:', user.id)
    console.log('  Username:', user.username)
    console.log('  Business ID:', user.businessId)
    console.log('  Direct locationId:', user.locationId || 'NULL')
    console.log('  UserLocation assignments:', user.userLocations.length)

    if (user.userLocations.length > 0) {
      console.log('\n📍 Current Location Assignments:')
      user.userLocations.forEach((ul: any) => {
        console.log(`  - ${ul.location.name} (ID: ${ul.locationId})`)
      })
    } else {
      console.log('\n⚠️  NO UserLocation assignments found!')
    }

    // Get Main Warehouse location
    const mainWarehouse = await prisma.businessLocation.findFirst({
      where: {
        businessId: user.businessId,
        name: 'Main Warehouse'
      }
    })

    if (!mainWarehouse) {
      console.log('\n❌ Main Warehouse location not found!')
      return
    }

    console.log('\n🏢 Main Warehouse:')
    console.log('  ID:', mainWarehouse.id)
    console.log('  Name:', mainWarehouse.name)

    // Check if already assigned
    const existingAssignment = user.userLocations.find((ul: any) => ul.locationId === mainWarehouse.id)

    if (existingAssignment) {
      console.log('\n✅ User is already assigned to Main Warehouse!')
    } else {
      console.log('\n📝 Assigning Main Warehouse to Jheiron...')

      await prisma.userLocation.create({
        data: {
          userId: user.id,
          locationId: mainWarehouse.id
        }
      })

      console.log('✅ Main Warehouse assigned successfully!')
    }

    // Also set direct locationId if NULL
    if (!user.locationId) {
      console.log('\n📝 Setting direct locationId to Main Warehouse...')

      await prisma.user.update({
        where: { id: user.id },
        data: { locationId: mainWarehouse.id }
      })

      console.log('✅ Direct locationId set successfully!')
    }

    // Verify the changes
    const updatedUser = await prisma.user.findFirst({
      where: { id: user.id },
      include: {
        userLocations: {
          include: {
            location: true
          }
        }
      }
    })

    console.log('\n🎉 Updated User Details:')
    console.log('  Direct locationId:', updatedUser?.locationId || 'NULL')
    console.log('  UserLocation assignments:', updatedUser?.userLocations.length)
    if (updatedUser && updatedUser.userLocations.length > 0) {
      console.log('\n📍 Assigned Locations:')
      updatedUser.userLocations.forEach((ul: any) => {
        console.log(`  - ${ul.location.name} (ID: ${ul.locationId})`)
      })
    }

    console.log('\n✅ Done! User must log out and log back in for changes to take effect.')

  } catch (error) {
    console.error('❌ Error:', error)
  } finally {
    await prisma.$disconnect()
  }
}

fixJheironLocation()
