import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('🔍 Checking pricing-related menus...\n')

  // Find all pricing/price related menus
  const menus = await prisma.menuPermission.findMany({
    where: {
      OR: [
        { key: { contains: 'pricing' } },
        { key: { contains: 'price' } },
        { name: { contains: 'Pricing' } },
        { name: { contains: 'Price' } }
      ]
    },
    orderBy: { order: 'asc' }
  })

  console.log(`📋 Found ${menus.length} pricing/price related menus:`)
  menus.forEach(menu => {
    console.log(`   • ${menu.key} - ${menu.name} (ID: ${menu.id}, Parent: ${menu.parentId}, Href: ${menu.href})`)
  })

  // Check the specific pricing_management menu
  const pricingManagement = await prisma.menuPermission.findUnique({
    where: { key: 'pricing_management' }
  })

  if (pricingManagement) {
    console.log(`\n✅ pricing_management menu found:`)
    console.log(`   Key: ${pricingManagement.key}`)
    console.log(`   Name: ${pricingManagement.name}`)
    console.log(`   Href: ${pricingManagement.href}`)
    console.log(`   ID: ${pricingManagement.id}`)
    console.log(`   Parent: ${pricingManagement.parentId}`)
    console.log(`   Order: ${pricingManagement.order}`)
  } else {
    console.log('\n❌ pricing_management menu NOT found!')
  }

  // Get the full menu hierarchy
  console.log('\n📋 Full menu hierarchy:')
  const allMenus = await prisma.menuPermission.findMany({
    orderBy: { order: 'asc' }
  })

  // Build tree structure
  const menuMap = new Map()
  const rootMenus = []

  allMenus.forEach(menu => {
    menuMap.set(menu.id, { ...menu, children: [] })
  })

  allMenus.forEach(menu => {
    if (menu.parentId === null) {
      rootMenus.push(menuMap.get(menu.id))
    } else {
      const parent = menuMap.get(menu.parentId)
      if (parent) {
        parent.children.push(menuMap.get(menu.id))
      }
    }
  })

  function printMenuTree(menus, indent = 0) {
    menus.forEach(menu => {
      const spaces = '  '.repeat(indent)
      const isPricingRelated = menu.key.includes('pricing') || menu.key.includes('price') ||
                             menu.name.includes('Pricing') || menu.name.includes('Price')
      const marker = isPricingRelated ? '🔸' : '•'
      console.log(`${spaces}${marker} ${menu.key} - ${menu.name}`)
      if (menu.children && menu.children.length > 0) {
        printMenuTree(menu.children, indent + 1)
      }
    })
  }

  printMenuTree(rootMenus)

  await prisma.$disconnect()
}

main()
  .catch(console.error)