import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth.simple'
import { prisma } from '@/lib/prisma.simple'
import { PERMISSIONS } from '@/lib/rbac'

// GET /api/technicians - List all technicians
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = session.user as any
    const businessId = parseInt(String(user.businessId))
    if (!businessId) {
      return NextResponse.json({ error: 'No business associated with user' }, { status: 400 })
    }

    // Check permission
    if (!user.permissions?.includes(PERMISSIONS.TECHNICIAN_VIEW)) {
      return NextResponse.json({ error: 'Forbidden - Insufficient permissions' }, { status: 403 })
    }

    // Parse query parameters for filtering
    const { searchParams } = new URL(request.url)
    const activeFilter = searchParams.get('active')
    const availableOnly = searchParams.get('available') === 'true'
    const specialization = searchParams.get('specialization')
    const search = searchParams.get('search')?.trim() || ''
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = (page - 1) * limit

    // Build where clause for employees
    const employeeWhere: any = {
      businessId: parseInt(businessId),
      deletedAt: null
    }

    // Apply active filter
    if (activeFilter !== null) {
      employeeWhere.isActive = activeFilter === 'true'
    }

    // Apply search filter
    if (search) {
      employeeWhere.OR = [
        { employeeCode: { contains: search, mode: 'insensitive' } },
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { mobile: { contains: search, mode: 'insensitive' } }
      ]
    }

    // Build where clause for technicians
    const technicianWhere: any = {
      businessId: parseInt(businessId)
    }

    if (availableOnly) {
      technicianWhere.isAvailable = true
    }

    if (specialization) {
      technicianWhere.primarySpecialization = { contains: specialization, mode: 'insensitive' }
    }

    const [technicians, total] = await Promise.all([
      prisma.serviceTechnician.findMany({
        where: {
          ...technicianWhere,
          employee: employeeWhere
        },
        include: {
          employee: true
        },
        orderBy: { createdAt: 'desc' },
        skip: offset,
        take: limit
      }),
      prisma.serviceTechnician.count({
        where: {
          ...technicianWhere,
          employee: employeeWhere
        }
      })
    ])

    // Serialize Decimal fields
    const serializedTechnicians = technicians.map(tech => ({
      ...tech,
      averageRepairTime: tech.averageRepairTime ? Number(tech.averageRepairTime) : null,
      customerSatisfaction: tech.customerSatisfaction ? Number(tech.customerSatisfaction) : null,
      onTimeCompletionRate: tech.onTimeCompletionRate ? Number(tech.onTimeCompletionRate) : null,
      firstTimeFixRate: tech.firstTimeFixRate ? Number(tech.firstTimeFixRate) : null
    }))

    return NextResponse.json({
      technicians: serializedTechnicians,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
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
    const businessId = parseInt(String(user.businessId))
    if (!businessId) {
      return NextResponse.json({ error: 'No business associated with user' }, { status: 400 })
    }

    // Check permission
    if (!user.permissions?.includes(PERMISSIONS.TECHNICIAN_CREATE)) {
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
        businessId: parseInt(businessId),
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
          businessId: parseInt(businessId),
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
          businessId: parseInt(businessId),
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
      }, {
      timeout: 60000, // 60 seconds timeout for network resilience
    })

      // Create technician profile
      const technician = await tx.serviceTechnician.create({
        data: {
          businessId: parseInt(businessId),
          employeeId: employee.id,
          primarySpecialization,
          secondarySpecializations,
          maxConcurrentJobs: maxConcurrentJobs ? parseInt(maxConcurrentJobs) : 5,
          currentJobCount: 0,
          isAvailable: true
        }
      })

      return { employee, technician }
    })

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
