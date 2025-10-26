/**
 * API Route: Role Menu Permissions
 * GET /api/settings/menu-permissions/role/[roleId] - Get role's menu permissions
 * PUT /api/settings/menu-permissions/role/[roleId] - Update role's menu permissions
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import {
  getRoleMenuPermissions,
  updateRoleMenuPermissions,
} from '@/lib/menu-permissions'
import { hasPermission, PERMISSIONS } from '@/lib/rbac'
import { prisma } from '@/lib/prisma'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ roleId: string }> }
) {
  try {
    // Authentication check
    const session = await getServerSession(authOptions)
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Authorization check
    if (!hasPermission(session.user, PERMISSIONS.ROLE_VIEW)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { roleId: roleIdParam } = await params
    const roleId = parseInt(roleIdParam)

    if (isNaN(roleId)) {
      return NextResponse.json({ error: 'Invalid role ID' }, { status: 400 })
    }

    // Check if role exists and belongs to user's business
    const role = await prisma.role.findFirst({
      where: {
        id: roleId,
        businessId: parseInt(session.user.businessId as string),
      },
    })

    if (!role) {
      return NextResponse.json({ error: 'Role not found' }, { status: 404 })
    }

    const menuKeys = await getRoleMenuPermissions(roleId)

    return NextResponse.json({
      success: true,
      data: {
        roleId,
        roleName: role.name,
        menuKeys,
      },
    })
  } catch (error) {
    console.error('Error fetching role menu permissions:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ roleId: string }> }
) {
  try {
    // Authentication check
    const session = await getServerSession(authOptions)
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Authorization check
    if (!hasPermission(session.user, PERMISSIONS.ROLE_UPDATE)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { roleId: roleIdParam } = await params
    const roleId = parseInt(roleIdParam)

    if (isNaN(roleId)) {
      return NextResponse.json({ error: 'Invalid role ID' }, { status: 400 })
    }

    // Check if role exists and belongs to user's business
    const role = await prisma.role.findFirst({
      where: {
        id: roleId,
        businessId: parseInt(session.user.businessId as string),
      },
    })

    if (!role) {
      return NextResponse.json({ error: 'Role not found' }, { status: 404 })
    }

    // Get request body
    const body = await request.json()
    const { menuKeys } = body

    if (!Array.isArray(menuKeys)) {
      return NextResponse.json(
        { error: 'menuKeys must be an array' },
        { status: 400 }
      )
    }

    // Update role menu permissions
    await updateRoleMenuPermissions(roleId, menuKeys)

    return NextResponse.json({
      success: true,
      message: 'Role menu permissions updated successfully',
      data: {
        roleId,
        roleName: role.name,
        menuKeys,
      },
    })
  } catch (error) {
    console.error('Error updating role menu permissions:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
