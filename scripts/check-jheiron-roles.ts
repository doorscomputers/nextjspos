import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function checkJheironRoles() {
  try {
    const user = await prisma.user.findFirst({
      where: { username: 'Jheiron' },
      include: {
        roles: {
          include: {
            role: true
          }
        }
      }
    })

    if (!user) {
      console.log('❌ User Jheiron not found')
      return
    }

    const roleNames = user.roles.map(r => r.role.name)
    console.log('👤 Username:', user.username)
    console.log('📋 Roles:', roleNames.join(', '))
    console.log()

    // Check if any role matches admin criteria
    const ADMIN_ROLES = ['Super Admin', 'System Administrator', 'All Branch Admin']
    const isAdminRole = roleNames.some(role => ADMIN_ROLES.includes(role))

    console.log('🔐 Admin Detection:')
    console.log('   Admin roles that bypass RFID:', ADMIN_ROLES.join(', '))
    console.log('   User has admin role?', isAdminRole ? '✅ YES' : '❌ NO')
    console.log()

    if (isAdminRole) {
      console.log('⚠️  This user CAN login without RFID scanning (admin exempt)')
    } else {
      console.log('✅ This user SHOULD be blocked without RFID scanning')
    }

  } catch (error) {
    console.error('Error:', error)
  } finally {
    await prisma.$disconnect()
  }
}

checkJheironRoles()
