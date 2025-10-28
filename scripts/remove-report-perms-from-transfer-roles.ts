import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  try {
    // Find all transfer/warehouse related roles
    const transferRoles = await prisma.role.findMany({
      where: {
        name: {
          in: [
            'Warehouse Manager',
            'Transfer Receiver',
            'Transfer Checker',
            'Transfer Creator',
            'Warehouse Transfer Sender',
            'Transfer Approver'
          ]
        }
      },
      include: {
        permissions: {
          include: {
            permission: true
          }
        }
      }
    })

    console.log(`\nFound ${transferRoles.length} transfer/warehouse roles`)

    for (const role of transferRoles) {
      // Find report permissions
      const reportPermissions = role.permissions.filter(p =>
        p.permission.name.includes('REPORT_')
      )

      if (reportPermissions.length > 0) {
        console.log(`\n${role.name} has ${reportPermissions.length} report permissions:`)
        reportPermissions.forEach(p => console.log(`  - ${p.permission.name}`))

        // Remove them
        console.log(`\nRemoving report permissions from ${role.name}...`)
        await prisma.rolePermission.deleteMany({
          where: {
            roleId: role.id,
            permission: {
              name: {
                contains: 'REPORT_'
              }
            }
          }
        })
        console.log(`✅ Removed all report permissions from ${role.name}`)
      } else {
        console.log(`\n${role.name} - No report permissions to remove`)
      }
    }

    console.log('\n✅ Done! All report permissions have been removed from transfer/warehouse roles.')

  } catch (error) {
    console.error('Error:', error)
  } finally {
    await prisma.$disconnect()
  }
}

main()
