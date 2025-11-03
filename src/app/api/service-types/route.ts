import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth.simple'
import { prisma } from '@/lib/prisma'
import { PERMISSIONS } from '@/lib/rbac'

// GET /api/service-types - List all service types
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
    if (!user.permissions?.includes(PERMISSIONS.SERVICE_TYPE_VIEW)) {
      return NextResponse.json({ error: 'Forbidden - Insufficient permissions' }, { status: 403 })
    }

    // Parse query parameters for filtering
    const { searchParams } = new URL(request.url)
    const activeFilter = searchParams.get('active')
    const category = searchParams.get('category')
    const search = searchParams.get('search')?.trim() || ''
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = (page - 1) * limit

    // Build where clause
    const whereClause: any = {
      businessId: parseInt(businessId),
    }

    // Apply active filter
    if (activeFilter !== null) {
      whereClause.isActive = activeFilter === 'true'
    }

    // Apply category filter
    if (category) {
      whereClause.category = { contains: category, mode: 'insensitive' }
    }

    // Apply search filter
    if (search) {
      whereClause.OR = [
        { code: { contains: search, mode: 'insensitive' } },
        { name: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } }
      ]
    }

    const [serviceTypes, total] = await Promise.all([
      prisma.repairServiceType.findMany({
        where: whereClause,
        orderBy: { createdAt: 'desc' },
        skip: offset,
        take: limit
      }),
      prisma.repairServiceType.count({ where: whereClause })
    ])

    // Serialize Decimal fields to numbers for JSON
    const serializedServiceTypes = serviceTypes.map(serviceType => ({
      ...serviceType,
      standardPrice: Number(serviceType.standardPrice),
      laborCostPerHour: Number(serviceType.laborCostPerHour),
      estimatedHours: Number(serviceType.estimatedHours)
    }))

    return NextResponse.json({
      serviceTypes: serializedServiceTypes,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      }
    })
  } catch (error) {
    console.error('Error fetching service types:', error)
    return NextResponse.json({ error: 'Failed to fetch service types' }, { status: 500 })
  }
}

// POST /api/service-types - Create new service type
export async function POST(request: NextRequest) {
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
    if (!user.permissions?.includes(PERMISSIONS.SERVICE_TYPE_CREATE)) {
      return NextResponse.json({ error: 'Forbidden - Insufficient permissions' }, { status: 403 })
    }

    const body = await request.json()
    const {
      code,
      name,
      description,
      category,
      standardPrice,
      laborCostPerHour,
      estimatedHours,
      warrantyPeriodDays,
      isCoveredByWarranty,
      isActive
    } = body

    // Validation
    if (!code || !name || !category) {
      return NextResponse.json(
        { error: 'Missing required fields: code, name, category' },
        { status: 400 }
      )
    }

    // Check code uniqueness
    const existingServiceType = await prisma.repairServiceType.findFirst({
      where: {
        businessId: parseInt(businessId),
        code
      }
    })

    if (existingServiceType) {
      return NextResponse.json({ error: 'Service type code already exists' }, { status: 400 })
    }

    // Create service type
    const serviceType = await prisma.repairServiceType.create({
      data: {
        businessId: parseInt(businessId),
        code,
        name,
        description,
        category,
        standardPrice: standardPrice ? parseFloat(standardPrice) : 0,
        laborCostPerHour: laborCostPerHour ? parseFloat(laborCostPerHour) : 0,
        estimatedHours: estimatedHours ? parseFloat(estimatedHours) : 1,
        warrantyPeriodDays: warrantyPeriodDays ? parseInt(warrantyPeriodDays) : 30,
        isCoveredByWarranty: isCoveredByWarranty || false,
        isActive: isActive !== undefined ? isActive : true
      }
    })

    // Serialize Decimal fields
    const serializedServiceType = {
      ...serviceType,
      standardPrice: Number(serviceType.standardPrice),
      laborCostPerHour: Number(serviceType.laborCostPerHour),
      estimatedHours: Number(serviceType.estimatedHours)
    }

    return NextResponse.json({
      serviceType: serializedServiceType,
      message: 'Service type created successfully'
    }, { status: 201 })
  } catch (error) {
    console.error('Error creating service type:', error)
    return NextResponse.json({ error: 'Failed to create service type' }, { status: 500 })
  }
}
