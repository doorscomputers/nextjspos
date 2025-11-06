import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth.simple'
import { prisma } from '@/lib/prisma.simple'
import { PERMISSIONS } from '@/lib/rbac'

// PUT /api/settings/menu-management/menus/[id]
// Update a menu item
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check permission
    if (!session.user.permissions.includes(PERMISSIONS.ROLE_UPDATE)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { id } = await params
    const menuId = parseInt(id)
    if (isNaN(menuId)) {
      return NextResponse.json({ error: 'Invalid menu ID' }, { status: 400 })
    }

    const body = await req.json()
    const { key, name, href, parentId, order } = body

    // Update menu item
    const menu = await prisma.menuPermission.update({
      where: { id: menuId },
      data: {
        key,
        name,
        href,
        parentId: parentId || null,
        order: order || 0
      }
    })

    return NextResponse.json({
      success: true,
      data: menu
    })

  } catch (error) {
    console.error('Error updating menu:', error)
    return NextResponse.json(
      { error: 'Failed to update menu' },
      { status: 500 }
    )
  }
}

// DELETE /api/settings/menu-management/menus/[id]
// Delete a menu item
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check permission
    if (!session.user.permissions.includes(PERMISSIONS.ROLE_UPDATE)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { id } = await params
    const menuId = parseInt(id)
    if (isNaN(menuId)) {
      return NextResponse.json({ error: 'Invalid menu ID' }, { status: 400 })
    }

    // Check if menu has children
    const children = await prisma.menuPermission.count({
      where: { parentId: menuId }
    })

    if (children > 0) {
      return NextResponse.json(
        { error: 'Cannot delete menu with children. Delete children first.' },
        { status: 400 }
      )
    }

    // ✅ ATOMIC TRANSACTION: Delete permissions + menu item
    // All deletions happen together or none at all
    await prisma.$transaction(async (tx) => {
      // Delete role menu permissions first
      await tx.roleMenuPermission.deleteMany({
        where: { menuPermissionId: menuId }
      })

      // Delete user menu permissions
      await tx.userMenuPermission.deleteMany({
        where: { menuPermissionId: menuId }
      })

      // Delete menu item
      await tx.menuPermission.delete({
        where: { id: menuId }
      })
    }, {
      timeout: 60000, // 60 seconds timeout for network resilience
    })

    return NextResponse.json({
      success: true,
      message: 'Menu deleted successfully'
    })

  } catch (error) {
    console.error('Error deleting menu:', error)
    return NextResponse.json(
      { error: 'Failed to delete menu' },
      { status: 500 }
    )
  }
}
