import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function assignAIAssistantMenu() {
  try {
    console.log('🔍 Checking AI Assistant menu...\n')

    // Find AI Assistant menu
    const aiMenu = await prisma.menu.findFirst({
      where: { key: 'ai_assistant' },
      include: { permission: true }
    })

    if (!aiMenu) {
      console.log('❌ AI Assistant menu not found in database!')
      console.log('   Run: npx tsx scripts/populate-all-sidebar-menus-complete.ts')
      return
    }

    console.log('✅ AI Assistant menu found:')
    console.log('   ID:', aiMenu.id)
    console.log('   Name:', aiMenu.name)
    console.log('   URL:', aiMenu.href)
    console.log('   Permission:', aiMenu.permission?.name || 'None')

    // Find all businesses
    const businesses = await prisma.business.findMany({
      select: { id: true, name: true }
    })

    console.log(`\n📊 Found ${businesses.length} business(es)\n`)

    let totalAssigned = 0

    for (const business of businesses) {
      console.log(`\n🏢 Processing business: ${business.name} (ID: ${business.id})`)

      // Find Super Admin/System Administrator role for this business
      const superAdminRole = await prisma.role.findFirst({
        where: {
          businessId: business.id,
          OR: [
            { name: { contains: 'Super Admin', mode: 'insensitive' } },
            { name: { equals: 'System Administrator', mode: 'insensitive' } }
          ]
        }
      })

      if (!superAdminRole) {
        console.log('   ⚠️  No Super Admin role found for this business')
        continue
      }

      console.log(`   ✅ Super Admin role found: ${superAdminRole.name} (ID: ${superAdminRole.id})`)

      // Check if already assigned
      const existing = await prisma.roleMenuPermission.findFirst({
        where: {
          roleId: superAdminRole.id,
          menuId: aiMenu.id
        }
      })

      if (existing) {
        console.log('   ℹ️  AI Assistant already assigned to this role')
      } else {
        // Assign AI Assistant menu to Super Admin
        await prisma.roleMenuPermission.create({
          data: {
            roleId: superAdminRole.id,
            menuId: aiMenu.id
          }
        })
        console.log('   ✅ AI Assistant assigned to Super Admin role')
        totalAssigned++
      }
    }

    console.log(`\n🎉 Complete! Assigned AI Assistant menu to ${totalAssigned} role(s)`)
  } catch (error) {
    console.error('❌ Error:', error)
  } finally {
    await prisma.$disconnect()
  }
}

assignAIAssistantMenu()
