import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth.simple'
import { prisma } from '@/lib/prisma.simple'
import { hasPermission, PERMISSIONS, RBACUser } from '@/lib/rbac'

export async function GET() {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = session.user as any
    const businessId = parseInt(String(user.businessId))

    // Check permission
    if (!hasPermission(user as RBACUser, PERMISSIONS.PACKAGE_TEMPLATE_VIEW)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const categories = await prisma.packageCategory.findMany({
      where: {
        businessId: businessId,
        isActive: true
      },
      orderBy: { sortOrder: 'asc' },
      include: {
        _count: {
          select: { packages: true }
        }
      }
    })

    return NextResponse.json({ categories })
  } catch (error) {
    console.error('Error fetching package categories:', error)
    return NextResponse.json({ error: 'Failed to fetch package categories' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = session.user as any
    const businessId = parseInt(String(user.businessId))

    // Check permission
    if (!hasPermission(user as RBACUser, PERMISSIONS.PACKAGE_TEMPLATE_CREATE)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()

    // Get max sort order
    const maxOrder = await prisma.packageCategory.findFirst({
      where: { businessId },
      orderBy: { sortOrder: 'desc' },
      select: { sortOrder: true }
    })

    const category = await prisma.packageCategory.create({
      data: {
        businessId: businessId,
        name: body.name,
        description: body.description || null,
        sortOrder: (maxOrder?.sortOrder || 0) + 1,
        isActive: true
      }
    })

    return NextResponse.json({ category, message: 'Category created successfully' }, { status: 201 })
  } catch (error: any) {
    console.error('Error creating package category:', error)
    // Check for unique constraint violation
    if (error?.code === 'P2002') {
      return NextResponse.json({ error: 'A category with this name already exists' }, { status: 400 })
    }
    return NextResponse.json({
      error: 'Failed to create package category',
      details: error?.message || String(error)
    }, { status: 500 })
  }
}
