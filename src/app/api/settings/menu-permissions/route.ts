import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth.simple'
import { prisma } from '@/lib/prisma.simple'
import { hasPermission, PERMISSIONS } from '@/lib/rbac'

interface MenuPermission {
  id: number
  key: string
  name: string
  href: string | null
  parentId: number | null
  order: number
  children?: MenuPermission[]
}

// GET /api/settings/menu-permissions
// Get all menu permissions in hierarchical structure
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check permission
    if (!hasPermission(session.user, PERMISSIONS.USER_VIEW) && !hasPermission(session.user, PERMISSIONS.ROLE_VIEW)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Get all menu permissions
    const allMenus = await prisma.menuPermission.findMany({
      orderBy: [
        { order: 'asc' },
        { name: 'asc' }
      ],
      select: {
        id: true,
        key: true,
        name: true,
        href: true,
        parentId: true,
        order: true
      }
    })

    // Build hierarchy
    const menuMap = new Map<number, MenuPermission>()
    const rootMenus: MenuPermission[] = []

    // First pass: create map
    allMenus.forEach(menu => {
      menuMap.set(menu.id, { ...menu, children: [] })
    })

    // Second pass: build hierarchy
    allMenus.forEach(menu => {
      const menuItem = menuMap.get(menu.id)!
      if (menu.parentId === null) {
        rootMenus.push(menuItem)
      } else {
        const parent = menuMap.get(menu.parentId)
        if (parent) {
          if (!parent.children) {
            parent.children = []
          }
          parent.children.push(menuItem)
        }
      }
    })

    return NextResponse.json({
      success: true,
      data: {
        flat: allMenus,
        hierarchy: rootMenus
      }
    })

  } catch (error) {
    console.error('Error fetching menu permissions:', error)
    return NextResponse.json(
      { error: 'Failed to fetch menu permissions' },
      { status: 500 }
    )
  }
}
