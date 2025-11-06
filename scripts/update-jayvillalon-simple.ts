/**
 * Simple approach: Create Cross-Location Approver role via UI first,
 * then assign jayvillalon to it
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function updateJayvillalon() {
  try {
    console.log('🔍 Looking for user "jayvillalon"...')

    const user = await prisma.user.findFirst({
      where: { username: 'jayvillalon' },
      include: {
        roles: { include: { role: true } },
      }
    })

    if (!user) {
      console.error('❌ User "jayvillalon" not found')
      return
    }

    console.log(`✅ Found user: ${user.username} (ID: ${user.id})`)
    console.log(`   Current roles: ${user.roles.map(r => r.role.name).join(', ')}`)

    // Find Cross-Location Approver role
    const approverRole = await prisma.role.findFirst({
      where: {
        name: 'Cross-Location Approver',
        businessId: user.businessId
      }
    })

    if (!approverRole) {
      console.error('\n❌ "Cross-Location Approver" role not found in database')
      console.log('\n📝 Please create the role first via Settings → Roles')
      console.log('   OR run: npm run db:seed to create default roles')
      return
    }

    console.log(`\n✅ Found role: ${approverRole.name} (ID: ${approverRole.id})`)

    // Update user's role
    await prisma.$transaction(async (tx) => {
      // Remove old roles
      await tx.userRole.deleteMany({
        where: { userId: user.id }
      })

      // Assign new role
      await tx.userRole.create({
        data: {
          userId: user.id,
          roleId: approverRole.id
        }
      })

      // Remove location assignments
      await tx.userLocation.deleteMany({
        where: { userId: user.id }
      })
    })

    console.log('\n✅ UPDATE COMPLETE!')
    console.log(`   ${user.username} is now "Cross-Location Approver"`)

  } catch (error) {
    console.error('❌ Error:', error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

updateJayvillalon()
  .then(() => process.exit(0))
  .catch(() => process.exit(1))
