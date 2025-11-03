import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth.simple'
import { prisma } from '@/lib/prisma.simple'
import { PERMISSIONS } from '@/lib/rbac'
import { createAuditLog, AuditAction, EntityType, getIpAddress, getUserAgent } from '@/lib/auditLog'

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
    const businessId = user.businessId
    const { id } = await params

    // Debug logging
    console.log('=== Opening Stock API Debug ===')
    console.log('User ID (original):', user.id, 'Type:', typeof user.id)
    console.log('User ID (parsed):', parseInt(user.id), 'Type:', typeof parseInt(user.id))
    console.log('Business ID:', businessId, 'Type:', typeof businessId)
    console.log('User:', user.username)
    console.log('User Permissions:', user.permissions)
    console.log('Looking for:', PERMISSIONS.PRODUCT_OPENING_STOCK)
    console.log('Has Permission:', user.permissions?.includes(PERMISSIONS.PRODUCT_OPENING_STOCK))

    if (!user.permissions?.includes(PERMISSIONS.PRODUCT_OPENING_STOCK)) {
      console.error('Permission denied - User does not have PRODUCT_OPENING_STOCK permission')
      return NextResponse.json({
        error: 'Forbidden - Insufficient permissions for opening stock',
        debug: process.env.NODE_ENV === 'development' ? {
          required: PERMISSIONS.PRODUCT_OPENING_STOCK,
          userPermissions: user.permissions,
          solution: 'Please log out and log back in to refresh your session'
        } : undefined
      }, { status: 403 })
    }

    const body = await request.json()
    const { stockEntries } = body

    if (!stockEntries || !Array.isArray(stockEntries)) {
      return NextResponse.json({ error: 'Invalid stock entries' }, { status: 400 })
    }

    // Get allowed location IDs for this user
    const hasAccessAllLocations = user.permissions?.includes(PERMISSIONS.ACCESS_ALL_LOCATIONS)
    let allowedLocationIds: number[] = []

    if (hasAccessAllLocations) {
      // User can access all locations in their business
      const allLocations = await prisma.businessLocation.findMany({
        where: {
          businessId: parseInt(businessId),
          deletedAt: null
        },
        select: { id: true }
      })
      allowedLocationIds = allLocations.map(loc => loc.id)
      console.log('User has access to all locations:', allowedLocationIds)
    } else {
      // User can only access their assigned locations
      const userLocations = await prisma.userLocation.findMany({
        where: {
          userId: parseInt(user.id)
        },
        select: { locationId: true }
      })
      allowedLocationIds = userLocations.map(ul => ul.locationId)
      console.log('User has access to specific locations:', allowedLocationIds)
    }

    // Validate that all stock entries are for allowed locations
    const invalidEntries = stockEntries.filter(entry =>
      !allowedLocationIds.includes(parseInt(entry.locationId))
    )

    if (invalidEntries.length > 0) {
      console.error('Unauthorized location access attempt:', invalidEntries)
      return NextResponse.json({
        error: 'Forbidden - You do not have access to add stock for some of these locations',
        invalidLocationIds: invalidEntries.map(e => e.locationId)
      }, { status: 403 })
    }

    // Verify product belongs to user's business
    const product = await prisma.product.findFirst({
      where: {
        id: parseInt(id),
        businessId: parseInt(businessId),
        deletedAt: null
      }
    })

    if (!product) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 })
    }

    // Track processed entries for audit logging
    const processedEntries: Array<{
      locationId: number
      locationName?: string
      variationId?: number
      variationName?: string
      quantity: number
      unitCost: number | null
    }> = []

    // Create variation location details for each stock entry
    for (const entry of stockEntries) {
      console.log('Processing stock entry:', { entry, productType: product.type })

      if (product.type === 'variable' && entry.variationId) {
        // Check if stock is locked
        const existingStock = await prisma.variationLocationDetails.findUnique({
          where: {
            productVariationId_locationId: {
              productVariationId: parseInt(entry.variationId),
              locationId: parseInt(entry.locationId)
            }
          }
        })

        // If stock is locked, check permissions
        if (existingStock?.openingStockLocked) {
          const canUnlock = user.permissions?.includes(PERMISSIONS.PRODUCT_UNLOCK_OPENING_STOCK)
          const canModifyLocked = user.permissions?.includes(PERMISSIONS.PRODUCT_MODIFY_LOCKED_STOCK)

          if (!canUnlock && !canModifyLocked) {
            return NextResponse.json({
              error: 'Opening stock is locked. Use Inventory Corrections to adjust stock.',
              locked: true,
              lockedAt: existingStock.openingStockSetAt,
              redirectTo: '/dashboard/inventory-corrections/new'
            }, { status: 403 })
          }
        }

        // Check if any transactions exist for this product variation at this location
        const existingTransactions = await prisma.stockTransaction.findFirst({
          where: {
            productVariationId: parseInt(entry.variationId),
            locationId: parseInt(entry.locationId),
            businessId: parseInt(businessId)
          }
        })

        if (existingTransactions) {
          return NextResponse.json({
            error: 'Cannot set opening stock. Transactions already exist for this product at this location.',
            details: 'Opening stock can only be set when there are no sales, purchases, corrections, or transfers. Use Inventory Corrections to adjust stock.',
            redirectTo: '/dashboard/inventory-corrections/new'
          }, { status: 400 })
        }

        // For variable products, create/update variation location details
        await prisma.variationLocationDetails.upsert({
          where: {
            productVariationId_locationId: {
              productVariationId: parseInt(entry.variationId),
              locationId: parseInt(entry.locationId)
            }
          },
          update: {
            qtyAvailable: parseFloat(entry.quantity),
            sellingPrice: entry.sellingPrice ? parseFloat(entry.sellingPrice) : null,
            // Auto-lock after update if not already locked
            openingStockLocked: existingStock?.openingStockLocked ?? true,
            openingStockSetAt: existingStock?.openingStockSetAt ?? new Date(),
            openingStockSetBy: existingStock?.openingStockSetBy ?? parseInt(user.id)
          },
          create: {
            productId: product.id,
            productVariationId: parseInt(entry.variationId),
            locationId: parseInt(entry.locationId),
            qtyAvailable: parseFloat(entry.quantity),
            sellingPrice: entry.sellingPrice ? parseFloat(entry.sellingPrice) : null,
            // Auto-lock on creation
            openingStockLocked: true,
            openingStockSetAt: new Date(),
            openingStockSetBy: parseInt(user.id)
          }
        })

        // Create stock transaction record
        await prisma.stockTransaction.create({
          data: {
            businessId: parseInt(businessId),
            productId: product.id,
            productVariationId: parseInt(entry.variationId),
            locationId: parseInt(entry.locationId),
            type: 'opening_stock',
            quantity: parseFloat(entry.quantity),
            unitCost: entry.purchasePrice ? parseFloat(entry.purchasePrice) : null,
            balanceQty: parseFloat(entry.quantity),
            createdBy: parseInt(user.id),
            notes: 'Opening stock added'
          }
        })

        // Update variation purchase price if provided
        if (entry.purchasePrice) {
          await prisma.productVariation.update({
            where: { id: parseInt(entry.variationId) },
            data: { purchasePrice: parseFloat(entry.purchasePrice) }
          })
        }

        // Track for audit log
        const variation = await prisma.productVariation.findUnique({
          where: { id: parseInt(entry.variationId) }
        })
        const location = await prisma.businessLocation.findUnique({
          where: { id: parseInt(entry.locationId) }
        })
        processedEntries.push({
          locationId: parseInt(entry.locationId),
          locationName: location?.name,
          variationId: parseInt(entry.variationId),
          variationName: variation?.name,
          quantity: parseFloat(entry.quantity),
          unitCost: entry.purchasePrice ? parseFloat(entry.purchasePrice) : null
        })
      } else {
        // For single products, we need to create a default variation first
        let defaultVariation = await prisma.productVariation.findFirst({
          where: {
            productId: product.id,
            isDefault: true,
            deletedAt: null
          }
        })

        if (!defaultVariation) {
          // Create default variation for single product
          defaultVariation = await prisma.productVariation.create({
            data: {
              businessId: parseInt(businessId), // Required for denormalization
              productId: product.id,
              name: 'Default',
              sku: product.sku,
              purchasePrice: entry.purchasePrice ? parseFloat(entry.purchasePrice) : product.purchasePrice || 0,
              sellingPrice: product.sellingPrice || 0,
              isDefault: true,
              unitId: product.unitId
            }
          })
        }

        // Check if stock is locked for single products
        const existingSingleStock = await prisma.variationLocationDetails.findUnique({
          where: {
            productVariationId_locationId: {
              productVariationId: defaultVariation.id,
              locationId: parseInt(entry.locationId)
            }
          }
        })

        // If stock is locked, check permissions
        if (existingSingleStock?.openingStockLocked) {
          const canUnlock = user.permissions?.includes(PERMISSIONS.PRODUCT_UNLOCK_OPENING_STOCK)
          const canModifyLocked = user.permissions?.includes(PERMISSIONS.PRODUCT_MODIFY_LOCKED_STOCK)

          if (!canUnlock && !canModifyLocked) {
            return NextResponse.json({
              error: 'Opening stock is locked. Use Inventory Corrections to adjust stock.',
              locked: true,
              lockedAt: existingSingleStock.openingStockSetAt,
              redirectTo: '/dashboard/inventory-corrections/new'
            }, { status: 403 })
          }
        }

        // Check if any transactions exist for this product at this location
        const existingSingleTransactions = await prisma.stockTransaction.findFirst({
          where: {
            productVariationId: defaultVariation.id,
            locationId: parseInt(entry.locationId),
            businessId: parseInt(businessId)
          }
        })

        if (existingSingleTransactions) {
          return NextResponse.json({
            error: 'Cannot set opening stock. Transactions already exist for this product at this location.',
            details: 'Opening stock can only be set when there are no sales, purchases, corrections, or transfers. Use Inventory Corrections to adjust stock.',
            redirectTo: '/dashboard/inventory-corrections/new'
          }, { status: 400 })
        }

        // Create/update variation location details
        await prisma.variationLocationDetails.upsert({
          where: {
            productVariationId_locationId: {
              productVariationId: defaultVariation.id,
              locationId: parseInt(entry.locationId)
            }
          },
          update: {
            qtyAvailable: parseFloat(entry.quantity),
            sellingPrice: entry.sellingPrice ? parseFloat(entry.sellingPrice) : null,
            // Auto-lock after update if not already locked
            openingStockLocked: existingSingleStock?.openingStockLocked ?? true,
            openingStockSetAt: existingSingleStock?.openingStockSetAt ?? new Date(),
            openingStockSetBy: existingSingleStock?.openingStockSetBy ?? parseInt(user.id)
          },
          create: {
            productId: product.id,
            productVariationId: defaultVariation.id,
            locationId: parseInt(entry.locationId),
            qtyAvailable: parseFloat(entry.quantity),
            sellingPrice: entry.sellingPrice ? parseFloat(entry.sellingPrice) : null,
            // Auto-lock on creation
            openingStockLocked: true,
            openingStockSetAt: new Date(),
            openingStockSetBy: parseInt(user.id)
          }
        })

        // Create stock transaction record
        await prisma.stockTransaction.create({
          data: {
            businessId: parseInt(businessId),
            productId: product.id,
            productVariationId: defaultVariation.id,
            locationId: parseInt(entry.locationId),
            type: 'opening_stock',
            quantity: parseFloat(entry.quantity),
            unitCost: entry.purchasePrice ? parseFloat(entry.purchasePrice) : null,
            balanceQty: parseFloat(entry.quantity),
            createdBy: parseInt(user.id),
            notes: 'Opening stock added'
          }
        })

        // Track for audit log
        const location = await prisma.businessLocation.findUnique({
          where: { id: parseInt(entry.locationId) }
        })
        processedEntries.push({
          locationId: parseInt(entry.locationId),
          locationName: location?.name,
          variationId: defaultVariation.id,
          variationName: 'Default',
          quantity: parseFloat(entry.quantity),
          unitCost: entry.purchasePrice ? parseFloat(entry.purchasePrice) : null
        })
      }
    }

    // Create audit log for opening stock
    await createAuditLog({
      businessId: parseInt(businessId),
      userId: parseInt(user.id),
      username: user.username,
      action: AuditAction.OPENING_STOCK_SET,
      entityType: EntityType.PRODUCT,
      entityIds: [parseInt(id)],
      description: `Set opening stock for product "${product.name}"`,
      metadata: {
        productId: parseInt(id),
        productName: product.name,
        productSku: product.sku,
        openingStockSet: processedEntries
      },
      ipAddress: getIpAddress(request),
      userAgent: getUserAgent(request)
    })

    return NextResponse.json({ message: 'Opening stock added successfully' }, { status: 200 })
  } catch (error) {
    console.error('Error adding opening stock:', error)

    // Provide detailed error information
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    console.error('Detailed error:', {
      message: errorMessage,
      stack: error instanceof Error ? error.stack : undefined
    })

    return NextResponse.json({
      error: 'Failed to add opening stock',
      details: process.env.NODE_ENV === 'development' ? errorMessage : undefined
    }, { status: 500 })
  }
}
