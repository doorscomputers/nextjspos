import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function checkJheironLocation() {
  try {
    console.log('Checking Jheiron user location assignment...\n')

    const user = await prisma.user.findFirst({
      where: { username: 'Jheiron' },
      include: {
        business: {
          include: {
            locations: true
          }
        }
      }
    })

    if (!user) {
      console.log('❌ User "Jheiron" not found')
      return
    }

    console.log('📋 User Details:')
    console.log('  ID:', user.id)
    console.log('  Username:', user.username)
    console.log('  Business ID:', user.businessId)
    console.log('  Assigned Location ID:', user.locationId || '❌ NOT ASSIGNED')
    console.log('  Location Name:', user.locationId ? 'Loading...' : '❌ NO LOCATION')

    if (user.locationId) {
      const location = await prisma.businessLocation.findUnique({
        where: { id: user.locationId }
      })
      if (location) {
        console.log('  Location Name:', location.name)
      }
    }

    console.log('\n📍 Available Locations for Business:')
    if (user.business && user.business.locations) {
      user.business.locations.forEach((loc: any, index: number) => {
        console.log(`  ${index + 1}. ID: ${loc.id} - ${loc.name}`)
      })
    }

    // Check purchase order page logic
    console.log('\n🔍 Checking Purchase Order Creation Logic...')
    console.log('Expected behavior:')
    console.log('  - If user has locationId: Should pre-select that location')
    console.log('  - If user has NO locationId: Should show blank dropdown')
    console.log('  - User "Jheiron" has locationId:', user.locationId || 'NULL')

    if (!user.locationId) {
      console.log('\n⚠️  ISSUE FOUND:')
      console.log('User "Jheiron" does NOT have an assigned location (locationId is NULL)')
      console.log('This is why the "Receiving Location" dropdown appears blank.')
      console.log('\n✅ SOLUTION:')
      console.log('Assign a default location to Jheiron user in the database.')
      console.log('\nSQL to assign Main Warehouse (assuming location ID 1):')
      console.log(`UPDATE users SET location_id = 1 WHERE username = 'Jheiron';`)
    } else {
      console.log('\n✅ User has assigned location - checking if page loads it correctly...')
    }

  } catch (error) {
    console.error('Error:', error)
  } finally {
    await prisma.$disconnect()
  }
}

checkJheironLocation()
