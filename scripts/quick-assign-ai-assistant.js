// Quick script to assign AI Assistant menu to Super Admin
const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function assignAIAssistant() {
  try {
    console.log('🔍 Finding AI Assistant menu...')

    const aiMenu = await prisma.menu.findFirst({
      where: { key: 'ai_assistant' }
    })

    if (!aiMenu) {
      console.log('❌ AI Assistant menu not found!')
      return
    }

    console.log(`✅ Found: ${aiMenu.name} (ID: ${aiMenu.id})`)

    const superAdmin = await prisma.role.findFirst({
      where: {
        OR: [
          { name: { contains: 'Super Admin', mode: 'insensitive' } },
          { name: 'System Administrator' }
        ]
      }
    })

    if (!superAdmin) {
      console.log('❌ Super Admin role not found!')
      return
    }

    console.log(`✅ Found role: ${superAdmin.name} (ID: ${superAdmin.id})`)

    const existing = await prisma.roleMenuPermission.findFirst({
      where: {
        roleId: superAdmin.id,
        menuId: aiMenu.id
      }
    })

    if (existing) {
      console.log('✅ Already assigned!')
    } else {
      await prisma.roleMenuPermission.create({
        data: {
          roleId: superAdmin.id,
          menuId: aiMenu.id
        }
      })
      console.log('✅ AI Assistant assigned to Super Admin!')
    }

    console.log('\n🎉 Done! Refresh your browser to see the menu.')
  } catch (error) {
    console.error('❌ Error:', error.message)
  } finally {
    await prisma.$disconnect()
  }
}

assignAIAssistant()
