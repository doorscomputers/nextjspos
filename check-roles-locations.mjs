import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function checkRolesAndLocations() {
  console.log('Checking existing roles and locations...\n')

  try {
    // Get business
    const business = await prisma.business.findFirst()
    console.log('📊 Business:', business?.name, '(ID:', business?.id, ')\n')

    // Get all roles
    console.log('👥 Available Roles:')
    const roles = await prisma.role.findMany({
      where: { businessId: business.id },
      include: {
        permissions: {
          include: {
            permission: true
          }
        }
      }
    })

    roles.forEach(role => {
      console.log(`   - ${role.name} (ID: ${role.id}) - ${role.permissions.length} permissions`)
    })

    // Get all locations
    console.log('\n📍 Available Business Locations:')
    const locations = await prisma.businessLocation.findMany({
      where: { businessId: business.id }
    })

    locations.forEach(loc => {
      console.log(`   - ${loc.name} (ID: ${loc.id})`)
    })

    // Get existing users
    console.log('\n👤 Existing Users:')
    const users = await prisma.user.findMany({
      where: { businessId: business.id },
      select: {
        id: true,
        username: true,
        firstName: true,
        surname: true
      }
    })

    users.forEach(user => {
      console.log(`   - ${user.username} (${user.firstName} ${user.surname}) - ID: ${user.id}`)
    })

    return { business, roles, locations, users }

  } catch (error) {
    console.error('❌ Error:', error.message)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

checkRolesAndLocations()
