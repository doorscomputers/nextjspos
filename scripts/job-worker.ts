import { PrismaClient } from '@prisma/client'
import { transferStockOut } from '@/lib/stockOperations'
import { addStock } from '@/lib/stockOperations'

const prisma = new PrismaClient()

/**
 * Background Job Worker
 *
 * Processes pending jobs from the queue
 * Run this continuously or as a cron job (every minute)
 *
 * USAGE:
 * - Development: npx tsx scripts/job-worker.ts
 * - Production: Vercel Cron (see vercel.json)
 */

// Sleep utility
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

// Main worker loop
async function runWorker() {
  console.log('[Worker] Starting job worker...')

  let isProcessing = false

  while (true) {
    try {
      // Skip if already processing
      if (isProcessing) {
        await sleep(1000)
        continue
      }

      // Pick up pending jobs (oldest first)
      const jobs = await prisma.job.findMany({
        where: {
          status: 'pending',
        },
        orderBy: { createdAt: 'asc' },
        take: 3, // Process 3 jobs concurrently
      })

      if (jobs.length === 0) {
        // No jobs, wait 2 seconds
        await sleep(2000)
        continue
      }

      console.log(`[Worker] Found ${jobs.length} pending jobs`)

      isProcessing = true

      // Process jobs concurrently
      await Promise.all(jobs.map((job) => processJob(job)))

      isProcessing = false

      // Brief pause before next check
      await sleep(500)
    } catch (error) {
      console.error('[Worker] Error in main loop:', error)
      isProcessing = false
      await sleep(5000) // Wait 5 seconds on error
    }
  }
}

// Process a single job
async function processJob(job: any) {
  const startTime = Date.now()

  try {
    console.log(`\n[Job ${job.id}] Processing job type: ${job.type}`)

    // Mark as processing
    await prisma.job.update({
      where: { id: job.id },
      data: {
        status: 'processing',
        startedAt: new Date(),
        attempts: job.attempts + 1,
      },
    })

    let result: any

    // Route to appropriate processor
    switch (job.type) {
      case 'transfer_send':
        result = await processTransferSend(job)
        break
      case 'transfer_complete':
        result = await processTransferComplete(job)
        break
      case 'sale_create':
        result = await processSaleCreate(job)
        break
      case 'purchase_approve':
        result = await processPurchaseApprove(job)
        break
      default:
        throw new Error(`Unknown job type: ${job.type}`)
    }

    // Mark as completed
    const duration = Date.now() - startTime
    await prisma.job.update({
      where: { id: job.id },
      data: {
        status: 'completed',
        progress: job.total,
        result: result as any,
        completedAt: new Date(),
      },
    })

    console.log(`[Job ${job.id}] ✅ Completed in ${duration}ms`)
  } catch (error: any) {
    console.error(`[Job ${job.id}] ❌ Failed:`, error.message)

    // Check if should retry
    const shouldRetry = job.attempts < job.maxAttempts

    if (shouldRetry) {
      // Schedule retry (exponential backoff)
      const retryDelay = Math.pow(2, job.attempts) * 60 * 1000 // 2^n minutes
      const nextRetryAt = new Date(Date.now() + retryDelay)

      await prisma.job.update({
        where: { id: job.id },
        data: {
          status: 'pending', // Back to pending for retry
          error: error.message,
          nextRetryAt,
        },
      })

      console.log(
        `[Job ${job.id}] ⏳ Scheduled retry ${job.attempts + 1}/${job.maxAttempts} at ${nextRetryAt.toISOString()}`
      )
    } else {
      // Max attempts reached, mark as failed
      await prisma.job.update({
        where: { id: job.id },
        data: {
          status: 'failed',
          error: error.message,
          completedAt: new Date(),
        },
      })

      console.log(`[Job ${job.id}] 💀 Failed permanently after ${job.maxAttempts} attempts`)
    }
  }
}

// ============================================
// JOB PROCESSORS
// ============================================

async function processTransferSend(job: any) {
  const payload = job.payload as { transferId: number; notes?: string }
  const { transferId, notes } = payload

  console.log(`[Job ${job.id}] Processing transfer send for transfer #${transferId}`)

  // Get transfer
  const transfer = await prisma.stockTransfer.findUnique({
    where: { id: transferId },
    include: { items: true },
  })

  if (!transfer) {
    throw new Error(`Transfer ${transferId} not found`)
  }

  // Get user info
  const user = await prisma.user.findUnique({
    where: { id: job.userId },
    select: { username: true, firstName: true, lastName: true },
  })

  const userDisplayName =
    [user?.firstName, user?.lastName].filter(Boolean).join(' ') ||
    user?.username ||
    `User#${job.userId}`

  // Process items in batches
  const BATCH_SIZE = 10
  let processedCount = 0

  for (let i = 0; i < transfer.items.length; i += BATCH_SIZE) {
    const batch = transfer.items.slice(i, i + BATCH_SIZE)

    await prisma.$transaction(
      async (tx) => {
        for (const item of batch) {
          const quantity = parseFloat(item.quantity.toString())

          await transferStockOut({
            businessId: job.businessId,
            productId: item.productId,
            productVariationId: item.productVariationId,
            fromLocationId: transfer.fromLocationId,
            quantity,
            transferId,
            userId: job.userId,
            notes: notes || `Transfer ${transfer.transferNumber} sent`,
            userDisplayName,
            tx,
          })

          processedCount++

          // Update job progress
          await tx.job.update({
            where: { id: job.id },
            data: { progress: processedCount },
          })
        }
      },
      {
        timeout: 60000, // 60s per batch
        maxWait: 10000,
      }
    )

    console.log(
      `[Job ${job.id}] Progress: ${processedCount}/${transfer.items.length} items`
    )
  }

  // Update transfer status
  await prisma.stockTransfer.update({
    where: { id: transferId },
    data: {
      status: 'in_transit',
      stockDeducted: true,
      sentBy: job.userId,
      sentAt: new Date(),
    },
  })

  return {
    transferId,
    transferNumber: transfer.transferNumber,
    itemsProcessed: processedCount,
  }
}

async function processTransferComplete(job: any) {
  const payload = job.payload as { transferId: number; notes?: string }
  const { transferId, notes } = payload

  console.log(`[Job ${job.id}] Processing transfer complete for transfer #${transferId}`)

  // Get transfer
  const transfer = await prisma.stockTransfer.findUnique({
    where: { id: transferId },
    include: { items: true },
  })

  if (!transfer) {
    throw new Error(`Transfer ${transferId} not found`)
  }

  // Get user info
  const user = await prisma.user.findUnique({
    where: { id: job.userId },
    select: { username: true, firstName: true, lastName: true },
  })

  const userDisplayName =
    [user?.firstName, user?.lastName].filter(Boolean).join(' ') ||
    user?.username ||
    `User#${job.userId}`

  // Process items in batches
  const BATCH_SIZE = 10
  let processedCount = 0

  for (let i = 0; i < transfer.items.length; i += BATCH_SIZE) {
    const batch = transfer.items.slice(i, i + BATCH_SIZE)

    await prisma.$transaction(
      async (tx) => {
        for (const item of batch) {
          const receivedQty = item.receivedQuantity
            ? parseFloat(item.receivedQuantity.toString())
            : parseFloat(item.quantity.toString())

          await addStock({
            businessId: job.businessId,
            productId: item.productId,
            productVariationId: item.productVariationId,
            locationId: transfer.toLocationId,
            quantity: receivedQty,
            type: 'transfer_in' as any,
            referenceType: 'stock_transfer',
            referenceId: transferId,
            referenceNumber: transfer.transferNumber,
            userId: job.userId,
            userDisplayName,
            notes: `Transfer ${transfer.transferNumber} received`,
            tx,
          })

          processedCount++

          // Update job progress
          await tx.job.update({
            where: { id: job.id },
            data: { progress: processedCount },
          })
        }
      },
      {
        timeout: 60000,
        maxWait: 10000,
      }
    )

    console.log(
      `[Job ${job.id}] Progress: ${processedCount}/${transfer.items.length} items`
    )
  }

  // Update transfer status
  await prisma.stockTransfer.update({
    where: { id: transferId },
    data: {
      status: 'completed',
      completedBy: job.userId,
      completedAt: new Date(),
      verifiedBy: job.userId,
      verifiedAt: new Date(),
      receivedAt: new Date(),
    },
  })

  return {
    transferId,
    transferNumber: transfer.transferNumber,
    itemsProcessed: processedCount,
  }
}

async function processSaleCreate(job: any) {
  // TODO: Implement sale creation in background
  // This will be similar to transfer processing
  throw new Error('Sale creation not yet implemented in job worker')
}

async function processPurchaseApprove(job: any) {
  // TODO: Implement purchase approval in background
  throw new Error('Purchase approval not yet implemented in job worker')
}

// ============================================
// START WORKER
// ============================================

if (require.main === module) {
  console.log('🚀 Starting background job worker...')
  console.log('Press Ctrl+C to stop\n')

  runWorker()
    .catch((error) => {
      console.error('Fatal error in worker:', error)
      process.exit(1)
    })
    .finally(async () => {
      await prisma.$disconnect()
    })
}

export { processJob, processTransferSend, processTransferComplete }
