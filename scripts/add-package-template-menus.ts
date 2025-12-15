/**
 * Script to add Package Templates menu items to MenuPermission table
 * Run with: DATABASE_URL="your-connection-string" npx tsx scripts/add-package-template-menus.ts
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('Adding Package Templates menu items...')

  const menuItems = [
    {
      key: 'menu.package_templates',
      name: 'Package Templates',
      href: '/dashboard/package-templates',
      icon: 'CubeIcon',
      order: 10,
      parentId: null
    },
    {
      key: 'menu.package_templates_2',
      name: 'Package Template 2',
      href: '/dashboard/package-templates-2',
      icon: 'CubeIcon',
      order: 11,
      parentId: null
    }
  ]

  for (const item of menuItems) {
    const existing = await prisma.menuPermission.findUnique({
      where: { key: item.key }
    })

    if (existing) {
      console.log(`Menu "${item.name}" already exists (id: ${existing.id})`)
    } else {
      const created = await prisma.menuPermission.create({
        data: item
      })
      console.log(`Created menu "${item.name}" (id: ${created.id})`)
    }
  }

  console.log('\nDone! You can now assign these menus to roles/users in the Menu Permissions page.')
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
