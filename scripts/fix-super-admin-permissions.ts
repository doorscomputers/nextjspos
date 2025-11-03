import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function fixSuperAdminPermissions() {
  console.log('🔧 Fixing Super Admin Permissions...\n')

  try {
    // Get all permissions
    const allPermissions = await prisma.permission.findMany()
    console.log(`✅ Found ${allPermissions.length} permissions`)

    // Get all businesses
    const businesses = await prisma.business.findMany()
    console.log(`✅ Found ${businesses.length} business(es)\n`)

    for (const business of businesses) {
      console.log(`📋 Processing business: ${business.name} (ID: ${business.id})`)

      // Find System Administrator and Super Admin roles
      const adminRoles = await prisma.role.findMany({
        where: {
          businessId: business.id,
          name: {
            in: ['System Administrator', 'Super Admin']
          }
        }
      })

      if (adminRoles.length === 0) {
        console.log(`⚠️  No admin roles found for business ${business.name}`)
        continue
      }

      for (const adminRole of adminRoles) {
        console.log(`   🔑 Processing role: ${adminRole.name}`)

        let addedCount = 0
        let existingCount = 0

        for (const permission of allPermissions) {
          const existing = await prisma.rolePermission.findUnique({
            where: {
              roleId_permissionId: {
                roleId: adminRole.id,
                permissionId: permission.id
              }
            }
          })

          if (existing) {
            existingCount++
          } else {
            await prisma.rolePermission.create({
              data: {
                roleId: adminRole.id,
                permissionId: permission.id
              }
            })
            addedCount++
          }
        }

        console.log(`      ✅ Added ${addedCount} new permissions`)
        console.log(`      ℹ️  ${existingCount} permissions already existed`)
        console.log(`      📊 Total: ${addedCount + existingCount}/${allPermissions.length} permissions\n`)
      }
    }

    console.log('🎉 Super Admin permissions fixed successfully!')
    console.log('\n📝 Next steps:')
    console.log('1. Logout from your Super Admin account')
    console.log('2. Login again')
    console.log('3. You should now see ALL menus and features enabled')

  } catch (error) {
    console.error('❌ Error:', error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

fixSuperAdminPermissions()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
