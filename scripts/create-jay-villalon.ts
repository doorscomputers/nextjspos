import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function createJayVillalon() {
  console.log('🔧 Creating Jay Villalon user (Reports Admin)...\n')

  try {
    // Check if user already exists
    const existing = await prisma.user.findUnique({
      where: { username: 'jayvillalon' }
    })

    if (existing) {
      console.log('⚠️  jayvillalon user already exists!')
      return
    }

    // Get business
    const business = await prisma.business.findFirst()
    if (!business) {
      console.log('❌ No business found!')
      return
    }

    // Hash password: 111111
    const hashedPassword = await bcrypt.hash('111111', 10)

    // Create Reports Admin role if it doesn't exist
    let reportsAdminRole = await prisma.role.findFirst({
      where: {
        businessId: business.id,
        name: 'Reports Admin'
      }
    })

    if (!reportsAdminRole) {
      console.log('Creating Reports Admin role...')
      reportsAdminRole = await prisma.role.create({
        data: {
          name: 'Reports Admin',
          businessId: business.id,
          guardName: 'web',
          isDefault: false
        }
      })

      // Get all view and report permissions
      const viewReportPermissions = await prisma.permission.findMany({
        where: {
          OR: [
            { name: { contains: 'view' } },
            { name: { contains: 'report' } },
            { name: { contains: 'list' } },
            { name: { contains: 'read' } }
          ]
        }
      })

      console.log(`   Found ${viewReportPermissions.length} view/report permissions`)

      // Assign permissions to role
      for (const permission of viewReportPermissions) {
        await prisma.rolePermission.create({
          data: {
            roleId: reportsAdminRole.id,
            permissionId: permission.id
          }
        })
      }

      console.log('   ✅ Reports Admin role created')
    }

    // Create Jay Villalon user
    const jay = await prisma.user.create({
      data: {
        surname: 'Villalon',
        firstName: 'Jay',
        lastName: 'Admin',
        username: 'jayvillalon',
        email: 'jay.villalon@pcinet.com',
        password: hashedPassword,
        allowLogin: true,
        userType: 'user',
        business: {
          connect: { id: business.id }
        }
        // locationId: null (not tied to specific location)
      }
    })

    // Assign role
    await prisma.userRole.create({
      data: {
        userId: jay.id,
        roleId: reportsAdminRole.id
      }
    })

    console.log('\n✅ Jay Villalon created successfully!')
    console.log()
    console.log('═══════════════════════════════════════════════════════')
    console.log('📝 LOGIN CREDENTIALS')
    console.log('═══════════════════════════════════════════════════════')
    console.log()
    console.log('   Username: jayvillalon')
    console.log('   Password: 111111')
    console.log('   Role: Reports Admin')
    console.log('   Location: NULL (all locations)')
    console.log()
    console.log('═══════════════════════════════════════════════════════')
    console.log('📋 CAPABILITIES')
    console.log('═══════════════════════════════════════════════════════')
    console.log()
    console.log('✅ CAN DO:')
    console.log('   - View all reports (all locations)')
    console.log('   - View products, customers, suppliers')
    console.log('   - View sales, purchase, transfer data')
    console.log('   - View inventory levels')
    console.log('   - View dashboards and analytics')
    console.log()
    console.log('❌ CANNOT DO:')
    console.log('   - Create/Edit/Delete anything')
    console.log('   - Process transactions')
    console.log('   - Modify prices')
    console.log('   - Manage users or settings')
    console.log()

  } catch (error) {
    console.error('❌ Error:', error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

createJayVillalon()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
