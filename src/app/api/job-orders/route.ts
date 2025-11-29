import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth.simple'
import { prisma } from '@/lib/prisma.simple'
import { PERMISSIONS } from '@/lib/rbac'

// Helper function to generate job order number
async function generateJobOrderNumber(businessId: number, tx: any) {
  const year = new Date().getFullYear()
  const prefix = `JO-${year}-`

  // Get the last job order number for this year
  const lastJobOrder = await tx.repairJobOrder.findFirst({
    where: {
      businessId,
      jobOrderNumber: {
        startsWith: prefix
      }
    },
    orderBy: {
      jobOrderNumber: 'desc'
    }
  })

  let nextNumber = 1
  if (lastJobOrder) {
    const lastNumber = parseInt(lastJobOrder.jobOrderNumber.split('-')[2])
    nextNumber = lastNumber + 1
  }

  return `${prefix}${String(nextNumber).padStart(4, '0')}`
}

// GET /api/job-orders - List all job orders
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
    if (!user.permissions?.includes(PERMISSIONS.JOB_ORDER_VIEW)) {
      return NextResponse.json({ error: 'Forbidden - Insufficient permissions' }, { status: 403 })
    }

    // Parse query parameters for filtering
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const technicianId = searchParams.get('technicianId')
    const customerId = searchParams.get('customerId')
    const locationId = searchParams.get('locationId') ? parseInt(searchParams.get('locationId')!) : null
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const search = searchParams.get('search')?.trim() || ''
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = (page - 1) * limit

    // Build where clause
    const whereClause: any = {
      businessId: parseInt(businessId)
    }

    // Apply filters
    if (status) {
      whereClause.status = status
    }

    if (technicianId) {
      whereClause.technicianId = parseInt(technicianId)
    }

    if (customerId) {
      whereClause.customerId = parseInt(customerId)
    }

    if (locationId) {
      whereClause.locationId = parseInt(locationId)
    }

    if (startDate || endDate) {
      whereClause.jobOrderDate = {}
      if (startDate) whereClause.jobOrderDate.gte = new Date(startDate)
      if (endDate) whereClause.jobOrderDate.lte = new Date(endDate)
    }

    if (search) {
      whereClause.OR = [
        { jobOrderNumber: { contains: search, mode: 'insensitive' } },
        { customerName: { contains: search, mode: 'insensitive' } },
        { customerPhone: { contains: search, mode: 'insensitive' } },
        { serialNumber: { contains: search, mode: 'insensitive' } },
        { issueDescription: { contains: search, mode: 'insensitive' } }
      ]
    }

    const [jobOrders, total] = await Promise.all([
      prisma.repairJobOrder.findMany({
        where: whereClause,
        include: {
          customer: {
            select: {
              id: true,
              name: true,
              mobile: true,
              email: true
            }
          },
          product: {
            select: {
              id: true,
              name: true,
              sku: true
            }
          },
          productVariation: {
            select: {
              id: true,
              name: true,
              sku: true
            }
          },
          serviceType: true,
          technician: {
            include: {
              employee: {
                select: {
                  firstName: true,
                  lastName: true,
                  employeeCode: true
                }
              }
            }
          },
          location: {
            select: {
              id: true,
              name: true
            }
          },
          warrantyClaim: {
            select: {
              id: true,
              claimNumber: true
            }
          },
          parts: {
            include: {
              product: {
                select: {
                  name: true,
                  sku: true
                }
              },
              productVariation: {
                select: {
                  name: true,
                  sku: true
                }
              }
            }
          }
        },
        orderBy: { jobOrderDate: 'desc' },
        skip: offset,
        take: limit
      }),
      prisma.repairJobOrder.count({ where: whereClause })
    ])

    // Serialize Decimal fields
    const serializedJobOrders = jobOrders.map(job => ({
      ...job,
      laborCost: Number(job.laborCost),
      partsCost: Number(job.partsCost),
      taxAmount: Number(job.taxAmount),
      totalCost: Number(job.totalCost),
      paidAmount: Number(job.paidAmount),
      parts: job.parts.map(part => ({
        ...part,
        quantity: Number(part.quantity),
        unitPrice: Number(part.unitPrice),
        subtotal: Number(part.subtotal)
      }))
    }))

    return NextResponse.json({
      jobOrders: serializedJobOrders,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      }
    })
  } catch (error) {
    console.error('Error fetching job orders:', error)
    return NextResponse.json({ error: 'Failed to fetch job orders' }, { status: 500 })
  }
}

// POST /api/job-orders - Create new job order
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = session.user as any
    const businessId = parseInt(String(user.businessId))
    const userId = user.id

    if (!businessId) {
      return NextResponse.json({ error: 'No business associated with user' }, { status: 400 })
    }

    // Check permission
    if (!user.permissions?.includes(PERMISSIONS.JOB_ORDER_CREATE)) {
      return NextResponse.json({ error: 'Forbidden - Insufficient permissions' }, { status: 403 })
    }

    const body = await request.json()
    const {
      locationId,
      jobOrderDate,
      warrantyClaimId,
      serviceTypeId,
      productId,
      productVariationId,
      serialNumber,
      customerId,
      customerName,
      customerPhone,
      customerEmail,
      technicianId,
      issueDescription,
      priority,
      expectedCompletionDate,
      laborCost,
      taxRate
    } = body

    // Validation
    if (!locationId || !jobOrderDate || !serviceTypeId || !productId || !productVariationId || !customerName || !issueDescription) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // Verify location belongs to business
    const location = await prisma.businessLocation.findFirst({
      where: {
        id: parseInt(locationId),
        businessId: parseInt(businessId),
        deletedAt: null
      }
    })

    if (!location) {
      return NextResponse.json({ error: 'Location not found' }, { status: 404 })
    }

    // Verify service type
    const serviceType = await prisma.repairServiceType.findFirst({
      where: {
        id: parseInt(serviceTypeId),
        businessId: parseInt(businessId),
        isActive: true
      }
    })

    if (!serviceType) {
      return NextResponse.json({ error: 'Service type not found or inactive' }, { status: 404 })
    }

    // Verify product and variation
    const product = await prisma.product.findFirst({
      where: {
        id: parseInt(productId),
        businessId: parseInt(businessId),
        deletedAt: null
      }
    })

    if (!product) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 })
    }

    const variation = await prisma.productVariation.findFirst({
      where: {
        id: parseInt(productVariationId),
        productId: parseInt(productId),
        deletedAt: null
      }
    })

    if (!variation) {
      return NextResponse.json({ error: 'Product variation not found' }, { status: 404 })
    }

    // Verify technician if provided
    if (technicianId) {
      const technician = await prisma.serviceTechnician.findFirst({
        where: {
          id: parseInt(technicianId),
          businessId: parseInt(businessId),
          isAvailable: true
        }
      })

      if (!technician) {
        return NextResponse.json({ error: 'Technician not found or not available' }, { status: 404 })
      }

      if (technician.currentJobCount >= technician.maxConcurrentJobs) {
        return NextResponse.json({
          error: 'Technician has reached maximum concurrent jobs'
        }, { status: 400 })
      }
    }

    // Calculate costs
    const labor = laborCost ? parseFloat(laborCost) : Number(serviceType.standardPrice)
    const parts = 0 // Will be updated when parts are added
    const tax = taxRate ? (labor * parseFloat(taxRate) / 100) : 0
    const total = labor + parts + tax

    // Create job order in transaction
    const jobOrder = await prisma.$transaction(async (tx) => {
      // Generate job order number
      const jobOrderNumber = await generateJobOrderNumber(parseInt(businessId), tx)

      // Create job order
      const newJobOrder = await tx.repairJobOrder.create({
        data: {
          businessId: parseInt(businessId),
          locationId: parseInt(locationId),
          jobOrderNumber,
          jobOrderDate: new Date(jobOrderDate),
          warrantyClaimId: warrantyClaimId ? parseInt(warrantyClaimId) : null,
          serviceTypeId: parseInt(serviceTypeId),
          productId: parseInt(productId),
          productVariationId: parseInt(productVariationId),
          serialNumber,
          customerId: customerId ? parseInt(customerId) : null,
          customerName,
          customerPhone,
          customerEmail,
          technicianId: technicianId ? parseInt(technicianId) : null,
          issueDescription,
          priority: priority || 'medium',
          status: 'pending',
          expectedCompletionDate: expectedCompletionDate ? new Date(expectedCompletionDate) : null,
          laborCost: labor,
          partsCost: parts,
          taxAmount: tax,
          taxRate: taxRate ? parseFloat(taxRate) : 0,
          totalCost: total,
          paidAmount: 0,
          paymentStatus: 'unpaid',
          createdBy: parseInt(userId)
        }
      }, {
      timeout: 60000, // 60 seconds timeout for network resilience
    })

      // If technician assigned, increment their job count
      if (technicianId) {
        await tx.serviceTechnician.update({
          where: { id: parseInt(technicianId) },
          data: {
            currentJobCount: {
              increment: 1
            }
          }
        })
      }

      // If warranty claim, update status
      if (warrantyClaimId) {
        await tx.serviceWarrantyClaim.update({
          where: { id: parseInt(warrantyClaimId) },
          data: {
            status: 'job_order_created'
          }
        })
      }

      return newJobOrder
    })

    // Fetch complete job order with relations
    const completeJobOrder = await prisma.repairJobOrder.findUnique({
      where: { id: jobOrder.id },
      include: {
        customer: true,
        product: true,
        productVariation: true,
        serviceType: true,
        technician: {
          include: {
            employee: true
          }
        },
        location: true,
        warrantyClaim: true
      }
    })

    // Serialize Decimal fields
    const serializedJobOrder = {
      ...completeJobOrder,
      laborCost: completeJobOrder ? Number(completeJobOrder.laborCost) : 0,
      partsCost: completeJobOrder ? Number(completeJobOrder.partsCost) : 0,
      taxAmount: completeJobOrder ? Number(completeJobOrder.taxAmount) : 0,
      totalCost: completeJobOrder ? Number(completeJobOrder.totalCost) : 0,
      paidAmount: completeJobOrder ? Number(completeJobOrder.paidAmount) : 0
    }

    return NextResponse.json({
      jobOrder: serializedJobOrder,
      message: 'Job order created successfully'
    }, { status: 201 })
  } catch (error) {
    console.error('Error creating job order:', error)
    return NextResponse.json({ error: 'Failed to create job order' }, { status: 500 })
  }
}
