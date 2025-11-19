import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth.simple'
import { prisma } from '@/lib/prisma.simple'
import { PERMISSIONS } from '@/lib/rbac'

/**
 * Job Status API
 *
 * GET /api/jobs/[id] - Get job status and progress
 * DELETE /api/jobs/[id] - Cancel a pending job
 */

// GET /api/jobs/[id] - Get job status
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
    const businessId = parseInt(String(user.businessId))
    const userId = parseInt(String(user.id))

    const { id } = await params
    const jobId = parseInt(id)

    const job = await prisma.job.findFirst({
      where: {
        id: jobId,
        businessId,
      },
    })

    if (!job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 })
    }

    // Users can only view their own jobs (unless admin)
    if (
      job.userId !== userId &&
      !user.permissions?.includes(PERMISSIONS.VIEW_ALL_JOBS)
    ) {
      return NextResponse.json(
        { error: 'Forbidden - Cannot view other users\' jobs' },
        { status: 403 }
      )
    }

    // Calculate progress percentage
    const progressPercent = job.total > 0 ? Math.round((job.progress / job.total) * 100) : 0

    // Calculate duration
    let durationMs = 0
    if (job.startedAt) {
      const endTime = job.completedAt || new Date()
      durationMs = endTime.getTime() - job.startedAt.getTime()
    }

    return NextResponse.json({
      id: job.id,
      type: job.type,
      status: job.status,
      progress: job.progress,
      total: job.total,
      progressPercent,
      error: job.error,
      result: job.result,
      attempts: job.attempts,
      maxAttempts: job.maxAttempts,
      createdAt: job.createdAt,
      startedAt: job.startedAt,
      completedAt: job.completedAt,
      durationMs,
    })
  } catch (error: any) {
    console.error('Error fetching job status:', error)
    return NextResponse.json(
      { error: 'Failed to fetch job status', details: error.message },
      { status: 500 }
    )
  }
}

// DELETE /api/jobs/[id] - Cancel a pending job
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
    const businessId = parseInt(String(user.businessId))
    const userId = parseInt(String(user.id))

    const { id } = await params
    const jobId = parseInt(id)

    const job = await prisma.job.findFirst({
      where: {
        id: jobId,
        businessId,
      },
    })

    if (!job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 })
    }

    // Users can only cancel their own jobs (unless admin)
    if (
      job.userId !== userId &&
      !user.permissions?.includes(PERMISSIONS.VIEW_ALL_JOBS)
    ) {
      return NextResponse.json(
        { error: 'Forbidden - Cannot cancel other users\' jobs' },
        { status: 403 }
      )
    }

    // Can only cancel pending jobs
    if (job.status !== 'pending') {
      return NextResponse.json(
        { error: `Cannot cancel job with status: ${job.status}` },
        { status: 400 }
      )
    }

    // Update job status to cancelled
    const updatedJob = await prisma.job.update({
      where: { id: jobId },
      data: {
        status: 'cancelled',
        completedAt: new Date(),
        error: 'Cancelled by user',
      },
    })

    return NextResponse.json({
      message: 'Job cancelled successfully',
      job: {
        id: updatedJob.id,
        status: updatedJob.status,
      },
    })
  } catch (error: any) {
    console.error('Error cancelling job:', error)
    return NextResponse.json(
      { error: 'Failed to cancel job', details: error.message },
      { status: 500 }
    )
  }
}
