import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { PERMISSIONS, getUserAccessibleLocationIds } from '@/lib/rbac'
import * as XLSX from 'xlsx'

/**
 * GET /api/physical-inventory/export
 * Export physical inventory count template as Excel
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = session.user as any
    const businessId = user.businessId

    if (!businessId) {
      return NextResponse.json({ error: 'No business associated with user' }, { status: 400 })
    }

    // Check permission
    if (!user.permissions?.includes(PERMISSIONS.PHYSICAL_INVENTORY_EXPORT)) {
      return NextResponse.json({ error: 'Forbidden - Insufficient permissions' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const locationId = searchParams.get('locationId')

    if (!locationId) {
      return NextResponse.json({ error: 'Location ID is required' }, { status: 400 })
    }

    const locId = parseInt(locationId)

    // Check location access
    const accessibleLocationIds = getUserAccessibleLocationIds(user)
    if (accessibleLocationIds !== null && !accessibleLocationIds.includes(locId)) {
      return NextResponse.json(
        { error: 'You do not have access to this location' },
        { status: 403 }
      )
    }

    // Verify location exists
    const location = await prisma.businessLocation.findFirst({
      where: {
        id: locId,
        businessId: parseInt(businessId),
        deletedAt: null
      }
    })

    if (!location) {
      return NextResponse.json({ error: 'Location not found' }, { status: 404 })
    }

    // Get all products with variations at this location
    const variationLocationDetails = await prisma.variationLocationDetails.findMany({
      where: {
        locationId: locId
      },
      include: {
        product: {
          select: {
            id: true,
            name: true,
            sku: true,
            businessId: true
          }
        },
        productVariation: {
          select: {
            id: true,
            name: true,
            sku: true
          }
        }
      },
      orderBy: {
        product: {
          name: 'asc'
        }
      }
    })

    // Filter by business ID (security)
    const filteredData = variationLocationDetails.filter(
      detail => detail.product.businessId === parseInt(businessId)
    )

    // Prepare Excel data as ARRAY FORMAT (no headers)
    const titleRow = [`PHYSICAL INVENTORY COUNT - ${location.name.toUpperCase()}`, '', '', '', '', '']
    const dateRow = [`Date: ${new Date().toLocaleDateString()}`, '', '', '', '', '']
    const emptyRow = ['', '', '', '', '', '']

    const dataRows = filteredData.map(detail => {
      // Hide "DUMMY" variation for single products - show empty string instead
      const variationName = detail.productVariation.name === 'DUMMY'
        ? ''
        : (detail.productVariation.name || '')

      return [
        detail.productId,
        detail.product.name,
        variationName,
        detail.productVariation.sku || detail.product.sku || '',
        parseFloat(detail.qtyAvailable.toString()),
        ''
      ]
    })

    // Combine: title, date, empty, then data (NO header row)
    const excelData = [titleRow, dateRow, emptyRow, ...dataRows]

    // Create workbook using array format (no headers)
    const wb = XLSX.utils.book_new()
    const ws = XLSX.utils.aoa_to_sheet(excelData)

    // Set column widths
    ws['!cols'] = [
      { wch: 15 }, // Product ID
      { wch: 35 }, // Product Name
      { wch: 20 }, // Variation
      { wch: 20 }, // SKU
      { wch: 15 }, // Current Stock
      { wch: 18 }  // Physical Count
    ]

    // Styling: Title row (row 1) - Bold and larger
    if (ws['A1']) {
      ws['A1'].s = {
        font: { bold: true, sz: 14 },
        alignment: { horizontal: 'left' }
      }
    }

    // Date row (row 2) - Italic
    if (ws['A2']) {
      ws['A2'].s = {
        font: { italic: true },
        alignment: { horizontal: 'left' }
      }
    }

    // Header row (row 4) - Bold
    const range = XLSX.utils.decode_range(ws['!ref'] || 'A1')
    for (let C = range.s.c; C <= range.e.c; ++C) {
      const address = XLSX.utils.encode_col(C) + '4'
      if (!ws[address]) continue
      if (!ws[address].s) ws[address].s = {}
      ws[address].s.font = { bold: true }
      ws[address].s.fill = { fgColor: { rgb: 'E8E8E8' } }
    }

    // Merge cells for title (A1:F1)
    ws['!merges'] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: 5 } }, // Title row
      { s: { r: 1, c: 0 }, e: { r: 1, c: 5 } }  // Date row
    ]

    XLSX.utils.book_append_sheet(wb, ws, 'Physical Inventory')

    // Generate buffer
    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })

    // Return as downloadable file
    const filename = `Physical_Inventory_${location.name.replace(/[^a-z0-9]/gi, '_')}_${new Date().toISOString().split('T')[0]}.xlsx`

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    })
  } catch (error) {
    console.error('Error exporting physical inventory:', error)
    return NextResponse.json({ error: 'Failed to export physical inventory' }, { status: 500 })
  }
}
