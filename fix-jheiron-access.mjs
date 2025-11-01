import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function fixUserAccess() {
  try {
    // Add Bambang location access to Jheiron
    const user = await prisma.user.findFirst({
      where: { username: { equals: 'jheiron', mode: 'insensitive' } }
    })
    
    if (!user) {
      console.log('❌ User not found')
      return
    }
    
    // Check if user already has access
    const existingAccess = await prisma.userLocation.findFirst({
      where: {
        userId: user.id,
        locationId: 3 // Bambang
      }
    })
    
    if (existingAccess) {
      console.log('✓ User already has access to Bambang location')
    } else {
      await prisma.userLocation.create({
        data: {
          userId: user.id,
          locationId: 3 // Bambang
        }
      })
      console.log('✅ Added Bambang location access to Jheiron')
    }
    
    // Now add stock_transfer_complete permission to the role
    const role = await prisma.role.findFirst({
      where: { name: 'Price Manager' },
      include: {
        permissions: {
          include: {
            permission: true
          }
        }
      }
    })
    
    if (!role) {
      console.log('❌ Role "Price Manager" not found')
      return
    }
    
    const permission = await prisma.permission.findFirst({
      where: { name: 'stock_transfer_complete' }
    })
    
    if (!permission) {
      console.log('❌ Permission "stock_transfer_complete" not found')
      return
    }
    
    const hasPermission = role.permissions.some(rp => rp.permissionId === permission.id)
    
    if (hasPermission) {
      console.log('✓ Role already has stock_transfer_complete permission')
    } else {
      await prisma.rolePermission.create({
        data: {
          roleId: role.id,
          permissionId: permission.id
        }
      })
      console.log('✅ Added stock_transfer_complete permission to Price Manager role')
    }
    
    console.log('\n✅ Done! User should now be able to complete transfers at Bambang location.')
    console.log('Note: User needs to log out and log back in for permissions to take effect.')
    
  } catch (error) {
    console.error('❌ Error:', error)
  } finally {
    await prisma.$disconnect()
  }
}

fixUserAccess()

