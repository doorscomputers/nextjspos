import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth.simple'
import { prisma } from '@/lib/prisma'
import { PERMISSIONS } from '@/lib/rbac'
import { createAuditLog } from '@/lib/auditLog'

/**
 * GET /api/settings/inactivity
 * Fetch inactivity timeout settings for the current business
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = session.user as any

    // Check permission
    if (!user.permissions?.includes(PERMISSIONS.BUSINESS_SETTINGS_VIEW)) {
      return NextResponse.json({ error: 'Forbidden - View business settings permission required' }, { status: 403 })
    }

    // Fetch inactivity settings
    let settings = await prisma.inactivitySettings.findUnique({
      where: { businessId: parseInt(user.businessId) }
    })

    // If no settings exist, create defaults
    if (!settings) {
      settings = await prisma.inactivitySettings.create({
        data: {
          businessId: parseInt(user.businessId)
          // All defaults are set in schema
        }
      })
    }

    return NextResponse.json({
      success: true,
      settings
    })
  } catch (error) {
    console.error('Error fetching inactivity settings:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * PUT /api/settings/inactivity
 * Update inactivity timeout settings for the current business
 */
export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = session.user as any

    // Check permission - requires edit permission
    if (!user.permissions?.includes(PERMISSIONS.BUSINESS_SETTINGS_EDIT)) {
      return NextResponse.json({ error: 'Forbidden - Edit business settings permission required' }, { status: 403 })
    }

    const body = await request.json()
    const {
      enabled,
      superAdminTimeout,
      adminTimeout,
      managerTimeout,
      cashierTimeout,
      defaultTimeout,
      warningTime,
      warningMessage
    } = body

    // Validate timeout values
    if (superAdminTimeout !== undefined && (superAdminTimeout < 5 || superAdminTimeout > 480)) {
      return NextResponse.json({ error: 'Super Admin timeout must be between 5 and 480 minutes' }, { status: 400 })
    }
    if (adminTimeout !== undefined && (adminTimeout < 5 || adminTimeout > 480)) {
      return NextResponse.json({ error: 'Admin timeout must be between 5 and 480 minutes' }, { status: 400 })
    }
    if (managerTimeout !== undefined && (managerTimeout < 5 || managerTimeout > 480)) {
      return NextResponse.json({ error: 'Manager timeout must be between 5 and 480 minutes' }, { status: 400 })
    }
    if (cashierTimeout !== undefined && (cashierTimeout < 5 || cashierTimeout > 480)) {
      return NextResponse.json({ error: 'Cashier timeout must be between 5 and 480 minutes' }, { status: 400 })
    }
    if (defaultTimeout !== undefined && (defaultTimeout < 5 || defaultTimeout > 480)) {
      return NextResponse.json({ error: 'Default timeout must be between 5 and 480 minutes' }, { status: 400 })
    }
    if (warningTime !== undefined && (warningTime < 1 || warningTime > 10)) {
      return NextResponse.json({ error: 'Warning time must be between 1 and 10 minutes' }, { status: 400 })
    }

    const businessId = parseInt(user.businessId)

    // Fetch existing settings
    let settings = await prisma.inactivitySettings.findUnique({
      where: { businessId }
    })

    const oldSettings = settings ? { ...settings } : null

    // Upsert settings
    settings = await prisma.inactivitySettings.upsert({
      where: { businessId },
      update: {
        enabled: enabled ?? undefined,
        superAdminTimeout: superAdminTimeout ?? undefined,
        adminTimeout: adminTimeout ?? undefined,
        managerTimeout: managerTimeout ?? undefined,
        cashierTimeout: cashierTimeout ?? undefined,
        defaultTimeout: defaultTimeout ?? undefined,
        warningTime: warningTime ?? undefined,
        warningMessage: warningMessage ?? undefined,
        updatedAt: new Date()
      },
      create: {
        businessId,
        // All other fields use defaults from schema
        ...(enabled !== undefined && { enabled }),
        ...(superAdminTimeout !== undefined && { superAdminTimeout }),
        ...(adminTimeout !== undefined && { adminTimeout }),
        ...(managerTimeout !== undefined && { managerTimeout }),
        ...(cashierTimeout !== undefined && { cashierTimeout }),
        ...(defaultTimeout !== undefined && { defaultTimeout }),
        ...(warningTime !== undefined && { warningTime }),
        ...(warningMessage !== undefined && { warningMessage })
      }
    })

    // Create audit log
    try {
      await createAuditLog({
        action: 'inactivity_settings_update',
        userId: parseInt(user.id),
        username: user.username,
        entityType: 'INACTIVITY_SETTINGS',
        entityId: settings.id,
        businessId,
        metadata: {
          oldSettings,
          newSettings: settings,
          updatedBy: user.username,
          updatedFields: Object.keys(body)
        }
      })
    } catch (auditError) {
      console.error('Failed to create audit log:', auditError)
      // Don't block the save if audit logging fails
    }

    return NextResponse.json({
      success: true,
      message: 'Inactivity timeout settings updated successfully',
      settings
    })
  } catch (error) {
    console.error('Error updating inactivity settings:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
