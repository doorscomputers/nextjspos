import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function debugJheironComplete() {
  try {
    console.log('🔍 COMPLETE DEBUG FOR JHEIRON LOCATION ISSUE\n')
    console.log('='.repeat(60))

    // Get Jheiron user with all related data
    const user = await prisma.user.findFirst({
      where: { username: 'Jheiron' },
      include: {
        userLocations: {
          include: {
            location: true
          }
        },
        roles: {
          include: {
            role: {
              include: {
                permissions: {
                  include: {
                    permission: true
                  }
                },
                locations: {
                  include: {
                    location: true
                  }
                }
              }
            }
          }
        }
      }
    })

    if (!user) {
      console.log('❌ User not found')
      return
    }

    console.log('\n📋 USER INFORMATION:')
    console.log('  ID:', user.id)
    console.log('  Username:', user.username)
    console.log('  Business ID:', user.businessId)

    console.log('\n📍 DIRECT USER LOCATION ASSIGNMENTS (UserLocation table):')
    if (user.userLocations.length === 0) {
      console.log('  ❌ NONE - This is the problem!')
    } else {
      user.userLocations.forEach(ul => {
        console.log(`  ✅ ${ul.location.name} (ID: ${ul.locationId})`)
      })
    }

    console.log('\n👥 ROLES ASSIGNED:')
    user.roles.forEach(ur => {
      console.log(`  - ${ur.role.name} (ID: ${ur.roleId})`)
    })

    console.log('\n🔐 CHECKING "ACCESS ALL LOCATIONS" PERMISSION:')
    let hasAccessAllLocations = false
    user.roles.forEach(ur => {
      const accessAllPerm = ur.role.permissions.find(
        rp => rp.permission.name === 'access_all_locations'
      )
      if (accessAllPerm) {
        console.log(`  ✅ Role "${ur.role.name}" has "access_all_locations" permission`)
        hasAccessAllLocations = true
      }
    })

    if (!hasAccessAllLocations) {
      console.log('  ❌ No "access_all_locations" permission found')
    }

    console.log('\n📌 ROLE LOCATION ASSIGNMENTS (RoleLocation table):')
    user.roles.forEach(ur => {
      if (ur.role.locations.length === 0) {
        console.log(`  Role "${ur.role.name}": No specific locations`)
      } else {
        console.log(`  Role "${ur.role.name}":`)
        ur.role.locations.forEach(rl => {
          console.log(`    - ${rl.location.name} (ID: ${rl.locationId})`)
        })
      }
    })

    console.log('\n' + '='.repeat(60))
    console.log('🧪 SIMULATING API /api/user-locations/my-location')
    console.log('='.repeat(60))

    // Simulate the API call
    const userLocations = await prisma.userLocation.findMany({
      where: { userId: user.id },
      include: { location: true },
      take: 1
    })

    console.log('\nAPI Query Result:')
    console.log('  User locations found:', userLocations.length)

    if (userLocations.length === 0) {
      console.log('\n❌ API WILL RETURN: { error: "No location assigned", location: null }')
      console.log('\n⚠️  ROOT CAUSE IDENTIFIED:')
      console.log('  - User has NO UserLocation records')
      console.log('  - Even though role has "Access All Locations" permission')
      console.log('  - The API specifically looks for UserLocation records')
      console.log('  - NOT role-based location access')
    } else {
      const loc = userLocations[0].location
      console.log('\n✅ API WILL RETURN:')
      console.log(JSON.stringify({
        location: {
          id: loc.id,
          name: loc.name,
          city: loc.city,
          state: loc.state
        }
      }, null, 2))
    }

    console.log('\n' + '='.repeat(60))
    console.log('💡 SOLUTION')
    console.log('='.repeat(60))

    if (user.userLocations.length === 0) {
      console.log('\n❌ Problem: No UserLocation assignment exists')
      console.log('✅ Solution: Add UserLocation record for Main Warehouse')
      console.log('\nRunning fix now...\n')

      const mainWarehouse = await prisma.businessLocation.findFirst({
        where: {
          businessId: user.businessId,
          name: 'Main Warehouse'
        }
      })

      if (mainWarehouse) {
        // Check if already exists (race condition protection)
        const existing = await prisma.userLocation.findUnique({
          where: {
            userId_locationId: {
              userId: user.id,
              locationId: mainWarehouse.id
            }
          }
        })

        if (existing) {
          console.log('✅ UserLocation already exists (created since check)')
        } else {
          await prisma.userLocation.create({
            data: {
              userId: user.id,
              locationId: mainWarehouse.id
            }
          })
          console.log('✅ UserLocation created successfully!')
        }

        console.log('\n🔄 NEXT STEPS:')
        console.log('  1. User MUST log out')
        console.log('  2. User MUST log back in')
        console.log('  3. Navigate to Create Purchase Order')
        console.log('  4. Dropdown will show: "Main Warehouse" (locked)')
      } else {
        console.log('❌ Main Warehouse location not found!')
      }
    } else {
      console.log('\n✅ UserLocation exists - dropdown should work')
      console.log('⚠️  If dropdown is still blank:')
      console.log('  1. User needs to log out and log back in')
      console.log('  2. Clear browser cache (Ctrl+Shift+Delete)')
      console.log('  3. Check browser console for API errors (F12)')
    }

  } catch (error) {
    console.error('❌ Error:', error)
  } finally {
    await prisma.$disconnect()
  }
}

debugJheironComplete()
