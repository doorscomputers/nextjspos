import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth.simple'
import { prisma } from '@/lib/prisma.simple'
import { hasPermission, PERMISSIONS } from '@/lib/rbac'

// GET /api/reports/technician-labor-cost
// Get labor cost report grouped by technician for COMPLETED job orders only
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check permission
    if (!hasPermission(session.user, PERMISSIONS.TECHNICIAN_PERFORMANCE_VIEW)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const businessId = session.user.businessId
    const { searchParams } = new URL(req.url)

    // Date filters
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const technicianId = searchParams.get('technicianId')
    const locationId = searchParams.get('locationId')

    // Build where clause
    const where: any = {
      businessId,
      status: 'completed', // Only completed jobs count for labor cost
    }

    // Date range filter on completedDate (when the job was completed)
    if (startDate || endDate) {
      where.completedDate = {}
      if (startDate) {
        where.completedDate.gte = new Date(startDate)
      }
      if (endDate) {
        // Set to end of day
        const end = new Date(endDate)
        end.setHours(23, 59, 59, 999)
        where.completedDate.lte = end
      }
    }

    // Filter by technician
    if (technicianId) {
      where.technicianId = parseInt(technicianId)
    }

    // Filter by location
    if (locationId) {
      where.locationId = parseInt(locationId)
    }

    // Fetch completed job orders with technician info
    const jobOrders = await prisma.repairJobOrder.findMany({
      where,
      include: {
        technician: {
          select: {
            id: true,
            employeeCode: true,
            firstName: true,
            lastName: true,
            position: true,
            primarySpecialization: true,
          },
        },
        location: {
          select: {
            id: true,
            name: true,
          },
        },
        serviceType: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
      },
      orderBy: [
        { completedDate: 'desc' },
      ],
    })

    // Group by technician for summary
    const technicianSummary: Record<number, {
      technicianId: number
      employeeCode: string
      technicianName: string
      position: string
      specialization: string
      totalJobsCompleted: number
      totalLaborCost: number
      jobOrders: typeof jobOrders
    }> = {}

    let grandTotalLaborCost = 0
    let grandTotalJobs = 0

    for (const job of jobOrders) {
      const laborCost = job.laborCost ? Number(job.laborCost) : 0
      grandTotalLaborCost += laborCost
      grandTotalJobs++

      if (job.technician) {
        const techId = job.technician.id
        if (!technicianSummary[techId]) {
          technicianSummary[techId] = {
            technicianId: techId,
            employeeCode: job.technician.employeeCode,
            technicianName: `${job.technician.firstName} ${job.technician.lastName}`,
            position: job.technician.position || '',
            specialization: job.technician.primarySpecialization || '',
            totalJobsCompleted: 0,
            totalLaborCost: 0,
            jobOrders: [],
          }
        }
        technicianSummary[techId].totalJobsCompleted++
        technicianSummary[techId].totalLaborCost += laborCost
        technicianSummary[techId].jobOrders.push(job)
      }
    }

    // Convert to array and sort by total labor cost descending
    const summaryArray = Object.values(technicianSummary).sort(
      (a, b) => b.totalLaborCost - a.totalLaborCost
    )

    // Detailed data for DataGrid (flat list)
    const detailedData = jobOrders.map(job => ({
      id: job.id,
      jobOrderNumber: job.jobOrderNumber,
      completedDate: job.completedDate,
      technicianId: job.technician?.id || null,
      employeeCode: job.technician?.employeeCode || 'Unassigned',
      technicianName: job.technician
        ? `${job.technician.firstName} ${job.technician.lastName}`
        : 'Unassigned',
      position: job.technician?.position || '',
      specialization: job.technician?.primarySpecialization || '',
      locationId: job.location?.id,
      locationName: job.location?.name || '',
      serviceTypeName: job.serviceType?.name || '',
      customerName: job.customerName,
      laborCost: job.laborCost ? Number(job.laborCost) : 0,
      itemDescription: job.itemDescription,
    }))

    return NextResponse.json({
      success: true,
      summary: summaryArray,
      detailed: detailedData,
      totals: {
        grandTotalLaborCost,
        grandTotalJobs,
        techniciansCount: summaryArray.length,
      },
      filters: {
        startDate,
        endDate,
        technicianId,
        locationId,
      },
    })
  } catch (error) {
    console.error('Error generating technician labor cost report:', error)
    return NextResponse.json(
      { error: 'Failed to generate report' },
      { status: 500 }
    )
  }
}
