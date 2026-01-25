/**
 * Script to check current MenuPermission entries in database
 * Run with: DATABASE_URL="your-connection-string" npx tsx scripts/check-menu-permissions.ts
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('Checking MenuPermission entries...\n')

  const menus = await prisma.menuPermission.findMany({
    orderBy: [
      { parentId: 'asc' },
      { order: 'asc' }
    ]
  })

  console.log(`Total menus in database: ${menus.length}\n`)

  // Check for Package Templates
  const packageMenus = menus.filter(m =>
    m.key.includes('package') || m.name.toLowerCase().includes('package')
  )

  if (packageMenus.length > 0) {
    console.log('Package-related menus found:')
    packageMenus.forEach(m => {
      console.log(`  - ${m.name} (key: ${m.key}, id: ${m.id})`)
    })
  } else {
    console.log('No Package Template menus found in database!')
    console.log('\nYou need to:')
    console.log('1. Go to /dashboard/settings/menu-management')
    console.log('2. Click "Sync All from Sidebar" button')
  }

  console.log('\nAll top-level menus:')
  const topLevel = menus.filter(m => m.parentId === null)
  topLevel.forEach(m => {
    console.log(`  - ${m.name} (key: ${m.key})`)
  })
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
