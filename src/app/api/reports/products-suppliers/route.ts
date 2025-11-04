import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth.simple'
import { prisma } from '@/lib/prisma.simple'
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

    console.time('⏱️ [REPORT] Total execution time')

    // ✅ OPTIMIZATION: Single query with all joins instead of N+1 queries
    console.time('⏱️ [REPORT] Database query')
    const variations = await prisma.productVariation.findMany({
      where: {
        businessId,
        product: {
          ...productWhere,
        },
      },
      include: {
        product: {
          include: {
            category: { select: { id: true, name: true } },
            brand: { select: { id: true, name: true } },
            unit: { select: { id: true, name: true, shortName: true } },
          },
        },
        // Get latest purchase receipt item
        purchaseReceiptItems: {
          where: {
            purchaseReceipt: {
              businessId,
              status: 'approved',
            },
          },
          include: {
            purchaseReceipt: {
              include: {
                supplier: {
                  select: { id: true, name: true, email: true, mobile: true },
                },
              },
            },
            purchaseItem: {
              select: { unitCost: true },
            },
          },
          orderBy: {
            purchaseReceipt: {
              receiptDate: 'desc',
            },
          },
          take: 1,
        },
        // Fallback: Get latest purchase item
        purchaseItems: {
          where: {
            purchase: {
              businessId,
              deletedAt: null,
              status: { in: ['ordered', 'partially_received', 'received'] },
            },
          },
          include: {
            purchase: {
              include: {
                supplier: {
                  select: { id: true, name: true, email: true, mobile: true },
                },
              },
            },
          },
          orderBy: {
            purchase: {
              purchaseDate: 'desc',
            },
          },
          take: 1,
        },
      },
      orderBy: {
        product: {
          name: 'asc',
        },
      },
    })
    console.timeEnd('⏱️ [REPORT] Database query')

    console.log(`✅ Loaded ${variations.length} variations in single query (was ${variations.length * 2}+ queries before)`)

    // Transform data (no more database queries!)
    const reportData = variations.map((variation) => {
      const product = variation.product
      const latestReceiptItem = variation.purchaseReceiptItems[0]
      const latestPurchaseItem = variation.purchaseItems[0]

      // Determine data source
      const sourceItem = latestReceiptItem || latestPurchaseItem

      if (!sourceItem) {
        return {
          productId: product.id,
          productName: product.name,
          productSku: product.sku,
          productType: product.type,
          category: product.category?.name || '-',
          categoryId: product.category?.id || null,
          brand: product.brand?.name || '-',
          unit: product.unit?.shortName || '-',
          variationName: variation.name,
          variationSku: variation.sku,
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
      let supplier: any

      if (latestReceiptItem) {
        lastDeliveryDate = latestReceiptItem.purchaseReceipt.receiptDate
        lastQty = parseFloat(latestReceiptItem.quantityReceived.toString())
        unitCost = latestReceiptItem.purchaseItem?.unitCost
          ? parseFloat(latestReceiptItem.purchaseItem.unitCost.toString())
          : 0
        supplier = latestReceiptItem.purchaseReceipt.supplier
      } else {
        lastDeliveryDate = latestPurchaseItem!.purchase.purchaseDate
        lastQty = parseFloat(latestPurchaseItem!.quantity.toString())
        unitCost = parseFloat(latestPurchaseItem!.unitCost.toString())
        supplier = latestPurchaseItem!.purchase.supplier
      }

      // Apply supplier filter
      if (supplierId && supplier.id !== parseInt(supplierId)) {
        return null
      }

      const daysSinceLastDelivery = Math.floor(
        (new Date().getTime() - lastDeliveryDate.getTime()) / (1000 * 60 * 60 * 24)
      )

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
        variationName: variation.name,
        variationSku: variation.sku,
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

    console.timeEnd('⏱️ [REPORT] Total execution time')

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
