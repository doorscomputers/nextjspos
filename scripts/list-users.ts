/**
 * List all users in the database
 */
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const users = await prisma.user.findMany({
    select: {
      id: true,
      username: true,
      email: true,
      businessId: true,
      roles: {
        select: {
          role: {
            select: {
              name: true
            }
          }
        }
      }
    }
  })

  console.log('📋 All users in database:\n')
  users.forEach(user => {
    const roles = user.roles.map(r => r.role.name).join(', ')
    console.log(`  ID: ${user.id}`)
    console.log(`  Username: ${user.username}`)
    console.log(`  Email: ${user.email}`)
    console.log(`  Business ID: ${user.businessId}`)
    console.log(`  Roles: ${roles}`)
    console.log('  ---')
  })
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
