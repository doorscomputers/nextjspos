import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')

    const businessId = parseInt(session.user.businessId)

    const whereClause: any = {
      businessId,
      deletedAt: null,
      status: 'completed' // Only look at completed transfers
    }

    if (startDate || endDate) {
      whereClause.createdAt = {}
      if (startDate) whereClause.createdAt.gte = new Date(startDate)
      if (endDate) whereClause.createdAt.lte = new Date(endDate)
    }

    const completedTransfers = await prisma.stockTransfer.findMany({
      where: whereClause,
      select: {
        id: true,
        transferNumber: true,
        fromLocationId: true,
        toLocationId: true,
        createdAt: true,
        submittedAt: true,
        checkedAt: true,
        approvedAt: true,
        sentAt: true,
        arrivedAt: true,
        verifiedAt: true,
        completedAt: true,
      }
    })

    // Calculate turnaround times
    const performanceData = completedTransfers.map(transfer => {
      const created = new Date(transfer.createdAt)
      const completed = transfer.completedAt ? new Date(transfer.completedAt) : null

      let totalDays = 0
      let submissionTime = 0
      let approvalTime = 0
      let transitTime = 0
      let verificationTime = 0

      if (completed) {
        totalDays = Math.round((completed.getTime() - created.getTime()) / (1000 * 60 * 60 * 24))

        if (transfer.submittedAt) {
          submissionTime = Math.round((new Date(transfer.submittedAt).getTime() - created.getTime()) / (1000 * 60 * 60))
        }

        if (transfer.approvedAt && transfer.submittedAt) {
          approvalTime = Math.round((new Date(transfer.approvedAt).getTime() - new Date(transfer.submittedAt).getTime()) / (1000 * 60 * 60))
        }

        if (transfer.arrivedAt && transfer.sentAt) {
          transitTime = Math.round((new Date(transfer.arrivedAt).getTime() - new Date(transfer.sentAt).getTime()) / (1000 * 60 * 60))
        }

        if (transfer.verifiedAt && transfer.arrivedAt) {
          verificationTime = Math.round((new Date(transfer.verifiedAt).getTime() - new Date(transfer.arrivedAt).getTime()) / (1000 * 60 * 60))
        }
      }

      return {
        transferNumber: transfer.transferNumber,
        fromLocationId: transfer.fromLocationId,
        toLocationId: transfer.toLocationId,
        totalDays,
        submissionTimeHours: submissionTime,
        approvalTimeHours: approvalTime,
        transitTimeHours: transitTime,
        verificationTimeHours: verificationTime
      }
    })

    // Calculate averages
    const totalCompleted = performanceData.length
    const avgTotalDays = totalCompleted > 0
      ? performanceData.reduce((sum, t) => sum + t.totalDays, 0) / totalCompleted
      : 0

    const avgSubmissionTime = totalCompleted > 0
      ? performanceData.reduce((sum, t) => sum + t.submissionTimeHours, 0) / totalCompleted
      : 0

    const avgApprovalTime = totalCompleted > 0
      ? performanceData.reduce((sum, t) => sum + t.approvalTimeHours, 0) / totalCompleted
      : 0

    const avgTransitTime = totalCompleted > 0
      ? performanceData.reduce((sum, t) => sum + t.transitTimeHours, 0) / totalCompleted
      : 0

    const avgVerificationTime = totalCompleted > 0
      ? performanceData.reduce((sum, t) => sum + t.verificationTimeHours, 0) / totalCompleted
      : 0

    // Fetch location names
    const locationIds = new Set<number>()
    performanceData.forEach(t => {
      locationIds.add(t.fromLocationId)
      locationIds.add(t.toLocationId)
    })

    const locations = await prisma.businessLocation.findMany({
      where: {
        id: { in: Array.from(locationIds) },
        businessId
      },
      select: { id: true, name: true }
    })

    const locationMap = new Map(locations.map(l => [l.id, l.name]))

    // Add location names to performance data
    const enrichedPerformanceData = performanceData.map(t => ({
      ...t,
      fromLocation: locationMap.get(t.fromLocationId) || `Location ${t.fromLocationId}`,
      toLocation: locationMap.get(t.toLocationId) || `Location ${t.toLocationId}`
    }))

    return NextResponse.json({
      totalCompletedTransfers: totalCompleted,
      averages: {
        totalDays: avgTotalDays.toFixed(2),
        submissionTimeHours: avgSubmissionTime.toFixed(2),
        approvalTimeHours: avgApprovalTime.toFixed(2),
        transitTimeHours: avgTransitTime.toFixed(2),
        verificationTimeHours: avgVerificationTime.toFixed(2)
      },
      transfers: enrichedPerformanceData
    })
  } catch (error) {
    console.error('Transfer performance report error:', error)
    return NextResponse.json(
      {
        error: 'Failed to generate transfer performance report',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
