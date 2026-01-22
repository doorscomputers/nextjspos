import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth.simple'
import { prisma } from '@/lib/prisma.simple'
import { PERMISSIONS } from '@/lib/rbac'
import * as XLSX from 'xlsx'

/**
 * GET /api/admin/physical-inventory-upload/export
 *
 * Export physical inventory template for admin.
 * Can export for a single location or all locations.
 *
 * Query params:
 * - locationId: (optional) If provided, export only this location
 * - all: (optional) If "true", export all locations
 *
 * Excel Format:
 * | DATE | BRANCH | ITEM CODE | ITEM NAME | ACTUAL COUNT |
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = session.user as any
    const businessId = parseInt(String(user.businessId))
    if (!businessId) {
      return NextResponse.json({ error: 'No business associated with user' }, { status: 400 })
    }

    // Check permission
    if (!user.permissions?.includes(PERMISSIONS.ADMIN_PHYSICAL_INVENTORY_UPLOAD)) {
      return NextResponse.json({ error: 'Forbidden - Insufficient permissions' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const locationIdParam = searchParams.get('locationId')
    const exportAll = searchParams.get('all') === 'true'
    const locationId = locationIdParam ? parseInt(locationIdParam) : null

    // Get locations
    const locationFilter = locationId
      ? { id: locationId, businessId, deletedAt: null }
      : { businessId, deletedAt: null }

    const locations = await prisma.businessLocation.findMany({
      where: locationFilter,
      select: { id: true, name: true }
    })

    if (locations.length === 0) {
      return NextResponse.json({ error: 'No locations found' }, { status: 404 })
    }

    // Get all product variations with their location stock
    const variationLocationDetails = await prisma.variationLocationDetails.findMany({
      where: {
        locationId: { in: locations.map(l => l.id) },
        product: {
          businessId,
          deletedAt: null
        }
      },
      include: {
        product: {
          select: {
            id: true,
            name: true,
            sku: true
          }
        },
        productVariation: {
          select: {
            id: true,
            name: true,
            sku: true
          }
        },
        location: {
          select: {
            name: true
          }
        }
      },
      orderBy: [
        { location: { name: 'asc' } },
        { product: { name: 'asc' } }
      ]
    })

    // Build Excel data
    const today = new Date().toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: '2-digit'
    }).replace(/ /g, '-')

    const dataRows = variationLocationDetails.map(detail => {
      // Use variation SKU first, then product SKU
      const itemCode = detail.productVariation.sku || detail.product.sku || ''

      // Build item name (with variation if not DUMMY/Default)
      const variationName = detail.productVariation.name
      const showVariation = variationName && variationName !== 'DUMMY' && variationName !== 'Default'
      const itemName = showVariation
        ? `${detail.product.name} - ${variationName}`
        : detail.product.name

      return {
        'DATE': today,
        'BRANCH': detail.location.name,
        'ITEM CODE': itemCode,
        'ITEM NAME': itemName,
        'ACTUAL COUNT': '' // Leave empty for user to fill in
      }
    })

    // Create workbook
    const wb = XLSX.utils.book_new()
    const ws = XLSX.utils.json_to_sheet(dataRows)

    // Set column widths
    ws['!cols'] = [
      { wch: 12 }, // DATE
      { wch: 20 }, // BRANCH
      { wch: 18 }, // ITEM CODE
      { wch: 45 }, // ITEM NAME
      { wch: 15 }  // ACTUAL COUNT
    ]

    XLSX.utils.book_append_sheet(wb, ws, 'Physical Inventory')

    // Generate buffer
    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })

    // Filename
    const locationName = locations.length === 1
      ? locations[0].name.replace(/[^a-z0-9]/gi, '_')
      : 'All_Locations'
    const filename = `Physical_Inventory_${locationName}_${new Date().toISOString().split('T')[0]}.xlsx`

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    })
  } catch (error) {
    console.error('Error exporting admin physical inventory template:', error)
    return NextResponse.json({ error: 'Failed to export physical inventory template' }, { status: 500 })
  }
}
