import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { hasPermission, PERMISSIONS, getUserAccessibleLocationIds } from '@/lib/rbac'

/**
 * GET /api/reports/cost-audit
 * Cost audit report showing cost vs pricing analysis
 */
export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Permission check
    if (!hasPermission(session.user, PERMISSIONS.PRODUCT_COST_AUDIT_VIEW)) {
      return NextResponse.json({ error: 'Forbidden - Insufficient permissions' }, { status: 403 })
    }

    const businessId = Number(session.user.businessId)
    if (!Number.isInteger(businessId)) {
      return NextResponse.json({ error: 'Invalid business context' }, { status: 400 })
    }

    // Get accessible location IDs for this user
    const accessibleLocationIds = getUserAccessibleLocationIds(session.user)

    // Build location filter
    const locationFilter: any = {}
    if (accessibleLocationIds !== null) {
      locationFilter.id = { in: accessibleLocationIds }
    }

    // Fetch all active locations
    const locations = await prisma.businessLocation.findMany({
      where: {
        businessId,
        isActive: { select: { id: true, name: true } },
        ...locationFilter,
      },
      select: {
        id: { select: { id: true, name: true } },
        name: { select: { id: true, name: true } },
      },
      orderBy: {
        name: 'asc',
      },
    })

    // Fetch product variations with cost and pricing data
    const productVariations = await prisma.productVariation.findMany({
      where: {
        product: {
          businessId,
        },
      },
      select: {
        product: {
          select: {
            id: { select: { id: { select: { id: true, name: true } }, name: { select: { id: true, name: true } } } },
            name: { select: { id: true, name: true } },
            sku: { select: { id: true, name: true } },
            category: {
              select: {
                name: { select: { id: true, name: true } },
              },
            },
            brand: {
              select: {
                name: { select: { id: true, name: true } },
              },
            },
          },
        },
        variationLocationDetails: {
          where: accessibleLocationIds !== null
            ? { locationId: { in: accessibleLocationIds } }
            : {},
          select: {
            locationId: { select: { id: true, name: true } },
            sellingPrice: { select: { id: true, name: true } },
            qtyAvailable: { select: { id: true, name: true } },
          },
        },
      },
      orderBy: {
        product: {
          name: 'asc',
        },
      },
    })

    // Build cost audit data
    const auditData: any[] = []

    for (const variation of productVariations) {
      const basePrice = Number(variation.sellingPrice)
      const costPrice = Number(variation.purchasePrice)

      for (const location of locations) {
        // Find location-specific price
        const locationDetail = variation.variationLocationDetails.find(
          (detail) => detail.locationId === location.id
        )

        const sellingPrice = locationDetail?.sellingPrice
          ? Number(locationDetail.sellingPrice)
          : basePrice

        const qtyAvailable = locationDetail ? Number(locationDetail.qtyAvailable) : 0

        // Calculate margins
        const grossProfitAmount = sellingPrice - costPrice
        const grossProfitPercent = sellingPrice > 0 ? (grossProfitAmount / sellingPrice) * 100 : 0
        const markupPercent = costPrice > 0 ? (grossProfitAmount / costPrice) * 100 : 0

        // Identify pricing issues
        const isBelowCost = sellingPrice < costPrice
        const isLowMargin = grossProfitPercent < 15 && grossProfitPercent > 0
        const isHighMargin = grossProfitPercent > 50
        const hasIssue = isBelowCost || isLowMargin

        auditData.push({
          productVariationId: variation.id,
          productId: variation.product.id,
          productName: variation.product.name,
          productSku: variation.product.sku || '',
          variationName: variation.name || 'Default',
          variationSku: variation.sku || '',
          categoryName: variation.product.category?.name || 'Uncategorized',
          brandName: variation.product.brand?.name || 'No Brand',
          locationId: location.id,
          locationName: location.name,
          costPrice,
          basePrice,
          sellingPrice,
          qtyAvailable,
          grossProfitAmount,
          grossProfitPercent,
          markupPercent,
          isBelowCost,
          isLowMargin,
          isHighMargin,
          hasIssue,
          inventoryValue: qtyAvailable * sellingPrice,
          costValue: qtyAvailable * costPrice,
        })
      }
    }

    // Calculate summary statistics
    const totalItems = auditData.length
    const belowCostCount = auditData.filter((p) => p.isBelowCost).length
    const lowMarginCount = auditData.filter((p) => p.isLowMargin).length
    const highMarginCount = auditData.filter((p) => p.isHighMargin).length
    const avgMargin = auditData.reduce((sum, p) => sum + p.grossProfitPercent, 0) / totalItems

    return NextResponse.json({
      success: { select: { id: true, name: true } },
      data: auditData,
      metadata: {
        locations: locations.map((l) => ({ id: l.id, name: l.name })),
        summary: {
          totalItems,
          belowCostCount,
          lowMarginCount,
          highMarginCount,
          avgMargin,
          healthyCount: totalItems - belowCostCount - lowMarginCount,
        },
      },
    })
  } catch (error) {
    console.error('Cost audit report error:', error)
    return NextResponse.json(
      {
        error: 'Failed to generate cost audit report',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
