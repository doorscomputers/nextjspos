import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function checkApprovePermission() {
  try {
    console.log('🔍 Checking warehouse manager approve permissions...\n')

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

    console.log(`✅ User: ${user.username}`)
    console.log(`📋 Total permissions: ${allPermissions.size}\n`)

    // Check approve permissions
    const hasPurchaseReturnApprove = allPermissions.has('purchase_return.approve')
    const hasSupplierReturnApprove = allPermissions.has('supplier_return.approve')

    console.log('🔐 Approve permissions:')
    console.log(`   purchase_return.approve: ${hasPurchaseReturnApprove ? '✅' : '❌'}`)
    console.log(`   supplier_return.approve: ${hasSupplierReturnApprove ? '✅' : '❌'}`)

    if (!hasPurchaseReturnApprove) {
      console.log('\n⚠️  warehouse_manager CANNOT approve supplier returns!')
      console.log('   Missing: purchase_return.approve permission')
      console.log('\n💡 Solution: Add this permission to the role or user')
    } else {
      console.log('\n✅ warehouse_manager CAN approve supplier returns!')
    }

  } catch (error) {
    console.error('❌ Error:', error)
  } finally {
    await prisma.$disconnect()
  }
}

checkApprovePermission()
