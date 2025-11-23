/**
 * Add "Import Serial Numbers" Menu to Database
 *
 * PURPOSE: Add the missing "Import Serial Numbers" menu item to the menu_permissions table
 * so it can be assigned to users and roles through the Menu Permissions UI.
 *
 * This menu already exists in Sidebar.tsx but is missing from the database.
 *
 * SAFE: Only adds if it doesn't already exist - will not reset or delete any existing data.
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('🔄 Adding "Import Serial Numbers" menu to database...\n')

  // Check if menu already exists
  const existingMenu = await prisma.menuPermission.findUnique({
    where: { key: 'serial_number_import' }
  })

  if (existingMenu) {
    console.log('✅ Menu already exists in database!')
    console.log(`   ID: ${existingMenu.id}`)
    console.log(`   Key: ${existingMenu.key}`)
    console.log(`   Name: ${existingMenu.name}`)
    console.log(`   Href: ${existingMenu.href}`)
    console.log('\n⏭️  No changes needed - exiting.')
    return
  }

  // Find the parent menu (Purchases)
  const parentMenu = await prisma.menuPermission.findUnique({
    where: { key: 'purchases' }
  })

  if (!parentMenu) {
    console.error('❌ Parent menu "Purchases" not found!')
    console.error('   Cannot add child menu without parent.')
    return
  }

  console.log(`✓ Found parent menu: ${parentMenu.name} (ID: ${parentMenu.id})\n`)

  // Add the menu
  const newMenu = await prisma.menuPermission.create({
    data: {
      key: 'serial_number_import',
      name: 'Import Serial Numbers',
      href: '/dashboard/serial-numbers/bulk-import',
      icon: 'DocumentPlusIcon',
      order: 4, // After "Serial Number Lookup" (order 3)
      parentId: parentMenu.id
    }
  })

  console.log('✅ Successfully added menu!')
  console.log(`   ID: ${newMenu.id}`)
  console.log(`   Key: ${newMenu.key}`)
  console.log(`   Name: ${newMenu.name}`)
  console.log(`   Href: ${newMenu.href}`)
  console.log(`   Parent: ${parentMenu.name}`)
  console.log(`   Order: ${newMenu.order}`)

  console.log('\n🎉 Done!')
  console.log('\n📋 Next Steps:')
  console.log('   1. Go to Settings → Menu Permissions')
  console.log('   2. Select a role or user')
  console.log('   3. You will now see "Import Serial Numbers" under Purchases')
  console.log('   4. Check it to grant access')
  console.log('   5. Save changes')
  console.log('\n⚠️  Users must log out and log back in to see menu changes.')
}

main()
  .catch((e) => {
    console.error('❌ Error:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
