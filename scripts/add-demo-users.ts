import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL,
    },
  },
})

async function addDemoUsers() {
  console.log('Adding demo users to Supabase...\n')

  try {
    // Get first business
    const business = await prisma.business.findFirst()
    if (!business) {
      console.error('No business found! Run migration first.')
      process.exit(1)
    }

    console.log(`Found business: ${business.name} (ID: ${business.id})`)

    // Get first location
    const location = await prisma.businessLocation.findFirst({
      where: { businessId: business.id }
    })

    // Get roles
    const superAdminRole = await prisma.role.findFirst({
      where: {
        businessId: business.id,
        name: 'Super Admin'
      }
    })

    const adminRole = await prisma.role.findFirst({
      where: {
        businessId: business.id,
        name: 'Admin'
      }
    })

    if (!superAdminRole || !adminRole) {
      console.error('Required roles not found!')
      process.exit(1)
    }

    // Hash password
    const hashedPassword = await bcrypt.hash('password', 10)

    // Create or update superadmin
    const superadmin = await prisma.user.upsert({
      where: { username: 'superadmin' },
      update: {
        password: hashedPassword,
      },
      create: {
        username: 'superadmin',
        email: 'superadmin@example.com',
        password: hashedPassword,
        surname: 'Super',
        firstName: 'Admin',
        businessId: business.id,
        allowLogin: true,
      },
    })

    // Assign Super Admin role
    await prisma.userRole.upsert({
      where: {
        userId_roleId: {
          userId: superadmin.id,
          roleId: superAdminRole.id,
        },
      },
      update: {},
      create: {
        userId: superadmin.id,
        roleId: superAdminRole.id,
      },
    })

    // Create or update admin
    const admin = await prisma.user.upsert({
      where: { username: 'admin' },
      update: {
        password: hashedPassword,
      },
      create: {
        username: 'admin',
        email: 'admin@example.com',
        password: hashedPassword,
        surname: 'Admin',
        firstName: 'User',
        businessId: business.id,
        allowLogin: true,
      },
    })

    // Assign Admin role
    await prisma.userRole.upsert({
      where: {
        userId_roleId: {
          userId: admin.id,
          roleId: adminRole.id,
        },
      },
      update: {},
      create: {
        userId: admin.id,
        roleId: adminRole.id,
      },
    })

    console.log('\n✓ Demo users added successfully!')
    console.log('\nYou can now login with:')
    console.log('  Username: superadmin')
    console.log('  Password: password')
    console.log('    OR')
    console.log('  Username: admin')
    console.log('  Password: password')

  } catch (error) {
    console.error('Error adding demo users:', error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

addDemoUsers()
