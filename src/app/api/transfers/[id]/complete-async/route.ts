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
    const userId = parseInt(String(user.id))

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

    // Fast-fail if another request already claimed this transfer.
    // The atomic claim itself lives in processTransferComplete (job-processor.ts) —
    // claiming here too would trip the processor's stockReceived guard and no-op the job.
    if (transfer.stockReceived) {
      console.warn(`[complete-async] Transfer ${transferId} already being completed or stockReceived=true`)
      return NextResponse.json(
        { error: 'Transfer is already being completed by another request' },
        { status: 409 }
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

    // SYNCHRONOUS PROCESSING: Process immediately and return result
    // With bulk optimizations, 70 items complete in 30-45 seconds (within Vercel Pro 60s limit)
    // processJob never throws — it records the outcome on the job row, so re-fetch it
    const { processJob } = await import('@/lib/job-processor')
    await processJob(job)

    const finishedJob = await prisma.job.findUnique({ where: { id: job.id } })
    const jobResult = finishedJob?.result as any

    if (finishedJob?.status === 'completed' && !jobResult?.skipped) {
      console.log(`✅ Transfer receive completed successfully: ${transfer.transferNumber}`)

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
    }

    if (jobResult?.skipped) {
      console.warn(`[complete-async] Transfer ${transferId} skipped by processor (already claimed/completed)`)
      return NextResponse.json(
        { error: 'Transfer is already being completed by another request' },
        { status: 409 }
      )
    }

    console.error(`[Job ${job.id}] Processing failed:`, finishedJob?.error)
    return NextResponse.json(
      {
        error: 'Transfer receive failed',
        details: finishedJob?.error || 'Unknown error',
        jobId: job.id,
      },
      { status: 500 }
    )
  } catch (error: any) {
    console.error('Error creating transfer complete job:', error)
    return NextResponse.json(
      { error: 'Failed to create transfer complete job', details: error.message },
      { status: 500 }
    )
  }
}
