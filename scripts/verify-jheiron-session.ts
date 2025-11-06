import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function verifyJheironSession() {
  try {
    console.log('🔍 Verifying Jheiron session data...\n')

    // Simulate what happens during login
    const user = await prisma.user.findFirst({
      where: { username: 'Jheiron' },
      include: {
        roles: {
          include: {
            role: {
              include: {
                locations: true
              }
            }
          }
        },
        userLocations: {
          include: {
            location: true
          }
        }
      }
    })

    if (!user) {
      console.log('❌ User not found')
      return
    }

    // Replicate the auth.ts logic (lines 351-362)
    const directLocationIds = user.userLocations.map(ul => ul.locationId)
    const roleLocationIds = user.roles.flatMap(ur =>
      ur.role.locations.map(rl => rl.locationId)
    )

    const locationIds = directLocationIds.length > 0
      ? directLocationIds
      : [...new Set(roleLocationIds)]

    console.log('📋 User: Jheiron')
    console.log('  Business ID:', user.businessId)
    console.log('\n📍 Location Assignment Logic:')
    console.log('  Direct UserLocation IDs:', directLocationIds)
    console.log('  Role-based Location IDs:', roleLocationIds)
    console.log('  Final locationIds (for session):', locationIds)

    console.log('\n🎯 What will be in session.user.locationIds:', locationIds)

    if (locationIds.length > 0) {
      console.log('\n✅ User HAS location assignments!')
      console.log('   Purchase Order page SHOULD show these locations in dropdown')

      // Fetch location names
      const locations = await prisma.businessLocation.findMany({
        where: { id: { in: locationIds } }
      })

      console.log('\n📌 Assigned Locations:')
      locations.forEach(loc => {
        console.log(`  - ${loc.name} (ID: ${loc.id})`)
      })

      console.log('\n💡 Expected Behavior on Purchase Order Page:')
      console.log('  ✅ Dropdown should show:', locations.map(l => l.name).join(', '))
      console.log('  ✅ If only 1 location: Should be auto-selected and locked')
      console.log('  ✅ If multiple: User can select from dropdown')

      if (locationIds.length === 1) {
        console.log('\n⚠️  IMPORTANT: Since user has only 1 location assigned,')
        console.log('     the dropdown should be LOCKED to that location.')
        console.log('     Check if myLocation variable is set correctly in the page.')
      }

    } else {
      console.log('\n❌ User has NO location assignments!')
      console.log('   This is why the dropdown is blank.')
    }

    console.log('\n🔄 Next Steps:')
    console.log('  1. User must LOG OUT')
    console.log('  2. User must LOG BACK IN')
    console.log('  3. Session will be refreshed with locationIds:', locationIds)
    console.log('  4. Purchase Order page will then show assigned locations')

  } catch (error) {
    console.error('❌ Error:', error)
  } finally {
    await prisma.$disconnect()
  }
}

verifyJheironSession()
