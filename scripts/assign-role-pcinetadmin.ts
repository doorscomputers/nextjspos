import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function assignRoleToPcinetAdmin() {
  try {
    console.log('🔧 Assigning System Administrator role to pcinetadmin...')

    // Get the user
    const user = await prisma.user.findUnique({
      where: { username: 'pcinetadmin' },
      include: { business: true }
    })

    if (!user) {
      console.error('❌ User "pcinetadmin" not found')
      return
    }

    // Get System Administrator role
    const systemAdminRole = await prisma.role.findFirst({
      where: {
        businessId: user.businessId!,
        name: 'System Administrator'
      }
    })

    if (!systemAdminRole) {
      console.error('❌ System Administrator role not found')
      return
    }

    // Check if already assigned
    const existingAssignment = await prisma.userRole.findUnique({
      where: {
        userId_roleId: {
          userId: user.id,
          roleId: systemAdminRole.id
        }
      }
    })

    if (existingAssignment) {
      console.log('✅ Role already assigned!')
      return
    }

    // Assign the role
    await prisma.userRole.create({
      data: {
        userId: user.id,
        roleId: systemAdminRole.id,
      }
    })

    console.log('✅ System Administrator role assigned successfully!')
    console.log('\n🎉 Login credentials:')
    console.log('─'.repeat(50))
    console.log('Username: pcinetadmin')
    console.log('Password: 111111')
    console.log('Role:     System Administrator')
    console.log('─'.repeat(50))

  } catch (error) {
    console.error('❌ Error:', error)
  } finally {
    await prisma.$disconnect()
  }
}

assignRoleToPcinetAdmin()
