import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth.simple'
import { prisma } from '@/lib/prisma.simple'
import { PERMISSIONS, hasPermission } from '@/lib/rbac'

// GET /api/sales-personnel/[id] - Get single sales personnel
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
    const businessId = parseInt(user.businessId)
    if (!businessId || isNaN(businessId)) {
      return NextResponse.json({ error: 'No business associated with user' }, { status: 400 })
    }

    // Check permission
    if (!hasPermission(user, PERMISSIONS.SALES_PERSONNEL_VIEW)) {
      return NextResponse.json({ error: 'Forbidden - Insufficient permissions' }, { status: 403 })
    }

    const { id } = await params
    const salesPersonnelId = parseInt(id)

    if (isNaN(salesPersonnelId)) {
      return NextResponse.json({ error: 'Invalid sales personnel ID' }, { status: 400 })
    }

    const salesPerson = await prisma.salesPersonnel.findFirst({
      where: {
        id: salesPersonnelId,
        businessId,
        deletedAt: null
      },
      include: {
        _count: {
          select: { sales: true }
        }
      }
    })

    if (!salesPerson) {
      return NextResponse.json({ error: 'Sales personnel not found' }, { status: 404 })
    }

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
      updatedAt: salesPerson.updatedAt,
      salesCount: salesPerson._count.sales
    }

    return NextResponse.json({ salesPersonnel: serializedPerson })
  } catch (error) {
    console.error('Error fetching sales personnel:', error)
    return NextResponse.json({ error: 'Failed to fetch sales personnel' }, { status: 500 })
  }
}

// PUT /api/sales-personnel/[id] - Update sales personnel
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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
    if (!hasPermission(user, PERMISSIONS.SALES_PERSONNEL_UPDATE)) {
      return NextResponse.json({ error: 'Forbidden - Insufficient permissions' }, { status: 403 })
    }

    const { id } = await params
    const salesPersonnelId = parseInt(id)

    if (isNaN(salesPersonnelId)) {
      return NextResponse.json({ error: 'Invalid sales personnel ID' }, { status: 400 })
    }

    // Check if exists
    const existingPerson = await prisma.salesPersonnel.findFirst({
      where: {
        id: salesPersonnelId,
        businessId,
        deletedAt: null
      }
    })

    if (!existingPerson) {
      return NextResponse.json({ error: 'Sales personnel not found' }, { status: 404 })
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
      terminationDate,
      isActive
    } = body

    // Validation
    if (!employeeCode || !firstName || !lastName) {
      return NextResponse.json(
        { error: 'Missing required fields: employeeCode, firstName, lastName' },
        { status: 400 }
      )
    }

    // Check employee code uniqueness (excluding current record)
    const existingByCode = await prisma.salesPersonnel.findFirst({
      where: {
        businessId,
        employeeCode,
        deletedAt: null,
        NOT: { id: salesPersonnelId }
      }
    })

    if (existingByCode) {
      return NextResponse.json({ error: 'Employee code already exists' }, { status: 400 })
    }

    // Check name uniqueness (excluding current record)
    const existingByName = await prisma.salesPersonnel.findFirst({
      where: {
        businessId,
        firstName,
        lastName,
        deletedAt: null,
        NOT: { id: salesPersonnelId }
      }
    })

    if (existingByName) {
      return NextResponse.json(
        { error: `Sales personnel with name "${firstName} ${lastName}" already exists` },
        { status: 400 }
      )
    }

    // Update sales personnel
    const updatedPerson = await prisma.salesPersonnel.update({
      where: { id: salesPersonnelId },
      data: {
        employeeCode,
        firstName,
        lastName,
        email: email || null,
        mobile: mobile || null,
        salesTarget: salesTarget !== undefined ? parseFloat(salesTarget) : undefined,
        commissionRate: commissionRate !== undefined ? parseFloat(commissionRate) : undefined,
        hireDate: hireDate ? new Date(hireDate) : null,
        terminationDate: terminationDate ? new Date(terminationDate) : null,
        isActive: isActive !== undefined ? isActive : undefined
      }
    })

    // Serialize Decimal fields
    const serializedPerson = {
      id: updatedPerson.id,
      businessId: updatedPerson.businessId,
      employeeCode: updatedPerson.employeeCode,
      firstName: updatedPerson.firstName,
      lastName: updatedPerson.lastName,
      fullName: `${updatedPerson.firstName} ${updatedPerson.lastName}`,
      email: updatedPerson.email,
      mobile: updatedPerson.mobile,
      salesTarget: updatedPerson.salesTarget ? Number(updatedPerson.salesTarget) : 0,
      commissionRate: updatedPerson.commissionRate ? Number(updatedPerson.commissionRate) : 0,
      totalSalesCount: updatedPerson.totalSalesCount,
      totalRevenue: updatedPerson.totalRevenue ? Number(updatedPerson.totalRevenue) : 0,
      isActive: updatedPerson.isActive,
      hireDate: updatedPerson.hireDate,
      terminationDate: updatedPerson.terminationDate,
      createdAt: updatedPerson.createdAt,
      updatedAt: updatedPerson.updatedAt
    }

    return NextResponse.json({
      salesPersonnel: serializedPerson,
      message: 'Sales personnel updated successfully'
    })
  } catch (error: any) {
    console.error('Error updating sales personnel:', error)

    // Handle unique constraint violation
    if (error.code === 'P2002') {
      return NextResponse.json(
        { error: 'A sales personnel with this employee code or name already exists' },
        { status: 400 }
      )
    }

    return NextResponse.json({ error: 'Failed to update sales personnel' }, { status: 500 })
  }
}

// DELETE /api/sales-personnel/[id] - Soft delete sales personnel
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
    const businessId = parseInt(user.businessId)
    if (!businessId || isNaN(businessId)) {
      return NextResponse.json({ error: 'No business associated with user' }, { status: 400 })
    }

    // Check permission
    if (!hasPermission(user, PERMISSIONS.SALES_PERSONNEL_DELETE)) {
      return NextResponse.json({ error: 'Forbidden - Insufficient permissions' }, { status: 403 })
    }

    const { id } = await params
    const salesPersonnelId = parseInt(id)

    if (isNaN(salesPersonnelId)) {
      return NextResponse.json({ error: 'Invalid sales personnel ID' }, { status: 400 })
    }

    // Check if exists
    const existingPerson = await prisma.salesPersonnel.findFirst({
      where: {
        id: salesPersonnelId,
        businessId,
        deletedAt: null
      }
    })

    if (!existingPerson) {
      return NextResponse.json({ error: 'Sales personnel not found' }, { status: 404 })
    }

    // Check if there are any sales linked to this personnel
    const salesCount = await prisma.sale.count({
      where: {
        salesPersonnelId,
        deletedAt: null
      }
    })

    if (salesCount > 0) {
      return NextResponse.json(
        { error: `Cannot delete sales personnel with ${salesCount} linked sales. Consider deactivating instead.` },
        { status: 400 }
      )
    }

    // Soft delete
    await prisma.salesPersonnel.update({
      where: { id: salesPersonnelId },
      data: {
        deletedAt: new Date(),
        isActive: false
      }
    })

    return NextResponse.json({ message: 'Sales personnel deleted successfully' })
  } catch (error) {
    console.error('Error deleting sales personnel:', error)
    return NextResponse.json({ error: 'Failed to delete sales personnel' }, { status: 500 })
  }
}
