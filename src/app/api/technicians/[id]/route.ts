import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { PERMISSIONS } from '@/lib/rbac'

// GET /api/technicians/[id] - Get single technician with stats
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
    const businessId = user.businessId

    if (!businessId) {
      return NextResponse.json({ error: 'No business associated with user' }, { status: 400 })
    }

    // Check permission
    if (!user.permissions?.includes(PERMISSIONS.TECHNICIAN_VIEW)) {
      return NextResponse.json({ error: 'Forbidden - Insufficient permissions' }, { status: 403 })
    }

    const technicianId = parseInt(params.id)

    const technician = await prisma.serviceTechnician.findFirst({
      where: {
        id: technicianId,
        businessId: parseInt(businessId)
      },
      include: {
        employee: true,
        warrantyClaimsAssigned: {
          where: { deletedAt: null },
          orderBy: { claimDate: 'desc' },
          take: 10,
          include: {
            customer: {
              select: {
                id: true,
                name: true,
                mobile: true
              }
            },
            product: {
              select: {
                id: true,
                name: true,
                sku: true
              }
            }
          }
        },
        jobOrdersAssigned: {
          orderBy: { jobOrderDate: 'desc' },
          take: 10,
          include: {
            customer: {
              select: {
                id: true,
                name: true,
                mobile: true
              }
            },
            product: {
              select: {
                id: true,
                name: true,
                sku: true
              }
            },
            serviceType: {
              select: {
                id: true,
                name: true,
                code: true
              }
            }
          }
        }
      }
    })

    if (!technician) {
      return NextResponse.json({ error: 'Technician not found' }, { status: 404 })
    }

    // Calculate additional stats
    const activeJobsCount = await prisma.repairJobOrder.count({
      where: {
        technicianId: technicianId,
        status: {
          in: ['pending', 'in_progress', 'awaiting_parts', 'on_hold']
        }
      }
    })

    // Serialize Decimal fields
    const serializedTechnician = {
      ...technician,
      averageRepairTime: technician.averageRepairTime ? Number(technician.averageRepairTime) : null,
      customerSatisfaction: technician.customerSatisfaction ? Number(technician.customerSatisfaction) : null,
      onTimeCompletionRate: technician.onTimeCompletionRate ? Number(technician.onTimeCompletionRate) : null,
      firstTimeFixRate: technician.firstTimeFixRate ? Number(technician.firstTimeFixRate) : null,
      activeJobsCount,
      warrantyClaimsAssigned: technician.warrantyClaimsAssigned.map(claim => ({
        ...claim,
        laborCost: claim.laborCost ? Number(claim.laborCost) : null,
        partsCost: claim.partsCost ? Number(claim.partsCost) : null,
        totalCost: claim.totalCost ? Number(claim.totalCost) : null
      })),
      jobOrdersAssigned: technician.jobOrdersAssigned.map(job => ({
        ...job,
        laborCost: Number(job.laborCost),
        partsCost: Number(job.partsCost),
        taxAmount: Number(job.taxAmount),
        totalCost: Number(job.totalCost),
        paidAmount: Number(job.paidAmount)
      }))
    }

    return NextResponse.json({ technician: serializedTechnician })
  } catch (error) {
    console.error('Error fetching technician:', error)
    return NextResponse.json({ error: 'Failed to fetch technician' }, { status: 500 })
  }
}

// PUT /api/technicians/[id] - Update technician
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
    const businessId = user.businessId

    if (!businessId) {
      return NextResponse.json({ error: 'No business associated with user' }, { status: 400 })
    }

    // Check permission
    if (!user.permissions?.includes(PERMISSIONS.TECHNICIAN_EDIT)) {
      return NextResponse.json({ error: 'Forbidden - Insufficient permissions' }, { status: 403 })
    }

    const technicianId = parseInt(params.id)
    const body = await request.json()

    // Verify technician belongs to user's business
    const existing = await prisma.serviceTechnician.findFirst({
      where: {
        id: technicianId,
        businessId: parseInt(businessId)
      },
      include: { employee: true }
    })

    if (!existing) {
      return NextResponse.json({ error: 'Technician not found' }, { status: 404 })
    }

    const {
      // Employee fields
      employeeCode,
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
      terminationDate,
      isActive,
      // Technician fields
      primarySpecialization,
      secondarySpecializations,
      maxConcurrentJobs,
      isAvailable
    } = body

    // Check employee code uniqueness if being changed
    if (employeeCode && employeeCode !== existing.employee.employeeCode) {
      const existingCode = await prisma.technicalServiceEmployee.findFirst({
        where: {
          businessId: parseInt(businessId),
          employeeCode,
          id: { not: existing.employeeId }
        }
      })

      if (existingCode) {
        return NextResponse.json({ error: 'Employee code already exists' }, { status: 400 })
      }
    }

    // Update employee and technician in transaction
    await prisma.$transaction(async (tx) => {
      // Update employee
      await tx.technicalServiceEmployee.update({
        where: { id: existing.employeeId },
        data: {
          ...(employeeCode !== undefined && { employeeCode }),
          ...(firstName !== undefined && { firstName }),
          ...(lastName !== undefined && { lastName }),
          ...(email !== undefined && { email }),
          ...(mobile !== undefined && { mobile }),
          ...(address !== undefined && { address }),
          ...(city !== undefined && { city }),
          ...(state !== undefined && { state }),
          ...(country !== undefined && { country }),
          ...(zipCode !== undefined && { zipCode }),
          ...(position !== undefined && { position }),
          ...(department !== undefined && { department }),
          ...(specialization !== undefined && { specialization }),
          ...(certifications !== undefined && { certifications }),
          ...(hireDate !== undefined && { hireDate: hireDate ? new Date(hireDate) : null }),
          ...(terminationDate !== undefined && { terminationDate: terminationDate ? new Date(terminationDate) : null }),
          ...(isActive !== undefined && { isActive }),
          updatedAt: new Date()
        }
      })

      // Update technician profile
      await tx.serviceTechnician.update({
        where: { id: technicianId },
        data: {
          ...(primarySpecialization !== undefined && { primarySpecialization }),
          ...(secondarySpecializations !== undefined && { secondarySpecializations }),
          ...(maxConcurrentJobs !== undefined && { maxConcurrentJobs: parseInt(maxConcurrentJobs) }),
          ...(isAvailable !== undefined && { isAvailable }),
          updatedAt: new Date()
        }
      })
    })

    // Fetch updated technician
    const updatedTechnician = await prisma.serviceTechnician.findUnique({
      where: { id: technicianId },
      include: { employee: true }
    })

    // Serialize Decimal fields
    const serializedTechnician = {
      ...updatedTechnician,
      averageRepairTime: updatedTechnician?.averageRepairTime ? Number(updatedTechnician.averageRepairTime) : null,
      customerSatisfaction: updatedTechnician?.customerSatisfaction ? Number(updatedTechnician.customerSatisfaction) : null,
      onTimeCompletionRate: updatedTechnician?.onTimeCompletionRate ? Number(updatedTechnician.onTimeCompletionRate) : null,
      firstTimeFixRate: updatedTechnician?.firstTimeFixRate ? Number(updatedTechnician.firstTimeFixRate) : null
    }

    return NextResponse.json({
      technician: serializedTechnician,
      message: 'Technician updated successfully'
    })
  } catch (error) {
    console.error('Error updating technician:', error)
    return NextResponse.json({ error: 'Failed to update technician' }, { status: 500 })
  }
}

// DELETE /api/technicians/[id] - Soft delete technician
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
    const businessId = user.businessId

    if (!businessId) {
      return NextResponse.json({ error: 'No business associated with user' }, { status: 400 })
    }

    // Check permission
    if (!user.permissions?.includes(PERMISSIONS.TECHNICIAN_DELETE)) {
      return NextResponse.json({ error: 'Forbidden - Insufficient permissions' }, { status: 403 })
    }

    const technicianId = parseInt(params.id)

    // Verify technician belongs to user's business
    const existing = await prisma.serviceTechnician.findFirst({
      where: {
        id: technicianId,
        businessId: parseInt(businessId)
      }
    })

    if (!existing) {
      return NextResponse.json({ error: 'Technician not found' }, { status: 404 })
    }

    // Check for active job orders
    const activeJobsCount = await prisma.repairJobOrder.count({
      where: {
        technicianId: technicianId,
        status: {
          in: ['pending', 'in_progress', 'awaiting_parts', 'on_hold']
        }
      }
    })

    if (activeJobsCount > 0) {
      return NextResponse.json({
        error: 'Cannot delete technician with active job orders. Complete or reassign active jobs first.'
      }, { status: 400 })
    }

    // Soft delete employee (which cascades to technician via schema)
    await prisma.technicalServiceEmployee.update({
      where: { id: existing.employeeId },
      data: {
        deletedAt: new Date()
      }
    })

    return NextResponse.json({ message: 'Technician deleted successfully' })
  } catch (error) {
    console.error('Error deleting technician:', error)
    return NextResponse.json({ error: 'Failed to delete technician' }, { status: 500 })
  }
}
