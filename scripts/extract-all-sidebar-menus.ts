import { PrismaClient } from '@prisma/client'
import * as fs from 'fs'
import * as path from 'path'

const prisma = new PrismaClient()

interface ExtractedMenu {
  key: string
  name: string
  href: string | null
  icon?: string
  level: number
  parentKey?: string
}

async function extractAllSidebarMenus() {
  console.log('🔧 Extracting ALL menus from Sidebar.tsx...\n')

  try {
    // Read Sidebar.tsx
    const sidebarPath = path.join(process.cwd(), 'src', 'components', 'Sidebar.tsx')
    const sidebarContent = fs.readFileSync(sidebarPath, 'utf-8')

    // Extract menuItems array
    const menuItemsMatch = sidebarContent.match(/const menuItems: MenuItem\[\] = \[([\s\S]*?)\n  \]/m)
    if (!menuItemsMatch) {
      throw new Error('Could not find menuItems array in Sidebar.tsx')
    }

    const menuItemsContent = menuItemsMatch[1]

    // Parse menu structure
    const extractedMenus: ExtractedMenu[] = []
    let currentIndentLevel = 0
    let parentStack: string[] = []

    // Split into logical menu blocks
    const lines = menuItemsContent.split('\n')

    let currentMenu: Partial<ExtractedMenu> = {}
    let inChildren = false
    let braceCount = 0

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      const trimmed = line.trim()

      // Track opening braces to understand nesting
      const openBraces = (line.match(/\{/g) || []).length
      const closeBraces = (line.match(/\}/g) || []).length
      braceCount += openBraces - closeBraces

      // Detect menu start
      if (trimmed.startsWith('{') && !inChildren) {
        currentMenu = {}
        continue
      }

      // Extract key
      if (trimmed.startsWith('key:')) {
        const keyMatch = trimmed.match(/key:\s*["']([^"']+)["']/)
        if (keyMatch) {
          currentMenu.key = keyMatch[1]
        }
      }

      // Extract name
      if (trimmed.startsWith('name:')) {
        const nameMatch = trimmed.match(/name:\s*["']([^"']+)["']/)
        if (nameMatch) {
          currentMenu.name = nameMatch[1]
        }
      }

      // Extract href
      if (trimmed.startsWith('href:')) {
        const hrefMatch = trimmed.match(/href:\s*["']([^"']+)["']/)
        if (hrefMatch) {
          currentMenu.href = hrefMatch[1]
        } else if (trimmed.includes('null') || trimmed.includes('undefined')) {
          currentMenu.href = null
        }
      }

      // Detect children array
      if (trimmed.startsWith('children:')) {
        inChildren = true
        if (currentMenu.key) {
          parentStack.push(currentMenu.key)
        }
      }

      // Detect end of menu item
      if (trimmed.startsWith('},') || (trimmed === '},' && braceCount <= 2)) {
        if (currentMenu.key && currentMenu.name) {
          const level = parentStack.length
          extractedMenus.push({
            key: currentMenu.key,
            name: currentMenu.name,
            href: currentMenu.href || null,
            level,
            parentKey: parentStack[parentStack.length - 1]
          })
        }

        // Check if we're exiting children array
        if (inChildren && braceCount <= 1) {
          inChildren = false
          parentStack.pop()
        }

        currentMenu = {}
      }
    }

    console.log(`📊 Extracted ${extractedMenus.length} menu items from Sidebar.tsx`)
    console.log(`   - Level 0 (Parents): ${extractedMenus.filter(m => m.level === 0).length}`)
    console.log(`   - Level 1 (Children): ${extractedMenus.filter(m => m.level === 1).length}`)
    console.log(`   - Level 2+ (Grandchildren): ${extractedMenus.filter(m => m.level >= 2).length}`)
    console.log()

    // Now populate database
    console.log('📋 Populating menu_permission table...\n')

    const menuMap = new Map<string, number>()
    let createdCount = 0
    let updatedCount = 0
    let skippedCount = 0

    // Process in order of hierarchy level
    for (let level = 0; level <= 3; level++) {
      const menusAtLevel = extractedMenus.filter(m => m.level === level)

      for (const menu of menusAtLevel) {
        // Find parent ID if has parent
        let parentId: number | null = null
        if (menu.parentKey) {
          parentId = menuMap.get(menu.parentKey) || null
          if (!parentId) {
            console.log(`   ⚠️  Parent not found for ${menu.name} (parent: ${menu.parentKey}) - skipping`)
            skippedCount++
            continue
          }
        }

        // Check if exists
        const existing = await prisma.menuPermission.findUnique({
          where: { key: menu.key }
        })

        if (existing) {
          // Update
          await prisma.menuPermission.update({
            where: { id: existing.id },
            data: {
              name: menu.name,
              href: menu.href,
              parentId,
              order: 1 // Will be set properly later
            }
          })
          menuMap.set(menu.key, existing.id)
          updatedCount++
          console.log(`   ✓ ${menu.name} (updated)`)
        } else {
          // Create
          const created = await prisma.menuPermission.create({
            data: {
              key: menu.key,
              name: menu.name,
              href: menu.href,
              icon: 'Menu', // Default icon
              parentId,
              order: 1
            }
          })
          menuMap.set(menu.key, created.id)
          createdCount++
          console.log(`   ✅ ${menu.name} (created)`)
        }
      }
    }

    const totalMenus = await prisma.menuPermission.count()

    console.log('\n🎉 Menu extraction and population complete!')
    console.log(`\n📊 Summary:`)
    console.log(`   - Created: ${createdCount}`)
    console.log(`   - Updated: ${updatedCount}`)
    console.log(`   - Skipped: ${skippedCount}`)
    console.log(`   - Total in database: ${totalMenus}`)
    console.log()

  } catch (error) {
    console.error('❌ Error:', error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

extractAllSidebarMenus()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
