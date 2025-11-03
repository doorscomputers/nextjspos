import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth.simple'
import { prisma } from '@/lib/prisma.simple'
import { PERMISSIONS, isSuperAdmin } from '@/lib/rbac'
import { createAuditLog, AuditAction, EntityType, getIpAddress, getUserAgent } from '@/lib/auditLog'
import { getManilaDate } from '@/lib/timezone'
import { sendTelegramStockTransferAlert } from '@/lib/telegram'

// GET - List all stock transfers
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = session.user as any
    const businessId = parseInt(String(user.businessId))
    const userId = user.id

    // Check permission
    if (!user.permissions?.includes(PERMISSIONS.STOCK_TRANSFER_VIEW)) {
      return NextResponse.json(
        { error: 'Forbidden - Insufficient permissions' },
        { status: 403 }
      )
    }

    // Get query parameters for filtering
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const fromLocationId = searchParams.get('fromLocationId')
    const toLocationId = searchParams.get('toLocationId')
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const includeDetails = searchParams.get('includeDetails') === 'true'
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = (page - 1) * limit

    const where: any = {
      businessId: parseInt(businessId),
      deletedAt: null,
    }

    if (status) {
      where.status = status
    }

    if (fromLocationId) {
      where.fromLocationId = parseInt(fromLocationId)
    }

    if (toLocationId) {
      where.toLocationId = parseInt(toLocationId)
    }

    if (startDate || endDate) {
      where.transferDate = {}
      if (startDate) where.transferDate.gte = new Date(startDate)
      if (endDate) where.transferDate.lte = new Date(endDate)
    }

    const hasAccessAllLocations = user.permissions?.includes(PERMISSIONS.ACCESS_ALL_LOCATIONS)
    const isAdmin = isSuperAdmin(user)

    console.log('🔍 Transfer Filter Debug:')
    console.log('  User ID:', userId)
    console.log('  Username:', user.username)
    console.log('  Has ACCESS_ALL_LOCATIONS:', hasAccessAllLocations)
    console.log('  Is Super Admin:', isAdmin)

    // Fetch user's assigned locations
    const userLocations = await prisma.userLocation.findMany({
      where: { userId: parseInt(userId) },
      select: { locationId: true },
    })
    const locationIds = userLocations.map(ul => ul.locationId)

    console.log('  User assigned location IDs:', locationIds)

    // ALWAYS filter by user's assigned locations unless they're a Super Admin
    // Even if they have ACCESS_ALL_LOCATIONS, they should only see transfers from/to their assigned locations
    if (!isAdmin) {
      // Only show transfers where user has access to EITHER the source OR destination location
      if (locationIds.length > 0) {
        where.OR = [
          { fromLocationId: { in: locationIds } },
          { toLocationId: { in: locationIds } },
        ]
        console.log('  ✅ Applying location filter:', locationIds)
      } else {
        // User has no location assignments - return empty result
        where.id = -1 // Impossible ID to match nothing
        console.log('  ⚠️ No location assignments - returning empty result')
      }
    } else {
      console.log('  🌍 Super Admin - showing all transfers')
    }

    // Build include object dynamically
    const includeObject: any = {
      items: {
        include: {
          product: {
            select: {
              name: true,
              sku: true,
            },
          },
          productVariation: {
            select: {
              name: true,
              sku: true,
            },
          },
        },
      },
      fromLocation: {
        select: {
          name: true,
        },
      },
      toLocation: {
        select: {
          name: true,
        },
      },
    }

    // If includeDetails is true, add user relationships
    if (includeDetails) {
      includeObject.creator = {
        select: { username: true },
      }
      includeObject.checker = {
        select: { username: true },
      }
      includeObject.sender = {
        select: { username: true },
      }
      includeObject.arrivalMarker = {
        select: { username: true },
      }
      includeObject.verifier = {
        select: { username: true },
      }
      includeObject.completer = {
        select: { username: true },
      }
    }

    const [transfers, total] = await Promise.all([
      prisma.stockTransfer.findMany({
        where,
        include: includeObject,
        orderBy: {
          createdAt: 'desc',
        },
        skip: offset,
        take: limit,
      }),
      prisma.stockTransfer.count({ where }),
    ])

    return NextResponse.json(transfers)
  } catch (error) {
    console.error('Error fetching stock transfers:', error)
    return NextResponse.json(
      { error: 'Failed to fetch stock transfers' },
      { status: 500 }
    )
  }
}

// POST - Create new stock transfer (initiates transfer)
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = session.user as any
    const businessId = parseInt(String(user.businessId))
    const userId = user.id

    // Check permission
    if (!user.permissions?.includes(PERMISSIONS.STOCK_TRANSFER_CREATE)) {
      return NextResponse.json(
        { error: 'Forbidden - Insufficient permissions' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const {
      fromLocationId,
      toLocationId,
      items, // Array of { productId, productVariationId, quantity, serialNumberIds?: [] }
      notes,
    } = body

    // Validation
    if (!fromLocationId || !toLocationId || !items || items.length === 0) {
      return NextResponse.json(
        { error: 'Missing required fields: fromLocationId, toLocationId, items' },
        { status: 400 }
      )
    }

    if (fromLocationId === toLocationId) {
      return NextResponse.json(
        { error: 'Source and destination locations cannot be the same' },
        { status: 400 }
      )
    }

    // Verify both locations belong to business
    const [fromLocation, toLocation] = await Promise.all([
      prisma.businessLocation.findFirst({
        where: {
          id: parseInt(fromLocationId),
          businessId: parseInt(businessId),
          deletedAt: null,
        },
      }),
      prisma.businessLocation.findFirst({
        where: {
          id: parseInt(toLocationId),
          businessId: parseInt(businessId),
          deletedAt: null,
        },
      }),
    ])

    if (!fromLocation) {
      return NextResponse.json(
        { error: 'Source location not found or does not belong to your business' },
        { status: 404 }
      )
    }

    if (!toLocation) {
      return NextResponse.json(
        { error: 'Destination location not found or does not belong to your business' },
        { status: 404 }
      )
    }

    // CRITICAL: Enforce that fromLocationId must be one of user's assigned locations
    // This prevents users from transferring from locations they don't have access to
    const hasAccessAllLocations = user.permissions?.includes(PERMISSIONS.ACCESS_ALL_LOCATIONS)

    if (!hasAccessAllLocations) {
      // Fetch user's assigned locations
      const userLocations = await prisma.userLocation.findMany({
        where: {
          userId: parseInt(userId),
        },
        select: {
          locationId: true,
        },
      })

      const userLocationIds = userLocations.map(ul => ul.locationId)

      // Verify that fromLocationId is in user's assigned locations
      if (!userLocationIds.includes(parseInt(fromLocationId))) {
        return NextResponse.json(
          {
            error: 'Invalid source location. You can only create transfers from your assigned business location(s).',
            userLocationIds,
            requestedFromLocationId: parseInt(fromLocationId),
          },
          { status: 403 }
        )
      }
    }

    // Validate items and check stock availability at source
    for (const item of items) {
      const quantity = parseFloat(item.quantity)

      if (isNaN(quantity) || quantity <= 0) {
        return NextResponse.json(
          { error: `Invalid quantity for item: ${item.productId}` },
          { status: 400 }
        )
      }

      // Check stock availability at source location
      const stock = await prisma.variationLocationDetails.findUnique({
        where: {
          productVariationId_locationId: {
            productVariationId: parseInt(item.productVariationId),
            locationId: parseInt(fromLocationId),
          },
        },
      })

      if (!stock || parseFloat(stock.qtyAvailable.toString()) < quantity) {
        const availableQty = stock ? parseFloat(stock.qtyAvailable.toString()) : 0
        return NextResponse.json(
          {
            error: `Insufficient stock at source location for item ${item.productId}. Available: ${availableQty}, Required: ${quantity}`,
          },
          { status: 400 }
        )
      }

      // If serial numbers provided, validate them
      if (item.serialNumberIds && item.serialNumberIds.length > 0) {
        if (item.serialNumberIds.length !== quantity) {
          return NextResponse.json(
            {
              error: `Serial number count mismatch for item ${item.productId}. Expected: ${quantity}, Provided: ${item.serialNumberIds.length}`,
            },
            { status: 400 }
          )
        }

        // Verify serial numbers exist and are at source location
        for (const serialNumberId of item.serialNumberIds) {
          const serialNumber = await prisma.productSerialNumber.findFirst({
            where: {
              id: parseInt(serialNumberId),
              businessId: parseInt(businessId),
              productVariationId: parseInt(item.productVariationId),
              currentLocationId: parseInt(fromLocationId),
              status: 'in_stock',
            },
          })

          if (!serialNumber) {
            return NextResponse.json(
              { error: `Serial number ${serialNumberId} not available at source location` },
              { status: 400 }
            )
          }
        }
      }
    }

    // Generate transfer number
    const currentYear = new Date().getFullYear()
    const currentMonth = String(new Date().getMonth() + 1).padStart(2, '0')
    const lastTransfer = await prisma.stockTransfer.findFirst({
      where: {
        businessId: parseInt(businessId),
        transferNumber: {
          startsWith: `TR-${currentYear}${currentMonth}`,
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    })

    let transferNumber
    if (lastTransfer) {
      const lastNumber = parseInt(lastTransfer.transferNumber.split('-').pop() || '0')
      transferNumber = `TR-${currentYear}${currentMonth}-${String(lastNumber + 1).padStart(4, '0')}`
    } else {
      transferNumber = `TR-${currentYear}${currentMonth}-0001`
    }

    // Create transfer (status: pending - awaiting send)
    const transfer = await prisma.$transaction(async (tx) => {
      // Create stock transfer
      const newTransfer = await tx.stockTransfer.create({
        data: {
          businessId: parseInt(businessId),
          fromLocationId: parseInt(fromLocationId),
          toLocationId: parseInt(toLocationId),
          transferNumber,
          transferDate: getManilaDate(), // MANILA TIMEZONE (UTC+8) - prevents backdating fraud
          status: 'draft', // Step 1: Initial draft status
          stockDeducted: false, // CRITICAL: Stock NOT deducted yet
          notes,
          createdBy: parseInt(userId),
        },
      })

      // Create transfer items
      for (const item of items) {
        await tx.stockTransferItem.create({
          data: {
            stockTransferId: newTransfer.id,
            productId: parseInt(item.productId),
            productVariationId: parseInt(item.productVariationId),
            quantity: parseFloat(item.quantity),
            receivedQuantity: 0, // Not received yet
          },
        })

        // If serial numbers provided, link them (but don't change status yet)
        if (item.serialNumberIds && item.serialNumberIds.length > 0) {
          for (const serialNumberId of item.serialNumberIds) {
            await tx.transferItemSerialNumber.create({
              data: {
                stockTransferId: newTransfer.id,
                serialNumberId: parseInt(serialNumberId),
              },
            })
          }
        }
      }

      return newTransfer
    })

    // Create audit log
    await createAuditLog({
      businessId: parseInt(businessId),
      userId: parseInt(userId),
      username: user.username,
      action: 'transfer_create' as AuditAction,
      entityType: EntityType.STOCK_TRANSFER,
      entityIds: [transfer.id],
      description: `Created Stock Transfer ${transferNumber} from ${fromLocation.name} to ${toLocation.name}`,
      metadata: {
        transferId: transfer.id,
        transferNumber,
        fromLocationId: parseInt(fromLocationId),
        fromLocationName: fromLocation.name,
        toLocationId: parseInt(toLocationId),
        toLocationName: toLocation.name,
        itemCount: items.length,
        status: 'draft',
      },
      ipAddress: getIpAddress(request),
      userAgent: getUserAgent(request),
    })

    // Fetch complete transfer with relations
    const completeTransfer = await prisma.stockTransfer.findUnique({
      where: { id: transfer.id },
      include: {
        items: {
          include: {
            product: { select: { name: true } },
            productVariation: { select: { name: true } }
          }
        },
      },
    })

    // Send Telegram notification for transfer creation
    try {
      const userDisplayName = [user.firstName, user.lastName].filter(Boolean).join(' ') || user.username || `User#${userId}`
      const totalQuantity = completeTransfer?.items.reduce((sum, item) => sum + parseFloat(item.quantity.toString()), 0) || 0

      await sendTelegramStockTransferAlert({
        transferNumber,
        fromLocation: fromLocation.name,
        toLocation: toLocation.name,
        itemCount: items.length,
        totalQuantity,
        status: 'draft',
        createdBy: userDisplayName,
        timestamp: new Date(),
        items: completeTransfer?.items.slice(0, 3).map(item => ({
          productName: item.product.name,
          variationName: item.productVariation.name,
          quantity: parseFloat(item.quantity.toString())
        }))
      })
    } catch (telegramError) {
      console.error('Telegram notification failed:', telegramError)
    }

    return NextResponse.json({ transfer: completeTransfer }, { status: 201 })
  } catch (error) {
    console.error('Error creating stock transfer:', error)
    return NextResponse.json(
      {
        error: 'Failed to create stock transfer',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
