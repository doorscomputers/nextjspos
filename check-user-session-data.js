const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
  console.log('\n🔍 Checking branchmanager user data...\n')

  const user = await prisma.user.findFirst({
    where: { username: 'branchmanager' },
    include: {
      userLocations: {
        include: {
          location: true
        }
      },
      roles: {
        include: {
          role: true
        }
      }
    }
  })

  if (!user) {
    console.log('❌ User not found')
    return
  }

  console.log('User ID:', user.id)
  console.log('Username:', user.username)
  console.log('Business ID:', user.businessId)
  console.log('\nRoles:')
  user.roles.forEach(r => {
    console.log(`  - ${r.role.name} (ID: ${r.role.id})`)
  })

  console.log('\nUser Locations:')
  user.userLocations.forEach(ul => {
    console.log(`  - ${ul.location.name} (ID: ${ul.locationId})`)
  })

  console.log('\n📋 Inventory Corrections at user locations:')
  const locationIds = user.userLocations.map(ul => ul.locationId)
  const corrections = await prisma.inventoryCorrection.findMany({
    where: {
      locationId: { in: locationIds }
    },
    include: {
      product: { select: { name: true, sku: true } },
      location: { select: { name: true } }
    }
  })

  console.log(`  Found ${corrections.length} corrections`)
  corrections.forEach(c => {
    console.log(`  - ID: ${c.id}, Status: ${c.status}, Product: ${c.product.name}, Location: ${c.location.name}`)
  })
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
