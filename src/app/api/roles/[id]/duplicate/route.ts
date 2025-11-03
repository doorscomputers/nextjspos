import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth.simple'
import { prisma } from '@/lib/prisma'
import { PERMISSIONS } from '@/lib/rbac'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = session.user as any

    // Check permission - user needs role create permission to duplicate
    if (!user.permissions?.includes(PERMISSIONS.ROLE_CREATE)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const { name, locations } = body
    const resolvedParams = await params
    const sourceRoleId = parseInt(resolvedParams.id)

    if (!name) {
      return NextResponse.json({ error: 'Role name is required' }, { status: 400 })
    }

    // Get the source role with all its permissions
    const sourceRole = await prisma.role.findFirst({
      where: {
        id: sourceRoleId,
        businessId: parseInt(user.businessId),
      },
      include: {
        permissions: {
          include: {
            permission: true,
          },
        },
      },
    })

    if (!sourceRole) {
      return NextResponse.json({ error: 'Source role not found' }, { status: 404 })
    }

    // Check if role name already exists
    const existingRole = await prisma.role.findFirst({
      where: {
        name,
        businessId: parseInt(user.businessId),
      },
    })

    if (existingRole) {
      return NextResponse.json(
        { error: 'A role with this name already exists' },
        { status: 400 }
      )
    }

    // Create the new role
    const newRole = await prisma.role.create({
      data: {
        name,
        businessId: parseInt(user.businessId),
        guardName: 'web',
        isDefault: false, // Duplicated roles are always custom
      },
    })

    // Copy all permissions from source role to new role
    const permissionIds = sourceRole.permissions.map(rp => rp.permission.id)

    await Promise.all(
      permissionIds.map((permId) =>
        prisma.rolePermission.create({
          data: {
            roleId: newRole.id,
            permissionId: permId,
          },
        })
      )
    )

    // Assign locations if provided
    if (locations && Array.isArray(locations) && locations.length > 0) {
      await Promise.all(
        locations.map((locationId: number) =>
          prisma.roleLocation.create({
            data: {
              roleId: newRole.id,
              locationId,
            },
          })
        )
      )
    }

    return NextResponse.json({
      success: true,
      role: newRole,
      message: `Role "${name}" created successfully with ${permissionIds.length} permissions`
    }, { status: 201 })
  } catch (error) {
    console.error('Error duplicating role:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
