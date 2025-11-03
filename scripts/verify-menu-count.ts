import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function verifyMenuCount() {
  console.log('🔍 Checking menu_permission table status...\n')

  try {
    const total = await prisma.menuPermission.count()
    const parents = await prisma.menuPermission.count({
      where: { parentId: null }
    })
    const children = await prisma.menuPermission.count({
      where: { parentId: { not: null } }
    })

    console.log('📊 Current Menu Count:')
    console.log(`   Total: ${total}`)
    console.log(`   Parents (Level 0): ${parents}`)
    console.log(`   Children (Level 1+): ${children}`)
    console.log()

    // Check for key parent menus
    const keyMenus = [
      'dashboard',
      'cashier_reports_root',
      'pos_sales',
      'inventory_management',
      'pricing_management',
      'purchases',
      'stock_transfers',
      'returns_management',
      'reports',
      'hr_attendance',
      'technical_services',
      'accounting',
      'administration',
      'settings'
    ]

    console.log('🔑 Checking Key Parent Menus:')
    for (const key of keyMenus) {
      const exists = await prisma.menuPermission.findUnique({
        where: { key }
      })
      console.log(`   ${exists ? '✅' : '❌'} ${key}`)
    }
    console.log()

    // Sample some menus with hierarchy
    const sampleMenus = await prisma.menuPermission.findMany({
      take: 10,
      include: {
        children: true
      },
      orderBy: { order: 'asc' }
    })

    console.log('📋 Sample Menus:')
    for (const menu of sampleMenus) {
      console.log(`   ${menu.name} (${menu.key}) - ${menu.children.length} children`)
    }

  } catch (error) {
    console.error('❌ Error:', error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

verifyMenuCount()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
