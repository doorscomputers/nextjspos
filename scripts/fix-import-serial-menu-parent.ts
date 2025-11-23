/**
 * Fix "Import Serial Numbers" Menu Parent and Order
 *
 * PURPOSE: Set the correct parent (Purchases) and order for the menu
 *
 * SAFE: Only updates the specific menu - will not affect any other data.
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('🔄 Fixing "Import Serial Numbers" menu parent and order...\n')

  // Find the Purchases parent menu
  const parentMenu = await prisma.menuPermission.findUnique({
    where: { key: 'purchases' }
  })

  if (!parentMenu) {
    console.error('❌ Parent menu "purchases" not found!')
    return
  }

  console.log(`✓ Found parent menu: ${parentMenu.name} (ID: ${parentMenu.id})\n`)

  // Find the Import Serial Numbers menu
  const menu = await prisma.menuPermission.findUnique({
    where: { key: 'serial_number_import' }
  })

  if (!menu) {
    console.error('❌ Menu "serial_number_import" not found!')
    return
  }

  console.log('📋 Current menu state:')
  console.log(`   ID: ${menu.id}`)
  console.log(`   Name: ${menu.name}`)
  console.log(`   ParentID: ${menu.parentId || '(null)'}`)
  console.log(`   Order: ${menu.order}`)

  // Update parent and order
  const updated = await prisma.menuPermission.update({
    where: { id: menu.id },
    data: {
      parentId: parentMenu.id,
      order: 4 // After Serial Number Lookup
    }
  })

  console.log('\n✅ Menu updated successfully!')
  console.log(`   ParentID: ${updated.parentId} (${parentMenu.name})`)
  console.log(`   Order: ${updated.order}`)

  console.log('\n🎉 Done!')
  console.log('\n📋 Menu structure:')
  console.log('   Purchases')
  console.log('   ├── Purchase Orders (order 1)')
  console.log('   ├── Goods Received (GRN) (order 2)')
  console.log('   ├── Serial Number Lookup (order 3)')
  console.log('   ├── Import Serial Numbers (order 4) ← Fixed!')
  console.log('   ├── Reorder Suggestions (order 5)')
  console.log('   └── ...')
  console.log('\n✓ Menu will now appear under Purchases in Menu Permissions')
}

main()
  .catch((e) => {
    console.error('❌ Error:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
