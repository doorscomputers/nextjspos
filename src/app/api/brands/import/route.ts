import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { PERMISSIONS, isSuperAdmin } from '@/lib/rbac'

interface BrandCSVRow {
  'Brand': string
  'Description'?: string
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
    const { brands } = body

    if (!Array.isArray(brands) || brands.length === 0) {
      return NextResponse.json({ error: 'No brands to import' }, { status: 400 })
    }

    const results = {
      success: 0,
      failed: 0,
      skipped: 0,
      errors: [] as Array<{ row: number; name: string; error: string }>
    }

    // Process each brand
    for (let i = 0; i < brands.length; i++) {
      const brand = brands[i] as any
      const rowNumber = i + 2 // Account for header row

      try {
        // Handle multiple CSV formats
        let brandName: string | null = null
        let description: string | null = null

        // Format 1: CSV with "Brand" header
        if (brand['Brand']) {
          brandName = brand['Brand'].trim()
          description = brand['Description']?.trim() || null
        }
        // Format 2: CSV with column A only (first column, no specific header)
        else if (brand[Object.keys(brand)[0]]) {
          const firstColumn = Object.keys(brand)[0]
          brandName = brand[firstColumn].trim()
        }

        // Validate required fields
        if (!brandName || brandName === '') {
          results.skipped++
          results.errors.push({
            row: rowNumber,
            name: 'N/A',
            error: 'Brand name is required'
          })
          continue
        }

        // Check if brand already exists
        const existingBrand = await prisma.brand.findFirst({
          where: {
            businessId,
            name: brandName
          }
        })

        if (existingBrand) {
          results.skipped++
          results.errors.push({
            row: rowNumber,
            name: brandName,
            error: 'Brand with this name already exists'
          })
          continue
        }

        // Create brand
        await prisma.brand.create({
          data: {
            name: brandName,
            description,
            businessId
          }
        })

        results.success++
      } catch (error: any) {
        results.failed++
        results.errors.push({
          row: rowNumber,
          name: brand['Brand'] || 'N/A',
          error: error.message
        })
      }
    }

    return NextResponse.json({
      success: true,
      results
    })

  } catch (error: any) {
    console.error('Import brands error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to import brands' },
      { status: 500 }
    )
  }
}
