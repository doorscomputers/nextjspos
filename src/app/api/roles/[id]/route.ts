import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth.simple'
import { prisma } from '@/lib/prisma'
import { PERMISSIONS } from '@/lib/rbac'

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = session.user as any

    // Check permission
    if (!user.permissions?.includes(PERMISSIONS.ROLE_UPDATE)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const { name, permissions, locations } = body
    const resolvedParams = await params
    const roleId = parseInt(resolvedParams.id)

    // Check if role exists and belongs to business
    const role = await prisma.role.findFirst({
      where: {
        id: roleId,
        businessId: parseInt(user.businessId),
      },
    })

    if (!role) {
      return NextResponse.json({ error: 'Role not found' }, { status: 404 })
    }

    // Prevent editing default roles
    if (role.isDefault) {
      return NextResponse.json(
        { error: 'Cannot edit system default roles' },
        { status: 400 }
      )
    }

    // Update role name if provided
    if (name) {
      await prisma.role.update({
        where: { id: roleId },
        data: { name },
      })
    }

    // Update permissions if provided
    if (permissions && Array.isArray(permissions)) {
      // Delete existing permissions
      await prisma.rolePermission.deleteMany({
        where: { roleId },
      })

      // Add new permissions
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
              roleId,
              permissionId: perm.id,
            },
          })
        )
      )
    }

    // Update locations if provided
    if (locations && Array.isArray(locations)) {
      // Delete existing location assignments
      await prisma.roleLocation.deleteMany({
        where: { roleId },
      })

      // Add new location assignments
      await Promise.all(
        locations.map((locationId: number) =>
          prisma.roleLocation.create({
            data: {
              roleId,
              locationId,
            },
          })
        )
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error updating role:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
