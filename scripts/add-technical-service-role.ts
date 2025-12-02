/**
 * Script to add Technical Service Manager role to the database
 * Run with: DATABASE_URL="your-connection-string" npx tsx scripts/add-technical-service-role.ts
 */

import { PrismaClient } from '@prisma/client'
import { PERMISSIONS, DEFAULT_ROLES } from '../src/lib/rbac'

const prisma = new PrismaClient()

async function main() {
  console.log('Adding Technical Service Manager role...')

  // Get the business (assuming single business for now, or use specific businessId)
  const business = await prisma.business.findFirst()
  if (!business) {
    console.error('No business found in database')
    process.exit(1)
  }

  console.log(`Using business: ${business.name} (ID: ${business.id})`)

  // Get the role data from DEFAULT_ROLES
  const roleData = DEFAULT_ROLES.TECHNICAL_SERVICE_MANAGER
  if (!roleData) {
    console.error('TECHNICAL_SERVICE_MANAGER not found in DEFAULT_ROLES')
    process.exit(1)
  }

  // Check if role already exists
  let role = await prisma.role.findFirst({
    where: {
      name: roleData.name,
      businessId: business.id,
    },
  })

  if (role) {
    console.log(`Role "${roleData.name}" already exists (ID: ${role.id})`)
  } else {
    // Create the role
    role = await prisma.role.create({
      data: {
        name: roleData.name,
        description: roleData.description,
        businessId: business.id,
      },
    })
    console.log(`Created role "${roleData.name}" (ID: ${role.id})`)
  }

  // Get all permission names from the role definition
  const permissionNames = roleData.permissions

  // Find existing permissions in database
  const existingPermissions = await prisma.permission.findMany({
    where: {
      name: {
        in: permissionNames,
      },
    },
  })

  console.log(`Found ${existingPermissions.length} of ${permissionNames.length} permissions in database`)

  // Create missing permissions
  const existingPermissionNames = existingPermissions.map(p => p.name)
  const missingPermissions = permissionNames.filter(p => !existingPermissionNames.includes(p))

  if (missingPermissions.length > 0) {
    console.log(`Creating ${missingPermissions.length} missing permissions...`)
    for (const permName of missingPermissions) {
      await prisma.permission.create({
        data: {
          name: permName,
          description: `Permission: ${permName}`,
        },
      })
    }
    console.log('Missing permissions created')
  }

  // Get all permissions again (including newly created ones)
  const allPermissions = await prisma.permission.findMany({
    where: {
      name: {
        in: permissionNames,
      },
    },
  })

  // Get existing role permissions
  const existingRolePermissions = await prisma.rolePermission.findMany({
    where: {
      roleId: role.id,
    },
  })

  const existingPermissionIds = existingRolePermissions.map(rp => rp.permissionId)

  // Add missing role permissions
  let addedCount = 0
  for (const permission of allPermissions) {
    if (!existingPermissionIds.includes(permission.id)) {
      await prisma.rolePermission.create({
        data: {
          roleId: role.id,
          permissionId: permission.id,
        },
      })
      addedCount++
    }
  }

  console.log(`Added ${addedCount} new permissions to role`)

  // Summary
  const finalRolePermissions = await prisma.rolePermission.count({
    where: { roleId: role.id },
  })

  console.log('')
  console.log('='.repeat(50))
  console.log('Technical Service Manager Role Summary:')
  console.log('='.repeat(50))
  console.log(`Role ID: ${role.id}`)
  console.log(`Role Name: ${role.name}`)
  console.log(`Description: ${role.description}`)
  console.log(`Total Permissions: ${finalRolePermissions}`)
  console.log('='.repeat(50))
  console.log('')
  console.log('Permissions included:')
  console.log('- Dashboard View')
  console.log('- Product View & Search')
  console.log('- Serial Number Management')
  console.log('- Technician Management (Full CRUD)')
  console.log('- Service Type Management (Full CRUD)')
  console.log('- Warranty Claims (Full Access)')
  console.log('- Job Orders (Full Access)')
  console.log('- Service Payments (Full Access)')
  console.log('- Service Reports (Full Access)')
  console.log('- Customer View/Create/Update')
  console.log('- Sales View (for warranty validation)')
  console.log('')
  console.log('Done! You can now assign this role to users.')
}

main()
  .catch((e) => {
    console.error('Error:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
