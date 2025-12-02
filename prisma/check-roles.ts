import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  // Get all roles
  const roles = await prisma.role.findMany({
    select: { id: true, name: true, businessId: true }
  })
  console.log('All roles:', roles.map(r => `${r.id}: ${r.name}`).join('\n'))

  // Get package permissions
  const perms = await prisma.permission.findMany({
    where: { name: { startsWith: 'package_template' } },
    select: { id: true, name: true }
  })
  console.log('\nPackage permissions:', perms.map(p => `${p.id}: ${p.name}`).join('\n'))

  // Add permissions to Cross Location Approver if it exists
  const crossRole = roles.find(r => r.name.includes('Cross'))
  if (crossRole) {
    console.log('\nFound Cross Location Approver:', crossRole.name)

    // Get view, create, edit permissions (no delete)
    const permsToAdd = perms.filter(p =>
      ['package_template.view', 'package_template.create', 'package_template.edit'].includes(p.name)
    )

    for (const perm of permsToAdd) {
      try {
        await prisma.rolePermission.upsert({
          where: {
            roleId_permissionId: {
              roleId: crossRole.id,
              permissionId: perm.id
            }
          },
          update: {},
          create: {
            roleId: crossRole.id,
            permissionId: perm.id
          }
        })
        console.log(`✅ Added ${perm.name} to ${crossRole.name}`)
      } catch (e) {
        // Ignore
      }
    }
  } else {
    console.log('\nNo Cross Location Approver role found')
  }

  await prisma.$disconnect()
}

main().catch(console.error)
