import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  try {
    // List all users first
    const allUsers = await prisma.user.findMany({
      select: {
        id: true,
        username: true,
        firstName: true,
        lastName: true,
        surname: true
      }
    })

    console.log('\n=== ALL USERS ===')
    allUsers.forEach(u => console.log(`${u.id}: ${u.username} (${u.firstName || ''} ${u.lastName || u.surname || 'N/A'})`))

    // Find user with username containing 'Jhelrone' or 'terre'
    const user = await prisma.user.findFirst({
      where: {
        OR: [
          { username: { contains: 'jhelrone', mode: 'insensitive' } },
          { firstName: { contains: 'Jhelrone', mode: 'insensitive' } },
          { surname: { contains: 'Terre', mode: 'insensitive' } }
        ]
      },
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

    console.log('\n=== USER INFORMATION ===')
    console.log(`Username: ${user.username}`)
    console.log(`Name: ${user.name}`)
    console.log(`Business ID: ${user.businessId}`)

    console.log('\n=== ROLES ===')
    for (const userRole of user.roles) {
      console.log(`\n- ${userRole.role.name}`)
      const reportPerms = userRole.role.permissions
        .filter(p => p.permission.name.includes('REPORT_'))
        .map(p => p.permission.name)

      if (reportPerms.length > 0) {
        console.log('  Report Permissions:')
        reportPerms.forEach(p => console.log(`    - ${p}`))
      } else {
        console.log('  No report permissions')
      }
    }

    console.log('\n=== DIRECT USER PERMISSIONS ===')
    const userReportPerms = user.permissions
      .filter(p => p.permission.name.includes('REPORT_'))
      .map(p => p.permission.name)

    if (userReportPerms.length > 0) {
      userReportPerms.forEach(p => console.log(`  - ${p}`))
    } else {
      console.log('  No direct report permissions')
    }

    console.log('\n=== ALL PERMISSIONS (Combined) ===')
    const allPermissions = new Set<string>()

    // Add role permissions
    for (const userRole of user.roles) {
      userRole.role.permissions.forEach(p => {
        allPermissions.add(p.permission.name)
      })
    }

    // Add direct permissions
    user.permissions.forEach(p => {
      allPermissions.add(p.permission.name)
    })

    const allReportPerms = Array.from(allPermissions).filter(p => p.includes('REPORT_')).sort()
    console.log(`Total Report Permissions: ${allReportPerms.length}`)
    allReportPerms.forEach(p => console.log(`  - ${p}`))

  } catch (error) {
    console.error('Error:', error)
  } finally {
    await prisma.$disconnect()
  }
}

main()
