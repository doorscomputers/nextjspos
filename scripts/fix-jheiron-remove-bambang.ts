import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function fixJheironRemoveBambang() {
  try {
    console.log('🔧 Fixing Jheiron location assignments...\n')

    // Get Jheiron user with locations
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

    console.log('📋 Current Location Assignments:')
    user.userLocations.forEach((ul: any) => {
      console.log(`  - ${ul.location.name} (ID: ${ul.locationId})`)
    })

    // Find Bambang location
    const bambangAssignment = user.userLocations.find((ul: any) => ul.location.name === 'Bambang')

    if (bambangAssignment) {
      console.log('\n⚠️  Found incorrect assignment: Bambang (ID: 3)')
      console.log('🗑️  Removing Bambang from Jheiron...')

      await prisma.userLocation.delete({
        where: {
          userId_locationId: {
            userId: user.id,
            locationId: bambangAssignment.locationId
          }
        }
      })

      console.log('✅ Bambang removed successfully!')
    } else {
      console.log('\n✅ Bambang is not assigned (already correct)')
    }

    // Verify Main Warehouse is assigned
    const mainWarehouse = await prisma.businessLocation.findFirst({
      where: {
        businessId: user.businessId,
        name: 'Main Warehouse'
      }
    })

    if (!mainWarehouse) {
      console.log('\n❌ Main Warehouse not found!')
      return
    }

    const mainWarehouseAssignment = user.userLocations.find((ul: any) => ul.locationId === mainWarehouse.id)

    if (mainWarehouseAssignment) {
      console.log('\n✅ Main Warehouse is correctly assigned')
    } else {
      console.log('\n📝 Adding Main Warehouse assignment...')
      await prisma.userLocation.create({
        data: {
          userId: user.id,
          locationId: mainWarehouse.id
        }
      })
      console.log('✅ Main Warehouse assigned!')
    }

    // Show final result
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

    console.log('\n🎉 Final Location Assignments:')
    updatedUser?.userLocations.forEach((ul: any) => {
      console.log(`  ✅ ${ul.location.name} (ID: ${ul.locationId})`)
    })

    console.log('\n✅ Done!')
    console.log('🔄 User must LOG OUT and LOG BACK IN for changes to take effect.')
    console.log('📍 Expected dropdown locations: Main Warehouse only')

  } catch (error) {
    console.error('❌ Error:', error)
  } finally {
    await prisma.$disconnect()
  }
}

fixJheironRemoveBambang()
