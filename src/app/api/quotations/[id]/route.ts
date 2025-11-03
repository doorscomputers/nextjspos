import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth.simple'
import { prisma } from '@/lib/prisma'
import { hasPermission, PERMISSIONS } from '@/lib/rbac'
import { createAuditLog, AuditAction, EntityType } from '@/lib/auditLog'

/**
 * DELETE /api/quotations/[id] - Delete a quotation
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = session.user as any

    // Check permission - use SELL_CREATE permission since quotations are draft sales
    // Users who can create quotations should be able to delete their own drafts
    if (!hasPermission(user, PERMISSIONS.SELL_CREATE)) {
      return NextResponse.json(
        { error: 'Forbidden - Missing sell.create permission' },
        { status: 403 }
      )
    }

    const quotationId = parseInt((await params).id)

    // Find the quotation first to verify ownership and get details
    const quotation = await prisma.quotation.findFirst({
      where: {
        id: quotationId,
        businessId: parseInt(user.businessId),
      },
    })

    if (!quotation) {
      return NextResponse.json(
        { error: 'Quotation not found or access denied' },
        { status: 404 }
      )
    }

    // Delete the quotation (cascade will delete items)
    await prisma.quotation.delete({
      where: { id: quotationId },
    })

    // Create audit log
    await createAuditLog({
      businessId: parseInt(user.businessId),
      userId: parseInt(user.id),
      username: user.username,
      action: 'quotation_delete' as AuditAction,
      entityType: 'quotation' as EntityType,
      entityIds: [quotationId],
      description: `Deleted quotation ${quotation.quotationNumber}`,
      metadata: {
        quotationNumber: quotation.quotationNumber,
        customerName: quotation.customerName,
        totalAmount: parseFloat(quotation.totalAmount.toString()),
      },
    })

    return NextResponse.json(
      { message: 'Quotation deleted successfully' },
      { status: 200 }
    )
  } catch (error: any) {
    console.error('Error deleting quotation:', error)
    return NextResponse.json(
      {
        error: 'Failed to delete quotation',
        details: error.message,
      },
      { status: 500 }
    )
  }
}
