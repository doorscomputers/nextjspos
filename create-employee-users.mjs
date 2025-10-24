import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

// Configuration
const BUSINESS_ID = 1 // PciNet Computer Trading and Services
const DEFAULT_PASSWORD = 'password123' // Change this to a secure password
const SALT_ROUNDS = 10

// Location IDs
const LOCATIONS = {
  MAIN_STORE: 1,
  BAMBANG: 3,
  TUGUEGARAO: 4
}

// Role IDs
const ROLES = {
  SALES_CASHIER: 52,      // For cashier operations
  TRANSFER_RECEIVER: 29,  // For receiving transfers
  TRANSFER_SENDER: 28     // For sending transfers
}

// User definitions
const USERS_TO_CREATE = [
  // ========================================
  // JOJIT KATE - Main Store
  // ========================================
  {
    username: 'JOJITKATECashierMain',
    firstName: 'JOJIT',
    surname: 'KATE',
    lastName: null,
    email: 'jojit.kate.cashier.main@pcinet.com',
    roles: [ROLES.SALES_CASHIER],
    locations: [LOCATIONS.MAIN_STORE],
    description: 'Cashier - Main Store (POS, Sales Reports, X/Z Reading)'
  },
  {
    username: 'JOJITKATETransferReceiverMain',
    firstName: 'JOJIT',
    surname: 'KATE',
    lastName: null,
    email: 'jojit.kate.transfer.main@pcinet.com',
    roles: [ROLES.TRANSFER_RECEIVER, ROLES.TRANSFER_SENDER],
    locations: [LOCATIONS.MAIN_STORE],
    description: 'Transfer Receiver/Sender - Main Store'
  },

  // ========================================
  // JOJIT KATE - Bambang
  // ========================================
  {
    username: 'JOJITKATECashierBambang',
    firstName: 'JOJIT',
    surname: 'KATE',
    lastName: null,
    email: 'jojit.kate.cashier.bambang@pcinet.com',
    roles: [ROLES.SALES_CASHIER],
    locations: [LOCATIONS.BAMBANG],
    description: 'Cashier - Bambang (POS, Sales Reports, X/Z Reading)'
  },
  {
    username: 'JOJITKATETransferReceiverBambang',
    firstName: 'JOJIT',
    surname: 'KATE',
    lastName: null,
    email: 'jojit.kate.transfer.bambang@pcinet.com',
    roles: [ROLES.TRANSFER_RECEIVER, ROLES.TRANSFER_SENDER],
    locations: [LOCATIONS.BAMBANG],
    description: 'Transfer Receiver/Sender - Bambang'
  },

  // ========================================
  // JASMIN KATE - Bambang
  // ========================================
  {
    username: 'JASMINKATECashierBambang',
    firstName: 'JASMIN',
    surname: 'KATE',
    lastName: null,
    email: 'jasmin.kate.cashier.bambang@pcinet.com',
    roles: [ROLES.SALES_CASHIER],
    locations: [LOCATIONS.BAMBANG],
    description: 'Cashier - Bambang (POS, Sales Reports, X/Z Reading)'
  },
  {
    username: 'JASMINKATETransferReceiverBambang',
    firstName: 'JASMIN',
    surname: 'KATE',
    lastName: null,
    email: 'jasmin.kate.transfer.bambang@pcinet.com',
    roles: [ROLES.TRANSFER_RECEIVER, ROLES.TRANSFER_SENDER],
    locations: [LOCATIONS.BAMBANG],
    description: 'Transfer Receiver/Sender - Bambang'
  },

  // ========================================
  // JASMIN KATE - Main Store
  // ========================================
  {
    username: 'JASMINKATECashierMain',
    firstName: 'JASMIN',
    surname: 'KATE',
    lastName: null,
    email: 'jasmin.kate.cashier.main@pcinet.com',
    roles: [ROLES.SALES_CASHIER],
    locations: [LOCATIONS.MAIN_STORE],
    description: 'Cashier - Main Store (POS, Sales Reports, X/Z Reading)'
  },
  {
    username: 'JASMINKATETransferReceiverMain',
    firstName: 'JASMIN',
    surname: 'KATE',
    lastName: null,
    email: 'jasmin.kate.transfer.main@pcinet.com',
    roles: [ROLES.TRANSFER_RECEIVER, ROLES.TRANSFER_SENDER],
    locations: [LOCATIONS.MAIN_STORE],
    description: 'Transfer Receiver/Sender - Main Store'
  },

  // ========================================
  // ERICSON CHAN - Tuguegarao
  // ========================================
  {
    username: 'EricsonChanCashierTugue',
    firstName: 'ERICSON',
    surname: 'CHAN',
    lastName: null,
    email: 'ericson.chan.cashier.tugue@pcinet.com',
    roles: [ROLES.SALES_CASHIER],
    locations: [LOCATIONS.TUGUEGARAO],
    description: 'Cashier - Tuguegarao (POS, Sales Reports, X/Z Reading)'
  },
  {
    username: 'EricsonChanTransferReceiverTugue',
    firstName: 'ERICSON',
    surname: 'CHAN',
    lastName: null,
    email: 'ericson.chan.transfer.tugue@pcinet.com',
    roles: [ROLES.TRANSFER_RECEIVER, ROLES.TRANSFER_SENDER],
    locations: [LOCATIONS.TUGUEGARAO],
    description: 'Transfer Receiver/Sender - Tuguegarao'
  }
]

async function createUsers() {
  console.log('🚀 Starting User Creation Process...\n')
  console.log(`Business ID: ${BUSINESS_ID}`)
  console.log(`Default Password: ${DEFAULT_PASSWORD}`)
  console.log(`Users to Create: ${USERS_TO_CREATE.length}\n`)
  console.log('━'.repeat(80))

  const hashedPassword = await bcrypt.hash(DEFAULT_PASSWORD, SALT_ROUNDS)

  let created = 0
  let skipped = 0
  let errors = 0

  for (const userDef of USERS_TO_CREATE) {
    try {
      console.log(`\n📝 Creating: ${userDef.username}`)
      console.log(`   Name: ${userDef.firstName} ${userDef.surname}`)
      console.log(`   Description: ${userDef.description}`)

      // Check if user already exists
      const existingUser = await prisma.user.findUnique({
        where: { username: userDef.username }
      })

      if (existingUser) {
        console.log(`   ⚠️  User already exists (ID: ${existingUser.id}) - SKIPPED`)
        skipped++
        continue
      }

      // Create the user
      const user = await prisma.user.create({
        data: {
          username: userDef.username,
          firstName: userDef.firstName,
          surname: userDef.surname,
          lastName: userDef.lastName,
          email: userDef.email,
          password: hashedPassword,
          businessId: BUSINESS_ID,
          allowLogin: true,
          userType: 'user',
          theme: 'light',
          themeMode: 'light',
          language: 'en'
        }
      })

      console.log(`   ✅ User created (ID: ${user.id})`)

      // Assign roles
      for (const roleId of userDef.roles) {
        await prisma.userRole.create({
          data: {
            userId: user.id,
            roleId: roleId
          }
        })
        const role = await prisma.role.findUnique({ where: { id: roleId } })
        console.log(`   ✅ Assigned role: ${role.name}`)
      }

      // Assign locations
      for (const locationId of userDef.locations) {
        await prisma.userLocation.create({
          data: {
            userId: user.id,
            locationId: locationId
          }
        })
        const location = await prisma.businessLocation.findUnique({ where: { id: locationId } })
        console.log(`   ✅ Assigned location: ${location.name}`)
      }

      created++

    } catch (error) {
      console.log(`   ❌ Error: ${error.message}`)
      errors++
    }
  }

  console.log('\n' + '━'.repeat(80))
  console.log('\n📊 Summary:')
  console.log(`   ✅ Created: ${created}`)
  console.log(`   ⚠️  Skipped: ${skipped}`)
  console.log(`   ❌ Errors: ${errors}`)
  console.log(`   📝 Total: ${USERS_TO_CREATE.length}`)

  if (created > 0) {
    console.log('\n✨ Success! Users have been created.')
    console.log('\n📋 Login Credentials:')
    console.log(`   Username: [See list above]`)
    console.log(`   Password: ${DEFAULT_PASSWORD}`)
    console.log('\n⚠️  IMPORTANT: Change the default password after first login!')
  }

  console.log('\n🎯 What\'s Next:')
  console.log('   1. Test login with one of the created users')
  console.log('   2. Verify role permissions are working')
  console.log('   3. Check location access restrictions')
  console.log('   4. Update passwords for security')
  console.log('   5. Configure employee schedules if using schedule-based login')

  // Display user list for easy reference
  console.log('\n📝 Created User List:')
  console.log('━'.repeat(80))

  const createdUsers = await prisma.user.findMany({
    where: {
      username: {
        in: USERS_TO_CREATE.map(u => u.username)
      }
    },
    include: {
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

  for (const user of createdUsers) {
    console.log(`\n👤 ${user.username}`)
    console.log(`   Name: ${user.firstName} ${user.surname}`)
    console.log(`   Email: ${user.email}`)
    console.log(`   Roles: ${user.roles.map(r => r.role.name).join(', ')}`)
    console.log(`   Locations: ${user.userLocations.map(l => l.location.name).join(', ')}`)
  }

  console.log('\n' + '━'.repeat(80))
  console.log('✅ User creation process complete!')
}

async function main() {
  try {
    await createUsers()
  } catch (error) {
    console.error('❌ Fatal error:', error)
  } finally {
    await prisma.$disconnect()
  }
}

main()
