import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function addPackagePermissions() {
  console.log('🚀 Adding Package Template permissions to database...\n')

  // 1. Create the permissions if they don't exist
  const permissionNames = [
    'package_template.view',
    'package_template.create',
    'package_template.edit',
    'package_template.delete'
  ]

  const permissions: any[] = []
  for (const name of permissionNames) {
    const perm = await prisma.permission.upsert({
      where: { name },
      update: {},
      create: {
        name,
        guardName: 'web'
      }
    })
    permissions.push(perm)
    console.log('✅ Permission created/verified:', name)
  }

  // 2. Get all roles that should have these permissions
  const rolesToUpdate = await prisma.role.findMany({
    where: {
      name: {
        in: [
          'Warehouse Manager',
          'Cross Location Approver',
          'Admin',
          'All Branch Admin',
          'System Administrator',
          'Super Admin',
          'Manager',
          'Sales Cashier',
          'Sales Supervisor'
        ]
      }
    }
  })

  console.log('\n📋 Found roles to update:', rolesToUpdate.map(r => r.name).join(', '))

  // 3. Assign permissions to roles
  for (const role of rolesToUpdate) {
    // Determine which permissions this role should have
    let permsForRole: string[] = []

    if (['Admin', 'All Branch Admin', 'System Administrator', 'Super Admin'].includes(role.name)) {
      // Full access
      permsForRole = permissionNames
    } else if (['Warehouse Manager', 'Manager', 'Cross Location Approver'].includes(role.name)) {
      // View, Create, Edit (no delete)
      permsForRole = ['package_template.view', 'package_template.create', 'package_template.edit']
    } else if (['Sales Cashier', 'Sales Supervisor'].includes(role.name)) {
      // View only
      permsForRole = ['package_template.view']
    }

    // Get permission IDs
    const permsToAssign = permissions.filter(p => permsForRole.includes(p.name))

    for (const perm of permsToAssign) {
      try {
        await prisma.rolePermission.upsert({
          where: {
            roleId_permissionId: {
              roleId: role.id,
              permissionId: perm.id
            }
          },
          update: {},
          create: {
            roleId: role.id,
            permissionId: perm.id
          }
        })
      } catch (e: any) {
        // Ignore if already exists
      }
    }
    console.log(`✅ Assigned ${permsToAssign.length} permissions to ${role.name}`)
  }

  console.log('\n🎉 Done! Package Template permissions added to database.')
  console.log('\n📌 Roles with access:')
  console.log('   - Admin/Super Admin: Full access (view, create, edit, delete)')
  console.log('   - Warehouse Manager: View, Create, Edit')
  console.log('   - Cross Location Approver: View, Create, Edit')
  console.log('   - Sales Cashier/Supervisor: View only')
  console.log('\n⚠️  Users need to LOG OUT and LOG BACK IN to see the new menu!')

  await prisma.$disconnect()
}

addPackagePermissions().catch(console.error)
