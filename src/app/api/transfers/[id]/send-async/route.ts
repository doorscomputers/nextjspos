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

    // SYNCHRONOUS PROCESSING: Process immediately and return result
    // With bulk optimizations, 70 items complete in 30-45 seconds (within Vercel Pro 60s limit)
    try {
      const { processJob } = await import('@/lib/job-processor')
      await processJob(job)

      console.log(`✅ Transfer send completed successfully: ${transfer.transferNumber}`)

      return NextResponse.json(
        {
          jobId: job.id,
          transferId: transfer.id,
          transferNumber: transfer.transferNumber,
          itemCount: transfer.items.length,
          message: `Successfully processed ${transfer.items.length} items`,
          status: 'completed',
        },
        { status: 200 }
      )
    } catch (error: any) {
      console.error(`[Job ${job.id}] Processing failed:`, error)

      // Mark job as failed
      await prisma.job.update({
        where: { id: job.id },
        data: {
          status: 'failed',
          error: error.message,
        },
      })

      return NextResponse.json(
        {
          error: 'Transfer send failed',
          details: error.message,
          jobId: job.id,
        },
        { status: 500 }
      )
    }
  } catch (error: any) {
    console.error('Error creating transfer send job:', error)
    return NextResponse.json(
      { error: 'Failed to create transfer send job', details: error.message },
      { status: 500 }
    )
  }
}
