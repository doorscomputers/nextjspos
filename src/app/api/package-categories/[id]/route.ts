import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth.simple'
import { prisma } from '@/lib/prisma.simple'
import { hasPermission, PERMISSIONS, RBACUser } from '@/lib/rbac'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = session.user as any
    const businessId = parseInt(String(user.businessId))
    const { id } = await params

    // Check permission
    if (!hasPermission(user as RBACUser, PERMISSIONS.PACKAGE_TEMPLATE_VIEW)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const category = await prisma.packageCategory.findFirst({
      where: {
        id: parseInt(id),
        businessId: businessId
      },
      include: {
        packages: {
          where: { isActive: true },
          include: {
            _count: {
              select: { items: true }
            }
          }
        }
      }
    })

    if (!category) {
      return NextResponse.json({ error: 'Category not found' }, { status: 404 })
    }

    return NextResponse.json({ category })
  } catch (error) {
    console.error('Error fetching package category:', error)
    return NextResponse.json({ error: 'Failed to fetch package category' }, { status: 500 })
  }
}

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
    const businessId = parseInt(String(user.businessId))
    const { id } = await params

    // Check permission
    if (!hasPermission(user as RBACUser, PERMISSIONS.PACKAGE_TEMPLATE_EDIT)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()

    // Verify category belongs to business
    const existing = await prisma.packageCategory.findFirst({
      where: {
        id: parseInt(id),
        businessId: businessId
      }
    })

    if (!existing) {
      return NextResponse.json({ error: 'Category not found' }, { status: 404 })
    }

    const category = await prisma.packageCategory.update({
      where: { id: parseInt(id) },
      data: {
        name: body.name,
        description: body.description || null,
        sortOrder: body.sortOrder !== undefined ? body.sortOrder : existing.sortOrder,
        isActive: body.isActive !== undefined ? body.isActive : existing.isActive
      }
    })

    return NextResponse.json({ category, message: 'Category updated successfully' })
  } catch (error) {
    console.error('Error updating package category:', error)
    return NextResponse.json({ error: 'Failed to update package category' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = session.user as any
    const businessId = parseInt(String(user.businessId))
    const { id } = await params

    // Check permission
    if (!hasPermission(user as RBACUser, PERMISSIONS.PACKAGE_TEMPLATE_DELETE)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Verify category belongs to business
    const existing = await prisma.packageCategory.findFirst({
      where: {
        id: parseInt(id),
        businessId: businessId
      }
    })

    if (!existing) {
      return NextResponse.json({ error: 'Category not found' }, { status: 404 })
    }

    // Soft delete - just mark as inactive
    await prisma.packageCategory.update({
      where: { id: parseInt(id) },
      data: { isActive: false }
    })

    return NextResponse.json({ message: 'Category deleted successfully' })
  } catch (error) {
    console.error('Error deleting package category:', error)
    return NextResponse.json({ error: 'Failed to delete package category' }, { status: 500 })
  }
}
