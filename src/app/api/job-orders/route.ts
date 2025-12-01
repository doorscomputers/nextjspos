import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth.simple'
import { prisma } from '@/lib/prisma.simple'
import { PERMISSIONS, hasPermission } from '@/lib/rbac'

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

    // Check permission (hasPermission includes Super Admin bypass)
    if (!hasPermission(user, PERMISSIONS.JOB_ORDER_VIEW)) {
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
      businessId
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
        { itemDescription: { contains: search, mode: 'insensitive' } },
        { customerName: { contains: search, mode: 'insensitive' } },
        { customerPhone: { contains: search, mode: 'insensitive' } },
        { serialNumber: { contains: search, mode: 'insensitive' } },
        { problemDescription: { contains: search, mode: 'insensitive' } }
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
            select: {
              id: true,
              firstName: true,
              lastName: true,
              employeeCode: true
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
          jobOrderParts: {
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

    // Serialize and transform for frontend
    const serializedJobOrders = jobOrders.map(job => {
      const totalCost = Number(job.totalCost)
      const paidAmount = Number(job.paidAmount)

      // Calculate payment status
      let paymentStatus = 'pending'
      if (paidAmount >= totalCost && totalCost > 0) {
        paymentStatus = 'paid'
      } else if (paidAmount > 0) {
        paymentStatus = 'partial'
      }

      return {
        ...job,
        // Map field names for frontend compatibility
        jobNumber: job.jobOrderNumber,
        jobDate: job.jobOrderDate,
        itemDescription: job.itemDescription, // Customer's item description
        receivedDate: job.receivedDate, // When item was received
        productName: job.product?.name || null, // Optional product link
        serviceTypeName: job.serviceType?.name || 'N/A',
        technicianName: job.technician
          ? `${job.technician.firstName || ''} ${job.technician.lastName || ''}`.trim() || 'Unassigned'
          : null,
        paymentStatus,
        // Serialize Decimal fields
        laborCost: Number(job.laborCost),
        partsCost: Number(job.partsCost),
        taxAmount: Number(job.tax),
        totalCost,
        paidAmount,
        parts: job.jobOrderParts.map(part => ({
          ...part,
          partName: part.product?.name || part.productVariation?.name || 'Unknown Part',
          quantity: Number(part.quantity),
          unitPrice: Number(part.unitPrice),
          subtotal: Number(part.subtotal)
        })),
        payments: [] // Will be populated in detail view
      }
    })

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

    // Check permission (hasPermission includes Super Admin bypass)
    if (!hasPermission(user, PERMISSIONS.JOB_ORDER_CREATE)) {
      return NextResponse.json({ error: 'Forbidden - Insufficient permissions' }, { status: 403 })
    }

    const body = await request.json()
    const {
      locationId,
      warrantyClaimId,
      serviceTypeId,
      itemDescription,
      receivedDate,
      productId,
      productVariationId,
      serialNumber,
      customerId,
      customerName,
      customerPhone,
      customerEmail,
      technicianId,
      problemDescription,
      priority,
      estimatedEndDate,
      laborCost
    } = body

    // Validation - itemDescription is now required, product fields are optional
    if (!locationId || !serviceTypeId || !itemDescription || !customerName || !problemDescription) {
      return NextResponse.json(
        { error: 'Missing required fields: locationId, serviceTypeId, itemDescription, customerName, problemDescription' },
        { status: 400 }
      )
    }

    // Verify location belongs to business
    const location = await prisma.businessLocation.findFirst({
      where: {
        id: parseInt(locationId),
        businessId,
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
        businessId,
        isActive: true
      }
    })

    if (!serviceType) {
      return NextResponse.json({ error: 'Service type not found or inactive' }, { status: 404 })
    }

    // Verify product and variation (optional - only if provided)
    let validProductId: number | null = null
    let validVariationId: number | null = null

    if (productId) {
      const product = await prisma.product.findFirst({
        where: {
          id: parseInt(productId),
          businessId,
          deletedAt: null
        }
      })

      if (!product) {
        return NextResponse.json({ error: 'Product not found' }, { status: 404 })
      }
      validProductId = product.id

      // Variation is only required if product is provided
      if (productVariationId) {
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
        validVariationId = variation.id
      }
    }

    // Verify technician if provided
    if (technicianId) {
      const technician = await prisma.serviceTechnician.findFirst({
        where: {
          id: parseInt(technicianId),
          businessId,
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
    const taxAmount = 0 // Tax will be calculated based on business settings
    const total = labor + parts + taxAmount

    // Create job order in transaction
    const jobOrder = await prisma.$transaction(async (tx) => {
      // Generate job order number
      const jobOrderNumber = await generateJobOrderNumber(businessId, tx)

      // Create job order - jobOrderDate is now auto-set to server time
      const newJobOrder = await tx.repairJobOrder.create({
        data: {
          businessId,
          locationId: parseInt(locationId),
          jobOrderNumber,
          jobOrderDate: new Date(), // Auto-set to current server time
          itemDescription, // Required: describes the customer's item
          receivedDate: receivedDate ? new Date(receivedDate) : null, // Optional: when item was received
          warrantyClaimId: warrantyClaimId ? parseInt(warrantyClaimId) : null,
          serviceTypeId: parseInt(serviceTypeId),
          productId: validProductId, // Optional: linked product
          productVariationId: validVariationId, // Optional: linked variation
          serialNumber,
          customerId: customerId ? parseInt(customerId) : null,
          customerName,
          customerPhone,
          customerEmail,
          technicianId: technicianId ? parseInt(technicianId) : null,
          problemDescription,
          priority: priority || 'normal',
          status: 'pending',
          estimatedEndDate: estimatedEndDate ? new Date(estimatedEndDate) : null,
          laborCost: labor,
          partsCost: parts,
          tax: taxAmount,
          totalCost: total,
          paidAmount: 0
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
        technician: true,
        location: true,
        warrantyClaim: true
      }
    })

    // Serialize Decimal fields
    const serializedJobOrder = {
      ...completeJobOrder,
      laborCost: completeJobOrder ? Number(completeJobOrder.laborCost) : 0,
      partsCost: completeJobOrder ? Number(completeJobOrder.partsCost) : 0,
      taxAmount: completeJobOrder ? Number(completeJobOrder.tax) : 0,
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
