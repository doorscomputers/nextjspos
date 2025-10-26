import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { PERMISSIONS } from '@/lib/rbac'

// GET /api/technicians/available - Get available technicians for assignment
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = session.user as any
    const businessId = user.businessId

    if (!businessId) {
      return NextResponse.json({ error: 'No business associated with user' }, { status: 400 })
    }

    // Check permission
    if (!user.permissions?.includes(PERMISSIONS.TECHNICIAN_VIEW) &&
        !user.permissions?.includes(PERMISSIONS.TECHNICIAN_ASSIGN)) {
      return NextResponse.json({ error: 'Forbidden - Insufficient permissions' }, { status: 403 })
    }

    // Parse query parameters
    const { searchParams } = new URL(request.url)
    const specialization = searchParams.get('specialization')

    // Build where clause
    const whereClause: any = {
      businessId: parseInt(businessId),
      isAvailable: true,
      employee: {
        isActive: true,
        deletedAt: null
      }
    }

    // Filter by specialization if provided
    if (specialization) {
      whereClause.OR = [
        { primarySpecialization: { contains: specialization, mode: 'insensitive' } },
        { secondarySpecializations: { contains: specialization, mode: 'insensitive' } }
      ]
    }

    const technicians = await prisma.serviceTechnician.findMany({
      where: whereClause,
      include: {
        employee: {
          select: {
            id: true,
            employeeCode: true,
            firstName: true,
            lastName: true,
            email: true,
            mobile: true,
            position: true,
            specialization: true
          }
        }
      },
      orderBy: [
        { currentJobCount: 'asc' }, // Prioritize technicians with fewer jobs
        { totalJobsCompleted: 'desc' } // Then by experience
      ]
    })

    // Calculate workload percentage and serialize
    const serializedTechnicians = technicians.map(tech => {
      const workloadPercentage = tech.maxConcurrentJobs > 0
        ? (tech.currentJobCount / tech.maxConcurrentJobs) * 100
        : 0

      return {
        ...tech,
        workloadPercentage: Math.round(workloadPercentage),
        canAcceptJobs: tech.currentJobCount < tech.maxConcurrentJobs,
        averageRepairTime: tech.averageRepairTime ? Number(tech.averageRepairTime) : null,
        customerSatisfaction: tech.customerSatisfaction ? Number(tech.customerSatisfaction) : null,
        onTimeCompletionRate: tech.onTimeCompletionRate ? Number(tech.onTimeCompletionRate) : null,
        firstTimeFixRate: tech.firstTimeFixRate ? Number(tech.firstTimeFixRate) : null
      }
    })

    return NextResponse.json({ technicians: serializedTechnicians })
  } catch (error) {
    console.error('Error fetching available technicians:', error)
    return NextResponse.json({ error: 'Failed to fetch available technicians' }, { status: 500 })
  }
}
