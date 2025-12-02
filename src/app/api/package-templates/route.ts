import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth.simple'
import { prisma } from '@/lib/prisma.simple'
import { hasPermission, PERMISSIONS, RBACUser } from '@/lib/rbac'

export async function GET(request: NextRequest) {
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

    // Get query params for filtering
    const { searchParams } = new URL(request.url)
    const categoryId = searchParams.get('categoryId')
    const activeOnly = searchParams.get('activeOnly') !== 'false'

    const whereClause: any = {
      businessId: businessId
    }

    if (activeOnly) {
      whereClause.isActive = true
    }

    if (categoryId) {
      whereClause.categoryId = parseInt(categoryId)
    }

    const templates = await prisma.packageTemplate.findMany({
      where: whereClause,
      orderBy: { name: 'asc' },
      include: {
        category: {
          select: { id: true, name: true }
        },
        creator: {
          select: { id: true, firstName: true, lastName: true, username: true }
        },
        items: {
          include: {
            product: {
              select: { id: true, name: true, sku: true }
            }
          }
        },
        _count: {
          select: { items: true }
        }
      }
    })

    return NextResponse.json({ templates })
  } catch (error) {
    console.error('Error fetching package templates:', error)
    return NextResponse.json({ error: 'Failed to fetch package templates' }, { status: 500 })
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
    const userId = parseInt(String(user.id))

    // Check permission
    if (!hasPermission(user as RBACUser, PERMISSIONS.PACKAGE_TEMPLATE_CREATE)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const { name, description, sku, categoryId, targetPrice, items } = body

    if (!name || !items || items.length === 0) {
      return NextResponse.json({ error: 'Name and at least one item are required' }, { status: 400 })
    }

    // Create template with items in a transaction
    const template = await prisma.$transaction(async (tx) => {
      // Create the template
      const newTemplate = await tx.packageTemplate.create({
        data: {
          businessId: businessId,
          name: name,
          description: description || null,
          sku: sku || null,
          categoryId: categoryId ? parseInt(categoryId) : null,
          targetPrice: targetPrice || 0,
          isActive: true,
          createdBy: userId
        }
      })

      // Create items
      if (items && items.length > 0) {
        await tx.packageTemplateItem.createMany({
          data: items.map((item: any) => ({
            packageTemplateId: newTemplate.id,
            productId: parseInt(item.productId),
            productVariationId: parseInt(item.productVariationId),
            quantity: item.quantity || 1,
            originalPrice: item.originalPrice || 0,
            customPrice: item.customPrice || item.originalPrice || 0
          }))
        })
      }

      // Fetch the complete template with items
      return tx.packageTemplate.findUnique({
        where: { id: newTemplate.id },
        include: {
          category: { select: { id: true, name: true } },
          creator: { select: { id: true, firstName: true, lastName: true, username: true } },
          items: {
            include: {
              product: { select: { id: true, name: true, sku: true } }
            }
          }
        }
      })
    })

    return NextResponse.json({ template, message: 'Package template created successfully' }, { status: 201 })
  } catch (error) {
    console.error('Error creating package template:', error)
    return NextResponse.json({ error: 'Failed to create package template' }, { status: 500 })
  }
}
