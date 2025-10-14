const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
  const user = await prisma.user.findFirst({
    where: { username: 'Jheirone' },
    include: {
      roles: {
        include: {
          role: {
            include: {
              permissions: {
                include: {
                  permission: true
                }
              }
            }
          }
        }
      },
      permissions: {
        include: {
          permission: true
        }
      }
    }
  })

  if (!user) {
    console.log('User not found')
    return
  }

  console.log('\n=== User: Jheirone ===')
  console.log('Business ID:', user.businessId)

  console.log('\n=== Roles ===')
  user.roles.forEach(ur => {
    console.log(`- ${ur.role.name}`)
  })

  console.log('\n=== All Permissions ===')
  const allPerms = new Set()

  // From roles
  user.roles.forEach(ur => {
    ur.role.permissions.forEach(rp => {
      allPerms.add(rp.permission.name)
    })
  })

  // Direct permissions
  user.permissions.forEach(up => {
    allPerms.add(up.permission.name)
  })

  Array.from(allPerms).sort().forEach(perm => {
    console.log(`- ${perm}`)
  })

  console.log('\n=== Checking ACCESS_ALL_LOCATIONS ===')
  console.log('Has ACCESS_ALL_LOCATIONS:', allPerms.has('access_all_locations'))

  console.log('\n=== All Business Locations ===')
  const allLocations = await prisma.businessLocation.findMany({
    where: {
      businessId: user.businessId,
      deletedAt: null
    },
    select: {
      id: true,
      name: true
    }
  })

  console.log(`Total locations: ${allLocations.length}`)
  allLocations.forEach(loc => {
    console.log(`- ${loc.name} (ID: ${loc.id})`)
  })
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
