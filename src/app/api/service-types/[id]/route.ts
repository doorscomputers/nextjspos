import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth.simple'
import { prisma } from '@/lib/prisma.simple'
import { PERMISSIONS } from '@/lib/rbac'

// GET /api/service-types/[id] - Get single service type
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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
    if (!user.permissions?.includes(PERMISSIONS.SERVICE_TYPE_VIEW)) {
      return NextResponse.json({ error: 'Forbidden - Insufficient permissions' }, { status: 403 })
    }

    const serviceTypeId = parseInt(params.id)

    const serviceType = await prisma.repairServiceType.findFirst({
      where: {
        id: serviceTypeId,
        businessId: parseInt(businessId)
      }
    })

    if (!serviceType) {
      return NextResponse.json({ error: 'Service type not found' }, { status: 404 })
    }

    // Serialize Decimal fields
    const serializedServiceType = {
      ...serviceType,
      standardPrice: Number(serviceType.standardPrice),
      laborCostPerHour: Number(serviceType.laborCostPerHour),
      estimatedHours: Number(serviceType.estimatedHours)
    }

    return NextResponse.json({ serviceType: serializedServiceType })
  } catch (error) {
    console.error('Error fetching service type:', error)
    return NextResponse.json({ error: 'Failed to fetch service type' }, { status: 500 })
  }
}

// PUT /api/service-types/[id] - Update service type
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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
    if (!user.permissions?.includes(PERMISSIONS.SERVICE_TYPE_EDIT)) {
      return NextResponse.json({ error: 'Forbidden - Insufficient permissions' }, { status: 403 })
    }

    const serviceTypeId = parseInt(params.id)
    const body = await request.json()

    // Verify service type belongs to user's business
    const existing = await prisma.repairServiceType.findFirst({
      where: {
        id: serviceTypeId,
        businessId: parseInt(businessId)
      }
    })

    if (!existing) {
      return NextResponse.json({ error: 'Service type not found' }, { status: 404 })
    }

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

    // Check code uniqueness if being changed
    if (code && code !== existing.code) {
      const existingCode = await prisma.repairServiceType.findFirst({
        where: {
          businessId: parseInt(businessId),
          code,
          id: { not: serviceTypeId }
        }
      })

      if (existingCode) {
        return NextResponse.json({ error: 'Service type code already exists' }, { status: 400 })
      }
    }

    // Update service type
    const serviceType = await prisma.repairServiceType.update({
      where: { id: serviceTypeId },
      data: {
        ...(code !== undefined && { code }),
        ...(name !== undefined && { name }),
        ...(description !== undefined && { description }),
        ...(category !== undefined && { category }),
        ...(standardPrice !== undefined && { standardPrice: parseFloat(standardPrice) }),
        ...(laborCostPerHour !== undefined && { laborCostPerHour: parseFloat(laborCostPerHour) }),
        ...(estimatedHours !== undefined && { estimatedHours: parseFloat(estimatedHours) }),
        ...(warrantyPeriodDays !== undefined && { warrantyPeriodDays: parseInt(warrantyPeriodDays) }),
        ...(isCoveredByWarranty !== undefined && { isCoveredByWarranty }),
        ...(isActive !== undefined && { isActive }),
        updatedAt: new Date()
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
      message: 'Service type updated successfully'
    })
  } catch (error) {
    console.error('Error updating service type:', error)
    return NextResponse.json({ error: 'Failed to update service type' }, { status: 500 })
  }
}

// DELETE /api/service-types/[id] - Delete service type
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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
    if (!user.permissions?.includes(PERMISSIONS.SERVICE_TYPE_DELETE)) {
      return NextResponse.json({ error: 'Forbidden - Insufficient permissions' }, { status: 403 })
    }

    const serviceTypeId = parseInt(params.id)

    // Verify service type belongs to user's business
    const existing = await prisma.repairServiceType.findFirst({
      where: {
        id: serviceTypeId,
        businessId: parseInt(businessId)
      }
    })

    if (!existing) {
      return NextResponse.json({ error: 'Service type not found' }, { status: 404 })
    }

    // Check if service type is used in any job orders
    const jobOrdersCount = await prisma.repairJobOrder.count({
      where: { serviceTypeId }
    })

    if (jobOrdersCount > 0) {
      return NextResponse.json({
        error: 'Cannot delete service type that is used in job orders. Set it as inactive instead.'
      }, { status: 400 })
    }

    // Delete service type
    await prisma.repairServiceType.delete({
      where: { id: serviceTypeId }
    })

    return NextResponse.json({ message: 'Service type deleted successfully' })
  } catch (error) {
    console.error('Error deleting service type:', error)
    return NextResponse.json({ error: 'Failed to delete service type' }, { status: 500 })
  }
}
