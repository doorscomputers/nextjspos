import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth.simple'
import { prisma } from '@/lib/prisma.simple'
import { PERMISSIONS } from '@/lib/rbac'
import { createAuditLog, AuditAction, EntityType } from '@/lib/auditLog'
import { getIpAddress, getUserAgent } from '@/lib/utils'

/**
 * GET /api/qc-templates/[id]
 * Get a specific QC checklist template
 */
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
    // Check permission
    if (!user.permissions?.includes(PERMISSIONS.QC_TEMPLATE_VIEW)) {
      return NextResponse.json({ error: 'Forbidden - Insufficient permissions' }, { status: 403 })
    }

    const { id } = await params
    const templateId = parseInt(id)

    // Fetch template
    const template = await prisma.qCChecklistTemplate.findFirst({
      where: {
        id: templateId,
        businessId: parseInt(businessId),
      },
    })

    if (!template) {
      return NextResponse.json(
        { error: 'QC template not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      data: template,
    })
  } catch (error: any) {
    console.error('Error fetching QC template:', error)
    return NextResponse.json(
      { error: 'Failed to fetch QC template', details: error.message },
      { status: 500 }
    )
  }
}

/**
 * PUT /api/qc-templates/[id]
 * Update a QC checklist template
 */
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
    const userId = user.id

    // Check permission
    if (!user.permissions?.includes(PERMISSIONS.QC_TEMPLATE_MANAGE)) {
      return NextResponse.json({ error: 'Forbidden - Insufficient permissions' }, { status: 403 })
    }

    const { id } = await params
    const templateId = parseInt(id)
    const body = await request.json()
    const {
      name,
      description,
      categoryIds,
      productIds,
      checkItems,
      isActive,
    } = body

    // Fetch existing template
    const existingTemplate = await prisma.qCChecklistTemplate.findFirst({
      where: {
        id: templateId,
        businessId: parseInt(businessId),
      },
    })

    if (!existingTemplate) {
      return NextResponse.json(
        { error: 'QC template not found' },
        { status: 404 }
      )
    }

    // Validate checkItems if provided
    if (checkItems) {
      if (!Array.isArray(checkItems) || checkItems.length === 0) {
        return NextResponse.json(
          { error: 'checkItems must be a non-empty array' },
          { status: 400 }
        )
      }

      for (const item of checkItems) {
        if (!item.checkName || !item.checkCategory) {
          return NextResponse.json(
            { error: 'Each check item must have checkName and checkCategory' },
            { status: 400 }
          )
        }
      }
    }

    // Update template
    const updateData: any = {}
    if (name !== undefined) updateData.name = name
    if (description !== undefined) updateData.description = description || null
    if (categoryIds !== undefined) updateData.categoryIds = categoryIds ? JSON.stringify(categoryIds) : null
    if (productIds !== undefined) updateData.productIds = productIds ? JSON.stringify(productIds) : null
    if (checkItems !== undefined) updateData.checkItems = checkItems
    if (isActive !== undefined) updateData.isActive = isActive

    const updatedTemplate = await prisma.qCChecklistTemplate.update({
      where: { id: templateId },
      data: updateData,
    })

    // Create audit log
    await createAuditLog({
      businessId: parseInt(businessId),
      userId: parseInt(userId),
      username: user.username,
      action: 'qc_template_update' as AuditAction,
      entityType: EntityType.PURCHASE,
      entityIds: [templateId],
      description: `Updated QC Checklist Template: ${updatedTemplate.name}`,
      metadata: {
        templateId,
        templateName: updatedTemplate.name,
        changes: Object.keys(updateData),
      },
      ipAddress: getIpAddress(request),
      userAgent: getUserAgent(request),
    })

    return NextResponse.json({
      success: true,
      message: 'QC template updated successfully',
      data: updatedTemplate,
    })
  } catch (error: any) {
    console.error('Error updating QC template:', error)
    return NextResponse.json(
      { error: 'Failed to update QC template', details: error.message },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/qc-templates/[id]
 * Delete a QC checklist template
 */
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
    const userId = user.id

    // Check permission
    if (!user.permissions?.includes(PERMISSIONS.QC_TEMPLATE_MANAGE)) {
      return NextResponse.json({ error: 'Forbidden - Insufficient permissions' }, { status: 403 })
    }

    const { id } = await params
    const templateId = parseInt(id)

    // Fetch template
    const template = await prisma.qCChecklistTemplate.findFirst({
      where: {
        id: templateId,
        businessId: parseInt(businessId),
      },
    })

    if (!template) {
      return NextResponse.json(
        { error: 'QC template not found' },
        { status: 404 }
      )
    }

    // Soft delete by setting isActive to false
    await prisma.qCChecklistTemplate.update({
      where: { id: templateId },
      data: { isActive: false },
    })

    // Create audit log
    await createAuditLog({
      businessId: parseInt(businessId),
      userId: parseInt(userId),
      username: user.username,
      action: 'qc_template_delete' as AuditAction,
      entityType: EntityType.PURCHASE,
      entityIds: [templateId],
      description: `Deleted QC Checklist Template: ${template.name}`,
      metadata: {
        templateId,
        templateName: template.name,
      },
      ipAddress: getIpAddress(request),
      userAgent: getUserAgent(request),
    })

    return NextResponse.json({
      success: true,
      message: 'QC template deleted successfully',
    })
  } catch (error: any) {
    console.error('Error deleting QC template:', error)
    return NextResponse.json(
      { error: 'Failed to delete QC template', details: error.message },
      { status: 500 }
    )
  }
}
