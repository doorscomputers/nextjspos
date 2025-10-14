import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function fixWarehouseManagerLocations() {
  console.log('🔧 Fixing warehouse manager location access...\n')

  try {
    // Find warehouse manager user
    const warehouseManager = await prisma.user.findUnique({
      where: { username: 'warehousemanager' }
    })

    if (!warehouseManager) {
      console.error('❌ Warehouse manager user not found')
      return
    }

    // Find Tuguegarao and Warehouse locations
    const tuguegarao = await prisma.businessLocation.findFirst({
      where: { name: 'Tuguegarao Downtown' }
    })

    const warehouse = await prisma.businessLocation.findFirst({
      where: { name: 'Warehouse' }
    })

    if (!tuguegarao || !warehouse) {
      console.error('❌ Locations not found')
      return
    }

    // Add Tuguegarao location (if not exists)
    await prisma.userLocation.upsert({
      where: {
        userId_locationId: {
          userId: warehouseManager.id,
          locationId: tuguegarao.id
        }
      },
      update: {},
      create: {
        userId: warehouseManager.id,
        locationId: tuguegarao.id
      }
    })

    // Add Warehouse location (if not exists)
    await prisma.userLocation.upsert({
      where: {
        userId_locationId: {
          userId: warehouseManager.id,
          locationId: warehouse.id
        }
      },
      update: {},
      create: {
        userId: warehouseManager.id,
        locationId: warehouse.id
      }
    })

    // Verify
    const userLocations = await prisma.userLocation.findMany({
      where: { userId: warehouseManager.id },
      include: {
        location: {
          select: { name: true }
        }
      }
    })

    console.log('✅ Warehouse manager locations updated:')
    userLocations.forEach(ul => {
      console.log(`   - ${ul.location.name}`)
    })

    console.log('\n✅ Fix applied successfully!')
  } catch (error) {
    console.error('❌ Error:', error)
  } finally {
    await prisma.$disconnect()
  }
}

fixWarehouseManagerLocations()
