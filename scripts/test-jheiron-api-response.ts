import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function testJheironAPIResponse() {
  try {
    console.log('🧪 Simulating /api/user-locations/my-location API for Jheiron...\n')

    // Find Jheiron user
    const user = await prisma.user.findFirst({
      where: { username: 'Jheiron' }
    })

    if (!user) {
      console.log('❌ User "Jheiron" not found')
      return
    }

    console.log('📋 User ID:', user.id)
    console.log('👤 Username:', user.username)

    // Replicate the API logic (lines 20-28)
    const userLocations = await prisma.userLocation.findMany({
      where: {
        userId: user.id,
      },
      include: {
        location: true,
      },
      take: 1, // Get first assigned location
    })

    console.log('\n🔍 Query Results:')
    console.log('  User locations found:', userLocations.length)

    if (userLocations.length === 0) {
      console.log('\n❌ API RESPONSE: { error: "No location assigned", location: null }')
      console.log('\n⚠️  PROBLEM: No UserLocation records found for Jheiron!')
      console.log('This is why the dropdown is blank.')
      console.log('\nVerifying UserLocation table...')

      const allUserLocations = await prisma.userLocation.findMany({
        where: { userId: user.id },
        include: { location: true }
      })

      console.log('All UserLocation records for Jheiron:', allUserLocations.length)

      if (allUserLocations.length === 0) {
        console.log('\n❌ CONFIRMED: No UserLocation assignments exist in database!')
        console.log('This means the UI save did NOT create the record.')
      } else {
        console.log('\n✅ UserLocation records DO exist:')
        allUserLocations.forEach(ul => {
          console.log(`  - ${ul.location.name} (ID: ${ul.locationId})`)
        })
      }
      return
    }

    if (!userLocations[0]?.location) {
      console.log('\n❌ API RESPONSE: { error: "Location data is missing", location: null }')
      return
    }

    const locationData = userLocations[0].location
    console.log('\n✅ API RESPONSE:')
    console.log(JSON.stringify({
      location: {
        id: locationData.id,
        name: locationData.name,
        city: locationData.city || '',
        state: locationData.state || '',
      }
    }, null, 2))

    console.log('\n🎉 Expected Behavior:')
    console.log(`  - Dropdown should show: "${locationData.name}"`)
    console.log('  - Dropdown should be locked/disabled')
    console.log('  - Message should say: "Fixed to your assigned location"')

  } catch (error) {
    console.error('❌ Error:', error)
  } finally {
    await prisma.$disconnect()
  }
}

testJheironAPIResponse()
