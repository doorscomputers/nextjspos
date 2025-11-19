import { NextRequest, NextResponse } from 'next/server'
import { processJob } from '@/scripts/job-worker'
import { prisma } from '@/lib/prisma.simple'

/**
 * Vercel Cron Job Handler - Process Background Jobs
 *
 * This endpoint is called by Vercel Cron every minute to process pending jobs
 * See vercel.json for cron configuration
 *
 * Security: Vercel Cron includes x-vercel-cron-id header for verification
 */

export async function GET(request: NextRequest) {
  try {
    // Verify this is a genuine Vercel Cron request
    const cronId = request.headers.get('x-vercel-cron-id')

    if (!cronId && process.env.NODE_ENV === 'production') {
      return NextResponse.json(
        { error: 'Unauthorized - Not a Vercel Cron request' },
        { status: 401 }
      )
    }

    const startTime = Date.now()

    console.log('[Cron] Starting job processing...')

    // Pick up pending jobs (oldest first)
    const jobs = await prisma.job.findMany({
      where: {
        status: 'pending',
        // Only process jobs that are ready (either no retry scheduled or retry time passed)
        OR: [{ nextRetryAt: null }, { nextRetryAt: { lte: new Date() } }],
      },
      orderBy: { createdAt: 'asc' },
      take: 5, // Process up to 5 jobs per cron run
    })

    if (jobs.length === 0) {
      console.log('[Cron] No pending jobs')
      return NextResponse.json({
        message: 'No pending jobs',
        processed: 0,
        duration: Date.now() - startTime,
      })
    }

    console.log(`[Cron] Found ${jobs.length} pending jobs`)

    // Process jobs concurrently
    const results = await Promise.allSettled(jobs.map((job) => processJob(job)))

    // Count successes and failures
    const succeeded = results.filter((r) => r.status === 'fulfilled').length
    const failed = results.filter((r) => r.status === 'rejected').length

    const duration = Date.now() - startTime

    console.log(
      `[Cron] Completed: ${succeeded} succeeded, ${failed} failed (${duration}ms)`
    )

    return NextResponse.json({
      message: 'Job processing complete',
      processed: jobs.length,
      succeeded,
      failed,
      duration,
    })
  } catch (error: any) {
    console.error('[Cron] Error processing jobs:', error)
    return NextResponse.json(
      {
        error: 'Failed to process jobs',
        details: error.message,
      },
      { status: 500 }
    )
  }
}

// Also support POST for manual triggering during development
export async function POST(request: NextRequest) {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json(
      { error: 'POST method only available in development' },
      { status: 403 }
    )
  }

  return GET(request)
}
