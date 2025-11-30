import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth.simple'
import { prisma } from '@/lib/prisma.simple'
import { hasPermission, PERMISSIONS } from '@/lib/rbac'

// GET /api/technical/dashboard
// Get technical service dashboard data
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = session.user as any
    const businessId = parseInt(user.businessId)

    // Check permission
    if (!hasPermission(user, PERMISSIONS.WARRANTY_CLAIM_VIEW) &&
        !hasPermission(user, PERMISSIONS.JOB_ORDER_VIEW)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Get current date boundaries
    const now = new Date()
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999)
    const startOfWeek = new Date(now)
    startOfWeek.setDate(now.getDate() - now.getDay())
    startOfWeek.setHours(0, 0, 0, 0)
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)

    // Fetch all stats in parallel - using correct model names
    const [
      pendingClaims,
      activeJobs,
      availableTechnicians,
      todayCompletions,
      todayPayments,
      weekPayments,
      monthPayments,
      claimsByStatus,
      jobsByTechnician,
      recentActivity
    ] = await Promise.all([
      // Pending warranty claims
      prisma.warrantyClaim.count({
        where: {
          businessId,
          status: { in: ['pending', 'under_review'] },
        },
      }).catch(() => 0),

      // Active job orders - using ServiceJobOrder model
      prisma.serviceJobOrder.count({
        where: {
          businessId,
          status: { in: ['pending', 'in_progress', 'waiting_parts'] },
        },
      }).catch(() => 0),

      // Available technicians
      prisma.technicalServiceEmployee.count({
        where: {
          businessId,
          isActive: true,
        },
      }).catch(() => 0),

      // Today's completions - using ServiceJobOrder model
      prisma.serviceJobOrder.count({
        where: {
          businessId,
          status: 'completed',
          actualCompletionDate: {
            gte: startOfDay,
            lte: endOfDay,
          },
        },
      }).catch(() => 0),

      // Today's payments - using ServiceRepairPayment model
      prisma.serviceRepairPayment.aggregate({
        where: {
          businessId,
          paymentDate: {
            gte: startOfDay,
            lte: endOfDay,
          },
        },
        _sum: { amount: true },
      }).catch(() => ({ _sum: { amount: null } })),

      // Week payments
      prisma.serviceRepairPayment.aggregate({
        where: {
          businessId,
          paymentDate: {
            gte: startOfWeek,
          },
        },
        _sum: { amount: true },
      }).catch(() => ({ _sum: { amount: null } })),

      // Month payments
      prisma.serviceRepairPayment.aggregate({
        where: {
          businessId,
          paymentDate: {
            gte: startOfMonth,
          },
        },
        _sum: { amount: true },
      }).catch(() => ({ _sum: { amount: null } })),

      // Claims by status
      prisma.warrantyClaim.groupBy({
        by: ['status'],
        where: { businessId },
        _count: { status: true },
      }).catch(() => []),

      // Jobs by technician - using ServiceJobOrder model
      prisma.serviceJobOrder.groupBy({
        by: ['technicianId'],
        where: {
          businessId,
          technicianId: { not: null },
        },
        _count: { id: true },
      }).catch(() => []),

      // Recent activity (last 10 items) - using ServiceJobOrder model
      prisma.serviceJobOrder.findMany({
        where: { businessId },
        orderBy: { createdAt: 'desc' },
        take: 10,
        select: {
          id: true,
          jobOrderNumber: true,
          status: true,
          createdAt: true,
          customerName: true,
        },
      }).catch(() => []),
    ])

    // Get technician names for jobs by technician
    const technicianIds = (jobsByTechnician as any[])
      .filter(j => j.technicianId !== null)
      .map(j => j.technicianId as number)

    let technicianMap = new Map<number, string>()
    if (technicianIds.length > 0) {
      const technicians = await prisma.user.findMany({
        where: { id: { in: technicianIds } },
        select: { id: true, firstName: true, lastName: true, username: true },
      }).catch(() => [])

      technicianMap = new Map(technicians.map(t => [
        t.id,
        t.firstName && t.lastName ? `${t.firstName} ${t.lastName}` : t.username
      ]))
    }

    // Calculate average repair time (in hours)
    let avgRepairTime = 0
    try {
      const completedJobs = await prisma.serviceJobOrder.findMany({
        where: {
          businessId,
          status: 'completed',
          actualCompletionDate: { not: null },
        },
        select: {
          createdAt: true,
          actualCompletionDate: true,
        },
        take: 100,
        orderBy: { actualCompletionDate: 'desc' },
      })

      if (completedJobs.length > 0) {
        const totalHours = completedJobs.reduce((acc, job) => {
          if (job.actualCompletionDate) {
            const diff = job.actualCompletionDate.getTime() - job.createdAt.getTime()
            return acc + (diff / (1000 * 60 * 60)) // Convert to hours
          }
          return acc
        }, 0)
        avgRepairTime = totalHours / completedJobs.length
      }
    } catch (e) {
      console.error('Error calculating avg repair time:', e)
    }

    // Format response
    const stats = {
      pendingClaims: pendingClaims || 0,
      activeJobs: activeJobs || 0,
      availableTechnicians: availableTechnicians || 0,
      todayCompletions: todayCompletions || 0,
      todayRevenue: Number(todayPayments?._sum?.amount || 0),
      weekRevenue: Number(weekPayments?._sum?.amount || 0),
      monthRevenue: Number(monthPayments?._sum?.amount || 0),
      avgRepairTime,
    }

    const formattedClaimsByStatus = (claimsByStatus as any[]).map(c => ({
      status: c.status.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase()),
      count: c._count.status,
    }))

    const formattedJobsByTechnician = (jobsByTechnician as any[])
      .filter(j => j.technicianId !== null)
      .map(j => ({
        technician: technicianMap.get(j.technicianId as number) || 'Unknown',
        completed: j._count.id,
        inProgress: 0,
      }))

    const formattedRecentActivity = (recentActivity as any[]).map(activity => ({
      id: activity.id,
      type: 'job',
      description: `Job Order ${activity.jobOrderNumber} - ${activity.customerName || 'Walk-in'}`,
      time: new Date(activity.createdAt).toLocaleString(),
      status: activity.status,
    }))

    // Get last 7 days revenue
    const revenueByDay = []
    for (let i = 6; i >= 0; i--) {
      const date = new Date()
      date.setDate(date.getDate() - i)
      const dayStart = new Date(date.getFullYear(), date.getMonth(), date.getDate())
      const dayEnd = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999)

      try {
        const dayRevenue = await prisma.serviceRepairPayment.aggregate({
          where: {
            businessId,
            paymentDate: {
              gte: dayStart,
              lte: dayEnd,
            },
          },
          _sum: { amount: true },
        })

        revenueByDay.push({
          day: dayStart.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }),
          revenue: Number(dayRevenue._sum.amount || 0),
        })
      } catch (e) {
        revenueByDay.push({
          day: dayStart.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }),
          revenue: 0,
        })
      }
    }

    return NextResponse.json({
      success: true,
      stats,
      claimsByStatus: formattedClaimsByStatus,
      jobsByTechnician: formattedJobsByTechnician,
      revenueByDay,
      recentActivity: formattedRecentActivity,
    })

  } catch (error) {
    console.error('Error fetching technical dashboard:', error)
    return NextResponse.json(
      { error: 'Failed to fetch dashboard data' },
      { status: 500 }
    )
  }
}
