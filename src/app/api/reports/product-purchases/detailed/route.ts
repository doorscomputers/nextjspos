import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth.simple'
import { prisma } from '@/lib/prisma.simple'
import { PERMISSIONS } from '@/lib/rbac'
import type { Prisma } from '@prisma/client'

/**
 * GET /api/reports/product-purchases/detailed
 *
 * Detailed Product Purchase Report - Transaction Level
 * Returns individual purchase transactions for pivot analysis
 *
 * Query Parameters:
 * - categoryId (optional): Filter by category
 * - supplierId (optional): Filter by supplier
 * - productId (optional): Filter by specific product
 * - startDate (optional): Filter purchases from this date
 * - endDate (optional): Filter purchases until this date
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = session.user as {
      businessId: string
      permissions?: string[]
    }
    const businessId = parseInt(user.businessId)

    // Check permission
    if (!user.permissions?.includes(PERMISSIONS.REPORT_VIEW)) {
      return NextResponse.json(
        { error: 'Forbidden - Insufficient permissions to view reports' },
        { status: 403 }
      )
    }

    const { searchParams } = new URL(request.url)
    const categoryId = searchParams.get('categoryId')
    const supplierId = searchParams.get('supplierId')
    const productId = searchParams.get('productId')
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')

    // Build where clause for purchase receipts
    const receiptWhere: Prisma.PurchaseReceiptWhereInput = {
      businessId,
      status: 'completed',
    }

    if (startDate || endDate) {
      const receiptDateFilter: Prisma.DateTimeFilter = {}

      if (startDate) {
        const start = new Date(startDate)
        if (!Number.isNaN(start.getTime())) {
          start.setHours(0, 0, 0, 0)
          receiptDateFilter.gte = start
        }
      }

      if (endDate) {
        const end = new Date(endDate)
        if (!Number.isNaN(end.getTime())) {
          end.setHours(23, 59, 59, 999)
          receiptDateFilter.lte = end
        }
      }

      if (Object.keys(receiptDateFilter).length > 0) {
        receiptWhere.receiptDate = receiptDateFilter
      }
    }

    if (supplierId) {
      receiptWhere.supplierId = parseInt(supplierId)
    }

    // Get all purchase receipt items matching criteria
    const purchaseReceiptItems = await prisma.purchaseReceiptItem.findMany({
      where: {
        purchaseReceipt: receiptWhere,
        ...(productId ? { productId: parseInt(productId) } : {}),
      },
      include: {
        purchaseReceipt: {
          include: {
            supplier: {
              select: {
                id: true,
                name: true,
              },
            },
            purchase: {
              select: {
                id: true,
                purchaseOrderNumber: true,
              },
            },
          },
        },
        product: {
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
        purchaseReceipt: {
          receiptDate: 'desc',
        },
      },
    })

    // Filter by category if specified
    let filteredItems = purchaseReceiptItems
    if (categoryId) {
      filteredItems = purchaseReceiptItems.filter(
        (item) => item.product.categoryId === parseInt(categoryId)
      )
    }

    // Transform data for analysis
    const detailedData = await Promise.all(
      filteredItems.map(async (item) => {
        // Get unit cost from purchase or inventory movement
        let unitCost = 0

        if (item.purchaseReceipt.purchase) {
          // Get from purchase items
          const purchaseItem = await prisma.purchaseItem.findFirst({
            where: {
              purchaseId: item.purchaseReceipt.purchase.id,
              productId: item.productId,
              productVariationId: item.productVariationId,
            },
            select: {
              unitCost: true,
            },
          })

          if (purchaseItem) {
            unitCost = parseFloat(purchaseItem.unitCost.toString())
          }
        }

        // If no unit cost from purchase, try inventory movement
        if (unitCost === 0) {
          const movement = await prisma.inventoryMovement.findFirst({
            where: {
              referenceType: 'purchase_receipt',
              referenceId: item.purchaseReceipt.id.toString(),
              productId: item.productId,
              productVariationId: item.productVariationId,
            },
            orderBy: {
              createdAt: 'desc',
            },
            select: {
              unitCost: true,
            },
          })

          if (movement) {
            unitCost = parseFloat(movement.unitCost.toString())
          }
        }

        const quantity = parseFloat(item.quantityReceived.toString())
        const totalCost = quantity * unitCost

        return {
          id: item.id, // Use the purchaseReceiptItem ID as unique identifier
          receiptId: item.purchaseReceipt.id,
          receiptNumber: item.purchaseReceipt.receiptNumber,
          receiptDate: item.purchaseReceipt.receiptDate,
          purchaseOrderNumber: item.purchaseReceipt.purchase?.purchaseOrderNumber || 'Direct Entry',
          productId: item.product.id,
          productName: item.product.name,
          productSku: item.product.sku,
          variationName: item.productVariation?.name || 'Default',
          categoryId: item.product.category?.id || null,
          category: item.product.category?.name || 'Uncategorized',
          brandId: item.product.brand?.id || null,
          brand: item.product.brand?.name || 'No Brand',
          supplierId: item.purchaseReceipt.supplier?.id || null,
          supplier: item.purchaseReceipt.supplier?.name || 'Unknown',
          locationId: null,
          location: 'Main Warehouse',
          quantity,
          unitCost,
          totalCost,
          year: new Date(item.purchaseReceipt.receiptDate).getFullYear(),
          month: new Date(item.purchaseReceipt.receiptDate).toLocaleString('en-US', {
            month: 'long',
          }),
          quarter: `Q${Math.ceil((new Date(item.purchaseReceipt.receiptDate).getMonth() + 1) / 3)}`,
        }
      })
    )

    return NextResponse.json({
      success: true,
      data: detailedData,
      summary: {
        totalTransactions: detailedData.length,
        totalQuantity: detailedData.reduce((sum, item) => sum + item.quantity, 0),
        totalValue: detailedData.reduce((sum, item) => sum + item.totalCost, 0),
        uniqueProducts: new Set(detailedData.map((item) => item.productId)).size,
        uniqueSuppliers: new Set(detailedData.map((item) => item.supplierId)).size,
      },
      filters: {
        categoryId: categoryId ? parseInt(categoryId) : null,
        supplierId: supplierId ? parseInt(supplierId) : null,
        productId: productId ? parseInt(productId) : null,
        startDate,
        endDate,
      },
    })
  } catch (error: unknown) {
    console.error('Error generating detailed product purchase report:', error)
    return NextResponse.json(
      {
        error: 'Failed to generate report',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
