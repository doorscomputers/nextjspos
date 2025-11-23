/**
 * Fix "Import Serial Numbers" Menu
 *
 * PURPOSE: Update the existing menu to match the Sidebar.tsx configuration
 * - Fix name: "Serial Number Import" → "Import Serial Numbers"
 * - Fix href: null → "/dashboard/serial-numbers/bulk-import"
 *
 * SAFE: Only updates the specific menu - will not affect any other data.
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('🔄 Fixing "Import Serial Numbers" menu...\n')

  // Find the menu
  const menu = await prisma.menuPermission.findUnique({
    where: { key: 'serial_number_import' }
  })

  if (!menu) {
    console.error('❌ Menu not found with key: serial_number_import')
    return
  }

  console.log('📋 Current menu state:')
  console.log(`   ID: ${menu.id}`)
  console.log(`   Key: ${menu.key}`)
  console.log(`   Name: ${menu.name}`)
  console.log(`   Href: ${menu.href || '(null)'}`)
  console.log(`   Order: ${menu.order}`)
  console.log(`   ParentID: ${menu.parentId}`)

  // Update the menu
  const updated = await prisma.menuPermission.update({
    where: { id: menu.id },
    data: {
      name: 'Import Serial Numbers',
      href: '/dashboard/serial-numbers/bulk-import',
      icon: 'DocumentPlusIcon'
    }
  })

  console.log('\n✅ Menu updated successfully!')
  console.log(`   Name: ${updated.name}`)
  console.log(`   Href: ${updated.href}`)
  console.log(`   Icon: ${updated.icon}`)

  console.log('\n🎉 Done!')
  console.log('\n📋 The menu is now properly configured and will appear in:')
  console.log('   • Settings → Menu Permissions (to assign to roles/users)')
  console.log('   • Sidebar under Purchases (if user has permission)')
  console.log('\n⚠️  Users must log out and log back in to see changes.')
}

main()
  .catch((e) => {
    console.error('❌ Error:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
