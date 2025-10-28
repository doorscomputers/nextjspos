import { PrismaClient } from '@prisma/client'
import * as fs from 'fs'
import * as path from 'path'

const prisma = new PrismaClient()

interface MenuItem {
  key?: string
  name: string
  href: string
  children?: MenuItem[]
}

// Extract menu items from Sidebar.tsx
function extractMenuItems(): { key: string; name: string; href: string; parentKey: string | null; order: number }[] {
  const sidebarPath = path.join(process.cwd(), 'src', 'components', 'Sidebar.tsx')
  const sidebarContent = fs.readFileSync(sidebarPath, 'utf-8')

  const items: { key: string; name: string; href: string; parentKey: string | null; order: number }[] = []

  // Extract all menu items with keys
  const keyMatches = sidebarContent.matchAll(/key:\s*["']([^"']+)["']/g)
  const nameMatches = sidebarContent.matchAll(/name:\s*["']([^"']+)["']/g)
  const hrefMatches = sidebarContent.matchAll(/href:\s*["']([^"'#]+)["']/g)

  const keys = Array.from(keyMatches).map(m => m[1])
  const names = Array.from(nameMatches).map(m => m[1])
  const hrefs = Array.from(hrefMatches).map(m => m[1])

  // Create a map to track parent-child relationships
  const menuStructure: any[] = []

  // Parse the sidebar structure more carefully
  // For now, let's use a simpler approach - extract unique keys and build a flat structure
  const uniqueKeys = new Set<string>()

  keys.forEach((key, index) => {
    if (!uniqueKeys.has(key) && names[index]) {
      uniqueKeys.add(key)
      items.push({
        key,
        name: names[index] || key,
        href: hrefs[index] || '/dashboard',
        parentKey: null,
        order: index + 1
      })
    }
  })

  return items
}

async function main() {
  console.log('🔍 Extracting menu items from Sidebar.tsx...')

  const extractedItems = extractMenuItems()
  console.log(`   Found ${extractedItems.length} unique menu items\n`)

  console.log('🗑️  Clearing existing menu permissions...')
  await prisma.roleMenuPermission.deleteMany({})
  await prisma.userMenuPermission.deleteMany({})
  await prisma.menuPermission.deleteMany({})
  console.log('   ✅ Cleared all existing permissions\n')

  console.log('🌱 Seeding menu permissions...')

  for (const item of extractedItems) {
    try {
      await prisma.menuPermission.create({
        data: {
          key: item.key,
          name: item.name,
          href: item.href,
          parentId: null,
          order: item.order
        }
      })
      console.log(`   ✅ ${item.name}`)
    } catch (error) {
      console.log(`   ⚠️  Skipped duplicate: ${item.name}`)
    }
  }

  console.log(`\n✨ Successfully seeded ${extractedItems.length} menu permissions!`)
}