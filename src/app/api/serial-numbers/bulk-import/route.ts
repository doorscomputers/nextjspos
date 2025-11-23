import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth.simple'
import { prisma } from '@/lib/prisma.simple'
import { hasPermission, PERMISSIONS } from '@/lib/rbac'

/**
 * Bulk Import Serial Numbers (Historical Data Entry)
 *
 * Purpose: Import serial numbers for products purchased BEFORE system implementation
 * Use Case: Warranty tracking - link existing inventory to original suppliers
 *
 * POST /api/serial-numbers/bulk-import
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check permission (using PURCHASE_CREATE as proxy since this is similar)
    if (!hasPermission(session.user, PERMISSIONS.PURCHASE_CREATE)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const { supplierId, locationId, purchaseDate, entries } = body

    // Validation
    if (!supplierId || !locationId || !entries || entries.length === 0) {
      return NextResponse.json(
        { error: 'Supplier, location, and at least one entry are required' },
        { status: 400 }
      )
    }

    const businessId = parseInt(session.user.businessId)

    // Verify supplier belongs to business
    const supplier = await prisma.supplier.findFirst({
      where: {
        id: parseInt(supplierId),
        businessId,
        deletedAt: null,
      },
    })

    if (!supplier) {
      return NextResponse.json({ error: 'Invalid supplier' }, { status: 400 })
    }

    // Verify location belongs to business
    const location = await prisma.businessLocation.findFirst({
      where: {
        id: parseInt(locationId),
        businessId,
      },
    })

    if (!location) {
      return NextResponse.json({ error: 'Invalid location' }, { status: 400 })
    }

    // Extract all serial numbers to check for duplicates
    const serialNumbers = entries.map((e: any) => e.serialNumber.trim())

    // Check if any serial numbers already exist in database
    const existingSerials = await prisma.productSerialNumber.findMany({
      where: {
        businessId,
        serialNumber: {
          in: serialNumbers,
        },
      },
      select: {
        serialNumber: true,
      },
    })

    if (existingSerials.length > 0) {
      const duplicates = existingSerials.map(s => s.serialNumber)
      return NextResponse.json(
        {
          error: 'Some serial numbers already exist in the system',
          duplicates,
        },
        { status: 400 }
      )
    }

    // Verify all product variations exist and belong to this business
    const variationIds = entries.map((e: any) => e.productVariationId)

    // Get unique variation IDs to avoid duplicate queries
    const uniqueVariationIds = [...new Set(variationIds)]

    const variations = await prisma.productVariation.findMany({
      where: {
        id: { in: uniqueVariationIds },
        product: {
          businessId,
        },
        deletedAt: null,
      },
      include: {
        product: true,
      },
    })

    // Check if all unique variations were found
    if (variations.length !== uniqueVariationIds.length) {
      return NextResponse.json(
        { error: 'Some products are invalid or do not exist' },
        { status: 400 }
      )
    }

    // Create serial number records in a transaction
    const createdSerials = await prisma.$transaction(async (tx) => {
      const serialRecords = []

      for (const entry of entries) {
        // Create serial number record
        const serial = await tx.productSerialNumber.create({
          data: {
            businessId,
            productId: entry.productId,
            productVariationId: entry.productVariationId,
            serialNumber: entry.serialNumber.trim(),
            imei: entry.imei?.trim() || null,
            status: 'in_stock', // Default status
            condition: 'new', // Assume new unless specified
            currentLocationId: parseInt(locationId),
            supplierId: parseInt(supplierId), // CRITICAL: Link to supplier for warranty tracking
            purchasedAt: purchaseDate ? new Date(purchaseDate) : new Date(),
            createdBy: parseInt(session.user.id),
          },
        })

        // Create movement record for audit trail
        await tx.serialNumberMovement.create({
          data: {
            serialNumberId: serial.id,
            movementType: 'purchase', // Historical purchase
            toLocationId: parseInt(locationId),
            referenceType: 'manual_import',
            notes: `Historical serial number import from supplier: ${supplier.name}`,
            movedBy: parseInt(session.user.id),
            movedAt: purchaseDate ? new Date(purchaseDate) : new Date(),
          },
        })

        serialRecords.push(serial)
      }

      return serialRecords
    })

    return NextResponse.json({
      message: `Successfully imported ${createdSerials.length} serial number(s)`,
      count: createdSerials.length,
      serials: createdSerials.map(s => ({
        id: s.id,
        serialNumber: s.serialNumber,
        productVariationId: s.productVariationId,
      })),
    })
  } catch (error) {
    console.error('Error importing serial numbers:', error)
    return NextResponse.json(
      {
        error: 'Failed to import serial numbers',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    )
  }
}
