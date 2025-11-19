import { PrismaClient } from '@prisma/client'
import { processJob } from '../src/lib/job-processor'

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

/**
 * NOTE: The actual job processing logic is in src/lib/job-processor.ts
 * This script is just a CLI runner for local development
 * Production uses Vercel Cron which calls /api/cron/process-jobs
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
