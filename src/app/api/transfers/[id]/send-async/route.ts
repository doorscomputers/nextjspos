import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth.simple'
import { prisma } from '@/lib/prisma.simple'
import { PERMISSIONS } from '@/lib/rbac'

/**
 * POST /api/transfers/[id]/send-async
 *
 * Async version of transfer send - creates background job instead of processing immediately
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
    const userId = parseInt(String(user.id))

    const { id } = await params
    const transferId = parseInt(id)

    // Check permission
    if (!user.permissions?.includes(PERMISSIONS.STOCK_TRANSFER_SEND)) {
      return NextResponse.json(
        { error: 'Forbidden - Requires STOCK_TRANSFER_SEND permission' },
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

    // Validate status
    if (transfer.status !== 'checked') {
      return NextResponse.json(
        { error: `Cannot send transfer with status: ${transfer.status}` },
        { status: 400 }
      )
    }

    // Check if stock already deducted
    if (transfer.stockDeducted) {
      return NextResponse.json(
        { error: 'Stock already deducted for this transfer' },
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
        type: 'transfer_send',
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
      `✅ Transfer send job created: ${job.id} for transfer ${transfer.transferNumber} (${transfer.items.length} items)`
    )

    // Job will be processed by the cron worker (/api/cron/process-jobs)
    // Cron runs every minute, so processing starts within 60 seconds
    // This ensures the API response returns immediately without blocking

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
    console.error('Error creating transfer send job:', error)
    return NextResponse.json(
      { error: 'Failed to create transfer send job', details: error.message },
      { status: 500 }
    )
  }
}
