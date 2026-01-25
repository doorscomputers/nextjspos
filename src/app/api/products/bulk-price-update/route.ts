import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth.simple'
import { prisma } from '@/lib/prisma.simple'
import { hasPermission, PERMISSIONS, getUserAccessibleLocationIds } from '@/lib/rbac'
import { sendTelegramPriceChangeAlert, sendTelegramBulkPriceChangeAlert } from '@/lib/telegram'

/**
 * POST /api/products/bulk-price-update
 * Bulk update prices for multiple products across locations
 */
export async function POST(request: Request) {
  try {
    console.log('🚀 Bulk price update API called')

    const session = await getServerSession(authOptions)
    if (!session?.user) {
      console.log('❌ Unauthorized - no session')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Permission check
    const canEditAll = hasPermission(session.user, PERMISSIONS.PRODUCT_PRICE_EDIT_ALL)
    const canEdit = hasPermission(session.user, PERMISSIONS.PRODUCT_PRICE_EDIT)
    const canMultiLocation = hasPermission(session.user, PERMISSIONS.PRODUCT_PRICE_MULTI_LOCATION_UPDATE)

    if (!canEditAll && !canEdit) {
      return NextResponse.json({ error: 'Forbidden - Insufficient permissions' }, { status: 403 })
    }

    const businessId = parseInt(session.user.businessId)
    if (!Number.isInteger(businessId)) {
      return NextResponse.json({ error: 'Invalid business context' }, { status: 400 })
    }

    const body = await request.json()
    console.log('📦 Request body:', body)

    const { updates, applyToAllLocations } = body
    console.log('🔍 Extracted updates:', updates)

    if (!Array.isArray(updates) || updates.length === 0) {
      console.log('❌ Invalid updates array')
      return NextResponse.json({ error: 'Updates array is required and must not be empty' }, { status: 400 })
    }

    // Get accessible location IDs for this user
    const accessibleLocationIds = getUserAccessibleLocationIds(session.user)

    const requestedLocationIds = new Set<number>()
    let replicationRequested = false

    for (const update of updates) {
      if (update && update.locationId !== undefined && update.locationId !== null) {
        const baseId = Number(update.locationId)
        if (!Number.isNaN(baseId)) {
          requestedLocationIds.add(baseId)
        }
      }

      if (Array.isArray(update?.targetLocationIds) && update.targetLocationIds.length > 0) {
        replicationRequested = true
        for (const locId of update.targetLocationIds) {
          const numericId = Number(locId)
          if (!Number.isNaN(numericId)) {
            requestedLocationIds.add(numericId)
          }
        }
      }
    }

    if (replicationRequested && !canMultiLocation && !canEditAll) {
      return NextResponse.json(
        { error: 'Forbidden - Multi-location pricing permission required' },
        { status: 403 }
      )
    }

    // Validate location access
    if (!canEditAll && accessibleLocationIds !== null) {
      const invalidLocations: number[] = []
      for (const locId of requestedLocationIds) {
        if (!accessibleLocationIds.includes(locId)) {
          invalidLocations.push(locId)
        }
      }
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
    console.log(`🔄 Processing ${updates.length} updates...`)

    for (const [index, update] of updates.entries()) {
      console.log(`📝 Processing update ${index + 1}:`, update)

      const {
        productVariationId,
        locationId: rawLocationId,
        sellingPrice,
        pricePercentage,
        targetLocationIds,
      } = update

      if (!productVariationId) {
        errors.push({ productVariationId, error: 'Product variation ID is required' })
        continue
      }

      if (rawLocationId === undefined || rawLocationId === null) {
        errors.push({ productVariationId, error: 'Location ID is required' })
        continue
      }

      const baseLocationId = Number(rawLocationId)
      const replicationTargets = Array.isArray(targetLocationIds) && targetLocationIds.length > 0
        ? Array.from(
            new Set(
              targetLocationIds
                .map((id: number) => Number(id))
                .filter(id => !Number.isNaN(id) && id !== baseLocationId)
            )
          )
        : []

      if (replicationTargets.length > 0 && !canMultiLocation && !canEditAll) {
        errors.push({
          productVariationId,
          locationId: baseLocationId,
          error: 'Multi-location pricing permission required',
        })
        continue
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

        const locationsToUpdate = [baseLocationId, ...replicationTargets]

        for (const locationId of locationsToUpdate) {
          if (!canEditAll && accessibleLocationIds !== null) {
            if (!accessibleLocationIds.includes(locationId)) {
              errors.push({ productVariationId, locationId, error: 'Access denied to this location' })
              continue
            }
          }

          const location = await prisma.businessLocation.findUnique({
            where: { id: locationId },
            select: { name: true },
          })

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

          // SYNC TO POS PRICING TABLE
          // This ensures POS cart shows the updated price (fixes price mismatch issue)
          if (sellingPrice !== undefined) {
            await prisma.productUnitLocationPrice.updateMany({
              where: {
                productId: variation.productId,
                locationId: locationId,
              },
              data: {
                sellingPrice: sellingPrice,
                lastUpdatedBy: userId,
              }
            })
          }

          if (sellingPrice !== undefined && oldPrice !== newPrice) {
            priceChanges.push({
              productName: variation.product.name,
              productSku: variation.product.sku || 'N/A',
              locationName: location?.name || 'Unknown Location',
              oldPrice,
              newPrice,
            })

            // Log price change to audit history
            await prisma.priceChangeHistory.create({
              data: {
                businessId,
                productVariationId,
                locationId,
                oldPrice: oldPrice || null,
                newPrice,
                changedBy: userId,
                changeSource: 'bulk_update',
                sku: variation.product.sku || null,
                productName: variation.product.name,
              },
            })
          }
        }

        // Also update the base variation price to keep it in sync
        // This ensures reports using product_variations.selling_price show correct values
        if (sellingPrice !== undefined) {
          await prisma.productVariation.update({
            where: { id: productVariationId },
            data: { sellingPrice: sellingPrice },
          })
          console.log(`✅ Also updated base variation price for ${variation.product.name} to ${sellingPrice}`)
        }
      } catch (error) {
        console.error(`Error updating price for variation ${productVariationId}:`, error)
        errors.push({
          productVariationId,
          locationId: rawLocationId,
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
