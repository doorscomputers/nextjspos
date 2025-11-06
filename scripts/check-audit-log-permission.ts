import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function checkAuditLogPermission() {
  console.log('🔍 Checking AUDIT_LOG_VIEW permission...\n')

  try {
    // Find the permission
    const permission = await prisma.permission.findFirst({
      where: { name: 'audit_log.view' },
    })

    if (!permission) {
      console.log('❌ Permission "audit_log.view" does NOT exist!')
      console.log('\n📝 Creating the permission now...\n')

      const newPermission = await prisma.permission.create({
        data: {
          name: 'audit_log.view',
          description: 'View audit logs and system activity',
        },
      })

      console.log(`✅ Created permission: ${newPermission.name} (ID: ${newPermission.id})`)

      // Add to Super Admin and Admin roles
      const roles = await prisma.role.findMany({
        where: {
          name: {
            in: ['Super Admin', 'Admin', 'All Branch Admin'],
          },
        },
      })

      console.log('\n📋 Adding permission to roles:\n')

      for (const role of roles) {
        const existing = await prisma.rolePermission.findUnique({
          where: {
            roleId_permissionId: {
              roleId: role.id,
              permissionId: newPermission.id,
            },
          },
        })

        if (!existing) {
          await prisma.rolePermission.create({
            data: {
              roleId: role.id,
              permissionId: newPermission.id,
            },
          })
          console.log(`   ✅ Added to "${role.name}"`)
        } else {
          console.log(`   ⏭️  Already linked to "${role.name}"`)
        }
      }

      console.log('\n✅ Permission setup complete!')
      console.log('\n⚠️  Users must LOGOUT and LOGIN again to see changes!')
    } else {
      console.log(`✅ Permission exists: ${permission.name} (ID: ${permission.id})`)

      // Check which roles have this permission
      const rolePermissions = await prisma.rolePermission.findMany({
        where: { permissionId: permission.id },
        include: {
          role: {
            select: {
              name: true,
            },
          },
        },
      })

      console.log('\n📋 Roles with this permission:')
      for (const rp of rolePermissions) {
        console.log(`   ✅ ${rp.role.name}`)
      }

      if (rolePermissions.length === 0) {
        console.log('   ⚠️  No roles have this permission yet!')
      }
    }
  } catch (error: any) {
    console.error('❌ Error:', error.message)
  } finally {
    await prisma.$disconnect()
  }
}

checkAuditLogPermission().catch(console.error)
