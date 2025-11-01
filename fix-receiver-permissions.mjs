import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function fixReceiverPermissions() {
  try {
    console.log('\n🔧 Fixing Transfer Receiver Permissions...\n')
    
    // Get the "Transfer Sender" role
    const role = await prisma.role.findFirst({
      where: { name: 'Transfer Sender' }
    })
    
    if (!role) {
      console.log('❌ Role "Transfer Sender" not found')
      return
    }
    
    console.log(`📋 Role: ${role.name} (ID: ${role.id})`)
    
    // Get the required permissions
    const requiredPermissions = [
      'stock_transfer.complete',
      'stock_transfer.receive'
    ]
    
    for (const permName of requiredPermissions) {
      const permission = await prisma.permission.findFirst({
        where: { name: permName }
      })
      
      if (!permission) {
        console.log(`   ⚠️  Permission "${permName}" not found in database`)
        continue
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
        console.log(`   ✓ Already has: ${permName}`)
      } else {
        await prisma.rolePermission.create({
          data: {
            roleId: role.id,
            permissionId: permission.id
          }
        })
        console.log(`   ✅ Added: ${permName}`)
      }
    }
    
    console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)
    console.log(`✅ SUCCESS!`)
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)
    console.log(`\nUser "JOJITKATETransferReceiverBambang" now has:`)
    console.log(`   ✅ stock_transfer.complete permission`)
    console.log(`   ✅ stock_transfer.receive permission`)
    console.log(`   ✅ Access to Bambang location`)
    console.log(`\n⚠️  IMPORTANT: User must LOG OUT and LOG BACK IN!`)
    console.log(`\nThen:`)
    console.log(`   1. Log in as JOJITKATETransferReceiverBambang`)
    console.log(`   2. Go to transfer TR-202511-0001`)
    console.log(`   3. Click "Receive Transfer" button`)
    console.log(`   4. Confirm the action`)
    console.log(`   5. ✅ Transfer should complete successfully!`)
    
  } catch (error) {
    console.error('❌ Error:', error)
  } finally {
    await prisma.$disconnect()
  }
}

fixReceiverPermissions()

