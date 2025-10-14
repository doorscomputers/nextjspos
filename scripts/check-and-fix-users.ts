import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function checkAndFixUsers() {
  console.log('🔍 Checking database users and locations...\n')

  try {
    // List all users
    const users = await prisma.user.findMany({
      select: {
        id: true,
        username: true,
        firstName: true,
        lastName: true,
        surname: true
      }
    })

    console.log('📋 Users in database:')
    users.forEach(u => {
      console.log(`   ID: ${u.id}, Username: ${u.username}, Name: ${u.surname} ${u.firstName} ${u.lastName}`)
    })

    // List all locations
    const locations = await prisma.businessLocation.findMany({
      select: {
        id: true,
        name: true
      }
    })

    console.log('\n📍 Locations in database:')
    locations.forEach(l => {
      console.log(`   ID: ${l.id}, Name: ${l.name}`)
    })

    // Check user locations
    const userLocations = await prisma.userLocation.findMany({
      include: {
        user: {
          select: { username: true }
        },
        location: {
          select: { name: true }
        }
      }
    })

    console.log('\n🔗 User Location Assignments:')
    userLocations.forEach(ul => {
      console.log(`   ${ul.user.username} → ${ul.location.name}`)
    })

    // Find the WarehouseManager role user
    const warehouseManagerUsers = await prisma.user.findMany({
      where: {
        roles: {
          some: {
            role: {
              name: {
                contains: 'Warehouse',
                mode: 'insensitive'
              }
            }
          }
        }
      },
      include: {
        roles: {
          include: {
            role: true
          }
        }
      }
    })

    console.log('\n👤 Users with Warehouse role:')
    warehouseManagerUsers.forEach(u => {
      console.log(`   ${u.username} (${u.firstName} ${u.lastName})`)
      u.roles.forEach(r => console.log(`      - Role: ${r.role.name}`))
    })

    // If there's a user with WarehouseManager in their name, fix their locations
    const targetUser = users.find(u =>
      u.username?.toLowerCase().includes('warehouse') ||
      u.lastName?.toLowerCase().includes('warehouse') ||
      u.firstName?.toLowerCase().includes('jhei') // The user in the screenshot
    )

    if (targetUser) {
      console.log(`\n🔧 Fixing locations for user: ${targetUser.username || 'unknown'} (ID: ${targetUser.id})`)

      // Add all locations for testing (Tuguegarao and Warehouse)
      const tuguegarao = locations.find(l => l.name.includes('Tuguegarao'))
      const warehouse = locations.find(l => l.name.includes('Warehouse'))

      if (tuguegarao) {
        await prisma.userLocation.upsert({
          where: {
            userId_locationId: {
              userId: targetUser.id,
              locationId: tuguegarao.id
            }
          },
          update: {},
          create: {
            userId: targetUser.id,
            locationId: tuguegarao.id
          }
        })
        console.log(`   ✅ Added ${tuguegarao.name}`)
      }

      if (warehouse) {
        await prisma.userLocation.upsert({
          where: {
            userId_locationId: {
              userId: targetUser.id,
              locationId: warehouse.id
            }
          },
          update: {},
          create: {
            userId: targetUser.id,
            locationId: warehouse.id
          }
        })
        console.log(`   ✅ Added ${warehouse.name}`)
      }

      console.log('\n✅ User locations fixed! User now has access to both locations.')
    } else {
      console.log('\n⚠️  No warehouse manager user found to fix')
    }

  } catch (error) {
    console.error('❌ Error:', error)
  } finally {
    await prisma.$disconnect()
  }
}

checkAndFixUsers()
