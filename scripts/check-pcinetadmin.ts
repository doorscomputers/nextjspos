import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function checkAndCreatePcinetAdmin() {
  try {
    console.log('🔍 Checking for pcinetadmin user...')

    // Check if user exists
    const existingUser = await prisma.user.findUnique({
      where: { username: 'pcinetadmin' },
      include: {
        business: true,
        roles: {
          include: {
            role: true
          }
        },
        userLocations: {
          include: {
            location: true
          }
        }
      }
    })

    if (existingUser) {
      console.log('\n✅ User "pcinetadmin" exists!')
      console.log('─'.repeat(60))
      console.log(`ID: ${existingUser.id}`)
      console.log(`Username: ${existingUser.username}`)
      console.log(`Email: ${existingUser.email}`)
      console.log(`Name: ${existingUser.firstName} ${existingUser.lastName}`)
      console.log(`Business: ${existingUser.business?.name || 'N/A'}`)
      console.log(`Allow Login: ${existingUser.allowLogin}`)
      console.log(`Roles: ${existingUser.roles.map(r => r.role.name).join(', ') || 'None'}`)
      console.log(`Locations: ${existingUser.userLocations.map(l => l.location.name).join(', ') || 'All (via permission)'}`)
      console.log('─'.repeat(60))

      // Update password to 111111
      const hashedPassword = await bcrypt.hash('111111', 10)
      await prisma.user.update({
        where: { id: existingUser.id },
        data: { password: hashedPassword }
      })
      console.log('\n✅ Password has been reset to: 111111')

      return
    }

    console.log('\n❌ User "pcinetadmin" does not exist.')
    console.log('Creating user now...\n')

    // Get the first business
    const business = await prisma.business.findFirst()
    if (!business) {
      console.error('❌ No business found. Please run database seed first.')
      return
    }

    // Get System Administrator role
    const systemAdminRole = await prisma.role.findFirst({
      where: {
        businessId: business.id,
        name: 'System Administrator'
      }
    })

    if (!systemAdminRole) {
      console.error('❌ System Administrator role not found. Please run database seed first.')
      return
    }

    // Create the user
    const hashedPassword = await bcrypt.hash('111111', 10)
    const newUser = await prisma.user.create({
      data: {
        surname: 'PCInet',
        firstName: 'Admin',
        lastName: 'User',
        username: 'pcinetadmin',
        email: 'pcinetadmin@pcinetstore.com',
        password: hashedPassword,
        businessId: business.id,
        allowLogin: true,
        userType: 'user',
      }
    })

    console.log('✅ User created successfully!')
    console.log('─'.repeat(60))
    console.log(`ID: ${newUser.id}`)
    console.log(`Username: ${newUser.username}`)
    console.log(`Email: ${newUser.email}`)
    console.log(`Password: 111111`)
    console.log('─'.repeat(60))

    // Assign System Administrator role
    await prisma.userRole.create({
      data: {
        userId: newUser.id,
        roleId: systemAdminRole.id,
      }
    })

    console.log('\n✅ Assigned role: System Administrator')
    console.log('\n🎉 Done! You can now login with:')
    console.log('   Username: pcinetadmin')
    console.log('   Password: 111111')

  } catch (error) {
    console.error('❌ Error:', error)
  } finally {
    await prisma.$disconnect()
  }
}

checkAndCreatePcinetAdmin()
