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
    const locationId = searchParams.get('locationId')
    const categoryId = searchParams.get('categoryId')
    const minDays = parseInt(searchParams.get('minDays') || '30')

    const businessId = parseInt(session.user.businessId)

    // Get all active locations
    const activeLocations = await prisma.businessLocation.findMany({
      where: {
        businessId,
        isActive: true,
      },
      select: {
        id: true,
        name: true,
      },
    })
    const locationMap = new Map(activeLocations.map(loc => [loc.id, loc.name]))
    const activeLocationIds = activeLocations.map(loc => loc.id)

    // Build location filter
    const locationFilter = locationId && locationId !== 'all'
      ? [parseInt(locationId)]
      : activeLocationIds

    // Get all products with stock > 0 at specified locations
    const stockData = await prisma.variationLocationDetails.findMany({
      where: {
        locationId: { in: locationFilter },
        qtyAvailable: { gt: 0 },
        productVariation: {
          businessId,
          deletedAt: null,
          product: {
            isActive: true,
            enableStock: true,
            ...(categoryId && categoryId !== 'all' ? { categoryId: parseInt(categoryId) } : {}),
          },
        },
      },
      include: {
        productVariation: {
          include: {
            product: {
              include: {
                category: {
                  select: { id: true, name: true },
                },
              },
            },
            supplier: {
              select: { id: true, name: true },
            },
          },
        },
      },
    })

    // Get last sale date for each variation
    const variationIds = [...new Set(stockData.map(s => s.productVariationId))]

    // Fetch last sale for each variation
    const lastSales = await prisma.saleItem.findMany({
      where: {
        productVariationId: { in: variationIds },
        sale: {
          businessId,
          status: { in: ['completed', 'final'] },
        },
      },
      select: {
        productVariationId: true,
        sale: {
          select: {
            saleDate: true,
          },
        },
      },
      orderBy: {
        sale: {
          saleDate: 'desc',
        },
      },
    })

    // Build map of last sale date per variation
    const lastSaleDateMap = new Map<number, Date>()
    for (const sale of lastSales) {
      if (!lastSaleDateMap.has(sale.productVariationId)) {
        lastSaleDateMap.set(sale.productVariationId, sale.sale.saleDate)
      }
    }

    // Calculate total inventory value for percentage
    const totalInventoryValue = stockData.reduce((sum, s) => {
      const qty = parseFloat(s.qtyAvailable.toString())
      const cost = parseFloat(s.productVariation.purchasePrice.toString())
      return sum + (qty * cost)
    }, 0)

    // Process data and calculate days since last sale
    const today = new Date()
    const deadStockItems: Array<{
      id: number
      productId: number
      variationId: number
      productName: string
      variationName: string
      sku: string
      category: string
      categoryId: number | null
      supplierId: number | null
      supplierName: string
      locationId: number
      locationName: string
      currentStock: number
      unitCost: number
      tiedUpCapital: number
      lastSaleDate: string | null
      daysSinceSale: number | null
      suggestion: string
      suggestionColor: string
    }> = []

    for (const stock of stockData) {
      const variation = stock.productVariation
      const product = variation.product
      const qty = parseFloat(stock.qtyAvailable.toString())
      const cost = parseFloat(variation.purchasePrice.toString())
      const tiedUpCapital = qty * cost

      const lastSaleDate = lastSaleDateMap.get(variation.id)
      let daysSinceSale: number | null = null

      if (lastSaleDate) {
        daysSinceSale = Math.floor((today.getTime() - new Date(lastSaleDate).getTime()) / (1000 * 60 * 60 * 24))
      }

      // Check if this item qualifies as dead stock
      // Either never sold OR hasn't sold in minDays
      const isDeadStock = daysSinceSale === null || daysSinceSale >= minDays

      if (!isDeadStock) continue

      // Determine suggestion based on days
      let suggestion: string
      let suggestionColor: string
      if (daysSinceSale === null) {
        suggestion = 'Return to Supplier'
        suggestionColor = 'red'
      } else if (daysSinceSale >= 90) {
        suggestion = 'Clearance Sale'
        suggestionColor = 'red'
      } else if (daysSinceSale >= 60) {
        suggestion = 'Markdown 10-20%'
        suggestionColor = 'orange'
      } else {
        suggestion = 'Monitor'
        suggestionColor = 'yellow'
      }

      deadStockItems.push({
        id: stock.id,
        productId: product.id,
        variationId: variation.id,
        productName: product.name,
        variationName: variation.name,
        sku: variation.sku,
        category: product.category?.name || 'Uncategorized',
        categoryId: product.categoryId,
        supplierId: variation.supplierId,
        supplierName: variation.supplier?.name || 'No Supplier',
        locationId: stock.locationId,
        locationName: locationMap.get(stock.locationId) || 'Unknown',
        currentStock: qty,
        unitCost: cost,
        tiedUpCapital,
        lastSaleDate: lastSaleDate ? lastSaleDate.toISOString().split('T')[0] : null,
        daysSinceSale,
        suggestion,
        suggestionColor,
      })
    }

    // Sort by tied-up capital descending
    deadStockItems.sort((a, b) => b.tiedUpCapital - a.tiedUpCapital)

    // Calculate summary statistics
    const totalTiedUpCapital = deadStockItems.reduce((sum, item) => sum + item.tiedUpCapital, 0)
    const neverSold = deadStockItems.filter(item => item.daysSinceSale === null).length
    const over30Days = deadStockItems.filter(item => item.daysSinceSale !== null && item.daysSinceSale >= 30).length
    const over60Days = deadStockItems.filter(item => item.daysSinceSale !== null && item.daysSinceSale >= 60).length
    const over90Days = deadStockItems.filter(item => item.daysSinceSale !== null && item.daysSinceSale >= 90).length

    const summary = {
      totalItems: deadStockItems.length,
      neverSold,
      over30Days,
      over60Days,
      over90Days,
      totalTiedUpCapital,
      percentOfInventory: totalInventoryValue > 0
        ? Math.round((totalTiedUpCapital / totalInventoryValue) * 100 * 10) / 10
        : 0,
    }

    return NextResponse.json({
      success: true,
      data: {
        summary,
        items: deadStockItems,
      },
    })
  } catch (error) {
    console.error('Dead stock report error:', error)
    return NextResponse.json(
      {
        error: 'Failed to generate dead stock report',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
