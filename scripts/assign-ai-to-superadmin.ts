import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function assignAIToSuperAdmin() {
  try {
    console.log('🔍 Finding AI Assistant menu and Super Admin roles...\n')

    // Find AI Assistant menu
    const aiMenu = await prisma.menu.findFirst({
      where: { key: 'ai_assistant' }
    })

    if (!aiMenu) {
      console.log('❌ AI Assistant menu not found!')
      console.log('   Run: npx tsx scripts/populate-all-sidebar-menus-complete.ts')
      return
    }

    console.log(`✅ Found AI Assistant menu: ${aiMenu.name} (ID: ${aiMenu.id})`)

    // Find all Super Admin and System Administrator roles
    const adminRoles = await prisma.role.findMany({
      where: {
        OR: [
          { name: { contains: 'Super Admin', mode: 'insensitive' } },
          { name: { equals: 'System Administrator', mode: 'insensitive' } }
        ]
      },
      include: {
        business: {
          select: { name: true }
        }
      }
    })

    console.log(`\n📊 Found ${adminRoles.length} admin role(s)\n`)

    let assignedCount = 0

    for (const role of adminRoles) {
      console.log(`🔧 Processing: ${role.name} - ${role.business?.name}`)

      // Check if already assigned
      const existing = await prisma.roleMenuPermission.findFirst({
        where: {
          roleId: role.id,
          menuId: aiMenu.id
        }
      })

      if (existing) {
        console.log('   ℹ️  Already assigned\n')
      } else {
        await prisma.roleMenuPermission.create({
          data: {
            roleId: role.id,
            menuId: aiMenu.id
          }
        })
        console.log('   ✅ AI Assistant assigned!\n')
        assignedCount++
      }
    }

    console.log('═══════════════════════════════════════════════')
    console.log(`🎉 Complete! Assigned to ${assignedCount} role(s)`)
    console.log('═══════════════════════════════════════════════')
    console.log('\n💡 Next steps:')
    console.log('   1. Logout from your account')
    console.log('   2. Login again')
    console.log('   3. AI Assistant should now appear in sidebar\n')

  } catch (error: any) {
    console.error('❌ Error:', error.message)
    console.error('Stack:', error.stack)
  } finally {
    await prisma.$disconnect()
  }
}

assignAIToSuperAdmin()
