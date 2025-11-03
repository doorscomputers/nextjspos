import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth.simple'
import { prisma } from '@/lib/prisma'

/**
 * GET /api/reports/returns
 * Get returns report (both supplier returns and customer returns) per item
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = session.user as any
    const businessId = parseInt(user.businessId)

    // Get query parameters
    const { searchParams } = new URL(request.url)
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const locationId = searchParams.get('locationId') ? parseInt(searchParams.get('locationId')!) : null
    const returnType = searchParams.get('returnType') // 'supplier', 'customer', or 'all'

    // Build date filter
    const dateFilter: any = {}
    if (startDate) {
      dateFilter.gte = new Date(startDate)
    }
    if (endDate) {
      const end = new Date(endDate)
      end.setHours(23, 59, 59, 999)
      dateFilter.lte = end
    }

    const results: any[] = []

    // Fetch Supplier Returns
    if (!returnType || returnType === 'all' || returnType === 'supplier') {
      const supplierReturns = await prisma.supplierReturnItem.findMany({
        where: {
          supplierReturn: {
            businessId,
            ...(locationId ? { locationId: parseInt(locationId) } : {}),
            ...(Object.keys(dateFilter).length > 0 ? { returnDate: dateFilter } : {}),
            status: 'approved', // Only approved returns
          },
        },
        include: {
          supplierReturn: {
            include: {
              supplier: {
                select: {
                  id: true,
                  name: true,
                },
              },
              location: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
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
        orderBy: {
          supplierReturn: {
            returnDate: 'desc',
          },
        },
      })

      // Transform supplier returns
      for (const item of supplierReturns) {
        results.push({
          id: `supplier-${item.id}`,
          returnType: 'Supplier Return',
          returnNumber: item.supplierReturn.returnNumber,
          returnDate: item.supplierReturn.returnDate,
          approvedAt: item.supplierReturn.approvedAt,
          location: item.supplierReturn.location.name,
          locationId: item.supplierReturn.locationId,
          customerSupplier: item.supplierReturn.supplier.name,
          customerSupplierId: item.supplierReturn.supplierId,
          productId: item.productId,
          productName: item.product.name,
          productSku: item.product.sku,
          variationId: item.productVariationId,
          variationName: item.productVariation.name,
          quantity: parseFloat(item.quantity.toString()),
          unitCost: item.unitCost ? parseFloat(item.unitCost.toString()) : 0,
          totalAmount: item.unitCost
            ? parseFloat(item.quantity.toString()) * parseFloat(item.unitCost.toString())
            : 0,
          condition: item.condition,
          returnReason: item.supplierReturn.returnReason,
          notes: item.notes,
        })
      }
    }

    // Fetch Customer Returns
    if (!returnType || returnType === 'all' || returnType === 'customer') {
      const customerReturns = await prisma.customerReturnItem.findMany({
        where: {
          customerReturn: {
            businessId,
            ...(locationId ? { locationId: parseInt(locationId) } : {}),
            ...(Object.keys(dateFilter).length > 0 ? { returnDate: dateFilter } : {}),
            status: 'approved', // Only approved returns
          },
        },
        include: {
          customerReturn: {
            include: {
              customer: {
                select: {
                  id: true,
                  name: true,
                },
              },
              location: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
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
        orderBy: {
          customerReturn: {
            returnDate: 'desc',
          },
        },
      })

      // Transform customer returns
      for (const item of customerReturns) {
        results.push({
          id: `customer-${item.id}`,
          returnType: 'Customer Return',
          returnNumber: item.customerReturn.returnNumber,
          returnDate: item.customerReturn.returnDate,
          approvedAt: item.customerReturn.approvedAt,
          location: item.customerReturn.location.name,
          locationId: item.customerReturn.locationId,
          customerSupplier: item.customerReturn.customer?.name || 'Walk-in Customer',
          customerSupplierId: item.customerReturn.customerId,
          productId: item.productId,
          productName: item.product.name,
          productSku: item.product.sku,
          variationId: item.productVariationId,
          variationName: item.productVariation.name,
          quantity: parseFloat(item.quantity.toString()),
          unitCost: parseFloat(item.unitPrice.toString()), // Customer returns use unitPrice
          totalAmount: parseFloat(item.quantity.toString()) * parseFloat(item.unitPrice.toString()),
          condition: item.condition,
          returnReason: '', // Customer returns don't have a general return reason
          returnTypeDetail: item.returnType, // refund or replacement
          notes: item.notes,
        })
      }
    }

    // Sort by return date descending
    results.sort((a, b) => new Date(b.returnDate).getTime() - new Date(a.returnDate).getTime())

    // Calculate summary
    const summary = {
      totalReturns: results.length,
      totalSupplierReturns: results.filter((r) => r.returnType === 'Supplier Return').length,
      totalCustomerReturns: results.filter((r) => r.returnType === 'Customer Return').length,
      totalQuantity: results.reduce((sum, r) => sum + r.quantity, 0),
      totalAmount: results.reduce((sum, r) => sum + r.totalAmount, 0),
    }

    return NextResponse.json({
      returns: results,
      summary,
    })
  } catch (error: any) {
    console.error('Error fetching returns report:', error)
    return NextResponse.json(
      { error: 'Failed to fetch returns report', details: error.message },
      { status: 500 }
    )
  }
}
