import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth.simple'
import { PERMISSIONS } from '@/lib/rbac'
import { prisma } from '@/lib/prisma'

/**
 * SAFE endpoint to add ONLY Package Templates menus
 * This does NOT touch any other menus or role/user assignments
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user has permission
    if (!session.user.permissions.includes(PERMISSIONS.ROLE_UPDATE)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const results: { key: string; action: string; id?: number }[] = []

    // Package Templates menu items to add
    const packageMenus = [
      {
        key: 'menu.package_templates',
        name: 'Package Templates',
        href: '/dashboard/package-templates',
        icon: 'CubeIcon',
        order: 100,
        parentId: null
      },
      {
        key: 'menu.package_templates_2',
        name: 'Package Template 2',
        href: '/dashboard/package-templates-2',
        icon: 'CubeIcon',
        order: 101,
        parentId: null
      }
    ]

    for (const menu of packageMenus) {
      // Check if already exists
      const existing = await prisma.menuPermission.findUnique({
        where: { key: menu.key }
      })

      if (existing) {
        results.push({ key: menu.key, action: 'already_exists', id: existing.id })
      } else {
        // Create new menu item
        const created = await prisma.menuPermission.create({
          data: menu
        })
        results.push({ key: menu.key, action: 'created', id: created.id })
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Package Template menus processed',
      data: results
    })

  } catch (error) {
    console.error('Error adding Package Template menus:', error)
    return NextResponse.json(
      { error: 'Failed to add Package Template menus' },
      { status: 500 }
    )
  }
}

// GET endpoint to check current status
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const packageMenu1 = await prisma.menuPermission.findUnique({
      where: { key: 'menu.package_templates' }
    })

    const packageMenu2 = await prisma.menuPermission.findUnique({
      where: { key: 'menu.package_templates_2' }
    })

    return NextResponse.json({
      success: true,
      data: {
        'menu.package_templates': packageMenu1 ? { exists: true, id: packageMenu1.id } : { exists: false },
        'menu.package_templates_2': packageMenu2 ? { exists: true, id: packageMenu2.id } : { exists: false }
      }
    })

  } catch (error) {
    console.error('Error checking Package Template menus:', error)
    return NextResponse.json(
      { error: 'Failed to check Package Template menus' },
      { status: 500 }
    )
  }
}
