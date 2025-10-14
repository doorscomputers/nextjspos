const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
  console.log('🔧 Fixing branchmanager location access...\n')

  // Find the user
  const user = await prisma.user.findFirst({
    where: { username: 'branchmanager' }
  })

  if (!user) {
    console.log('❌ User not found')
    return
  }

  console.log(`✓ Found user: ${user.username} (ID: ${user.id})`)

  // Find the Warehouse location
  const location = await prisma.businessLocation.findFirst({
    where: { name: 'Warehouse' }
  })

  if (!location) {
    console.log('❌ Warehouse location not found')
    return
  }

  console.log(`✓ Found location: ${location.name} (ID: ${location.id})`)

  // Check if already assigned
  const existing = await prisma.userLocation.findUnique({
    where: {
      userId_locationId: {
        userId: user.id,
        locationId: location.id
      }
    }
  })

  if (existing) {
    console.log('✓ Location already assigned to user')
    return
  }

  // Assign location to user
  await prisma.userLocation.create({
    data: {
      userId: user.id,
      locationId: location.id
    }
  })

  console.log('✅ Successfully assigned Warehouse location to branchmanager')
  console.log('ℹ️  Logout and login again for changes to take effect')
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
