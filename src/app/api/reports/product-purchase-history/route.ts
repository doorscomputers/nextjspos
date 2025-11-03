import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth.simple'
import { prisma } from '@/lib/prisma'
import { PERMISSIONS } from '@/lib/rbac'

/**
 * GET /api/reports/product-purchase-history
 *
 * Product Purchase History Report
 * Shows: SKU, Product Name, Last Cost, Last Supplier, Qty Purchased, Amount
 *
 * Query Parameters:
 * - productId (optional): Filter by specific product
 * - categoryId (optional): Filter by category
 * - startDate (optional): Filter purchases from this date
 * - endDate (optional): Filter purchases until this date
 * - page (default: 1)
 * - limit (default: 20)
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = session.user as any
    const businessId = parseInt(user.businessId)

    // Check permission
    if (!user.permissions?.includes(PERMISSIONS.REPORT_VIEW)) {
      return NextResponse.json(
        { error: 'Forbidden - Insufficient permissions to view reports' },
        { status: 403 }
      )
    }

    const { searchParams } = new URL(request.url)
    const productId = searchParams.get('productId')
    const categoryId = searchParams.get('categoryId')
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const skip = (page - 1) * limit

    // Build where clause for products
    const productWhere: any = {
      businessId,
      isActive: true,
    }

    if (productId) {
      productWhere.id = parseInt(productId)
    }

    if (categoryId) {
      productWhere.categoryId = parseInt(categoryId)
    }

    // Get all products matching criteria
    const products = await prisma.product.findMany({
      where: productWhere,
      include: {
        variations: {
          where: { isActive: true },
        },
        category: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: {
        name: 'asc',
      },
      skip,
      take: limit,
    })

    const totalProducts = await prisma.product.count({ where: productWhere })

    // For each product, get purchase history
    const productHistory = await Promise.all(
      products.map(async (product) => {
        // Get all purchase receipt items for this product
        const purchaseHistoryWhere: any = {
          productId: product.id,
          purchaseReceipt: {
            businessId,
          },
        }

        // Apply date filters
        if (startDate || endDate) {
          purchaseHistoryWhere.purchaseReceipt = {
            ...purchaseHistoryWhere.purchaseReceipt,
            receiptDate: {},
          }

          if (startDate) {
            purchaseHistoryWhere.purchaseReceipt.receiptDate.gte = new Date(startDate)
          }

          if (endDate) {
            purchaseHistoryWhere.purchaseReceipt.receiptDate.lte = new Date(endDate)
          }
        }

        const purchaseItems = await prisma.purchaseReceiptItem.findMany({
          where: purchaseHistoryWhere,
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
                  include: {
                    items: {
                      where: {
                        productId: product.id,
                      },
                      select: {
                        unitCost: true,
                      },
                    },
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

        // Calculate totals and get last purchase info
        let totalQuantity = 0
        let totalAmount = 0
        let lastCost = 0
        let lastSupplier = null
        let lastPurchaseDate = null

        if (purchaseItems.length > 0) {
          // Get last purchase info (most recent)
          const lastItem = purchaseItems[0]
          lastPurchaseDate = lastItem.purchaseReceipt.receiptDate
          lastSupplier = lastItem.purchaseReceipt.supplier

          // Get unit cost from purchase item or calculate from receipt
          if (lastItem.purchaseReceipt.purchase && lastItem.purchaseReceipt.purchase.items.length > 0) {
            lastCost = parseFloat(lastItem.purchaseReceipt.purchase.items[0].unitCost.toString())
          } else {
            // For direct entry GRNs, we need to get the cost from inventory movements
            const lastMovement = await prisma.inventoryMovement.findFirst({
              where: {
                referenceType: 'purchase_receipt',
                referenceId: lastItem.purchaseReceipt.id.toString(),
                productId: product.id,
                productVariationId: lastItem.productVariationId,
              },
              orderBy: {
                createdAt: 'desc',
              },
              select: {
                unitCost: true,
              },
            })

            if (lastMovement) {
              lastCost = parseFloat(lastMovement.unitCost.toString())
            }
          }

          // Calculate totals for all purchases
          for (const item of purchaseItems) {
            const quantity = parseFloat(item.quantityReceived.toString())
            totalQuantity += quantity

            // Get unit cost for this item
            let unitCost = 0
            if (item.purchaseReceipt.purchase && item.purchaseReceipt.purchase.items.length > 0) {
              unitCost = parseFloat(item.purchaseReceipt.purchase.items[0].unitCost.toString())
            } else {
              // Get from inventory movement
              const movement = await prisma.inventoryMovement.findFirst({
                where: {
                  referenceType: 'purchase_receipt',
                  referenceId: item.purchaseReceipt.id.toString(),
                  productId: product.id,
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

            totalAmount += quantity * unitCost
          }
        }

        // Get current stock across all variations
        const currentStock = product.variations.reduce(
          (sum, variation) => sum + parseFloat(variation.currentStock.toString()),
          0
        )

        return {
          productId: product.id,
          sku: product.sku,
          productName: product.name,
          categoryName: product.category?.name || 'Uncategorized',
          variations: product.variations.length,
          currentStock,
          lastCost,
          lastSupplier,
          lastPurchaseDate,
          totalQuantityPurchased: totalQuantity,
          totalAmountSpent: totalAmount,
          purchaseCount: purchaseItems.length,
        }
      })
    )

    // Sort by last purchase date (most recent first)
    productHistory.sort((a, b) => {
      if (!a.lastPurchaseDate && !b.lastPurchaseDate) return 0
      if (!a.lastPurchaseDate) return 1
      if (!b.lastPurchaseDate) return -1
      return new Date(b.lastPurchaseDate).getTime() - new Date(a.lastPurchaseDate).getTime()
    })

    return NextResponse.json({
      success: true,
      data: productHistory,
      pagination: {
        page,
        limit,
        totalProducts,
        totalPages: Math.ceil(totalProducts / limit),
      },
      filters: {
        productId: productId ? parseInt(productId) : null,
        categoryId: categoryId ? parseInt(categoryId) : null,
        startDate,
        endDate,
      },
    })
  } catch (error: any) {
    console.error('Error generating product purchase history report:', error)
    return NextResponse.json(
      {
        error: 'Failed to generate report',
        details: error.message,
      },
      { status: 500 }
    )
  }
}
