import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { hasPermission, PERMISSIONS, getUserAccessibleLocationIds } from '@/lib/rbac'
import { sendTelegramPriceChangeAlert, sendTelegramBulkPriceChangeAlert } from '@/lib/telegram'

/**
 * POST /api/products/bulk-price-update
 * Bulk update prices for multiple products across locations
 */
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Permission check
    const canEditAll = hasPermission(session.user, PERMISSIONS.PRODUCT_PRICE_EDIT_ALL)
    const canEdit = hasPermission(session.user, PERMISSIONS.PRODUCT_PRICE_EDIT)

    if (!canEditAll && !canEdit) {
      return NextResponse.json({ error: 'Forbidden - Insufficient permissions' }, { status: 403 })
    }

    const businessId = Number(session.user.businessId)
    if (!Number.isInteger(businessId)) {
      return NextResponse.json({ error: 'Invalid business context' }, { status: 400 })
    }

    const body = await request.json()
    const { updates, applyToAllLocations } = body

    if (!Array.isArray(updates) || updates.length === 0) {
      return NextResponse.json({ error: 'Updates array is required and must not be empty' }, { status: 400 })
    }

    // Get accessible location IDs for this user
    const accessibleLocationIds = getUserAccessibleLocationIds(session.user)

    // Validate location access
    const locationIds = body.locationIds || []
    if (!canEditAll && accessibleLocationIds !== null) {
      // User has limited access - check if all requested locations are accessible
      const invalidLocations = locationIds.filter(
        (id: number) => !accessibleLocationIds.includes(id)
      )
      if (invalidLocations.length > 0) {
        return NextResponse.json(
          { error: `Access denied to locations: ${invalidLocations.join(', ')}` },
          { status: 403 }
        )
      }
    }

    const userId = Number(session.user.id)
    const now = new Date()
    const results: any[] = []
    const errors: any[] = []
    const priceChanges: Array<{
      productName: string
      productSku: string
      locationName: string
      oldPrice: number
      newPrice: number
    }> = []

    // Process each update
    for (const update of updates) {
      const { productVariationId, locationId, sellingPrice, pricePercentage } = update

      if (!productVariationId) {
        errors.push({ productVariationId, error: 'Product variation ID is required' })
        continue
      }

      // Check if user has access to this location
      if (!canEditAll && accessibleLocationIds !== null) {
        if (!accessibleLocationIds.includes(locationId)) {
          errors.push({ productVariationId, locationId, error: 'Access denied to this location' })
          continue
        }
      }

      try {
        // Verify product variation belongs to user's business and get product details
        const variation = await prisma.productVariation.findFirst({
          where: {
            id: productVariationId,
            product: { businessId },
          },
          select: {
            id: true,
            productId: true,
            product: {
              select: {
                name: true,
                sku: true,
              },
            },
          },
        })

        if (!variation) {
          errors.push({ productVariationId, error: 'Product variation not found or access denied' })
          continue
        }

        // Get location name
        const location = await prisma.businessLocation.findUnique({
          where: { id: locationId },
          select: { name: true },
        })

        // Get old price for Telegram notification
        const existingPrice = await prisma.variationLocationDetails.findUnique({
          where: {
            productVariationId_locationId: {
              productVariationId,
              locationId,
            },
          },
          select: {
            sellingPrice: true,
          },
        })

        const oldPrice = Number(existingPrice?.sellingPrice || 0)
        const newPrice = sellingPrice !== undefined ? Number(sellingPrice) : oldPrice

        // Update or create variation location details
        const locationDetails = await prisma.variationLocationDetails.upsert({
          where: {
            productVariationId_locationId: {
              productVariationId,
              locationId,
            },
          },
          update: {
            sellingPrice: sellingPrice !== undefined ? sellingPrice : undefined,
            pricePercentage: pricePercentage !== undefined ? pricePercentage : undefined,
            lastPriceUpdate: now,
            lastPriceUpdatedBy: userId,
          },
          create: {
            productId: variation.productId,
            productVariationId,
            locationId,
            qtyAvailable: 0,
            sellingPrice: sellingPrice || null,
            pricePercentage: pricePercentage || null,
            lastPriceUpdate: now,
            lastPriceUpdatedBy: userId,
          },
          select: {
            id: true,
            productVariationId: true,
            locationId: true,
            sellingPrice: true,
            pricePercentage: true,
          },
        })

        results.push(locationDetails)

        // Track price change for Telegram notification (only if price actually changed)
        if (sellingPrice !== undefined && oldPrice !== newPrice) {
          priceChanges.push({
            productName: variation.product.name,
            productSku: variation.product.sku || 'N/A',
            locationName: location?.name || 'Unknown Location',
            oldPrice,
            newPrice,
          })
        }
      } catch (error) {
        console.error(`Error updating price for variation ${productVariationId}:`, error)
        errors.push({
          productVariationId,
          locationId,
          error: error instanceof Error ? error.message : 'Unknown error',
        })
      }
    }

    // Send Telegram notifications for price changes
    if (priceChanges.length > 0) {
      try {
        const changedBy = session.user.name || session.user.username || 'Unknown User'

        // If more than 3 price changes, send bulk summary. Otherwise, send individual alerts
        if (priceChanges.length > 3) {
          await sendTelegramBulkPriceChangeAlert({
            changedBy,
            totalProducts: priceChanges.length,
            changeType: 'Bulk Price Update',
            timestamp: now,
            sampleChanges: priceChanges.slice(0, 5),
          })
        } else {
          // Send individual alerts for each price change
          for (const change of priceChanges) {
            await sendTelegramPriceChangeAlert({
              locationName: change.locationName,
              productName: change.productName,
              productSku: change.productSku,
              oldPrice: change.oldPrice,
              newPrice: change.newPrice,
              changedBy,
              changeType: 'Bulk Update',
              timestamp: now,
            })
          }
        }
      } catch (telegramError) {
        // Log but don't fail the request if Telegram fails
        console.error('Failed to send Telegram notification:', telegramError)
      }
    }

    return NextResponse.json({
      success: true,
      message: `Updated ${results.length} prices. ${errors.length} errors.`,
      data: {
        updated: results,
        errors,
        summary: {
          totalProcessed: updates.length,
          successCount: results.length,
          errorCount: errors.length,
        },
      },
    })
  } catch (error) {
    console.error('Bulk price update error:', error)
    return NextResponse.json(
      {
        error: 'Failed to update prices',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
