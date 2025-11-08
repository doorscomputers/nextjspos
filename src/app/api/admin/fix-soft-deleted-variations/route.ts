import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth.simple'
import { prisma } from '@/lib/prisma.simple'
import { PERMISSIONS } from '@/lib/rbac'
import { refreshStockView } from '@/lib/refreshStockView'

/**
 * GET /api/admin/fix-soft-deleted-variations
 * Detect products with soft-deleted variations that should be active
 * Super Admin only
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = session.user as any
    const businessId = parseInt(String(user.businessId))

    // Check for Super Admin permission
    if (!user.permissions?.includes(PERMISSIONS.SUPER_ADMIN)) {
      return NextResponse.json(
        { error: 'Forbidden - Super Admin access required' },
        { status: 403 }
      )
    }

    // Find active products with soft-deleted variations
    const affectedProducts = await prisma.product.findMany({
      where: {
        businessId,
        isActive: true,
        deletedAt: null,
        variations: {
          some: {
            deletedAt: { not: null }
          }
        }
      },
      include: {
        variations: {
          where: {
            deletedAt: { not: null }
          }
        },
        category: {
          select: {
            name: true
          }
        }
      },
      orderBy: {
        updatedAt: 'desc'
      }
    })

    // Format the results
    const issues = affectedProducts.map(product => ({
      productId: product.id,
      productName: product.name,
      productSku: product.sku,
      productType: product.type,
      categoryName: product.category?.name || 'None',
      isActive: product.isActive,
      enableStock: product.enableStock,
      createdAt: product.createdAt,
      updatedAt: product.updatedAt,
      deletedVariations: product.variations.map(v => ({
        variationId: v.id,
        variationName: v.name,
        variationSku: v.sku,
        isDefault: v.isDefault,
        deletedAt: v.deletedAt
      }))
    }))

    return NextResponse.json({
      success: true,
      totalAffected: issues.length,
      totalDeletedVariations: issues.reduce((sum, p) => sum + p.deletedVariations.length, 0),
      issues
    })
  } catch (error) {
    console.error('Error detecting soft-deleted variations:', error)
    return NextResponse.json(
      {
        error: 'Failed to detect issues',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

/**
 * POST /api/admin/fix-soft-deleted-variations
 * Restore soft-deleted variations for active products
 * Super Admin only
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = session.user as any
    const businessId = parseInt(String(user.businessId))

    // Check for Super Admin permission
    if (!user.permissions?.includes(PERMISSIONS.SUPER_ADMIN)) {
      return NextResponse.json(
        { error: 'Forbidden - Super Admin access required' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { productIds } = body

    if (!Array.isArray(productIds) || productIds.length === 0) {
      return NextResponse.json(
        { error: 'productIds array is required' },
        { status: 400 }
      )
    }

    console.log(`[Admin Fix] Restoring variations for ${productIds.length} products...`)

    // Restore variations in a transaction
    const result = await prisma.$transaction(async (tx) => {
      const restoredVariations: number[] = []

      for (const productId of productIds) {
        // Verify product exists and is active
        const product = await tx.product.findFirst({
          where: {
            id: productId,
            businessId,
            isActive: true,
            deletedAt: null
          },
          include: {
            variations: {
              where: {
                deletedAt: { not: null }
              }
            }
          }
        })

        if (!product) {
          console.warn(`[Admin Fix] Product ${productId} not found or not active - skipping`)
          continue
        }

        // Restore all soft-deleted variations for this product
        for (const variation of product.variations) {
          await tx.productVariation.update({
            where: { id: variation.id },
            data: { deletedAt: null }
          })
          restoredVariations.push(variation.id)
          console.log(`[Admin Fix] Restored variation ${variation.id} (${variation.name}) for product ${product.name}`)
        }
      }

      return {
        productsProcessed: productIds.length,
        variationsRestored: restoredVariations.length,
        restoredVariationIds: restoredVariations
      }
    })

    // Refresh materialized view to show restored products in reports
    console.log('[Admin Fix] Refreshing stock materialized view...')
    const refreshResult = await refreshStockView({ silent: false })

    if (!refreshResult.success) {
      console.error('[Admin Fix] Failed to refresh view:', refreshResult.error)
    } else {
      console.log(`[Admin Fix] View refreshed - ${refreshResult.rowsAffected} rows affected`)
    }

    return NextResponse.json({
      success: true,
      message: `Restored ${result.variationsRestored} variation(s) across ${result.productsProcessed} product(s)`,
      ...result,
      viewRefreshed: refreshResult.success
    })
  } catch (error) {
    console.error('Error fixing soft-deleted variations:', error)
    return NextResponse.json(
      {
        error: 'Failed to fix variations',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
