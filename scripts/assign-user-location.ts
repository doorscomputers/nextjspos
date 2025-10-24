/**
 * Assign locations to users
 * Use this if a user has no location assignments
 */

import { PrismaClient } from '@prisma/client'
import * as readline from 'readline'

const prisma = new PrismaClient()

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
})

function question(query: string): Promise<string> {
  return new Promise((resolve) => rl.question(query, resolve))
}

async function main() {
  console.log('\n🔍 Location Assignment Tool\n')

  // Get all users
  const users = await prisma.user.findMany({
    include: {
      userLocations: {
        include: {
          location: true
        }
      }
    }
  })

  console.log('📋 Current Users:\n')
  users.forEach((user, index) => {
    const locations = user.userLocations.map(ul => ul.location.name).join(', ')
    console.log(`${index + 1}. ${user.username} (${user.firstName} ${user.lastName})`)
    console.log(`   Locations: ${locations || 'NONE ASSIGNED ⚠️'}`)
    console.log(`   Business ID: ${user.businessId}`)
    console.log('')
  })

  // Get username to assign
  const username = await question('Enter username to assign location: ')
  const user = users.find(u => u.username === username)

  if (!user) {
    console.log('❌ User not found!')
    rl.close()
    return
  }

  // Get locations for this business
  const locations = await prisma.businessLocation.findMany({
    where: {
      businessId: user.businessId,
      deletedAt: null
    }
  })

  console.log('\n📍 Available Locations:\n')
  locations.forEach((loc, index) => {
    console.log(`${index + 1}. ${loc.name} (ID: ${loc.id})`)
  })

  const locationChoice = await question('\nEnter location number (or "all" for all locations): ')

  let locationsToAssign: number[] = []

  if (locationChoice.toLowerCase() === 'all') {
    locationsToAssign = locations.map(l => l.id)
  } else {
    const index = parseInt(locationChoice) - 1
    if (index >= 0 && index < locations.length) {
      locationsToAssign = [locations[index].id]
    } else {
      console.log('❌ Invalid choice!')
      rl.close()
      return
    }
  }

  // Assign locations
  console.log('\n🔄 Assigning locations...')

  for (const locationId of locationsToAssign) {
    // Check if already assigned
    const existing = await prisma.userLocation.findFirst({
      where: {
        userId: user.id,
        locationId: locationId
      }
    })

    if (existing) {
      console.log(`   ⏭️  Location ${locationId} already assigned`)
      continue
    }

    await prisma.userLocation.create({
      data: {
        userId: user.id,
        locationId: locationId
      }
    })

    const location = locations.find(l => l.id === locationId)
    console.log(`   ✅ Assigned: ${location?.name}`)
  }

  console.log('\n✅ Location assignment complete!')
  console.log('\n📝 Next steps:')
  console.log('   1. User should log out')
  console.log('   2. Log back in')
  console.log('   3. Try accessing X/Z Reading again')

  rl.close()
}

main()
  .catch((error) => {
    console.error('Error:', error)
    rl.close()
    process.exit(1)
  })
  .finally(() => {
    prisma.$disconnect()
  })
