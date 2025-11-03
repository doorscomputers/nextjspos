import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth.simple'
import prisma from '@/lib/prisma.simple'

/**
 * GET /api/reports/service-warranty-slip
 * Fetch complete service job order data for warranty slip printing
 *
 * Query Parameters:
 * - jobOrderId: ID of the service job order
 *
 * Required Permission: VIEW_REPORTS or VIEW_SERVICE_JOBS
 */
export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const jobOrderId = searchParams.get('jobOrderId')

    if (!jobOrderId) {
      return NextResponse.json(
        { error: 'Job Order ID is required' },
        { status: 400 }
      )
    }

    // Fetch the complete job order with all relations
    const jobOrder = await prisma.serviceJobOrder.findUnique({
      where: {
        id: parseInt(jobOrderId),
      },
      include: {
        business: true,
        location: true,
        customer: true,
        technician: {
          select: {
            id: true,
            username: true,
            firstName: true,
            lastName: true,
            surname: true,
          },
        },
        qualityChecker: {
          select: {
            id: true,
            username: true,
            firstName: true,
            lastName: true,
            surname: true,
          },
        },
        createdByUser: {
          select: {
            id: true,
            username: true,
            firstName: true,
            lastName: true,
            surname: true,
          },
        },
        parts: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
                sku: true,
              },
            },
            productVariation: {
              select: {
                id: true,
                name: true,
                sku: true,
              },
            },
          },
          orderBy: {
            createdAt: 'asc',
          },
        },
      },
    })

    if (!jobOrder) {
      return NextResponse.json(
        { error: 'Service Job Order not found' },
        { status: 404 }
      )
    }

    // Verify multi-tenant access
    if (jobOrder.businessId !== parseInt(session.user.businessId)) {
      return NextResponse.json(
        { error: 'Access denied - different business' },
        { status: 403 }
      )
    }

    // Calculate warranty expiry date if not set
    let warrantyExpiry = jobOrder.warrantyExpiryDate
    if (!warrantyExpiry && jobOrder.actualCompletionDate) {
      const completionDate = new Date(jobOrder.actualCompletionDate)
      warrantyExpiry = new Date(completionDate)
      warrantyExpiry.setDate(
        warrantyExpiry.getDate() + jobOrder.serviceWarrantyPeriod
      )
    }

    // Format the response
    const response = {
      jobOrder: {
        ...jobOrder,
        warrantyExpiryDate: warrantyExpiry,
        // Format decimal values
        laborCost: parseFloat(jobOrder.laborCost.toString()),
        partsCost: parseFloat(jobOrder.partsCost.toString()),
        additionalCharges: parseFloat(jobOrder.additionalCharges.toString()),
        subtotal: parseFloat(jobOrder.subtotal.toString()),
        discountAmount: parseFloat(jobOrder.discountAmount.toString()),
        taxAmount: parseFloat(jobOrder.taxAmount.toString()),
        grandTotal: parseFloat(jobOrder.grandTotal.toString()),
        amountPaid: parseFloat(jobOrder.amountPaid.toString()),
        balanceDue: parseFloat(jobOrder.balanceDue.toString()),
        parts: jobOrder.parts.map((part) => ({
          ...part,
          quantity: parseFloat(part.quantity.toString()),
          unitPrice: parseFloat(part.unitPrice.toString()),
          subtotal: parseFloat(part.subtotal.toString()),
        })),
      },
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error('Error fetching service warranty slip:', error)
    return NextResponse.json(
      { error: 'Failed to fetch service warranty slip data' },
      { status: 500 }
    )
  }
}
