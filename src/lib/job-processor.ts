import { PrismaClient } from '@prisma/client'
import { transferStockOut, addStock, bulkUpdateStock, StockTransactionType } from '@/lib/stockOperations'

/**
 * Job Processing Logic
 *
 * Separated from CLI script for use in API routes
 */

const prisma = new PrismaClient()

// Sleep utility
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

// Process a single job
export async function processJob(job: any) {
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
  const BATCH_SIZE = 30 // Increased from 10 to reduce transaction overhead
  let processedCount = 0

  for (let i = 0; i < transfer.items.length; i += BATCH_SIZE) {
    const batch = transfer.items.slice(i, i + BATCH_SIZE)

    await prisma.$transaction(
      async (tx) => {
        // BULK OPTIMIZATION: Process all items in batch with single function call
        // Prepare bulk update parameters
        const bulkItems = batch.map((item) => ({
          businessId: job.businessId,
          productId: item.productId,
          productVariationId: item.productVariationId,
          locationId: transfer.fromLocationId,
          quantity: -Math.abs(parseFloat(item.quantity.toString())), // Negative for stock out
          type: StockTransactionType.TRANSFER_OUT,
          referenceType: 'transfer' as const,
          referenceId: transferId,
          userId: job.userId,
          notes: notes || `Transfer ${transfer.transferNumber} sent`,
          userDisplayName,
          allowNegative: true, // Allow negative for async transfers (stock may have changed since creation)
          tx,
        }))

        // Call bulk function - processes all items in single server call
        const results = await bulkUpdateStock(bulkItems)

        // Check for failures
        const failures = results.filter((r) => !r.success)
        if (failures.length > 0) {
          const firstFailure = failures[0]
          console.error(
            `[Job ${job.id}] Bulk transfer send failed:`,
            firstFailure.error
          )
          throw new Error(`Bulk update failed: ${firstFailure.error}`)
        }

        processedCount += batch.length

        // Update job progress once per batch
        await tx.job.update({
          where: { id: job.id },
          data: { progress: processedCount },
        })
      },
      {
        timeout: 180000, // 180s per batch (6s per item for 30 items)
        maxWait: 20000, // Increased wait time for lock acquisition
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
  const BATCH_SIZE = 30 // Increased from 10 to reduce transaction overhead
  let processedCount = 0

  for (let i = 0; i < transfer.items.length; i += BATCH_SIZE) {
    const batch = transfer.items.slice(i, i + BATCH_SIZE)

    await prisma.$transaction(
      async (tx) => {
        // BULK OPTIMIZATION STEP 1: Auto-verify all unverified items in this batch (single query)
        const batchItemIds = batch.map(item => item.id)
        const unverifiedInBatch = batch.filter(item => !item.verified)

        if (unverifiedInBatch.length > 0) {
          console.log(`[Job ${job.id}] Auto-verifying ${unverifiedInBatch.length} items in batch`)

          await tx.stockTransferItem.updateMany({
            where: {
              id: { in: unverifiedInBatch.map(item => item.id) },
              verified: false, // Only update unverified items
            },
            data: {
              verified: true,
              verifiedBy: job.userId,
              verifiedAt: new Date(),
            },
          })

          // BULK OPTIMIZATION 3: Update receivedQuantity in batch (saves ~4 seconds for 11 items)
          const itemsNeedingReceivedQty = unverifiedInBatch.filter(
            item => !item.receivedQuantity || item.receivedQuantity.toString() === '0'
          )

          if (itemsNeedingReceivedQty.length > 0) {
            // Update all items where receivedQuantity needs to be set to quantity
            // Note: Prisma doesn't support CASE WHEN in updateMany, so we batch by quantity
            const quantityGroups = new Map<string, number[]>()

            for (const item of itemsNeedingReceivedQty) {
              const qtyKey = item.quantity.toString()
              if (!quantityGroups.has(qtyKey)) {
                quantityGroups.set(qtyKey, [])
              }
              quantityGroups.get(qtyKey)!.push(item.id)
            }

            // Execute one updateMany per unique quantity value
            for (const [quantity, itemIds] of quantityGroups) {
              await tx.stockTransferItem.updateMany({
                where: { id: { in: itemIds } },
                data: { receivedQuantity: parseFloat(quantity) },
              })
            }
          }
        }

        // BULK OPTIMIZATION STEP 2: Process all inventory additions in single function call
        // Prepare bulk update parameters
        const bulkItems = batch.map((item) => {
          // CRITICAL FIX: Properly handle NULL vs 0 vs missing receivedQuantity
          const receivedQtyValue = item.receivedQuantity != null
            ? parseFloat(item.receivedQuantity.toString())
            : null

          const receivedQty = (receivedQtyValue != null && receivedQtyValue > 0)
            ? receivedQtyValue
            : parseFloat(item.quantity.toString())

          console.log(`[Job Processor Transfer] Item ${item.id}: receivedQuantity=${item.receivedQuantity}, calculated receivedQty=${receivedQty}, original quantity=${item.quantity}`)

          return {
            businessId: job.businessId,
            productId: item.productId,
            productVariationId: item.productVariationId,
            locationId: transfer.toLocationId,
            quantity: receivedQty, // Positive for stock in
            type: StockTransactionType.TRANSFER_IN,
            referenceType: 'stock_transfer' as const,
            referenceId: transferId,
            referenceNumber: transfer.transferNumber,
            userId: job.userId,
            notes: `Transfer ${transfer.transferNumber} received`,
            userDisplayName,
            tx,
          }
        })

        // Call bulk function - processes all items in single server call
        const results = await bulkUpdateStock(bulkItems)

        // Check for failures
        const failures = results.filter((r) => !r.success)
        if (failures.length > 0) {
          const firstFailure = failures[0]
          console.error(
            `[Job ${job.id}] Bulk transfer receive failed:`,
            firstFailure.error
          )
          throw new Error(`Bulk update failed: ${firstFailure.error}`)
        }

        processedCount += batch.length

        // Update job progress once per batch
        await tx.job.update({
          where: { id: job.id },
          data: { progress: processedCount },
        })
      },
      {
        timeout: 180000, // 180s per batch (6s per item for 30 items)
        maxWait: 20000, // Increased wait time for lock acquisition
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
  throw new Error('Sale creation not yet implemented in job worker')
}

async function processPurchaseApprove(job: any) {
  // TODO: Implement purchase approval in background
  throw new Error('Purchase approval not yet implemented in job worker')
}

export { processTransferSend, processTransferComplete }
