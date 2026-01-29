import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth.simple'
import { prisma } from '@/lib/prisma.simple'

interface SupplierMetrics {
  supplierId: number
  supplierName: string
  contactPerson: string | null
  email: string | null
  phone: string | null
  // Performance Metrics
  totalPurchaseOrders: number
  totalPurchaseValue: number
  totalQuantityOrdered: number
  totalQuantityReceived: number
  // Calculated Scores (0-100)
  onTimeDeliveryRate: number
  fillRate: number
  priceTrendScore: number
  qualityScore: number
  overallScore: number
  // Tier Classification
  tier: 'Preferred' | 'Acceptable' | 'Review'
  tierColor: string
  // Additional Details
  avgLeadTimeDays: number
  lastPurchaseDate: string | null
  lastPriceChange: 'up' | 'down' | 'stable'
  priceChangePercent: number
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const periodDays = parseInt(searchParams.get('periodDays') || '90')

    const businessId = parseInt(session.user.businessId)

    // Calculate date range
    const endDate = new Date()
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - periodDays)

    // Previous period for price comparison
    const prevStartDate = new Date(startDate)
    prevStartDate.setDate(prevStartDate.getDate() - periodDays)

    // Get all suppliers with purchases in the period
    const suppliers = await prisma.supplier.findMany({
      where: {
        businessId,
        deletedAt: null,
      },
      select: {
        id: true,
        name: true,
        contactPerson: true,
        email: true,
        mobile: true,
      },
    })

    // Get all purchase orders for the period
    const purchases = await prisma.purchase.findMany({
      where: {
        businessId,
        purchaseDate: {
          gte: startDate,
          lte: endDate,
        },
        status: { not: 'cancelled' },
      },
      include: {
        items: {
          select: {
            quantity: true,
            quantityReceived: true,
            unitCost: true,
            productVariationId: true,
          },
        },
        receipts: {
          where: {
            status: 'approved',
          },
          select: {
            receiptDate: true,
          },
        },
      },
    })

    // Get previous period purchases for price comparison
    const prevPurchases = await prisma.purchase.findMany({
      where: {
        businessId,
        purchaseDate: {
          gte: prevStartDate,
          lt: startDate,
        },
        status: { not: 'cancelled' },
      },
      include: {
        items: {
          select: {
            unitCost: true,
            productVariationId: true,
          },
        },
      },
    })

    // Get quality control data
    const qcInspections = await prisma.qualityControlInspection.findMany({
      where: {
        businessId,
        inspectionDate: {
          gte: startDate,
          lte: endDate,
        },
        status: { in: ['passed', 'failed', 'conditional_pass'] },
      },
      include: {
        purchaseReceipt: {
          select: {
            supplierId: true,
          },
        },
      },
    })

    // Build QC map by supplier
    const qcBySupplier = new Map<number, { passed: number; total: number }>()
    for (const qc of qcInspections) {
      const supplierId = qc.purchaseReceipt.supplierId
      const current = qcBySupplier.get(supplierId) || { passed: 0, total: 0 }
      current.total++
      if (qc.status === 'passed' || qc.status === 'conditional_pass') {
        current.passed++
      }
      qcBySupplier.set(supplierId, current)
    }

    // Build previous period price map
    const prevPricesByProduct = new Map<string, number[]>()
    for (const purchase of prevPurchases) {
      for (const item of purchase.items) {
        const key = `${purchase.supplierId}-${item.productVariationId}`
        const prices = prevPricesByProduct.get(key) || []
        prices.push(parseFloat(item.unitCost.toString()))
        prevPricesByProduct.set(key, prices)
      }
    }

    // Calculate metrics for each supplier
    const supplierMetrics: SupplierMetrics[] = []

    for (const supplier of suppliers) {
      const supplierPurchases = purchases.filter(p => p.supplierId === supplier.id)

      if (supplierPurchases.length === 0) continue

      // Calculate totals
      let totalPurchaseValue = 0
      let totalQuantityOrdered = 0
      let totalQuantityReceived = 0
      let onTimeCount = 0
      let deliveryCount = 0
      let totalLeadTimeDays = 0
      let leadTimeCount = 0
      const currentPrices = new Map<number, number[]>()

      for (const purchase of supplierPurchases) {
        totalPurchaseValue += parseFloat(purchase.totalAmount.toString())

        for (const item of purchase.items) {
          totalQuantityOrdered += parseFloat(item.quantity.toString())
          totalQuantityReceived += parseFloat(item.quantityReceived.toString())

          // Track current prices
          const varId = item.productVariationId
          const prices = currentPrices.get(varId) || []
          prices.push(parseFloat(item.unitCost.toString()))
          currentPrices.set(varId, prices)
        }

        // On-time delivery calculation
        if (purchase.expectedDeliveryDate && purchase.receipts.length > 0) {
          deliveryCount++
          const expectedDate = new Date(purchase.expectedDeliveryDate)
          const actualReceiptDate = purchase.receipts[0].receiptDate
          if (actualReceiptDate <= expectedDate) {
            onTimeCount++
          }

          // Calculate lead time
          const purchaseDate = new Date(purchase.purchaseDate)
          const receiptDate = new Date(actualReceiptDate)
          const leadTime = Math.floor((receiptDate.getTime() - purchaseDate.getTime()) / (1000 * 60 * 60 * 24))
          totalLeadTimeDays += leadTime
          leadTimeCount++
        }
      }

      // Calculate scores

      // 1. On-Time Delivery Rate (35%)
      const onTimeDeliveryRate = deliveryCount > 0
        ? Math.round((onTimeCount / deliveryCount) * 100)
        : 80 // Default if no delivery data

      // 2. Fill Rate (30%)
      const fillRate = totalQuantityOrdered > 0
        ? Math.round((totalQuantityReceived / totalQuantityOrdered) * 100)
        : 80 // Default if no data

      // 3. Price Trend Score (20%)
      // Compare current average prices to previous period
      let priceChangePercent = 0
      let priceChangeDirection: 'up' | 'down' | 'stable' = 'stable'
      let comparedProducts = 0

      for (const [varId, prices] of currentPrices) {
        const key = `${supplier.id}-${varId}`
        const prevPrices = prevPricesByProduct.get(key)
        if (prevPrices && prevPrices.length > 0) {
          const currentAvg = prices.reduce((a, b) => a + b, 0) / prices.length
          const prevAvg = prevPrices.reduce((a, b) => a + b, 0) / prevPrices.length
          if (prevAvg > 0) {
            priceChangePercent += ((currentAvg - prevAvg) / prevAvg) * 100
            comparedProducts++
          }
        }
      }

      if (comparedProducts > 0) {
        priceChangePercent = Math.round((priceChangePercent / comparedProducts) * 10) / 10
        if (priceChangePercent < -1) priceChangeDirection = 'down'
        else if (priceChangePercent > 1) priceChangeDirection = 'up'
      }

      // Price trend score: 100 if prices went down, 70 if stable, decreasing if up
      let priceTrendScore: number
      if (priceChangePercent <= -2) {
        priceTrendScore = 100
      } else if (priceChangePercent <= 0) {
        priceTrendScore = 85
      } else if (priceChangePercent <= 2) {
        priceTrendScore = 70
      } else if (priceChangePercent <= 5) {
        priceTrendScore = 50
      } else {
        priceTrendScore = Math.max(20, 50 - (priceChangePercent - 5) * 5)
      }

      // 4. Quality Score (15%)
      const qcData = qcBySupplier.get(supplier.id)
      const qualityScore = qcData && qcData.total > 0
        ? Math.round((qcData.passed / qcData.total) * 100)
        : 80 // Default if no QC data

      // Calculate Overall Score (weighted average)
      const overallScore = Math.round(
        (onTimeDeliveryRate * 0.35) +
        (fillRate * 0.30) +
        (priceTrendScore * 0.20) +
        (qualityScore * 0.15)
      )

      // Determine tier
      let tier: 'Preferred' | 'Acceptable' | 'Review'
      let tierColor: string
      if (overallScore >= 90) {
        tier = 'Preferred'
        tierColor = 'green'
      } else if (overallScore >= 70) {
        tier = 'Acceptable'
        tierColor = 'blue'
      } else {
        tier = 'Review'
        tierColor = 'red'
      }

      // Get last purchase date
      const lastPurchase = supplierPurchases.sort((a, b) =>
        new Date(b.purchaseDate).getTime() - new Date(a.purchaseDate).getTime()
      )[0]

      supplierMetrics.push({
        supplierId: supplier.id,
        supplierName: supplier.name,
        contactPerson: supplier.contactPerson,
        email: supplier.email,
        phone: supplier.mobile,
        totalPurchaseOrders: supplierPurchases.length,
        totalPurchaseValue: Math.round(totalPurchaseValue * 100) / 100,
        totalQuantityOrdered: Math.round(totalQuantityOrdered),
        totalQuantityReceived: Math.round(totalQuantityReceived),
        onTimeDeliveryRate,
        fillRate: Math.min(fillRate, 100), // Cap at 100%
        priceTrendScore,
        qualityScore,
        overallScore,
        tier,
        tierColor,
        avgLeadTimeDays: leadTimeCount > 0
          ? Math.round(totalLeadTimeDays / leadTimeCount)
          : 0,
        lastPurchaseDate: lastPurchase
          ? new Date(lastPurchase.purchaseDate).toISOString().split('T')[0]
          : null,
        lastPriceChange: priceChangeDirection,
        priceChangePercent,
      })
    }

    // Sort by overall score descending
    supplierMetrics.sort((a, b) => b.overallScore - a.overallScore)

    // Calculate summary
    const summary = {
      totalSuppliers: supplierMetrics.length,
      preferredCount: supplierMetrics.filter(s => s.tier === 'Preferred').length,
      acceptableCount: supplierMetrics.filter(s => s.tier === 'Acceptable').length,
      reviewCount: supplierMetrics.filter(s => s.tier === 'Review').length,
      avgOverallScore: supplierMetrics.length > 0
        ? Math.round(supplierMetrics.reduce((sum, s) => sum + s.overallScore, 0) / supplierMetrics.length)
        : 0,
      topPerformer: supplierMetrics.length > 0 ? supplierMetrics[0]?.supplierName : null,
      totalPurchaseValue: Math.round(supplierMetrics.reduce((sum, s) => sum + s.totalPurchaseValue, 0) * 100) / 100,
      periodDays,
      weightDescription: 'On-Time 35% | Fill Rate 30% | Price Trend 20% | Quality 15%',
    }

    return NextResponse.json({
      success: true,
      data: {
        summary,
        suppliers: supplierMetrics,
      },
    })
  } catch (error) {
    console.error('Supplier scorecard error:', error)
    return NextResponse.json(
      {
        error: 'Failed to generate supplier scorecard',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
