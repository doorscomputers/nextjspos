import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth.simple'
import { prisma } from '@/lib/prisma'
import { PERMISSIONS } from '@/lib/rbac'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = session.user as any

    // Check permission
    if (!user.permissions?.includes(PERMISSIONS.ROLE_VIEW)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Get roles for the business
    const roles = await prisma.role.findMany({
      where: {
        businessId: parseInt(user.businessId),
      },
      include: {
        permissions: {
          include: {
            permission: true,
          },
        },
        users: true,
        locations: {
          include: {
            location: true,
          },
        },
      },
      orderBy: {
        name: 'asc',
      },
    })

    // Format response
    const formattedRoles = roles.map(r => ({
      id: r.id,
      name: r.name,
      isDefault: r.isDefault,
      permissionCount: r.permissions.length,
      userCount: r.users.length,
      permissions: r.permissions.map(rp => rp.permission.name),
      locations: r.locations.map(rl => rl.locationId),
      createdAt: r.createdAt,
    }))

    return NextResponse.json({ success: true, data: formattedRoles })
  } catch (error) {
    console.error('Error fetching roles:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = session.user as any

    // Check permission
    if (!user.permissions?.includes(PERMISSIONS.ROLE_CREATE)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const { name, permissions, locations } = body

    if (!name) {
      return NextResponse.json({ error: 'Role name is required' }, { status: 400 })
    }

    // Create role
    const role = await prisma.role.create({
      data: {
        name,
        businessId: parseInt(user.businessId),
        guardName: 'web',
        isDefault: false,
      },
    })

    // Assign permissions if provided
    if (permissions && Array.isArray(permissions)) {
      const permissionRecords = await prisma.permission.findMany({
        where: {
          name: {
            in: permissions,
          },
        },
      })

      await Promise.all(
        permissionRecords.map((perm) =>
          prisma.rolePermission.create({
            data: {
              roleId: role.id,
              permissionId: perm.id,
            },
          })
        )
      )
    }

    // Assign locations if provided
    if (locations && Array.isArray(locations)) {
      await Promise.all(
        locations.map((locationId: number) =>
          prisma.roleLocation.create({
            data: {
              roleId: role.id,
              locationId,
            },
          })
        )
      )
    }

    return NextResponse.json({ success: true, role }, { status: 201 })
  } catch (error) {
    console.error('Error creating role:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = session.user as any

    // Check permission
    if (!user.permissions?.includes(PERMISSIONS.ROLE_DELETE)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'Role ID is required' }, { status: 400 })
    }

    // Check if role exists and belongs to business
    const role = await prisma.role.findFirst({
      where: {
        id: parseInt(id),
        businessId: parseInt(user.businessId),
      },
      include: {
        users: true,
      },
    })

    if (!role) {
      return NextResponse.json({ error: 'Role not found' }, { status: 404 })
    }

    // Prevent deleting default roles
    if (role.isDefault) {
      return NextResponse.json(
        { error: 'Cannot delete system default roles' },
        { status: 400 }
      )
    }

    // Prevent deleting roles with users
    if (role.users.length > 0) {
      return NextResponse.json(
        { error: 'Cannot delete role with assigned users' },
        { status: 400 }
      )
    }

    // Delete role (permissions will cascade delete)
    await prisma.role.delete({
      where: { id: parseInt(id) },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting role:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
