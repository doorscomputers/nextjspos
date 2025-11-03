import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth.simple'
import { prisma } from '@/lib/prisma.simple'
import { PERMISSIONS } from '@/lib/rbac'

// GET - Fetch a single purchase order by ID (Fixed for Next.js 15)
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
    const businessId = parseInt(String(user.businessId))
    // Check permission
    if (!user.permissions?.includes(PERMISSIONS.PURCHASE_VIEW)) {
      return NextResponse.json(
        { error: 'Forbidden - Insufficient permissions' },
        { status: 403 }
      )
    }

    // Await params in Next.js 15
    const { id } = await params
    const purchaseId = parseInt(id)

    if (isNaN(purchaseId)) {
      return NextResponse.json(
        { error: 'Invalid purchase ID' },
        { status: 400 }
      )
    }

    // Fetch purchase order with all related data
    const purchase = await prisma.purchase.findFirst({
      where: {
        id: purchaseId,
        businessId: parseInt(businessId),
        deletedAt: null,
      },
      include: {
        supplier: {
          select: {
            id: true,
            name: true,
            mobile: true,
            email: true,
          },
        },
        items: {
          include: {
            receiptItems: true,
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
              },
            },
          },
        },
      },
    })

    if (!purchase) {
      return NextResponse.json(
        { error: 'Purchase order not found' },
        { status: 404 }
      )
    }

    const [business, location] = await Promise.all([
      prisma.business.findUnique({
        where: { id: purchase.businessId },
        select: {
          name: true,
          taxLabel1: true,
          taxNumber1: true,
          taxLabel2: true,
          taxNumber2: true,
        },
      }),
      prisma.businessLocation.findUnique({
        where: { id: purchase.locationId },
        select: {
          id: true,
          name: true,
          landmark: true,
          country: true,
          state: true,
          city: true,
          zipCode: true,
          mobile: true,
          alternateNumber: true,
          email: true,
        },
      }),
    ])

    const purchaseWithDetails = {
      ...purchase,
      business: business
        ? {
            name: business.name,
            taxNumberPrimary: business.taxNumber1,
            taxLabelPrimary: business.taxLabel1,
            taxNumberSecondary: business.taxNumber2,
            taxLabelSecondary: business.taxLabel2,
          }
        : null,
      location: location
        ? {
            id: location.id,
            name: location.name,
            landmark: location.landmark,
            country: location.country,
            state: location.state,
            city: location.city,
            zipCode: location.zipCode,
            mobile: location.mobile,
            alternateNumber: location.alternateNumber,
            email: location.email,
          }
        : null,
    }

    return NextResponse.json({ data: purchaseWithDetails })
  } catch (error) {
    console.error('Error fetching purchase order:', error)
    return NextResponse.json(
      { error: 'Failed to fetch purchase order' },
      { status: 500 }
    )
  }
}
