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

    // Fetch all stats in parallel
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
      }),

      // Active job orders
      prisma.jobOrder.count({
        where: {
          businessId,
          status: { in: ['pending', 'in_progress', 'waiting_parts'] },
        },
      }),

      // Available technicians
      prisma.technicalServiceEmployee.count({
        where: {
          businessId,
          isActive: true,
        },
      }),

      // Today's completions
      prisma.jobOrder.count({
        where: {
          businessId,
          status: 'completed',
          completedAt: {
            gte: startOfDay,
            lte: endOfDay,
          },
        },
      }),

      // Today's payments
      prisma.servicePayment.aggregate({
        where: {
          businessId,
          paymentDate: {
            gte: startOfDay,
            lte: endOfDay,
          },
          status: 'completed',
        },
        _sum: { amount: true },
      }),

      // Week payments
      prisma.servicePayment.aggregate({
        where: {
          businessId,
          paymentDate: {
            gte: startOfWeek,
          },
          status: 'completed',
        },
        _sum: { amount: true },
      }),

      // Month payments
      prisma.servicePayment.aggregate({
        where: {
          businessId,
          paymentDate: {
            gte: startOfMonth,
          },
          status: 'completed',
        },
        _sum: { amount: true },
      }),

      // Claims by status
      prisma.warrantyClaim.groupBy({
        by: ['status'],
        where: { businessId },
        _count: { status: true },
      }),

      // Jobs by technician
      prisma.jobOrder.groupBy({
        by: ['technicianId'],
        where: {
          businessId,
          technicianId: { not: null },
        },
        _count: { id: true },
      }),

      // Recent activity (last 10 items)
      prisma.jobOrder.findMany({
        where: { businessId },
        orderBy: { createdAt: 'desc' },
        take: 10,
        select: {
          id: true,
          jobOrderNumber: true,
          status: true,
          createdAt: true,
          customer: {
            select: { name: true },
          },
        },
      }),
    ])

    // Get technician names for jobs by technician
    const technicianIds = jobsByTechnician
      .filter(j => j.technicianId !== null)
      .map(j => j.technicianId as number)

    const technicians = technicianIds.length > 0
      ? await prisma.technicalServiceEmployee.findMany({
          where: { id: { in: technicianIds } },
          select: { id: true, firstName: true, lastName: true },
        })
      : []

    const technicianMap = new Map(technicians.map(t => [t.id, `${t.firstName} ${t.lastName}`]))

    // Calculate average repair time (in hours)
    const completedJobs = await prisma.jobOrder.findMany({
      where: {
        businessId,
        status: 'completed',
        completedAt: { not: null },
      },
      select: {
        createdAt: true,
        completedAt: true,
      },
      take: 100,
      orderBy: { completedAt: 'desc' },
    })

    let avgRepairTime = 0
    if (completedJobs.length > 0) {
      const totalHours = completedJobs.reduce((acc, job) => {
        if (job.completedAt) {
          const diff = job.completedAt.getTime() - job.createdAt.getTime()
          return acc + (diff / (1000 * 60 * 60)) // Convert to hours
        }
        return acc
      }, 0)
      avgRepairTime = totalHours / completedJobs.length
    }

    // Format response
    const stats = {
      pendingClaims,
      activeJobs,
      availableTechnicians,
      todayCompletions,
      todayRevenue: Number(todayPayments._sum.amount || 0),
      weekRevenue: Number(weekPayments._sum.amount || 0),
      monthRevenue: Number(monthPayments._sum.amount || 0),
      avgRepairTime,
    }

    const formattedClaimsByStatus = claimsByStatus.map(c => ({
      status: c.status.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
      count: c._count.status,
    }))

    const formattedJobsByTechnician = jobsByTechnician
      .filter(j => j.technicianId !== null)
      .map(j => ({
        technician: technicianMap.get(j.technicianId as number) || 'Unknown',
        completed: j._count.id,
        inProgress: 0, // Would need separate query for accurate data
      }))

    const formattedRecentActivity = recentActivity.map(activity => ({
      id: activity.id,
      type: 'job',
      description: `Job Order ${activity.jobOrderNumber} - ${activity.customer?.name || 'Walk-in'}`,
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

      const dayRevenue = await prisma.servicePayment.aggregate({
        where: {
          businessId,
          paymentDate: {
            gte: dayStart,
            lte: dayEnd,
          },
          status: 'completed',
        },
        _sum: { amount: true },
      })

      revenueByDay.push({
        day: dayStart.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }),
        revenue: Number(dayRevenue._sum.amount || 0),
      })
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
