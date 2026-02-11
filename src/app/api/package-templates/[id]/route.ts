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

    const template = await prisma.packageTemplate.findFirst({
      where: {
        id: parseInt(id),
        businessId: businessId
      },
      include: {
        category: { select: { id: true, name: true } },
        creator: { select: { id: true, firstName: true, lastName: true, username: true } },
        items: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
                sku: true,
                imageUrl: true
              }
            }
          }
        }
      }
    })

    if (!template) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 })
    }

    return NextResponse.json({ template })
  } catch (error) {
    console.error('Error fetching package template:', error)
    return NextResponse.json({ error: 'Failed to fetch package template' }, { status: 500 })
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
    const templateId = parseInt(id)

    // Check permission
    if (!hasPermission(user as RBACUser, PERMISSIONS.PACKAGE_TEMPLATE_EDIT)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const { name, description, sku, categoryId, targetPrice, markupPercent, templateType, isActive, items } = body

    // Verify template belongs to business
    const existing = await prisma.packageTemplate.findFirst({
      where: {
        id: templateId,
        businessId: businessId
      }
    })

    if (!existing) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 })
    }

    // Update template with items in a transaction
    const template = await prisma.$transaction(async (tx) => {
      // Update the template
      await tx.packageTemplate.update({
        where: { id: templateId },
        data: {
          name: name !== undefined ? name : existing.name,
          description: description !== undefined ? description : existing.description,
          sku: sku !== undefined ? (sku || null) : existing.sku,
          categoryId: categoryId !== undefined ? (categoryId ? parseInt(categoryId) : null) : existing.categoryId,
          targetPrice: targetPrice !== undefined ? targetPrice : existing.targetPrice,
          markupPercent: markupPercent !== undefined ? markupPercent : existing.markupPercent,
          templateType: templateType !== undefined ? templateType : existing.templateType,
          isActive: isActive !== undefined ? isActive : existing.isActive
        }
      })

      // If items are provided, replace all items
      if (items !== undefined) {
        // Delete existing items
        await tx.packageTemplateItem.deleteMany({
          where: { packageTemplateId: templateId }
        })

        // Create new items
        if (items && items.length > 0) {
          await tx.packageTemplateItem.createMany({
            data: items.map((item: any) => ({
              packageTemplateId: templateId,
              productId: parseInt(item.productId),
              productVariationId: parseInt(item.productVariationId),
              quantity: item.quantity || 1,
              originalPrice: item.originalPrice || 0,
              customPrice: item.customPrice || item.originalPrice || 0
            }))
          })
        }
      }

      // Fetch the complete template with items
      return tx.packageTemplate.findUnique({
        where: { id: templateId },
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

    return NextResponse.json({ template, message: 'Package template updated successfully' })
  } catch (error) {
    console.error('Error updating package template:', error)
    return NextResponse.json({ error: 'Failed to update package template' }, { status: 500 })
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

    // Verify template belongs to business
    const existing = await prisma.packageTemplate.findFirst({
      where: {
        id: parseInt(id),
        businessId: businessId
      }
    })

    if (!existing) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 })
    }

    // Soft delete - just mark as inactive
    await prisma.packageTemplate.update({
      where: { id: parseInt(id) },
      data: { isActive: false }
    })

    return NextResponse.json({ message: 'Package template deleted successfully' })
  } catch (error) {
    console.error('Error deleting package template:', error)
    return NextResponse.json({ error: 'Failed to delete package template' }, { status: 500 })
  }
}
