import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth.simple'
import { prisma } from '@/lib/prisma.simple'
import { differenceInDays } from 'date-fns'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')

    if (!startDate || !endDate) {
      return NextResponse.json(
        { error: 'Start date and end date are required' },
        { status: 400 }
      )
    }

    const businessId = parseInt(session.user.businessId)

    // Get all purchases in date range with received/completed status
    const purchases = await prisma.purchase.findMany({
      where: {
        businessId,
        deletedAt: null,
        status: {
          in: ['received', 'completed']
        },
        purchaseDate: {
          gte: new Date(startDate + 'T00:00:00'),
          lte: new Date(endDate + 'T23:59:59.999')
        }
      },
      include: {
        supplier: {
          select: {
            id: true,
            name: true
          }
        },
        items: true
      }
    })

    // Get returns in date range
    const returns = await prisma.purchaseReturn.findMany({
      where: {
        businessId,
        returnDate: {
          gte: new Date(startDate + 'T00:00:00'),
          lte: new Date(endDate + 'T23:59:59.999')
        }
      },
      include: {
        items: true
      },
      select: {
        id: true,
        supplierId: true,
        items: true
      }
    })

    // Get QC inspections for the purchases
    // Note: QC inspection feature may not exist yet, so we'll handle gracefully
    let qcInspections: any[] = []
    try {
      qcInspections = await prisma.qCInspection.findMany({
        where: {
          businessId,
          deletedAt: null,
          createdAt: {
            gte: new Date(startDate + 'T00:00:00'),
            lte: new Date(endDate + 'T23:59:59.999')
          }
        },
        include: {
          goodsReceivedNote: {
            include: {
              purchase: {
                select: {
                  supplierId: true
                }
              }
            }
          }
        }
      })
    } catch (error) {
      // QC table might not exist, that's okay
      console.log('QC Inspections not available')
    }

    // Build supplier performance data
    const supplierPerformance = new Map<number, {
      supplierId: number
      supplierName: string
      totalOrders: number
      totalOrderValue: number
      onTimeDeliveries: number
      lateDeliveries: number
      onTimeDeliveryRate: number
      returnCount: number
      returnValue: number
      returnRate: number
      qcInspections: number
      qcPassed: number
      qcFailed: number
      qcPassRate: number
      overallScore: number
      rating: string
    }>()

    // Process purchases
    purchases.forEach(purchase => {
      const supplierId = purchase.supplierId
      const supplierName = purchase.supplier.name

      if (!supplierPerformance.has(supplierId)) {
        supplierPerformance.set(supplierId, {
          supplierId,
          supplierName,
          totalOrders: 0,
          totalOrderValue: 0,
          onTimeDeliveries: 0,
          lateDeliveries: 0,
          onTimeDeliveryRate: 0,
          returnCount: 0,
          returnValue: 0,
          returnRate: 0,
          qcInspections: 0,
          qcPassed: 0,
          qcFailed: 0,
          qcPassRate: 0,
          overallScore: 0,
          rating: 'N/A'
        })
      }

      const supplier = supplierPerformance.get(supplierId)!
      supplier.totalOrders += 1
      supplier.totalOrderValue += parseFloat(purchase.totalAmount.toString())

      // Check on-time delivery
      if (purchase.expectedDeliveryDate && purchase.receivedAt) {
        const expectedDate = new Date(purchase.expectedDeliveryDate)
        const receivedDate = new Date(purchase.receivedAt)

        if (receivedDate <= expectedDate) {
          supplier.onTimeDeliveries += 1
        } else {
          supplier.lateDeliveries += 1
        }
      }
    })

    // Process returns
    returns.forEach(ret => {
      const supplierId = ret.supplierId
      const supplier = supplierPerformance.get(supplierId)

      if (supplier) {
        supplier.returnCount += 1
        ret.items.forEach(item => {
          const quantity = parseFloat(item.quantityReturned.toString())
          const unitCost = parseFloat(item.unitCost.toString())
          supplier.returnValue += quantity * unitCost
        })
      }
    })

    // Process QC inspections
    qcInspections.forEach(qc => {
      if (qc.goodsReceivedNote?.purchase?.supplierId) {
        const supplierId = qc.goodsReceivedNote.purchase.supplierId
        const supplier = supplierPerformance.get(supplierId)

        if (supplier) {
          supplier.qcInspections += 1
          if (qc.status === 'passed') {
            supplier.qcPassed += 1
          } else if (qc.status === 'failed') {
            supplier.qcFailed += 1
          }
        }
      }
    })

    // Calculate rates and scores for each supplier
    const suppliers = Array.from(supplierPerformance.values()).map(supplier => {
      // Calculate on-time delivery rate
      const totalDeliveries = supplier.onTimeDeliveries + supplier.lateDeliveries
      supplier.onTimeDeliveryRate = totalDeliveries > 0
        ? (supplier.onTimeDeliveries / totalDeliveries) * 100
        : 100 // If no data, assume 100%

      // Calculate return rate
      supplier.returnRate = supplier.totalOrders > 0
        ? (supplier.returnCount / supplier.totalOrders) * 100
        : 0

      // Calculate QC pass rate
      supplier.qcPassRate = supplier.qcInspections > 0
        ? (supplier.qcPassed / supplier.qcInspections) * 100
        : 100 // If no QC data, assume 100%

      // Calculate overall score (weighted average)
      // On-time delivery: 40%, Return rate: 30%, QC pass rate: 30%
      const onTimeScore = supplier.onTimeDeliveryRate * 0.4
      const returnScore = (100 - supplier.returnRate) * 0.3
      const qcScore = supplier.qcPassRate * 0.3

      supplier.overallScore = onTimeScore + returnScore + qcScore

      // Assign rating based on overall score
      if (supplier.overallScore >= 90) {
        supplier.rating = 'Excellent'
      } else if (supplier.overallScore >= 75) {
        supplier.rating = 'Good'
      } else if (supplier.overallScore >= 60) {
        supplier.rating = 'Fair'
      } else {
        supplier.rating = 'Poor'
      }

      return supplier
    })

    // Sort by overall score descending
    suppliers.sort((a, b) => b.overallScore - a.overallScore)

    // Calculate summary statistics
    const summary = {
      totalSuppliers: suppliers.length,
      averageOnTimeDelivery: suppliers.length > 0
        ? suppliers.reduce((sum, s) => sum + s.onTimeDeliveryRate, 0) / suppliers.length
        : 0,
      averageReturnRate: suppliers.length > 0
        ? suppliers.reduce((sum, s) => sum + s.returnRate, 0) / suppliers.length
        : 0,
      averageQcPassRate: suppliers.length > 0
        ? suppliers.reduce((sum, s) => sum + s.qcPassRate, 0) / suppliers.length
        : 0
    }

    return NextResponse.json({
      data: {
        summary,
        suppliers
      }
    })
  } catch (error) {
    console.error('Supplier performance error:', error)
    return NextResponse.json(
      {
        error: 'Failed to generate supplier performance report',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
