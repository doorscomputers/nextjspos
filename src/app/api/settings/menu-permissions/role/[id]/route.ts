import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth.simple'
import { prisma } from '@/lib/prisma.simple'
import { PERMISSIONS } from '@/lib/rbac'

// GET /api/settings/menu-permissions/role/[id]
// Get menu permissions for a specific role
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user has permission to view roles
    if (!session.user.permissions.includes(PERMISSIONS.ROLE_VIEW)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { id } = await params
    const roleId = parseInt(id)
    if (isNaN(roleId)) {
      return NextResponse.json({ error: 'Invalid role ID' }, { status: 400 })
    }

    // Get role with menu permissions
    const role = await prisma.role.findUnique({
      where: { id: roleId },
      include: {
        menuPermissions: {
          include: {
            menuPermission: {
              select: {
                id: true,
                key: true,
                name: true,
                href: true,
                parentId: true
              }
            }
          }
        }
      }
    })

    if (!role) {
      return NextResponse.json({ error: 'Role not found' }, { status: 404 })
    }

    // Get all available menu permissions
    const allMenus = await prisma.menuPermission.findMany({
      orderBy: [
        { parentId: 'asc' },
        { order: 'asc' },
        { name: 'asc' }
      ]
    })

    // Extract enabled menu keys
    const enabledMenuKeys = role.menuPermissions.map(rmp => rmp.menuPermission.key)

    return NextResponse.json({
      success: true,
      data: {
        role: {
          id: role.id,
          name: role.name,
          displayName: role.name // Use name as displayName
        },
        allMenus,
        enabledMenuKeys
      }
    })

  } catch (error) {
    console.error('Error fetching role menu permissions:', error)
    return NextResponse.json(
      { error: 'Failed to fetch menu permissions' },
      { status: 500 }
    )
  }
}

// POST /api/settings/menu-permissions/role/[id]
// Update menu permissions for a role
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user has permission to edit roles
    if (!session.user.permissions.includes(PERMISSIONS.ROLE_UPDATE)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { id } = await params
    const roleId = parseInt(id)
    if (isNaN(roleId)) {
      return NextResponse.json({ error: 'Invalid role ID' }, { status: 400 })
    }

    const body = await req.json()
    const { menuKeys } = body

    if (!Array.isArray(menuKeys)) {
      return NextResponse.json({ error: 'menuKeys must be an array' }, { status: 400 })
    }

    // Verify role exists
    const role = await prisma.role.findUnique({
      where: { id: roleId }
    })

    if (!role) {
      return NextResponse.json({ error: 'Role not found' }, { status: 404 })
    }

    // Get menu permission IDs for the provided keys
    const menuPermissions = await prisma.menuPermission.findMany({
      where: {
        key: { in: menuKeys }
      }
    })

    // ✅ ATOMIC TRANSACTION: Delete old + create new menu permissions
    await prisma.$transaction(async (tx) => {
      // Delete existing role menu permissions
      await tx.roleMenuPermission.deleteMany({
        where: { roleId }
      })

      // Create new role menu permissions
      if (menuPermissions.length > 0) {
        await tx.roleMenuPermission.createMany({
          data: menuPermissions.map(mp => ({
            roleId,
            menuPermissionId: mp.id
          }))
        })
      }
    }, {
      timeout: 60000, // 60 seconds timeout for network resilience
    })

    return NextResponse.json({
      success: true,
      message: 'Menu permissions updated successfully',
      data: {
        roleId,
        enabledMenuCount: menuPermissions.length
      }
    })

  } catch (error) {
    console.error('Error updating role menu permissions:', error)
    return NextResponse.json(
      { error: 'Failed to update menu permissions' },
      { status: 500 }
    )
  }
}
