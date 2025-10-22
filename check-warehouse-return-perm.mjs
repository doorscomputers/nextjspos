import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function checkWarehouseReturnPermission() {
  try {
    console.log('🔍 Checking warehouse manager purchase return permissions...\n')

    // Find warehouse manager role
    const role = await prisma.role.findFirst({
      where: {
        name: {
          contains: 'warehouse',
          mode: 'insensitive',
        },
      },
      include: {
        permissions: {
          include: {
            permission: true,
          },
        },
      },
    })

    if (!role) {
      console.log('❌ Warehouse Manager role not found!')
      return
    }

    console.log(`✅ Found role: ${role.name} (ID: ${role.id})`)

    // Check for purchase return view permission
    const hasPurchaseReturnView = role.permissions.some(
      rp => rp.permission.name === 'purchase_return.view'
    )

    console.log(`   Has purchase_return.view: ${hasPurchaseReturnView ? '✅ YES' : '❌ NO'}`)

    if (!hasPurchaseReturnView) {
      console.log('\n⚠️  Warehouse Manager is missing purchase_return.view permission!')
      console.log('   This is why purchase returns are not showing.')

      // Find the permission
      const permission = await prisma.permission.findUnique({
        where: { name: 'purchase_return.view' },
      })

      if (permission) {
        console.log(`\n📋 Adding purchase_return.view permission to ${role.name}...`)
        await prisma.rolePermission.create({
          data: {
            roleId: role.id,
            permissionId: permission.id,
          },
        })
        console.log('✅ Permission added!')
      }
    }

    // Show all purchase return related permissions
    console.log('\n📋 All purchase return permissions in role:')
    role.permissions
      .filter(rp => rp.permission.name.includes('return'))
      .forEach(rp => console.log(`   - ${rp.permission.name}`))

  } catch (error) {
    console.error('❌ Error:', error)
  } finally {
    await prisma.$disconnect()
  }
}

checkWarehouseReturnPermission()
