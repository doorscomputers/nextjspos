import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth.simple'
import { prisma } from '@/lib/prisma.simple'
import { PERMISSIONS, hasPermission } from '@/lib/rbac'

// GET /api/sales-personnel - List all sales personnel
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

    // Check permission
    if (!hasPermission(user, PERMISSIONS.SALES_PERSONNEL_VIEW)) {
      return NextResponse.json({ error: 'Forbidden - Insufficient permissions' }, { status: 403 })
    }

    // Parse query parameters for filtering
    const { searchParams } = new URL(request.url)
    const activeOnly = searchParams.get('activeOnly') === 'true'
    const search = searchParams.get('search')?.trim() || ''
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = (page - 1) * limit

    // Build where clause
    const whereClause: any = {
      businessId,
      deletedAt: null
    }

    // Filter by active status
    if (activeOnly) {
      whereClause.isActive = true
    }

    // Apply search filter
    if (search) {
      whereClause.OR = [
        { employeeCode: { contains: search, mode: 'insensitive' } },
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { mobile: { contains: search, mode: 'insensitive' } }
      ]
    }

    // Query sales personnel
    const [salesPersonnel, total] = await Promise.all([
      prisma.salesPersonnel.findMany({
        where: whereClause,
        orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }],
        skip: offset,
        take: limit
      }),
      prisma.salesPersonnel.count({ where: whereClause })
    ])

    // Serialize Decimal fields
    const serializedPersonnel = salesPersonnel.map(person => ({
      id: person.id,
      businessId: person.businessId,
      employeeCode: person.employeeCode,
      firstName: person.firstName,
      lastName: person.lastName,
      fullName: `${person.firstName} ${person.lastName}`,
      email: person.email,
      mobile: person.mobile,
      salesTarget: person.salesTarget ? Number(person.salesTarget) : 0,
      commissionRate: person.commissionRate ? Number(person.commissionRate) : 0,
      totalSalesCount: person.totalSalesCount,
      totalRevenue: person.totalRevenue ? Number(person.totalRevenue) : 0,
      isActive: person.isActive,
      hireDate: person.hireDate,
      terminationDate: person.terminationDate,
      createdAt: person.createdAt,
      updatedAt: person.updatedAt
    }))

    return NextResponse.json({
      salesPersonnel: serializedPersonnel,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      }
    })
  } catch (error) {
    console.error('Error fetching sales personnel:', error)
    return NextResponse.json({ error: 'Failed to fetch sales personnel' }, { status: 500 })
  }
}

// POST /api/sales-personnel - Create new sales personnel
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

    // Check permission
    if (!hasPermission(user, PERMISSIONS.SALES_PERSONNEL_CREATE)) {
      return NextResponse.json({ error: 'Forbidden - Insufficient permissions' }, { status: 403 })
    }

    const body = await request.json()
    const {
      employeeCode,
      firstName,
      lastName,
      email,
      mobile,
      salesTarget,
      commissionRate,
      hireDate,
      isActive
    } = body

    // Validation
    if (!employeeCode || !firstName || !lastName) {
      return NextResponse.json(
        { error: 'Missing required fields: employeeCode, firstName, lastName' },
        { status: 400 }
      )
    }

    // Check employee code uniqueness
    const existingByCode = await prisma.salesPersonnel.findFirst({
      where: {
        businessId,
        employeeCode,
        deletedAt: null
      }
    })

    if (existingByCode) {
      return NextResponse.json({ error: 'Employee code already exists' }, { status: 400 })
    }

    // Check name uniqueness (firstName + lastName)
    const existingByName = await prisma.salesPersonnel.findFirst({
      where: {
        businessId,
        firstName,
        lastName,
        deletedAt: null
      }
    })

    if (existingByName) {
      return NextResponse.json(
        { error: `Sales personnel with name "${firstName} ${lastName}" already exists` },
        { status: 400 }
      )
    }

    // Create sales personnel
    const salesPerson = await prisma.salesPersonnel.create({
      data: {
        businessId,
        employeeCode,
        firstName,
        lastName,
        email: email || null,
        mobile: mobile || null,
        salesTarget: salesTarget ? parseFloat(salesTarget) : 0,
        commissionRate: commissionRate ? parseFloat(commissionRate) : 0,
        hireDate: hireDate ? new Date(hireDate) : null,
        isActive: isActive !== undefined ? isActive : true
      }
    })

    // Serialize Decimal fields
    const serializedPerson = {
      id: salesPerson.id,
      businessId: salesPerson.businessId,
      employeeCode: salesPerson.employeeCode,
      firstName: salesPerson.firstName,
      lastName: salesPerson.lastName,
      fullName: `${salesPerson.firstName} ${salesPerson.lastName}`,
      email: salesPerson.email,
      mobile: salesPerson.mobile,
      salesTarget: salesPerson.salesTarget ? Number(salesPerson.salesTarget) : 0,
      commissionRate: salesPerson.commissionRate ? Number(salesPerson.commissionRate) : 0,
      totalSalesCount: salesPerson.totalSalesCount,
      totalRevenue: salesPerson.totalRevenue ? Number(salesPerson.totalRevenue) : 0,
      isActive: salesPerson.isActive,
      hireDate: salesPerson.hireDate,
      terminationDate: salesPerson.terminationDate,
      createdAt: salesPerson.createdAt,
      updatedAt: salesPerson.updatedAt
    }

    return NextResponse.json({
      salesPersonnel: serializedPerson,
      message: 'Sales personnel created successfully'
    }, { status: 201 })
  } catch (error: any) {
    console.error('Error creating sales personnel:', error)

    // Handle unique constraint violation
    if (error.code === 'P2002') {
      return NextResponse.json(
        { error: 'A sales personnel with this employee code or name already exists' },
        { status: 400 }
      )
    }

    return NextResponse.json({ error: 'Failed to create sales personnel' }, { status: 500 })
  }
}
