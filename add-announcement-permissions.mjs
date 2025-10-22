import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function addAnnouncementPermissions() {
  console.log('🚀 Adding announcement permissions to database...')

  try {
    // Step 1: Create the announcement permissions if they don't exist
    const announcementPermissions = [
      'announcement.view',
      'announcement.create',
      'announcement.update',
      'announcement.delete',
      'announcement.manage',
    ]

    console.log('📝 Creating announcement permissions...')

    for (const permName of announcementPermissions) {
      const existing = await prisma.permission.findUnique({
        where: { name: permName }
      })

      if (!existing) {
        await prisma.permission.create({
          data: {
            name: permName,
            guardName: 'web',
          }
        })
        console.log(`✅ Created permission: ${permName}`)
      } else {
        console.log(`ℹ️  Permission already exists: ${permName}`)
      }
    }

    // Step 2: Get all announcement permissions
    const permissions = await prisma.permission.findMany({
      where: {
        name: {
          in: announcementPermissions
        }
      }
    })

    console.log(`\n📊 Found ${permissions.length} announcement permissions`)

    // Step 3: Get roles that should have announcement permissions
    const rolesToUpdate = [
      'Super Admin',
      'Branch Admin',
      'Branch Manager',
      'Admin', // Common role name
    ]

    for (const roleName of rolesToUpdate) {
      // Find all roles with this name across all businesses
      const roles = await prisma.role.findMany({
        where: {
          name: roleName
        },
        include: {
          permissions: {
            include: {
              permission: true
            }
          }
        }
      })

      if (roles.length === 0) {
        console.log(`⚠️  No roles found with name: ${roleName}`)
        continue
      }

      for (const role of roles) {
        console.log(`\n🔧 Updating role: ${role.name} (ID: ${role.id}, Business: ${role.businessId})`)

        // Get permission IDs this role already has
        const existingPermissionIds = role.permissions.map(rp => rp.permissionId)

        // Add announcement permissions that aren't already assigned
        let addedCount = 0
        for (const permission of permissions) {
          if (!existingPermissionIds.includes(permission.id)) {
            try {
              await prisma.rolePermission.create({
                data: {
                  roleId: role.id,
                  permissionId: permission.id,
                }
              })
              addedCount++
            } catch (error) {
              // Ignore if already exists (duplicate key error)
              if (!error.message.includes('Unique constraint')) {
                throw error
              }
            }
          }
        }

        if (addedCount > 0) {
          console.log(`✅ Added ${addedCount} announcement permissions to ${role.name}`)
        } else {
          console.log(`ℹ️  Role ${role.name} already has all announcement permissions`)
        }
      }
    }

    console.log('\n✅ Successfully added announcement permissions!')
    console.log('\n🔄 Please log out and log back in to refresh your session with new permissions.')

  } catch (error) {
    console.error('❌ Error adding announcement permissions:', error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

addAnnouncementPermissions()
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
