import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth.simple'
import { prisma } from '@/lib/prisma'
import { hasPermission, PERMISSIONS } from '@/lib/rbac'

/**
 * GET /api/settings/pricing
 * Fetch pricing settings for current business
 */
export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Permission check
    if (!hasPermission(session.user, PERMISSIONS.PRICING_SETTINGS_VIEW)) {
      return NextResponse.json({ error: 'Forbidden - Insufficient permissions' }, { status: 403 })
    }

    const businessId = parseInt(session.user.businessId)
    if (!Number.isInteger(businessId)) {
      return NextResponse.json({ error: 'Invalid business context' }, { status: 400 })
    }

    // Fetch business pricing settings
    const business = await prisma.business.findUnique({
      where: { id: businessId },
      select: {
        id: true,
        name: true,
        pricingStrategy: true,
        bulkPriceSync: true,
        priceRoundingRule: true,
        telegramBotToken: true,
        telegramChatId: true,
        enablePricingAlerts: true,
        belowCostThreshold: true,
        belowRetailThreshold: true,
      },
    })

    if (!business) {
      return NextResponse.json({ error: 'Business not found' }, { status: 404 })
    }

    return NextResponse.json({
      success: true,
      data: business,
    })
  } catch (error) {
    console.error('Fetch pricing settings error:', error)
    return NextResponse.json(
      {
        error: 'Failed to fetch pricing settings',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

/**
 * PUT /api/settings/pricing
 * Update pricing settings for current business
 */
export async function PUT(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Permission check
    if (!hasPermission(session.user, PERMISSIONS.PRICING_SETTINGS_EDIT)) {
      return NextResponse.json({ error: 'Forbidden - Insufficient permissions' }, { status: 403 })
    }

    const businessId = parseInt(session.user.businessId)
    if (!Number.isInteger(businessId)) {
      return NextResponse.json({ error: 'Invalid business context' }, { status: 400 })
    }

    const body = await request.json()

    // Validate pricing strategy
    const validStrategies = ['fallback', 'required', 'percentage']
    if (body.pricingStrategy && !validStrategies.includes(body.pricingStrategy)) {
      return NextResponse.json(
        { error: 'Invalid pricing strategy. Must be: fallback, required, or percentage' },
        { status: 400 }
      )
    }

    // Validate rounding rule
    const validRoundingRules = ['none', 'round_up', 'round_down', 'nearest']
    if (body.priceRoundingRule && !validRoundingRules.includes(body.priceRoundingRule)) {
      return NextResponse.json(
        { error: 'Invalid rounding rule. Must be: none, round_up, round_down, or nearest' },
        { status: 400 }
      )
    }

    // Build update data
    const updateData: any = {}

    if (body.pricingStrategy !== undefined) updateData.pricingStrategy = body.pricingStrategy
    if (body.bulkPriceSync !== undefined) updateData.bulkPriceSync = Boolean(body.bulkPriceSync)
    if (body.priceRoundingRule !== undefined) updateData.priceRoundingRule = body.priceRoundingRule
    if (body.telegramBotToken !== undefined) updateData.telegramBotToken = body.telegramBotToken || null
    if (body.telegramChatId !== undefined) updateData.telegramChatId = body.telegramChatId || null
    if (body.enablePricingAlerts !== undefined) updateData.enablePricingAlerts = Boolean(body.enablePricingAlerts)

    if (body.belowCostThreshold !== undefined) {
      const threshold = Number(body.belowCostThreshold)
      if (isNaN(threshold) || threshold < 0 || threshold > 100) {
        return NextResponse.json(
          { error: 'Below cost threshold must be between 0 and 100' },
          { status: 400 }
        )
      }
      updateData.belowCostThreshold = threshold
    }

    if (body.belowRetailThreshold !== undefined) {
      const threshold = Number(body.belowRetailThreshold)
      if (isNaN(threshold) || threshold < 0 || threshold > 100) {
        return NextResponse.json(
          { error: 'Below retail threshold must be between 0 and 100' },
          { status: 400 }
        )
      }
      updateData.belowRetailThreshold = threshold
    }

    // Update business settings
    const updatedBusiness = await prisma.business.update({
      where: { id: businessId },
      data: updateData,
      select: {
        id: true,
        name: true,
        pricingStrategy: true,
        bulkPriceSync: true,
        priceRoundingRule: true,
        telegramBotToken: true,
        telegramChatId: true,
        enablePricingAlerts: true,
        belowCostThreshold: true,
        belowRetailThreshold: true,
      },
    })

    return NextResponse.json({
      success: true,
      message: 'Pricing settings updated successfully',
      data: updatedBusiness,
    })
  } catch (error) {
    console.error('Update pricing settings error:', error)
    return NextResponse.json(
      {
        error: 'Failed to update pricing settings',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
