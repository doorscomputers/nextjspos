import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function checkLocations() {
  try {
    const locations = await prisma.businessLocation.findMany({
      where: { businessId: 1 },
      orderBy: { id: 'asc' }
    })

    console.log('\n=== CURRENT DATABASE LOCATIONS ===\n')
    
    for (const loc of locations) {
      console.log(`ID ${loc.id}:`)
      console.log(`  Name: ${loc.name}`)
      console.log(`  City: ${loc.city}`)
      console.log(`  State: ${loc.state}`)
      console.log(`  Zip: ${loc.zipCode}`)
      console.log(`  Email: ${loc.email}`)
      console.log(`  Mobile: ${loc.mobile}`)
      console.log('')
    }

  } catch (error) {
    console.error('Error:', error)
  } finally {
    await prisma.$disconnect()
  }
}

checkLocations()
