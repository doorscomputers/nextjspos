import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth.simple'
import { prisma } from '@/lib/prisma.simple'
import { PERMISSIONS } from '@/lib/rbac'
import { createAuditLog } from '@/lib/auditLog'

/**
 * GET /api/settings/sod-rules
 * Fetch SOD settings for the current business
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

    // Fetch SOD settings
    let settings = await prisma.businessSODSettings.findUnique({
      where: { businessId: parseInt(user.businessId) }
    })

    // If no settings exist, create defaults
    if (!settings) {
      settings = await prisma.businessSODSettings.create({
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
    console.error('Error fetching SOD settings:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * PUT /api/settings/sod-rules
 * Update SOD settings for the current business
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
      // Transfer SOD
      enforceTransferSOD,
      allowCreatorToCheck,
      allowCreatorToSend,
      allowCheckerToSend,
      // allowSenderToCheck, // TEMPORARILY DISABLED - Need to regenerate Prisma client
      allowCreatorToReceive,
      allowSenderToComplete,
      allowCreatorToComplete,
      allowReceiverToComplete,

      // Purchase SOD
      enforcePurchaseSOD,
      allowAmendmentCreatorToApprove,
      allowPOCreatorToApprove,
      allowGRNCreatorToApprove,

      // Return SOD
      enforceReturnSOD,
      allowCustomerReturnCreatorToApprove,
      allowSupplierReturnCreatorToApprove,

      // General
      exemptRoles,
      minStaffWarningThreshold
    } = body

    const businessId = parseInt(user.businessId)

    // Fetch existing settings
    let settings = await prisma.businessSODSettings.findUnique({
      where: { businessId }
    })

    const oldSettings = settings ? { ...settings } : null

    // Upsert settings
    settings = await prisma.businessSODSettings.upsert({
      where: { businessId },
      update: {
        // Transfer SOD
        enforceTransferSOD: enforceTransferSOD ?? undefined,
        allowCreatorToCheck: allowCreatorToCheck ?? undefined,
        allowCreatorToSend: allowCreatorToSend ?? undefined,
        allowCheckerToSend: allowCheckerToSend ?? undefined,
        // allowSenderToCheck: allowSenderToCheck ?? undefined, // TEMPORARILY DISABLED
        allowCreatorToReceive: allowCreatorToReceive ?? undefined,
        allowSenderToComplete: allowSenderToComplete ?? undefined,
        allowCreatorToComplete: allowCreatorToComplete ?? undefined,
        allowReceiverToComplete: allowReceiverToComplete ?? undefined,

        // Purchase SOD
        enforcePurchaseSOD: enforcePurchaseSOD ?? undefined,
        allowAmendmentCreatorToApprove: allowAmendmentCreatorToApprove ?? undefined,
        allowPOCreatorToApprove: allowPOCreatorToApprove ?? undefined,
        allowGRNCreatorToApprove: allowGRNCreatorToApprove ?? undefined,

        // Return SOD
        enforceReturnSOD: enforceReturnSOD ?? undefined,
        allowCustomerReturnCreatorToApprove: allowCustomerReturnCreatorToApprove ?? undefined,
        allowSupplierReturnCreatorToApprove: allowSupplierReturnCreatorToApprove ?? undefined,

        // General
        exemptRoles: exemptRoles ?? undefined,
        minStaffWarningThreshold: minStaffWarningThreshold ?? undefined,

        updatedAt: new Date()
      },
      create: {
        businessId,
        // All other fields use defaults from schema
        ...(enforceTransferSOD !== undefined && { enforceTransferSOD }),
        ...(allowCreatorToCheck !== undefined && { allowCreatorToCheck }),
        ...(allowCreatorToSend !== undefined && { allowCreatorToSend }),
        ...(allowCheckerToSend !== undefined && { allowCheckerToSend }),
        // ...(allowSenderToCheck !== undefined && { allowSenderToCheck }), // TEMPORARILY DISABLED
        ...(allowCreatorToReceive !== undefined && { allowCreatorToReceive }),
        ...(allowSenderToComplete !== undefined && { allowSenderToComplete }),
        ...(allowCreatorToComplete !== undefined && { allowCreatorToComplete }),
        ...(allowReceiverToComplete !== undefined && { allowReceiverToComplete }),
        ...(enforcePurchaseSOD !== undefined && { enforcePurchaseSOD }),
        ...(allowAmendmentCreatorToApprove !== undefined && { allowAmendmentCreatorToApprove }),
        ...(allowPOCreatorToApprove !== undefined && { allowPOCreatorToApprove }),
        ...(allowGRNCreatorToApprove !== undefined && { allowGRNCreatorToApprove }),
        ...(enforceReturnSOD !== undefined && { enforceReturnSOD }),
        ...(allowCustomerReturnCreatorToApprove !== undefined && { allowCustomerReturnCreatorToApprove }),
        ...(allowSupplierReturnCreatorToApprove !== undefined && { allowSupplierReturnCreatorToApprove }),
        ...(exemptRoles !== undefined && { exemptRoles }),
        ...(minStaffWarningThreshold !== undefined && { minStaffWarningThreshold })
      }
    })

    // Create audit log
    await createAuditLog({
      action: 'sod_settings_update',
      userId: parseInt(user.id),
      entityType: 'BUSINESS_SOD_SETTINGS',
      entityId: settings.id,
      businessId,
      metadata: {
        oldSettings,
        newSettings: settings,
        updatedBy: user.username,
        updatedFields: Object.keys(body)
      }
    })

    return NextResponse.json({
      success: true,
      message: 'SOD rules updated successfully',
      settings
    })
  } catch (error) {
    console.error('Error updating SOD settings:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
