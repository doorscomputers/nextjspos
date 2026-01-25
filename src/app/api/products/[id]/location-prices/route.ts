import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth.simple'
import { PERMISSIONS } from '@/lib/rbac'
import {
  getProductLocationPrices,
  saveProductLocationPrices,
  LocationUnitPriceInput,
} from '@/lib/productLocationPricing'
import { sendTelegramLocationPriceChangeAlert, sendTelegramBulkLocationPriceChangeAlert } from '@/lib/telegram'
import { createAuditLog, AuditAction, EntityType, getIpAddress, getUserAgent } from '@/lib/auditLog'

/**
 * GET /api/products/[id]/location-prices
 * Get all location-specific unit prices for a product
 * Admins can see all locations, Managers only their assigned locations
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = session.user as any
    const businessId = Number(user.businessId)
    const { id } = await params
    const productId = parseInt(id)

    if (isNaN(productId)) {
      return NextResponse.json(
        { error: 'Invalid product ID' },
        { status: 400 }
      )
    }

    // Check permissions
    if (!user.permissions?.includes(PERMISSIONS.PRODUCT_VIEW)) {
      return NextResponse.json(
        { error: 'Forbidden - Insufficient permissions' },
        { status: 403 }
      )
    }

    // Get location IDs based on user role
    let locationIds: number[] | undefined

    // Super Admin and Admin can see all locations
    const isSuperAdmin = user.roles?.includes('Super Admin')
    const isAdmin = user.roles?.includes('Admin')

    if (!isSuperAdmin && !isAdmin) {
      // Manager: Only show assigned locations
      const { prisma } = await import('@/lib/prisma')
      const userLocations = await prisma.userLocation.findMany({
        where: {
          userId: user.id,
        },
        select: {
          locationId: true,
        },
      })

      locationIds = userLocations.map(ul => ul.locationId)

      if (locationIds.length === 0) {
        return NextResponse.json({
          success: true,
          prices: [],
          message: 'No locations assigned to user',
        })
      }
    }

    // Get location prices
    const prices = await getProductLocationPrices(
      productId,
      businessId,
      locationIds
    )

    // Serialize Decimal to string
    const serializedPrices = prices.map(p => ({
      ...p,
      purchasePrice: p.purchasePrice.toString(),
      sellingPrice: p.sellingPrice.toString(),
      multiplier: p.multiplier.toString(),
    }))

    return NextResponse.json({
      success: true,
      prices: serializedPrices,
    })
  } catch (error) {
    console.error('Error fetching location prices:', error)
    return NextResponse.json(
      { error: 'Failed to fetch location prices' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/products/[id]/location-prices
 * Save location-specific unit prices for a product
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = session.user as any
    const businessId = Number(user.businessId)

    // Check permissions - need PRODUCT_UPDATE or PRODUCT_PRICE_EDIT
    const canUpdate =
      user.permissions?.includes(PERMISSIONS.PRODUCT_UPDATE) ||
      user.permissions?.includes(PERMISSIONS.PRODUCT_PRICE_EDIT)

    if (!canUpdate) {
      return NextResponse.json(
        { error: 'Forbidden - Insufficient permissions' },
        { status: 403 }
      )
    }

    const { id } = await params
    const productId = parseInt(id)

    if (isNaN(productId)) {
      return NextResponse.json(
        { error: 'Invalid product ID' },
        { status: 400 }
      )
    }

    const body = await request.json()
    const { prices } = body as { prices: LocationUnitPriceInput[] }

    if (!Array.isArray(prices)) {
      return NextResponse.json(
        { error: 'Invalid prices data' },
        { status: 400 }
      )
    }

    // Validate user can edit these locations
    const isSuperAdmin = user.roles?.includes('Super Admin')
    const isAdmin = user.roles?.includes('Admin')

    if (!isSuperAdmin && !isAdmin) {
      // Manager: Validate all location IDs are assigned to user
      const { prisma } = await import('@/lib/prisma')
      const userLocations = await prisma.userLocation.findMany({
        where: {
          userId: user.id,
        },
        select: {
          locationId: true,
        },
      })

      const assignedLocationIds = userLocations.map(ul => ul.locationId)
      const requestedLocationIds = [...new Set(prices.map(p => p.locationId))]

      const unauthorizedLocations = requestedLocationIds.filter(
        locId => !assignedLocationIds.includes(locId)
      )

      if (unauthorizedLocations.length > 0) {
        return NextResponse.json(
          {
            error: `Forbidden - You are not assigned to location IDs: ${unauthorizedLocations.join(', ')}`,
          },
          { status: 403 }
        )
      }
    }

    // Validate product exists and get full details for audit
    const { prisma } = await import('@/lib/prisma')
    const product = await prisma.product.findUnique({
      where: { id: productId, businessId },
      include: {
        category: { select: { name: true } },
        brand: { select: { name: true } },
      },
    })

    if (!product) {
      return NextResponse.json(
        { error: 'Product not found' },
        { status: 404 }
      )
    }

    // Get old prices for comparison (for Telegram notifications)
    const oldPrices = await getProductLocationPrices(productId, businessId)
    const oldPricesMap = new Map(
      oldPrices.map(p => [`${p.locationId}-${p.unitId}`, p])
    )

    // Save location prices
    await saveProductLocationPrices(productId, businessId, prices, user.id)

    // Fetch updated prices
    const locationIds = isSuperAdmin || isAdmin
      ? undefined
      : (await prisma.userLocation.findMany({
          where: { userId: user.id },
          select: { locationId: true },
        })).map(ul => ul.locationId)

    const updatedPrices = await getProductLocationPrices(
      productId,
      businessId,
      locationIds
    )

    // Serialize
    const serializedPrices = updatedPrices.map(p => ({
      ...p,
      purchasePrice: p.purchasePrice.toString(),
      sellingPrice: p.sellingPrice.toString(),
      multiplier: p.multiplier.toString(),
    }))

    // Track price changes for audit log and Telegram notifications
    const changedLocations = new Set<string>()
    let changeCount = 0
    const priceChanges: Array<{
      locationName: string
      locationId: number
      oldPurchasePrice: number
      newPurchasePrice: number
      oldSellingPrice: number
      newSellingPrice: number
      purchasePriceChanged: boolean
      sellingPriceChanged: boolean
    }> = []

    prices.forEach((newPrice) => {
      const key = `${newPrice.locationId}-${newPrice.unitId}`
      const oldPrice = oldPricesMap.get(key)

      if (oldPrice) {
        const purchasePriceChanged = parseFloat(oldPrice.purchasePrice.toString()) !== newPrice.purchasePrice
        const sellingPriceChanged = parseFloat(oldPrice.sellingPrice.toString()) !== newPrice.sellingPrice

        if (purchasePriceChanged || sellingPriceChanged) {
          changeCount++

          // Get location name from updatedPrices
          const updatedPrice = updatedPrices.find(p => p.locationId === newPrice.locationId && p.unitId === newPrice.unitId)
          if (updatedPrice) {
            changedLocations.add(updatedPrice.locationName)

            // Track for audit log
            priceChanges.push({
              locationName: updatedPrice.locationName,
              locationId: newPrice.locationId,
              oldPurchasePrice: parseFloat(oldPrice.purchasePrice.toString()),
              newPurchasePrice: newPrice.purchasePrice,
              oldSellingPrice: parseFloat(oldPrice.sellingPrice.toString()),
              newSellingPrice: newPrice.sellingPrice,
              purchasePriceChanged,
              sellingPriceChanged,
            })

            // Send individual notification for significant changes
            if (purchasePriceChanged && sellingPriceChanged) {
              sendTelegramLocationPriceChangeAlert({
                productName: product.name,
                productSku: product.sku,
                locationName: updatedPrice.locationName,
                priceType: 'both',
                oldPurchasePrice: parseFloat(oldPrice.purchasePrice.toString()),
                newPurchasePrice: newPrice.purchasePrice,
                oldSellingPrice: parseFloat(oldPrice.sellingPrice.toString()),
                newSellingPrice: newPrice.sellingPrice,
                changedBy: user.username,
                timestamp: new Date(),
              }).catch((error) => {
                console.error('[Telegram] Failed to send price change alert:', error)
              })
            } else if (purchasePriceChanged) {
              sendTelegramLocationPriceChangeAlert({
                productName: product.name,
                productSku: product.sku,
                locationName: updatedPrice.locationName,
                priceType: 'purchase',
                oldPurchasePrice: parseFloat(oldPrice.purchasePrice.toString()),
                newPurchasePrice: newPrice.purchasePrice,
                changedBy: user.username,
                timestamp: new Date(),
              }).catch((error) => {
                console.error('[Telegram] Failed to send price change alert:', error)
              })
            } else if (sellingPriceChanged) {
              sendTelegramLocationPriceChangeAlert({
                productName: product.name,
                productSku: product.sku,
                locationName: updatedPrice.locationName,
                priceType: 'selling',
                oldSellingPrice: parseFloat(oldPrice.sellingPrice.toString()),
                newSellingPrice: newPrice.sellingPrice,
                changedBy: user.username,
                timestamp: new Date(),
              }).catch((error) => {
                console.error('[Telegram] Failed to send price change alert:', error)
              })
            }
          }
        }
      }
    })

    // Send bulk notification if multiple locations changed
    if (changeCount > 3) {
      sendTelegramBulkLocationPriceChangeAlert({
        changedBy: user.username,
        totalChanges: changeCount,
        locations: Array.from(changedLocations),
        productName: product.name,
        timestamp: new Date(),
      }).catch((error) => {
        console.error('[Telegram] Failed to send bulk price change alert:', error)
      })
    }

    // Create audit log for price changes
    if (priceChanges.length > 0) {
      // Build description with details of changes
      const changesSummary = priceChanges.map(c => {
        const parts = []
        if (c.sellingPriceChanged) {
          parts.push(`Selling: ₱${c.oldSellingPrice.toLocaleString()} → ₱${c.newSellingPrice.toLocaleString()}`)
        }
        if (c.purchasePriceChanged) {
          parts.push(`Cost: ₱${c.oldPurchasePrice.toLocaleString()} → ₱${c.newPurchasePrice.toLocaleString()}`)
        }
        return `${c.locationName}: ${parts.join(', ')}`
      }).join('; ')

      const description = `Price changed for "${product.name}" (SKU: ${product.sku}) - ${changesSummary}`

      await createAuditLog({
        businessId,
        userId: user.id,
        username: user.username,
        action: AuditAction.PRICE_CHANGE,
        entityType: EntityType.PRODUCT,
        entityIds: [productId],
        description: description.substring(0, 500), // Limit description length
        metadata: {
          sku: product.sku,
          productName: product.name,
          categoryName: product.category?.name || null,
          brandName: product.brand?.name || null,
          totalChanges: priceChanges.length,
          changes: priceChanges.map(c => ({
            location: c.locationName,
            locationId: c.locationId,
            oldSellingPrice: c.oldSellingPrice,
            newSellingPrice: c.newSellingPrice,
            oldPurchasePrice: c.oldPurchasePrice,
            newPurchasePrice: c.newPurchasePrice,
            sellingPriceChanged: c.sellingPriceChanged,
            purchasePriceChanged: c.purchasePriceChanged,
          })),
        },
        ipAddress: getIpAddress(request),
        userAgent: getUserAgent(request),
      })
    }

    return NextResponse.json({
      success: true,
      message: 'Location prices saved successfully',
      prices: serializedPrices,
    })
  } catch (error: any) {
    console.error('Error saving location prices:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to save location prices' },
      { status: 500 }
    )
  }
}
