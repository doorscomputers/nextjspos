import { prisma } from '../src/lib/prisma.simple'

async function fixUserPermission() {
  console.log('🔧 Adding shift.close permission directly to ERICSON CHAN...\n')

  try {
    // Find the user
    const user = await prisma.user.findFirst({
      where: { username: 'ERICSON CHAN' }
    })

    if (!user) {
      console.log('❌ User not found')
      return
    }

    console.log('✅ Found user:', user.username, '(ID:', user.id + ')')

    // Find shift.close permission
    const permission = await prisma.permission.findFirst({
      where: { name: 'shift.close' }
    })

    if (!permission) {
      console.log('❌ shift.close permission not found')
      return
    }

    console.log('✅ Found permission:', permission.name, '(ID:', permission.id + ')')

    // Check if user already has this permission directly
    const existingUserPerm = await prisma.userPermission.findFirst({
      where: {
        userId: user.id,
        permissionId: permission.id
      }
    })

    if (existingUserPerm) {
      console.log('✅ User already has direct shift.close permission')
    } else {
      // Add permission directly to user
      await prisma.userPermission.create({
        data: {
          userId: user.id,
          permissionId: permission.id
        }
      })
      console.log('✅ Added shift.close permission directly to user')
    }

    console.log('\n🎯 Permission granted!')
    console.log('\n📝 Next step: Refresh the browser page (F5 or Ctrl+R) and try closing the shift again.')
  } catch (error) {
    console.error('❌ Error:', error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

fixUserPermission()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
