import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth.simple'
import { prisma } from '@/lib/prisma.simple'
import { PERMISSIONS, hasPermission } from '@/lib/rbac'

// GET /api/technicians - List all technicians
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = session.user as any
    const businessId = parseInt(user.businessId)
    if (!businessId || isNaN(businessId)) {
      return NextResponse.json({ error: 'No business associated with user' }, { status: 400 })
    }

    // Parse query parameters for filtering
    const { searchParams } = new URL(request.url)
    const availableOnly = searchParams.get('available') === 'true'
    const search = searchParams.get('search')?.trim() || ''
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = (page - 1) * limit

    // Build where clause - query TechnicalServiceEmployee directly
    const whereClause: any = {
      businessId,
      deletedAt: null,
      isActive: true
    }

    // Apply search filter
    if (search) {
      whereClause.OR = [
        { employeeCode: { contains: search, mode: 'insensitive' } },
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } }
      ]
    }

    // Query TechnicalServiceEmployee directly (simpler approach)
    const [technicians, total] = await Promise.all([
      prisma.technicalServiceEmployee.findMany({
        where: whereClause,
        include: {
          technicianProfile: true
        },
        orderBy: { firstName: 'asc' },
        skip: offset,
        take: limit
      }),
      prisma.technicalServiceEmployee.count({ where: whereClause })
    ])

    // Transform for frontend - flatten the structure
    const serializedTechnicians = technicians.map(emp => ({
      id: emp.id,
      businessId: emp.businessId,
      employeeCode: emp.employeeCode,
      firstName: emp.firstName,
      lastName: emp.lastName,
      email: emp.email,
      mobile: emp.mobile,
      position: emp.position,
      specialization: emp.specialization,
      isActive: emp.isActive,
      // ServiceTechnician fields (if exists)
      isAvailable: emp.technicianProfile?.isAvailable ?? true,
      currentJobCount: emp.technicianProfile?.currentJobCount ?? 0,
      maxConcurrentJobs: emp.technicianProfile?.maxConcurrentJobs ?? 5,
      primarySpecialization: emp.technicianProfile?.primarySpecialization || emp.specialization,
      totalJobsCompleted: emp.technicianProfile?.totalJobsCompleted ?? 0,
      averageRepairTime: emp.technicianProfile?.averageRepairTime ? Number(emp.technicianProfile.averageRepairTime) : null
    })).filter(tech => !availableOnly || tech.isAvailable)

    return NextResponse.json({
      technicians: serializedTechnicians,
      pagination: {
        total: availableOnly ? serializedTechnicians.length : total,
        page,
        limit,
        totalPages: Math.ceil((availableOnly ? serializedTechnicians.length : total) / limit)
      }
    })
  } catch (error) {
    console.error('Error fetching technicians:', error)
    return NextResponse.json({ error: 'Failed to fetch technicians' }, { status: 500 })
  }
}

// POST /api/technicians - Create new technician (employee + technician profile)
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = session.user as any
    const businessId = parseInt(user.businessId)
    if (!businessId || isNaN(businessId)) {
      return NextResponse.json({ error: 'No business associated with user' }, { status: 400 })
    }

    // Check permission (hasPermission includes Super Admin bypass)
    if (!hasPermission(user, PERMISSIONS.TECHNICIAN_CREATE)) {
      return NextResponse.json({ error: 'Forbidden - Insufficient permissions' }, { status: 403 })
    }

    const body = await request.json()
    const {
      // Employee fields
      employeeCode,
      userId,
      firstName,
      lastName,
      email,
      mobile,
      address,
      city,
      state,
      country,
      zipCode,
      position,
      department,
      specialization,
      certifications,
      hireDate,
      isActive,
      // Technician fields
      primarySpecialization,
      secondarySpecializations,
      maxConcurrentJobs
    } = body

    // Validation
    if (!employeeCode || !firstName || !lastName || !position || !primarySpecialization) {
      return NextResponse.json(
        { error: 'Missing required fields: employeeCode, firstName, lastName, position, primarySpecialization' },
        { status: 400 }
      )
    }

    // Check employee code uniqueness
    const existingEmployee = await prisma.technicalServiceEmployee.findFirst({
      where: {
        businessId,
        employeeCode
      }
    })

    if (existingEmployee) {
      return NextResponse.json({ error: 'Employee code already exists' }, { status: 400 })
    }

    // Check if userId is already linked to another technician
    if (userId) {
      const existingUserLink = await prisma.technicalServiceEmployee.findFirst({
        where: {
          businessId,
          userId: parseInt(userId),
          deletedAt: null
        }
      })

      if (existingUserLink) {
        return NextResponse.json({ error: 'User is already linked to another technician' }, { status: 400 })
      }
    }

    // Create employee and technician in transaction
    const result = await prisma.$transaction(async (tx) => {
      // Create employee
      const employee = await tx.technicalServiceEmployee.create({
        data: {
          businessId,
          employeeCode,
          userId: userId ? parseInt(userId) : null,
          firstName,
          lastName,
          email,
          mobile,
          address,
          city,
          state,
          country,
          zipCode,
          position,
          department: department || 'Technical Service',
          specialization,
          certifications,
          hireDate: hireDate ? new Date(hireDate) : null,
          isActive: isActive !== undefined ? isActive : true
        }
      })

      // Create technician profile
      const technician = await tx.serviceTechnician.create({
        data: {
          businessId,
          employeeId: employee.id,
          primarySpecialization,
          secondarySpecializations,
          maxConcurrentJobs: maxConcurrentJobs ? parseInt(maxConcurrentJobs) : 5,
          currentJobCount: 0,
          isAvailable: true
        }
      })

      return { employee, technician }
    }, { timeout: 60000 })

    // Fetch complete technician with employee
    const completeTechnician = await prisma.serviceTechnician.findUnique({
      where: { id: result.technician.id },
      include: { employee: true }
    })

    // Serialize Decimal fields
    const serializedTechnician = {
      ...completeTechnician,
      averageRepairTime: completeTechnician?.averageRepairTime ? Number(completeTechnician.averageRepairTime) : null,
      customerSatisfaction: completeTechnician?.customerSatisfaction ? Number(completeTechnician.customerSatisfaction) : null,
      onTimeCompletionRate: completeTechnician?.onTimeCompletionRate ? Number(completeTechnician.onTimeCompletionRate) : null,
      firstTimeFixRate: completeTechnician?.firstTimeFixRate ? Number(completeTechnician.firstTimeFixRate) : null
    }

    return NextResponse.json({
      technician: serializedTechnician,
      message: 'Technician created successfully'
    }, { status: 201 })
  } catch (error) {
    console.error('Error creating technician:', error)
    return NextResponse.json({ error: 'Failed to create technician' }, { status: 500 })
  }
}
