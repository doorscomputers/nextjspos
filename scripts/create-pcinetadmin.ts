import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function createPcinetAdmin() {
  console.log('🔧 Creating pcinetadmin user (duplicate of superadmin)...\n')

  try {
    // Check if pcinetadmin already exists
    const existing = await prisma.user.findUnique({
      where: { username: 'pcinetadmin' }
    })

    if (existing) {
      console.log('⚠️  pcinetadmin user already exists!')
      console.log(`   Username: ${existing.username}`)
      console.log(`   Email: ${existing.email}`)
      console.log(`   Business ID: ${existing.businessId}`)
      console.log(`   Location ID: ${existing.locationId || 'NULL (not location-specific)'}`)
      console.log('\nNo action needed.')
      return
    }

    // Get superadmin user
    const superadmin = await prisma.user.findUnique({
      where: { username: 'superadmin' },
      include: {
        roles: {
          include: {
            role: true
          }
        },
        permissions: {
          include: {
            permission: true
          }
        }
      }
    })

    if (!superadmin) {
      console.log('❌ superadmin user not found!')
      console.log('Cannot create duplicate without source user.')
      return
    }

    console.log('✅ Found superadmin user')
    console.log(`   Business ID: ${superadmin.businessId}`)
    console.log(`   Roles: ${superadmin.roles.length}`)
    console.log(`   Direct Permissions: ${superadmin.permissions.length}`)
    console.log()

    // Hash password: 111111
    const hashedPassword = await bcrypt.hash('111111', 10)

    // Create pcinetadmin user
    const pcinetadmin = await prisma.user.create({
      data: {
        surname: 'Administrator',
        firstName: 'PciNet',
        lastName: 'Admin',
        username: 'pcinetadmin',
        email: 'pcinetadmin@pcinet.com',
        password: hashedPassword,
        allowLogin: true,
        userType: 'user',
        business: {
          connect: { id: superadmin.businessId }
        }
        // locationId: null by default (not tied to specific location)
      }
    })

    console.log('✅ Created pcinetadmin user')
    console.log(`   User ID: ${pcinetadmin.id}`)
    console.log(`   Username: pcinetadmin`)
    console.log(`   Password: 111111`)
    console.log(`   Location: NULL (not location-specific)`)
    console.log()

    // Assign the same roles
    let roleCount = 0
    for (const userRole of superadmin.roles) {
      await prisma.userRole.create({
        data: {
          userId: pcinetadmin.id,
          roleId: userRole.roleId
        }
      })
      roleCount++
      console.log(`   ✅ Assigned role: ${userRole.role.name}`)
    }

    // Assign the same direct permissions (if any)
    let permCount = 0
    for (const userPerm of superadmin.permissions) {
      await prisma.userPermission.create({
        data: {
          userId: pcinetadmin.id,
          permissionId: userPerm.permissionId
        }
      })
      permCount++
    }

    if (permCount > 0) {
      console.log(`   ✅ Assigned ${permCount} direct permissions`)
    }

    console.log()
    console.log('🎉 pcinetadmin user created successfully!')
    console.log()
    console.log('═══════════════════════════════════════════════════════')
    console.log('📝 LOGIN CREDENTIALS')
    console.log('═══════════════════════════════════════════════════════')
    console.log()
    console.log('   Username: pcinetadmin')
    console.log('   Password: 111111')
    console.log()
    console.log('═══════════════════════════════════════════════════════')
    console.log('📋 USER CHARACTERISTICS')
    console.log('═══════════════════════════════════════════════════════')
    console.log()
    console.log('✅ CAN DO:')
    console.log('   - View all reports (all locations)')
    console.log('   - Edit/Create/Delete products (CRUD)')
    console.log('   - Manage categories, brands, units, etc.')
    console.log('   - Manage users and permissions')
    console.log('   - Configure system settings')
    console.log()
    console.log('❌ SHOULD NOT DO (location-based transactions):')
    console.log('   - Process Sales (location-specific)')
    console.log('   - Create Purchases (location-specific)')
    console.log('   - Create/Approve Transfers (location-specific)')
    console.log('   - Adjust Stock (location-specific)')
    console.log()
    console.log('💡 TIP: You can disable these menu items via menu permissions')
    console.log('   after logging in as pcinetadmin')
    console.log()

  } catch (error) {
    console.error('❌ Error:', error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

createPcinetAdmin()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
