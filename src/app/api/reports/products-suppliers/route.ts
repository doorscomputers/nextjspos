import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth.simple'
import { prisma } from '@/lib/prisma'
import { PERMISSIONS } from '@/lib/rbac'

/**
 * Products with Latest Suppliers Report API
 *
 * Returns a list of all products with information about:
 * - Latest supplier who delivered the product
 * - Latest cost from the most recent purchase
 * - Last quantity delivered
 * - Last delivery date
 *
 * This report helps businesses track which suppliers they're sourcing from
 * and the most recent purchase costs for each product.
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = session.user as any
    const businessId = parseInt(user.businessId)

    // Check permission
    if (!user.permissions?.includes(PERMISSIONS.REPORT_VIEW) &&
        !user.permissions?.includes(PERMISSIONS.PRODUCT_VIEW)) {
      return NextResponse.json(
        { error: 'Forbidden - Insufficient permissions' },
        { status: 403 }
      )
    }

    // Get query parameters for filtering
    const { searchParams } = new URL(request.url)
    const categoryId = searchParams.get('categoryId')
    const supplierId = searchParams.get('supplierId')
    const searchTerm = searchParams.get('search')

    // Build product filter
    const productWhere: any = {
      businessId,
      deletedAt: null,
    }

    if (categoryId) {
      productWhere.categoryId = parseInt(categoryId)
    }

    if (searchTerm) {
      productWhere.OR = [
        { name: { contains: searchTerm, mode: 'insensitive' } },
        { sku: { contains: searchTerm, mode: 'insensitive' } },
      ]
    }

    // Get all products with their variations
    const products = await prisma.product.findMany({
      where: productWhere,
      include: {
        category: {
          select: {
            id: true,
            name: true,
          },
        },
        brand: {
          select: {
            id: true,
            name: true,
          },
        },
        unit: {
          select: {
            id: true,
            name: true,
            shortName: true,
          },
        },
        variations: {
          select: {
            id: true,
            name: true,
            sku: true,
          },
        },
      },
      orderBy: {
        name: 'asc',
      },
    })

    // For each product, get the latest purchase information
    const reportData = await Promise.all(
      products.map(async (product) => {
        // Get variation IDs for this product
        const variationIds = product.variations.map(v => v.id)

        if (variationIds.length === 0) {
          // No variations, skip this product
          return null
        }

        // Find the most recent purchase receipt item for any variation of this product
        const latestPurchaseItem = await prisma.purchaseReceiptItem.findFirst({
          where: {
            productId: product.id,
            productVariationId: {
              in: variationIds,
            },
            purchaseReceipt: {
              is: {
                businessId,
                status: 'approved', // Only consider approved receipts
              },
            },
          },
          include: {
            purchaseReceipt: {
              include: {
                supplier: {
                  select: {
                    id: true,
                    name: true,
                    email: true,
                    mobile: true,
                  },
                },
              },
            },
            purchaseItem: {
              select: {
                id: true,
                unitCost: true,
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
            purchaseReceipt: {
              receiptDate: 'desc',
            },
          },
        })

        // If no receipt item found, try getting from purchase items (non-received POs)
        let fallbackPurchaseItem = null
        if (!latestPurchaseItem) {
          fallbackPurchaseItem = await prisma.purchaseItem.findFirst({
            where: {
              productId: product.id,
              productVariationId: {
                in: variationIds,
              },
              purchase: {
                is: {
                  businessId,
                  deletedAt: null,
                  status: {
                    in: ['ordered', 'partially_received', 'received'],
                  },
                },
              },
            },
            include: {
              purchase: {
                include: {
                  supplier: {
                    select: {
                      id: true,
                      name: true,
                      email: true,
                      mobile: true,
                    },
                  },
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
              purchase: {
                purchaseDate: 'desc',
              },
            },
          })
        }

        // Determine which data source to use
        const sourceItem = latestPurchaseItem || fallbackPurchaseItem

        if (!sourceItem) {
          // No purchase history for this product
          return {
            productId: product.id,
            productName: product.name,
            productSku: product.sku,
            productType: product.type,
            category: product.category?.name || '-',
            categoryId: product.category?.id || null,
            brand: product.brand?.name || '-',
            unit: product.unit?.shortName || '-',
            variationName: '-',
            variationSku: '-',
            supplierId: null,
            supplierName: 'No Purchase History',
            supplierContact: '-',
            latestCost: 0,
            lastQtyDelivered: 0,
            lastDeliveryDate: null,
            daysSinceLastDelivery: null,
            hasHistory: false,
          }
        }

        let lastDeliveryDate: Date
        let lastQty: number
        let unitCost: number

        if (latestPurchaseItem) {
          // From approved receipt
          lastDeliveryDate = latestPurchaseItem.purchaseReceipt.receiptDate
          lastQty = parseFloat(latestPurchaseItem.quantityReceived.toString())
          // unitCost comes from the related purchaseItem (may be null for direct GRN)
          unitCost = latestPurchaseItem.purchaseItem
            ? parseFloat(latestPurchaseItem.purchaseItem.unitCost.toString())
            : 0
        } else {
          // From purchase order
          lastDeliveryDate = fallbackPurchaseItem!.purchase.purchaseDate
          lastQty = parseFloat(fallbackPurchaseItem!.quantity.toString())
          unitCost = parseFloat(fallbackPurchaseItem!.unitCost.toString())
        }

        const supplier = latestPurchaseItem
          ? latestPurchaseItem.purchaseReceipt.supplier
          : fallbackPurchaseItem!.purchase.supplier

        const variation = latestPurchaseItem
          ? latestPurchaseItem.productVariation
          : fallbackPurchaseItem!.productVariation

        // Calculate days since last delivery
        const daysSinceLastDelivery = Math.floor(
          (new Date().getTime() - lastDeliveryDate.getTime()) / (1000 * 60 * 60 * 24)
        )

        // Apply supplier filter if specified
        if (supplierId && supplier.id !== parseInt(supplierId)) {
          return null
        }

        const supplierContact = [
          supplier.mobile || '',
          supplier.email || '',
        ].filter(Boolean).join(' | ') || '-'

        return {
          productId: product.id,
          productName: product.name,
          productSku: product.sku,
          productType: product.type,
          category: product.category?.name || '-',
          categoryId: product.category?.id || null,
          brand: product.brand?.name || '-',
          unit: product.unit?.shortName || '-',
          variationName: variation.name || '-',
          variationSku: variation.sku || '-',
          supplierId: supplier.id,
          supplierName: supplier.name,
          supplierContact,
          latestCost: unitCost,
          lastQtyDelivered: lastQty,
          lastDeliveryDate: lastDeliveryDate.toISOString(),
          daysSinceLastDelivery,
          hasHistory: true,
        }
      })
    )

    // Filter out null entries
    const filteredData = reportData.filter((item): item is NonNullable<typeof item> => item !== null)

    // Calculate summary statistics
    const summary = {
      totalProducts: filteredData.length,
      productsWithHistory: filteredData.filter(p => p.hasHistory).length,
      productsWithoutHistory: filteredData.filter(p => !p.hasHistory).length,
      uniqueSuppliers: new Set(
        filteredData.filter(p => p.supplierId).map(p => p.supplierId)
      ).size,
      totalValue: filteredData.reduce((sum, p) => sum + (p.latestCost * p.lastQtyDelivered), 0),
      averageDaysSinceDelivery:
        filteredData.filter(p => p.daysSinceLastDelivery !== null).length > 0
          ? Math.round(
              filteredData
                .filter(p => p.daysSinceLastDelivery !== null)
                .reduce((sum, p) => sum + (p.daysSinceLastDelivery || 0), 0) /
              filteredData.filter(p => p.daysSinceLastDelivery !== null).length
            )
          : 0,
    }

    return NextResponse.json({
      success: true,
      data: filteredData,
      summary,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('Error generating products-suppliers report:', error)
    return NextResponse.json(
      {
        error: 'Failed to generate report',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
