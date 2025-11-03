import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth.simple'
import { prisma } from '@/lib/prisma'
import { PERMISSIONS } from '@/lib/rbac'
import { createAuditLog, AuditAction, EntityType, getIpAddress, getUserAgent } from '@/lib/auditLog'

/**
 * GET /api/customer-returns/[id]
 * Get individual customer return details
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
    const businessId = user.businessId
    const { id: returnId } = await params

    // Check permission
    if (!user.permissions?.includes(PERMISSIONS.CUSTOMER_RETURN_VIEW)) {
      return NextResponse.json(
        { error: 'Forbidden - Insufficient permissions' },
        { status: 403 }
      )
    }

    // Get return details
    const customerReturn = await prisma.customerReturn.findFirst({
      where: {
        id: parseInt(returnId),
        businessId: parseInt(businessId),
      },
      include: {
        customer: {
          select: {
            id: true,
            name: true,
            mobile: true,
            email: true,
          },
        },
        sale: {
          select: {
            id: true,
            invoiceNumber: true,
            saleDate: true,
            totalAmount: true,
          },
        },
        items: true,
      },
    })

    if (!customerReturn) {
      return NextResponse.json(
        { error: 'Customer return not found' },
        { status: 404 }
      )
    }

    return NextResponse.json(customerReturn)
  } catch (error) {
    console.error('Error fetching customer return:', error)
    return NextResponse.json(
      {
        error: 'Failed to fetch customer return',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/customer-returns/[id]
 * Reject customer return
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
    const businessId = user.businessId
    const userId = user.id
    const { id: returnId } = await params

    // Check permission
    if (!user.permissions?.includes(PERMISSIONS.CUSTOMER_RETURN_DELETE)) {
      return NextResponse.json(
        { error: 'Forbidden - Insufficient permissions' },
        { status: 403 }
      )
    }

    // Get existing return
    const existing = await prisma.customerReturn.findFirst({
      where: {
        id: parseInt(returnId),
        businessId: parseInt(businessId),
      },
      include: {
        sale: true,
      },
    })

    if (!existing) {
      return NextResponse.json(
        { error: 'Customer return not found' },
        { status: 404 }
      )
    }

    // Only pending returns can be rejected
    if (existing.status !== 'pending') {
      return NextResponse.json(
        { error: `Cannot reject return with status: ${existing.status}` },
        { status: 400 }
      )
    }

    // Update status to rejected
    await prisma.customerReturn.update({
      where: { id: parseInt(returnId) },
      data: {
        status: 'rejected',
      },
    })

    // Create audit log
    await createAuditLog({
      businessId: parseInt(businessId),
      userId: parseInt(userId),
      username: user.username,
      action: 'customer_return_delete' as AuditAction,
      entityType: EntityType.SALE,
      entityIds: [existing.id],
      description: `Rejected Customer Return ${existing.returnNumber}`,
      metadata: {
        returnId: existing.id,
        returnNumber: existing.returnNumber,
        saleId: existing.saleId,
        invoiceNumber: existing.sale.invoiceNumber,
      },
      ipAddress: getIpAddress(request),
      userAgent: getUserAgent(request),
    })

    return NextResponse.json({
      message: `Customer return ${existing.returnNumber} rejected`,
      return: {
        id: existing.id,
        returnNumber: existing.returnNumber,
        status: 'rejected',
      },
    })
  } catch (error) {
    console.error('Error rejecting customer return:', error)
    return NextResponse.json(
      {
        error: 'Failed to reject customer return',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
