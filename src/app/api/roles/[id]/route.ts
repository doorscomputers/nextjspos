import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth.simple'
import { prisma } from '@/lib/prisma.simple'
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

    console.log('🔧 Updating role:', { roleId, name, permissionCount: permissions?.length, locationCount: locations?.length })

    // Validate roleId
    if (isNaN(roleId)) {
      console.error('❌ Invalid role ID:', resolvedParams.id)
      return NextResponse.json({ error: 'Invalid role ID' }, { status: 400 })
    }

    // Check if role exists and belongs to business
    const role = await prisma.role.findFirst({
      where: {
        id: roleId,
        businessId: parseInt(user.businessId),
      },
    })

    if (!role) {
      console.error('❌ Role not found:', { roleId, businessId: user.businessId })
      return NextResponse.json({ error: 'Role not found' }, { status: 404 })
    }

    // Prevent editing default roles
    if (role.isDefault) {
      console.warn('⚠️ Attempt to edit default role:', role.name)
      return NextResponse.json(
        { error: 'Cannot edit system default roles' },
        { status: 400 }
      )
    }

    // Use a transaction to ensure all updates succeed or fail together
    await prisma.$transaction(async (tx) => {
      // Update role name if provided
      if (name) {
        console.log('📝 Updating role name to:', name)
        await tx.role.update({
          where: { id: roleId },
          data: { name },
        })
      }

      // Update permissions if provided
      if (permissions && Array.isArray(permissions)) {
        console.log('🔐 Updating permissions:', permissions.length)

        // Delete existing permissions
        await tx.rolePermission.deleteMany({
          where: { roleId },
        })

        if (permissions.length > 0) {
          // Add new permissions
          const permissionRecords = await tx.permission.findMany({
            where: {
              name: {
                in: permissions,
              },
            },
          })

          console.log('✅ Found permission records:', permissionRecords.length)

          if (permissionRecords.length > 0) {
            await tx.rolePermission.createMany({
              data: permissionRecords.map((perm) => ({
                roleId,
                permissionId: perm.id,
              })),
            })
          }
        }
      }

      // Update locations if provided
      if (locations && Array.isArray(locations)) {
        console.log('📍 Updating locations:', locations.length)

        // Delete existing location assignments
        await tx.roleLocation.deleteMany({
          where: { roleId },
        })

        if (locations.length > 0) {
          // Add new location assignments
          await tx.roleLocation.createMany({
            data: locations.map((locationId: number) => ({
              roleId,
              locationId,
            })),
          })
        }
      }
    })

    console.log('✅ Role updated successfully:', roleId)
    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('❌ Error updating role:', {
      message: error.message,
      code: error.code,
      meta: error.meta,
      stack: error.stack
    })

    // Provide more specific error messages
    if (error.code === 'P2002') {
      return NextResponse.json(
        { error: 'A role with this name already exists' },
        { status: 409 }
      )
    }

    if (error.code === 'P2025') {
      return NextResponse.json(
        { error: 'Role or related record not found' },
        { status: 404 }
      )
    }

    return NextResponse.json(
      { error: 'Failed to update role. Please try again.' },
      { status: 500 }
    )
  }
}
