import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function checkWarehouseSupplierReturnPerm() {
  try {
    console.log('🔍 Checking warehouse manager supplier return permissions...\n')

    // Find warehouse manager user
    const user = await prisma.user.findFirst({
      where: {
        username: 'warehouse_manager',
      },
      include: {
        roles: {
          include: {
            role: {
              include: {
                permissions: {
                  include: {
                    permission: true,
                  },
                },
              },
            },
          },
        },
        permissions: {
          include: {
            permission: true,
          },
        },
      },
    })

    if (!user) {
      console.log('❌ warehouse_manager user not found!')
      return
    }

    console.log(`✅ Found user: ${user.username} (ID: ${user.id})`)

    // Collect all permissions
    const allPermissions = new Set()

    // From roles
    user.roles.forEach(ur => {
      ur.role.permissions.forEach(rp => {
        allPermissions.add(rp.permission.name)
      })
    })

    // Direct permissions
    user.permissions.forEach(up => {
      allPermissions.add(up.permission.name)
    })

    console.log(`\n📋 Total permissions: ${allPermissions.size}`)

    // Check supplier return permissions
    const hasSupplierReturnView = allPermissions.has('supplier_return.view')
    const hasSupplierReturnCreate = allPermissions.has('supplier_return.create')
    const hasPurchaseReturnView = allPermissions.has('purchase_return.view')
    const hasPurchaseReturnCreate = allPermissions.has('purchase_return.create')

    console.log('\n🔐 Return-related permissions:')
    console.log(`   supplier_return.view: ${hasSupplierReturnView ? '✅' : '❌'}`)
    console.log(`   supplier_return.create: ${hasSupplierReturnCreate ? '✅' : '❌'}`)
    console.log(`   purchase_return.view: ${hasPurchaseReturnView ? '✅' : '❌'}`)
    console.log(`   purchase_return.create: ${hasPurchaseReturnCreate ? '✅' : '❌'}`)

    if (!hasSupplierReturnCreate) {
      console.log('\n⚠️  Warehouse Manager is missing supplier_return.create permission!')
      console.log('   This is why they cannot create supplier returns from Serial Lookup.')
    }

  } catch (error) {
    console.error('❌ Error:', error)
  } finally {
    await prisma.$disconnect()
  }
}

checkWarehouseSupplierReturnPerm()
