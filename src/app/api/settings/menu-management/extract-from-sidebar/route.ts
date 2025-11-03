import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth.simple'
import { PERMISSIONS } from '@/lib/rbac'
import * as fs from 'fs'
import * as path from 'path'

// Extract all menu items from Sidebar.tsx
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user has permission
    if (!session.user.permissions.includes(PERMISSIONS.ROLE_UPDATE)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Read Sidebar.tsx
    const sidebarPath = path.join(process.cwd(), 'src', 'components', 'Sidebar.tsx')
    const sidebarContent = fs.readFileSync(sidebarPath, 'utf-8')

    // Extract menu items with keys
    const menuItems: any[] = []

    // Parse the file to extract menu structures
    // This is a simple regex-based extraction
    const lines = sidebarContent.split('\n')

    let currentParent: string | null = null
    let order = 0

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]

      // Check for key
      const keyMatch = line.match(/key:\s*["']([^"']+)["']/)
      if (keyMatch) {
        const key = keyMatch[1]

        // Find name on nearby lines
        let name = key
        for (let j = Math.max(0, i - 5); j < Math.min(lines.length, i + 5); j++) {
          const nameMatch = lines[j].match(/name:\s*["']([^"']+)["']/)
          if (nameMatch) {
            name = nameMatch[1]
            break
          }
        }

        // Find href on nearby lines
        let href = '/dashboard'
        for (let j = Math.max(0, i - 5); j < Math.min(lines.length, i + 5); j++) {
          const hrefMatch = lines[j].match(/href:\s*["']([^"'#]+)["']/)
          if (hrefMatch) {
            href = hrefMatch[1]
            break
          }
        }

        // Determine if this is a parent or child based on indentation/structure
        const indent = line.search(/\S/)
        const isParent = indent < 10 || line.includes('name:') || i > 0 && lines[i-5]?.includes('children:')

        menuItems.push({
          key,
          name,
          href,
          parentKey: currentParent,
          order: order++,
          inDatabase: false // Will be checked later
        })

        // Update current parent if this looks like a parent menu
        if (isParent && !currentParent) {
          currentParent = key
        }
      }

      // Reset parent when we hit a new section
      if (line.includes('// ==========')) {
        currentParent = null
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        totalFound: menuItems.length,
        menuItems
      }
    })

  } catch (error) {
    console.error('Error extracting menu items:', error)
    return NextResponse.json(
      { error: 'Failed to extract menu items' },
      { status: 500 }
    )
  }
}
