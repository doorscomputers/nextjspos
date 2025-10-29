import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('🔧 Updating pricing_management menu href to point to new simple price editor...\n')

  // Find the pricing_management menu
  const pricingMenu = await prisma.menuPermission.findUnique({
    where: { key: 'pricing_management' }
  })

  if (!pricingMenu) {
    console.log('❌ pricing_management menu not found!')
    return
  }

  console.log(`✅ Found pricing_management menu:`)
  console.log(`   Current href: ${pricingMenu.href}`)
  console.log(`   Current name: ${pricingMenu.name}`)

  // Update the href to point to the new simple price editor
  const updatedMenu = await prisma.menuPermission.update({
    where: { key: 'pricing_management' },
    data: {
      href: '/dashboard/products/simple-price-editor',
      name: 'Price Editor' // Update name to be simpler
    }
  })

  console.log(`\n✅ Updated menu:`)
  console.log(`   New href: ${updatedMenu.href}`)
  console.log(`   New name: ${updatedMenu.name}`)

  // Also check if there's a simple_price_editor menu item that needs to be created
  // Let's check the children to see if we need to update or create a simple_price_editor child menu
  const bulkPriceEditor = await prisma.menuPermission.findUnique({
    where: { key: 'bulk_price_editor' }
  })

  if (bulkPriceEditor) {
    console.log(`\n📋 Found bulk_price_editor menu:`)
    console.log(`   Href: ${bulkPriceEditor.href}`)
    console.log(`   Name: ${bulkPriceEditor.name}`)
    console.log(`   Parent: ${bulkPriceEditor.parentId}`)

    // Update bulk_price_editor to point to the legacy editor and rename it
    await prisma.menuPermission.update({
      where: { key: 'bulk_price_editor' },
      data: {
        name: 'Legacy Bulk Editor',
        href: '/dashboard/products/bulk-price-editor'
      }
    })

    console.log(`   ✅ Updated to Legacy Bulk Editor`)
  }

  // Create a new simple_price_editor menu item as a child of pricing_management
  const existingSimpleEditor = await prisma.menuPermission.findUnique({
    where: { key: 'simple_price_editor' }
  })

  if (!existingSimpleEditor) {
    // Get the order for the new menu item (place it first among children)
    const maxOrder = await prisma.menuPermission.findFirst({
      where: { parentId: pricingMenu.id },
      orderBy: { order: 'desc' }
    })

    const newOrder = maxOrder ? maxOrder.order - 100 : 100 // Place it before existing items

    const newSimpleEditorMenu = await prisma.menuPermission.create({
      data: {
        key: 'simple_price_editor',
        name: 'Price Editor',
        href: '/dashboard/products/simple-price-editor',
        parentId: pricingMenu.id,
        order: newOrder,
        icon: 'CurrencyDollarIcon' // Optional icon
      }
    })

    console.log(`\n✅ Created new simple_price_editor menu:`)
    console.log(`   Key: ${newSimpleEditorMenu.key}`)
    console.log(`   Name: ${newSimpleEditorMenu.name}`)
    console.log(`   Href: ${newSimpleEditorMenu.href}`)
    console.log(`   Parent: ${newSimpleEditorMenu.parentId}`)
    console.log(`   Order: ${newSimpleEditorMenu.order}`)
  } else {
    console.log(`\n✅ simple_price_editor menu already exists`)
  }

  // Show final pricing menu structure
  console.log(`\n📋 Final pricing menu structure:`)
  const pricingChildren = await prisma.menuPermission.findMany({
    where: { parentId: pricingMenu.id },
    orderBy: { order: 'asc' }
  })

  console.log(`📁 ${pricingMenu.key} - ${pricingMenu.name} (${pricingMenu.href})`)
  pricingChildren.forEach(child => {
    console.log(`   • ${child.key} - ${child.name} (${child.href})`)
  })

  console.log('\n✨ Pricing menu has been updated successfully!')
  console.log('\n📌 Summary of changes:')
  console.log('   • pricing_management now points to /dashboard/products/simple-price-editor')
  console.log('   • pricing_management renamed to "Price Editor"')
  console.log('   • bulk_price_editor renamed to "Legacy Bulk Editor"')
  console.log('   • simple_price_editor child menu created (if it didn\'t exist)')
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())