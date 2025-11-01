import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function addPermission() {
  try {
    const role = await prisma.role.findFirst({
      where: { name: 'Price Manager' }
    })
    
    if (!role) {
      console.log('❌ Role "Price Manager" not found')
      return
    }
    
    const permission = await prisma.permission.findFirst({
      where: { name: 'stock_transfer.complete' }
    })
    
    if (!permission) {
      console.log('❌ Permission not found')
      return
    }
    
    // Check if already exists
    const existing = await prisma.rolePermission.findUnique({
      where: {
        roleId_permissionId: {
          roleId: role.id,
          permissionId: permission.id
        }
      }
    })
    
    if (existing) {
      console.log('✓ Permission already exists')
    } else {
      await prisma.rolePermission.create({
        data: {
          roleId: role.id,
          permissionId: permission.id
        }
      })
      console.log('✅ Added stock_transfer.complete permission to Price Manager role')
    }
    
    console.log('\n✅ Done!')
    console.log('User Jheiron now has:')
    console.log('  ✓ Access to Bambang location')
    console.log('  ✓ stock_transfer.complete permission')
    console.log('\n⚠️  IMPORTANT: User must LOG OUT and LOG BACK IN for changes to take effect!')
    console.log('\nNow try clicking "Receive Transfer" button again.')
    
  } catch (error) {
    console.error('❌ Error:', error)
  } finally {
    await prisma.$disconnect()
  }
}

addPermission()

