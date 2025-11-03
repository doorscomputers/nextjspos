import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import {
  getInventoryValuationTrend,
  getCurrentPeriodValuation,
  PeriodType
} from '@/lib/historicalInventoryValuation'
import { ValuationMethod } from '@/lib/inventoryValuation'

/**
 * GET /api/reports/inventory-valuation-history
 * Get historical inventory valuation trend
 *
 * Query params:
 * - year: Year to analyze (required)
 * - periodType: monthly | quarterly | yearly (required)
 * - locationId: Location ID (optional, null = all locations)
 * - method: fifo | lifo | avco (optional, default: avco)
 * - includeCurrent: true | false (optional, include current period)
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session || !session.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const businessId = parseInt(session.user.businessId)

    // Parse query parameters
    const searchParams = request.nextUrl.searchParams
    const yearParam = searchParams.get('year')
    const periodTypeParam = searchParams.get('periodType')
    const locationIdParam = searchParams.get('locationId')
    const methodParam = searchParams.get('method') || 'avco'
    const includeCurrentParam = searchParams.get('includeCurrent') === 'true'

    // Validate required parameters
    if (!yearParam || !periodTypeParam) {
      return NextResponse.json(
        { error: 'Missing required parameters: year and periodType' },
        { status: 400 }
      )
    }

    const year = parseInt(yearParam)
    if (isNaN(year) || year < 2000 || year > 2100) {
      return NextResponse.json(
        { error: 'Invalid year parameter' },
        { status: 400 }
      )
    }

    // Validate period type
    const validPeriodTypes = ['monthly', 'quarterly', 'yearly']
    if (!validPeriodTypes.includes(periodTypeParam)) {
      return NextResponse.json(
        { error: 'Invalid periodType. Must be: monthly, quarterly, or yearly' },
        { status: 400 }
      )
    }

    const periodType = periodTypeParam as PeriodType

    // Validate valuation method
    const validMethods = ['fifo', 'lifo', 'avco']
    if (!validMethods.includes(methodParam)) {
      return NextResponse.json(
        { error: 'Invalid method. Must be: fifo, lifo, or avco' },
        { status: 400 }
      )
    }

    const method = methodParam as ValuationMethod

    // Parse location ID
    const locationId = locationIdParam ? parseInt(locationIdParam) : undefined
    if (locationIdParam && isNaN(locationId as number)) {
      return NextResponse.json(
        { error: 'Invalid locationId parameter' },
        { status: 400 }
      )
    }

    console.log('📊 Historical Valuation Request:', {
      businessId,
      year,
      periodType,
      locationId,
      method,
      includeCurrent: includeCurrentParam
    })

    // Get historical trend data
    const trendData = await getInventoryValuationTrend(
      businessId,
      year,
      periodType,
      locationId,
      method
    )

    // Include current period if requested
    let currentPeriod = null
    if (includeCurrentParam) {
      currentPeriod = await getCurrentPeriodValuation(
        businessId,
        locationId,
        method
      )
    }

    return NextResponse.json({
      success: true,
      data: {
        trend: trendData,
        current: currentPeriod,
        filters: {
          year,
          periodType,
          locationId: locationId || null,
          method
        }
      }
    })

  } catch (error) {
    console.error('❌ Error fetching historical inventory valuation:', error)
    return NextResponse.json(
      {
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
