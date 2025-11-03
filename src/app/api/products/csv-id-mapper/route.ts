import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth.simple'
import { prisma } from '@/lib/prisma'
import { isSuperAdmin } from '@/lib/rbac'

interface OriginalCSVRow {
  'Item Code': string
  'Item Name': string
  'Supplier': string
  'Category': string
  'Brand': string
  'Last Delivery Date'?: string
  'Last Qty Delivered'?: string
  '?Cost': string
  '?Price': string
  'Warehouse': string
  'Main Store': string
  'Bambang': string
  'Tuguegarao': string
  'Total Stocks'?: string
  '?Total Cost'?: string
  '?Total Price'?: string
  'Active': string
}

interface MappedCSVRow {
  'Item Code': string
  'Item Name': string
  'Supplier': string
  'Category ID': string
  'Brand ID': string
  'Last Delivery Date'?: string
  'Last Qty Delivered'?: string
  '?Cost': string
  '?Price': string
  'Warehouse': string
  'Main Store': string
  'Bambang': string
  'Tuguegarao': string
  'Total Stocks'?: string
  '?Total Cost'?: string
  '?Total Price'?: string
  'Active': string
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = session.user
    const businessId = parseInt(String(user.businessId))

    // Check permission - Super Admin only
    if (!isSuperAdmin(user)) {
      return NextResponse.json({
        error: 'Forbidden: This feature is only available to Super Administrators'
      }, { status: 403 })
    }

    const body = await request.json()
    const { products } = body

    if (!Array.isArray(products) || products.length === 0) {
      return NextResponse.json({ error: 'No products to process' }, { status: 400 })
    }

    // Fetch all brands and categories for this business
    const brands = await prisma.brand.findMany({
      where: { businessId },
      select: { id: true, name: true }
    })

    const categories = await prisma.category.findMany({
      where: { businessId },
      select: { id: true, name: true }
    })

    // Create lookup maps
    const brandMap = new Map(brands.map(b => [b.name.toUpperCase(), b.id]))
    const categoryMap = new Map(categories.map(c => [c.name.toUpperCase(), c.id]))

    const results = {
      success: 0,
      failed: 0,
      errors: [] as Array<{ row: number; sku: string; error: string }>,
      mappedProducts: [] as MappedCSVRow[]
    }

    // Process each product
    for (let i = 0; i < products.length; i++) {
      const product = products[i] as OriginalCSVRow
      const rowNumber = i + 2

      try {
        const brandName = product['Brand']?.trim().toUpperCase()
        const categoryName = product['Category']?.trim().toUpperCase()

        // Find Brand ID
        const brandId = brandName ? brandMap.get(brandName) : null
        if (brandName && !brandId) {
          results.failed++
          results.errors.push({
            row: rowNumber,
            sku: product['Item Code'],
            error: `Brand "${product['Brand']}" not found. Please import brands first.`
          })
          continue
        }

        // Find Category ID
        const categoryId = categoryName ? categoryMap.get(categoryName) : null
        if (categoryName && !categoryId) {
          results.failed++
          results.errors.push({
            row: rowNumber,
            sku: product['Item Code'],
            error: `Category "${product['Category']}" not found. Please import categories first.`
          })
          continue
        }

        // Create mapped row
        const mappedRow: MappedCSVRow = {
          'Item Code': product['Item Code'],
          'Item Name': product['Item Name'],
          'Supplier': product['Supplier'],
          'Category ID': categoryId ? String(categoryId) : '',
          'Brand ID': brandId ? String(brandId) : '',
          'Last Delivery Date': product['Last Delivery Date'],
          'Last Qty Delivered': product['Last Qty Delivered'],
          '?Cost': product['?Cost'],
          '?Price': product['?Price'],
          'Warehouse': product['Warehouse'],
          'Main Store': product['Main Store'],
          'Bambang': product['Bambang'],
          'Tuguegarao': product['Tuguegarao'],
          'Total Stocks': product['Total Stocks'],
          '?Total Cost': product['?Total Cost'],
          '?Total Price': product['?Total Price'],
          'Active': product['Active']
        }

        results.mappedProducts.push(mappedRow)
        results.success++
      } catch (error: any) {
        results.failed++
        results.errors.push({
          row: rowNumber,
          sku: product['Item Code'] || 'N/A',
          error: error.message
        })
      }
    }

    // Convert mapped products to CSV format
    const csvHeaders = [
      'Item Code',
      'Item Name',
      'Supplier',
      'Category ID',
      'Brand ID',
      'Last Delivery Date',
      'Last Qty Delivered',
      '?Cost',
      '?Price',
      'Warehouse',
      'Main Store',
      'Bambang',
      'Tuguegarao',
      'Total Stocks',
      '?Total Cost',
      '?Total Price',
      'Active'
    ]

    const csvRows = results.mappedProducts.map(row => {
      return csvHeaders.map(header => {
        const value = row[header as keyof MappedCSVRow] || ''
        const strValue = String(value)
        // Escape values that contain commas, quotes, or newlines
        if (strValue.includes(',') || strValue.includes('"') || strValue.includes('\n') || strValue.includes('\r')) {
          return `"${strValue.replace(/"/g, '""')}"`
        }
        return strValue
      }).join(',')
    })

    const csvContent = [csvHeaders.join(','), ...csvRows].join('\r\n')

    return NextResponse.json({
      success: true,
      results: {
        success: results.success,
        failed: results.failed,
        errors: results.errors,
        totalBrands: brands.length,
        totalCategories: categories.length
      },
      csvContent // The mapped CSV ready for download
    })

  } catch (error: any) {
    console.error('CSV ID Mapper error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to process CSV' },
      { status: 500 }
    )
  }
}
