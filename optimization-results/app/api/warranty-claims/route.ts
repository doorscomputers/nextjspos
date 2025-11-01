import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { PERMISSIONS } from '@/lib/rbac'

// Helper function to generate claim number
async function generateClaimNumber(businessId: number, tx: any) {
  const year = new Date().getFullYear()
  const prefix = `WC-${year}-`

  // Get the last claim number for this year
  const lastClaim = await tx.serviceWarrantyClaim.findFirst({
    where: {
      businessId,
      claimNumber: {
        startsWith: prefix
      }
    },
    orderBy: {
      claimNumber: 'desc'
    }
  })

  let nextNumber = 1
  if (lastClaim) {
    const lastNumber = parseInt(lastClaim.claimNumber.split('-')[2])
    nextNumber = lastNumber + 1
  }

  return `${prefix}${String(nextNumber).padStart(4, '0')}`
}

// GET /api/warranty-claims - List all warranty claims
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = session.user as any
    const businessId = user.businessId
    const userId = user.id

    if (!businessId) {
      return NextResponse.json({ error: 'No business associated with user' }, { status: 400 })
    }

    // Check permission
    const canViewAll = user.permissions?.includes(PERMISSIONS.WARRANTY_CLAIM_VIEW)
    const canViewOwn = user.permissions?.includes(PERMISSIONS.WARRANTY_CLAIM_VIEW_OWN)

    if (!canViewAll && !canViewOwn) {
      return NextResponse.json({ error: 'Forbidden - Insufficient permissions' }, { status: 403 })
    }

    // Parse query parameters for filtering
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const customerId = searchParams.get('customerId')
    const locationId = searchParams.get('locationId')
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const search = searchParams.get('search')?.trim() || ''
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = (page - 1) * limit

    // Build where clause
    const whereClause: any = {
      businessId: parseInt(businessId),
      deletedAt: null
    }

    // If user can only view own claims
    if (canViewOwn && !canViewAll) {
      whereClause.submittedBy = parseInt(userId)
    }

    // Apply filters
    if (status) {
      whereClause.status = status
    }

    if (customerId) {
      whereClause.customerId = parseInt(customerId)
    }

    if (locationId) {
      whereClause.locationId = parseInt(locationId)
    }

    if (startDate || endDate) {
      whereClause.claimDate = {}
      if (startDate) whereClause.claimDate.gte = new Date(startDate)
      if (endDate) whereClause.claimDate.lte = new Date(endDate)
    }

    if (search) {
      whereClause.OR = [
        { claimNumber: { contains: search, mode: 'insensitive' } },
        { customerName: { contains: search, mode: 'insensitive' } },
        { customerPhone: { contains: search, mode: 'insensitive' } },
        { issueDescription: { contains: search, mode: 'insensitive' } }
      ]
    }

    const [claims, total] = await Promise.all([
      prisma.serviceWarrantyClaim.findMany({
        where: whereClause,
        select: {
          customer: {
            select: {
              id: { select: { id: { select: { id: true, name: true } }, name: { select: { id: true, name: true } } } },
              name: { select: { id: true, name: true } },
              mobile: { select: { id: true, name: true } },
              email: { select: { id: true, name: true } }
            }
          },
          product: {
            select: {
              id: { select: { id: true, name: true } },
              name: { select: { id: true, name: true } },
              sku: { select: { id: true, name: true } }
            }
          },
          productVariation: {
            select: {
              id: { select: { id: true, name: true } },
              name: { select: { id: true, name: true } },
              sku: { select: { id: true, name: true } }
            }
          },
          serialNumber: {
            select: {
              id: { select: { id: true, name: true } },
              serialNumber: { select: { id: true, name: true } },
              imei: { select: { id: true, name: true } },
              purchaseDate: { select: { id: true, name: true } },
              warrantyExpiryDate: { select: { id: true, name: true } }
            }
          },
          location: {
            select: {
              id: { select: { id: true, name: true } },
              name: { select: { id: true, name: true } }
            }
          },
          assignedTechnician: {
            select: {
              id: { select: { id: true, name: true } },
              primarySpecialization: { select: { id: true, name: true } },
              employee: {
                select: {
                  firstName: { select: { id: true, name: true } },
                  lastName: { select: { id: true, name: true } },
                  employeeCode: { select: { id: true, name: true } }
                }
              }
            }
          },
          submitter: {
            select: {
              id: { select: { id: true, name: true } },
              username: { select: { id: true, name: true } },
              firstName: { select: { id: true, name: true } },
              lastName: { select: { id: true, name: true } }
            }
          }
        },
        orderBy: { claimDate: 'desc' },
        skip: offset,
        take: limit
      }),
      prisma.serviceWarrantyClaim.count({ where: whereClause })
    ])

    // Serialize Decimal fields
    const serializedClaims = claims.map(claim => ({
      ...claim,
      laborCost: claim.laborCost ? Number(claim.laborCost) : null,
      partsCost: claim.partsCost ? Number(claim.partsCost) : null,
      totalCost: claim.totalCost ? Number(claim.totalCost) : null
    }))

    return NextResponse.json({
      claims: serializedClaims,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      }
    })
  } catch (error) {
    console.error('Error fetching warranty claims:', error)
    return NextResponse.json({ error: 'Failed to fetch warranty claims' }, { status: 500 })
  }
}

// POST /api/warranty-claims - Create new warranty claim
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = session.user as any
    const businessId = user.businessId
    const userId = user.id

    if (!businessId) {
      return NextResponse.json({ error: 'No business associated with user' }, { status: 400 })
    }

    // Check permission
    if (!user.permissions?.includes(PERMISSIONS.WARRANTY_CLAIM_CREATE)) {
      return NextResponse.json({ error: 'Forbidden - Insufficient permissions' }, { status: 403 })
    }

    const body = await request.json()
    const {
      locationId,
      claimDate,
      serialNumberId,
      productId,
      productVariationId,
      customerId,
      customerName,
      customerPhone,
      customerEmail,
      saleId,
      issueDescription,
      claimType,
      priority,
      expectedDeliveryDate
    } = body

    // Validation
    if (!locationId || !claimDate || !issueDescription) {
      return NextResponse.json(
        { error: 'Missing required fields: locationId, claimDate, issueDescription' },
        { status: 400 }
      )
    }

    // Must have either serial number or product
    if (!serialNumberId && !productId) {
      return NextResponse.json(
        { error: 'Either serialNumberId or productId is required' },
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

    // Verify serial number if provided
    let serialNumberData = null
    if (serialNumberId) {
      serialNumberData = await prisma.productSerialNumber.findFirst({
        where: {
          id: parseInt(serialNumberId),
          businessId: parseInt(businessId)
        },
        select: {
          productVariation: {
            select: {
              product: { select: { id: { select: { id: true, name: true } }, name: { select: { id: true, name: true } } } }
            }
          }
        }
      })

      if (!serialNumberData) {
        return NextResponse.json({ error: 'Serial number not found' }, { status: 404 })
      }

      // Check if warranty is expired
      if (serialNumberData.warrantyExpiryDate && new Date(serialNumberData.warrantyExpiryDate) < new Date()) {
        return NextResponse.json({
          error: 'Warranty has expired',
          warrantyExpiryDate: serialNumberData.warrantyExpiryDate
        }, { status: 400 })
      }
    }

    // Create warranty claim in transaction
    const claim = await prisma.$transaction(async (tx) => {
      // Generate claim number
      const claimNumber = await generateClaimNumber(parseInt(businessId), tx)

      // Create claim
      const newClaim = await tx.serviceWarrantyClaim.create({
        data: {
          businessId: parseInt(businessId),
          locationId: parseInt(locationId),
          claimNumber,
          claimDate: new Date(claimDate),
          serialNumberId: serialNumberId ? parseInt(serialNumberId) : null,
          productId: serialNumberId ? serialNumberData?.productVariation.productId : parseInt(productId),
          productVariationId: serialNumberId ? serialNumberData?.productVariationId : (productVariationId ? parseInt(productVariationId) : null),
          customerId: customerId ? parseInt(customerId) : null,
          customerName: customerName || null,
          customerPhone: customerPhone || null,
          customerEmail: customerEmail || null,
          saleId: saleId ? parseInt(saleId) : null,
          issueDescription,
          claimType: claimType || 'hardware_defect',
          priority: priority || 'medium',
          status: 'pending',
          expectedDeliveryDate: expectedDeliveryDate ? new Date(expectedDeliveryDate) : null,
          submittedBy: parseInt(userId),
          submittedAt: new Date()
        }
      })

      return newClaim
    })

    // Fetch complete claim with relations
    const completeClaim = await prisma.serviceWarrantyClaim.findUnique({
      where: { id: claim.id },
      select: {
        customer: { select: { id: { select: { id: true, name: true } }, name: { select: { id: true, name: true } } } },
        product: { select: { id: true, name: true } },
        productVariation: { select: { id: true, name: true } },
        serialNumber: { select: { id: true, name: true } },
        location: { select: { id: true, name: true } },
        submitter: {
          select: {
            id: { select: { id: true, name: true } },
            username: { select: { id: true, name: true } },
            firstName: { select: { id: true, name: true } },
            lastName: { select: { id: true, name: true } }
          }
        }
      }
    })

    // Serialize Decimal fields
    const serializedClaim = {
      ...completeClaim,
      laborCost: completeClaim?.laborCost ? Number(completeClaim.laborCost) : null,
      partsCost: completeClaim?.partsCost ? Number(completeClaim.partsCost) : null,
      totalCost: completeClaim?.totalCost ? Number(completeClaim.totalCost) : null
    }

    return NextResponse.json({
      claim: serializedClaim,
      message: 'Warranty claim created successfully'
    }, { status: 201 })
  } catch (error) {
    console.error('Error creating warranty claim:', error)
    return NextResponse.json({ error: 'Failed to create warranty claim' }, { status: 500 })
  }
}
