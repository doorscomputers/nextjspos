import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth.simple'
import { prisma } from '@/lib/prisma'

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { productIds, settings } = body

    if (!productIds || !Array.isArray(productIds) || productIds.length === 0) {
      return NextResponse.json(
        { error: 'Product IDs are required' },
        { status: 400 }
      )
    }

    if (!settings) {
      return NextResponse.json(
        { error: 'Reorder settings are required' },
        { status: 400 }
      )
    }

    const businessId = parseInt(session.user.businessId)

    // Build update data based on provided settings
    const updateData: any = {}

    if (settings.enableAutoReorder !== undefined) {
      updateData.enableAutoReorder = settings.enableAutoReorder
    }

    if (settings.reorderPoint !== undefined && settings.reorderPoint !== '') {
      updateData.reorderPoint = parseFloat(settings.reorderPoint)
    }

    if (settings.reorderQuantity !== undefined && settings.reorderQuantity !== '') {
      updateData.reorderQuantity = parseFloat(settings.reorderQuantity)
    }

    if (settings.leadTimeDays !== undefined && settings.leadTimeDays !== '') {
      updateData.leadTimeDays = parseInt(settings.leadTimeDays)
    }

    if (settings.safetyStockDays !== undefined && settings.safetyStockDays !== '') {
      updateData.safetyStockDays = parseInt(settings.safetyStockDays)
    }

    // Update all selected products
    const result = await prisma.product.updateMany({
      where: {
        id: { in: productIds.map((id: string | number) => parseInt(id.toString())) },
        businessId,
      },
      data: updateData,
    })

    return NextResponse.json({
      success: true,
      data: {
        updatedCount: result.count,
        message: `Successfully updated ${result.count} product(s)`,
      },
    })
  } catch (error) {
    console.error('Bulk update reorder settings error:', error)
    return NextResponse.json(
      {
        error: 'Failed to update reorder settings',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
