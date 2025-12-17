import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth.simple'
import { prisma } from '@/lib/prisma.simple'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const businessId = parseInt(session.user.businessId)

    // Filters
    const locationId = searchParams.get('locationId') ? parseInt(searchParams.get('locationId')!) : null
    const supplierId = searchParams.get('supplierId')
    const status = searchParams.get('status')
    const productName = searchParams.get('productName')
    const sku = searchParams.get('sku')
    const purchaseOrderNumber = searchParams.get('purchaseOrderNumber')
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const minAmount = searchParams.get('minAmount')
    const maxAmount = searchParams.get('maxAmount')

    // Pagination
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '50')
    const skip = (page - 1) * limit

    // Build purchase where clause
    const purchaseWhere: any = {
      businessId,
      deletedAt: null
    }

    if (locationId && locationId !== 'all') {
      purchaseWhere.locationId = parseInt(locationId)
    }

    if (supplierId && supplierId !== 'all') {
      purchaseWhere.supplierId = parseInt(supplierId)
    }

    if (status && status !== 'all') {
      purchaseWhere.status = status
    } else {
      // Exclude cancelled purchase orders by default (lowercase to match database values)
      purchaseWhere.status = { not: 'cancelled' }
    }

    if (purchaseOrderNumber) {
      purchaseWhere.purchaseOrderNumber = {
        contains: purchaseOrderNumber
      }
    }

    if (startDate && endDate) {
      purchaseWhere.purchaseDate = {
        gte: new Date(startDate + 'T00:00:00'),
        lte: new Date(endDate + 'T23:59:59.999')
      }
    } else if (startDate) {
      purchaseWhere.purchaseDate = {
        gte: new Date(startDate + 'T00:00:00')
      }
    } else if (endDate) {
      purchaseWhere.purchaseDate = {
        lte: new Date(endDate + 'T23:59:59.999')
      }
    }

    // Fetch all purchase items with related data
    const items = await prisma.purchaseItem.findMany({
      where: {
        purchase: purchaseWhere
      },
      include: {
        purchase: {
          select: {
            id: true,
            purchaseOrderNumber: true,
            purchaseDate: true,
            expectedDeliveryDate: true,
            status: true,
            locationId: true,
            supplier: {
              select: {
                id: true,
                name: true
              }
            }
          }
        },
        productVariation: {
          select: {
            id: true,
            sku: true,
            name: true,
            product: {
              select: {
                id: true,
                name: true,
                sku: true,
                category: {
                  select: {
                    id: true,
                    name: true
                  }
                }
              }
            }
          }
        }
      },
      orderBy: {
        id: 'desc'
      }
    })

    // Fetch all unique location IDs and get location names
    const uniqueLocationIds = [...new Set(items.map(item => item.purchase.locationId))]
    const locations = await prisma.businessLocation.findMany({
      where: {
        id: { in: uniqueLocationIds }
      },
      select: {
        id: true,
        name: true
      }
    })

    // Create a location lookup map
    const locationMap = new Map(locations.map(loc => [loc.id, loc.name]))

    // Apply additional filters at item level
    let filteredItems = items

    if (productName) {
      filteredItems = filteredItems.filter(item =>
        item.productVariation.product.name.toLowerCase().includes(productName.toLowerCase())
      )
    }

    if (sku) {
      filteredItems = filteredItems.filter(item =>
        item.productVariation.sku.toLowerCase().includes(sku.toLowerCase())
      )
    }

    if (minAmount || maxAmount) {
      filteredItems = filteredItems.filter(item => {
        const itemTotal = parseFloat(item.quantity.toString()) * parseFloat(item.unitCost.toString())
        if (minAmount && itemTotal < parseFloat(minAmount)) return false
        if (maxAmount && itemTotal > parseFloat(maxAmount)) return false
        return true
      })
    }

    // Calculate totals
    const totalItems = filteredItems.length
    const totalQuantityOrdered = filteredItems.reduce(
      (sum, item) => sum + parseFloat(item.quantity.toString()),
      0
    )
    const totalQuantityReceived = filteredItems.reduce(
      (sum, item) => sum + parseFloat(item.quantityReceived.toString()),
      0
    )
    const totalValue = filteredItems.reduce(
      (sum, item) => sum + (parseFloat(item.quantity.toString()) * parseFloat(item.unitCost.toString())),
      0
    )
    const totalReceivedValue = filteredItems.reduce(
      (sum, item) => sum + (parseFloat(item.quantityReceived.toString()) * parseFloat(item.unitCost.toString())),
      0
    )

    // Apply pagination
    const paginatedItems = filteredItems.slice(skip, skip + limit)

    // Format items for response
    const formattedItems = paginatedItems.map(item => {
      const quantity = parseFloat(item.quantity.toString())
      const quantityReceived = parseFloat(item.quantityReceived.toString())
      const unitCost = parseFloat(item.unitCost.toString())
      const itemTotal = quantity * unitCost
      const receivedTotal = quantityReceived * unitCost

      return {
        id: item.id,
        productName: item.productVariation.product.name,
        productId: item.productVariation.product.id,
        variationName: item.productVariation.name || 'N/A',
        variationId: item.productVariation.id,
        sku: item.productVariation.product.sku || item.productVariation.sku,
        category: item.productVariation.product.category?.name || 'Uncategorized',
        categoryId: item.productVariation.product.category?.id || null,
        purchaseOrderNumber: item.purchase.purchaseOrderNumber,
        purchaseDate: item.purchase.purchaseDate.toISOString().split('T')[0],
        purchaseDateObj: item.purchase.purchaseDate,
        expectedDeliveryDate: item.purchase.expectedDeliveryDate
          ? item.purchase.expectedDeliveryDate.toISOString().split('T')[0]
          : null,
        supplier: item.purchase.supplier.name,
        supplierId: item.purchase.supplier.id,
        location: locationMap.get(item.purchase.locationId) || 'Unknown',
        locationId: item.purchase.locationId,
        status: item.purchase.status,
        quantityOrdered: quantity,
        quantityReceived: quantityReceived,
        unitCost: unitCost,
        itemTotal: itemTotal,
        receivedTotal: receivedTotal,
        requiresSerial: item.requiresSerial || false
      }
    })

    const totalPages = Math.ceil(totalItems / limit)

    return NextResponse.json({
      items: formattedItems,
      summary: {
        totalItems,
        totalQuantityOrdered,
        totalQuantityReceived,
        totalValue,
        totalReceivedValue,
        averageUnitCost: totalItems > 0
          ? filteredItems.reduce((sum, item) => sum + parseFloat(item.unitCost.toString()), 0) / totalItems
          : 0
      },
      pagination: {
        page,
        limit,
        totalCount: totalItems,
        totalPages
      }
    })
  } catch (error) {
    console.error('========================================')
    console.error('Purchase items report ERROR:')
    console.error('Error object:', error)
    console.error('Error message:', error instanceof Error ? error.message : 'Unknown')
    console.error('Error stack:', error instanceof Error ? error.stack : 'No stack')
    console.error('========================================')
    return NextResponse.json(
      {
        error: 'Failed to generate purchase items report',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
