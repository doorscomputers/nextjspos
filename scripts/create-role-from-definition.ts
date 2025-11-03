import { PrismaClient } from '@prisma/client'
import { ROLE_DEFINITIONS, RoleDefinition } from './role-definitions'

const prisma = new PrismaClient()

async function createRoleFromDefinition() {
  const args = process.argv.slice(2)

  if (args.length === 0) {
    console.log('🔧 Role Creation Tool\n')
    console.log('Usage: npx tsx scripts/create-role-from-definition.ts <ROLE_KEY>\n')
    console.log('Available Roles:')
    console.log('═══════════════════════════════════════════════════════\n')

    Object.entries(ROLE_DEFINITIONS).forEach(([key, role]) => {
      console.log(`📋 ${key}`)
      console.log(`   Name: ${role.name}`)
      console.log(`   Description: ${role.description}`)
      console.log(`   Permissions: ${role.permissions.length}`)
      console.log(`   Location Required: ${role.locationRequired ? 'Yes' : 'No'}`)
      console.log()
    })

    console.log('Example: npx tsx scripts/create-role-from-definition.ts WAREHOUSE_MANAGER')
    return
  }

  const roleKey = args[0]
  const roleDefinition = ROLE_DEFINITIONS[roleKey]

  if (!roleDefinition) {
    console.log(`❌ Role ${roleKey} not found!`)
    console.log(`Available roles: ${Object.keys(ROLE_DEFINITIONS).join(', ')}`)
    return
  }

  try {
    console.log(`🔧 Creating role: ${roleDefinition.name}\n`)

    // Get all businesses
    const businesses = await prisma.business.findMany()

    if (businesses.length === 0) {
      console.log('❌ No businesses found!')
      return
    }

    for (const business of businesses) {
      console.log(`📋 Processing business: ${business.name}`)

      // Check if role exists
      const existingRole = await prisma.role.findFirst({
        where: {
          businessId: business.id,
          name: roleDefinition.name
        }
      })

      if (existingRole) {
        console.log(`   ⚠️  Role already exists (ID: ${existingRole.id})`)

        // Update permissions
        console.log('   🔄 Updating permissions...')

        // Delete existing permissions
        await prisma.rolePermission.deleteMany({
          where: { roleId: existingRole.id }
        })

        // Add new permissions
        let addedCount = 0
        for (const permissionName of roleDefinition.permissions) {
          const permission = await prisma.permission.findFirst({
            where: { name: permissionName }
          })

          if (permission) {
            await prisma.rolePermission.create({
              data: {
                roleId: existingRole.id,
                permissionId: permission.id
              }
            })
            addedCount++
          }
        }

        console.log(`   ✅ Updated ${addedCount} permissions`)
      } else {
        // Create role
        const role = await prisma.role.create({
          data: {
            name: roleDefinition.name,
            businessId: business.id,
            guardName: 'web',
            isDefault: roleDefinition.isDefault || false
          }
        })

        console.log(`   ✅ Role created (ID: ${role.id})`)

        // Assign permissions
        let addedCount = 0
        for (const permissionName of roleDefinition.permissions) {
          const permission = await prisma.permission.findFirst({
            where: { name: permissionName }
          })

          if (permission) {
            await prisma.rolePermission.create({
              data: {
                roleId: role.id,
                permissionId: permission.id
              }
            })
            addedCount++
          } else {
            console.log(`   ⚠️  Permission not found: ${permissionName}`)
          }
        }

        console.log(`   ✅ Assigned ${addedCount} permissions`)
      }
      console.log()
    }

    console.log('🎉 Role creation complete!')
    console.log()
    console.log('═══════════════════════════════════════════════════════')
    console.log(`📋 ${roleDefinition.name}`)
    console.log('═══════════════════════════════════════════════════════')
    console.log()
    console.log(`Description: ${roleDefinition.description}`)
    console.log(`Permissions: ${roleDefinition.permissions.length}`)
    console.log(`Location Required: ${roleDefinition.locationRequired ? 'Yes' : 'No'}`)
    console.log()

  } catch (error) {
    console.error('❌ Error:', error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

createRoleFromDefinition()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
