import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth.simple'
import { prisma } from '@/lib/prisma.simple'
import { PERMISSIONS } from '@/lib/rbac'
import { createAuditLog, AuditAction, EntityType } from '@/lib/auditLog'
import { getIpAddress, getUserAgent } from '@/lib/utils'

/**
 * GET /api/qc-templates
 * List QC checklist templates
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = session.user as any
    const businessId = user.businessId

    // Check permission
    if (!user.permissions?.includes(PERMISSIONS.QC_TEMPLATE_VIEW)) {
      return NextResponse.json({ error: 'Forbidden - Insufficient permissions' }, { status: 403 })
    }

    // Get query parameters
    const { searchParams } = new URL(request.url)
    const isActive = searchParams.get('isActive')

    // Build where clause
    const where: any = {
      businessId: parseInt(businessId),
    }

    if (isActive !== null) {
      where.isActive = isActive === 'true'
    }

    // Fetch templates
    const templates = await prisma.qCChecklistTemplate.findMany({
      where,
      orderBy: {
        name: 'asc',
      },
    })

    return NextResponse.json({
      success: true,
      data: templates,
    })
  } catch (error: any) {
    console.error('Error fetching QC templates:', error)
    return NextResponse.json(
      { error: 'Failed to fetch QC templates', details: error.message },
      { status: 500 }
    )
  }
}

/**
 * POST /api/qc-templates
 * Create a new QC checklist template
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = session.user as any
    const businessId = user.businessId
    const userId = user.id

    // Check permission
    if (!user.permissions?.includes(PERMISSIONS.QC_TEMPLATE_MANAGE)) {
      return NextResponse.json({ error: 'Forbidden - Insufficient permissions' }, { status: 403 })
    }

    const body = await request.json()
    const {
      name,
      description,
      categoryIds,
      productIds,
      checkItems,
      isActive = true,
    } = body

    // Validate required fields
    if (!name || !checkItems || !Array.isArray(checkItems) || checkItems.length === 0) {
      return NextResponse.json(
        { error: 'Missing required fields: name, checkItems (must be non-empty array)' },
        { status: 400 }
      )
    }

    // Validate checkItems structure
    for (const item of checkItems) {
      if (!item.checkName || !item.checkCategory) {
        return NextResponse.json(
          { error: 'Each check item must have checkName and checkCategory' },
          { status: 400 }
        )
      }
    }

    // Create template
    const template = await prisma.qCChecklistTemplate.create({
      data: {
        businessId: parseInt(businessId),
        name,
        description: description || null,
        categoryIds: categoryIds ? JSON.stringify(categoryIds) : null,
        productIds: productIds ? JSON.stringify(productIds) : null,
        checkItems: checkItems,
        isActive,
        createdBy: parseInt(userId),
      },
    })

    // Create audit log
    await createAuditLog({
      businessId: parseInt(businessId),
      userId: parseInt(userId),
      username: user.username,
      action: 'qc_template_create' as AuditAction,
      entityType: EntityType.PURCHASE,
      entityIds: [template.id],
      description: `Created QC Checklist Template: ${name}`,
      metadata: {
        templateId: template.id,
        templateName: name,
        checkItemsCount: checkItems.length,
      },
      ipAddress: getIpAddress(request),
      userAgent: getUserAgent(request),
    })

    return NextResponse.json({
      success: true,
      message: 'QC template created successfully',
      data: template,
    })
  } catch (error: any) {
    console.error('Error creating QC template:', error)
    return NextResponse.json(
      { error: 'Failed to create QC template', details: error.message },
      { status: 500 }
    )
  }
}
