import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth.simple'
import { prisma } from '@/lib/prisma.simple'
import { PERMISSIONS } from '@/lib/rbac'

/**
 * POST /api/transfers/[id]/complete-async
 *
 * Async version of transfer complete - creates background job instead of processing immediately
 * This prevents timeout failures for large transfers
 *
 * Returns job ID immediately, client polls /api/jobs/[id] for progress
 */
export async function POST(
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

    const { id } = await params
    const transferId = parseInt(id)

    // Check permission
    if (!user.permissions?.includes(PERMISSIONS.STOCK_TRANSFER_COMPLETE)) {
      return NextResponse.json(
        { error: 'Forbidden - Requires STOCK_TRANSFER_COMPLETE permission' },
        { status: 403 }
      )
    }

    // Get transfer to validate and count items
    const transfer = await prisma.stockTransfer.findFirst({
      where: {
        id: transferId,
        businessId,
        deletedAt: null,
      },
      include: {
        items: true,
      },
    })

    if (!transfer) {
      return NextResponse.json({ error: 'Transfer not found' }, { status: 404 })
    }

    // Validate status (accept in_transit, arrived, verified, verifying)
    const validStatuses = ['in_transit', 'arrived', 'verified', 'verifying']
    if (!validStatuses.includes(transfer.status)) {
      return NextResponse.json(
        { error: `Cannot complete transfer with status: ${transfer.status}` },
        { status: 400 }
      )
    }

    const body = await request.json()
    const { notes } = body

    // Create background job
    const job = await prisma.job.create({
      data: {
        businessId,
        userId,
        type: 'transfer_complete',
        status: 'pending',
        progress: 0,
        total: transfer.items.length,
        payload: {
          transferId,
          notes,
        } as any,
        attempts: 0,
        maxAttempts: 3,
      },
    })

    console.log(
      `✅ Transfer complete job created: ${job.id} for transfer ${transfer.transferNumber} (${transfer.items.length} items)`
    )

    // Return immediately with job ID
    return NextResponse.json(
      {
        jobId: job.id,
        transferId: transfer.id,
        transferNumber: transfer.transferNumber,
        itemCount: transfer.items.length,
        message: `Processing ${transfer.items.length} items in background. Poll /api/jobs/${job.id} for progress.`,
      },
      { status: 202 } // 202 Accepted
    )
  } catch (error: any) {
    console.error('Error creating transfer complete job:', error)
    return NextResponse.json(
      { error: 'Failed to create transfer complete job', details: error.message },
      { status: 500 }
    )
  }
}
