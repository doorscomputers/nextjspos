import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth.simple'
import { prisma } from '@/lib/prisma.simple'
import { PERMISSIONS, isSuperAdmin } from '@/lib/rbac'

interface CategoryCSVRow {
  'Category': string
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
    const { categories } = body

    if (!Array.isArray(categories) || categories.length === 0) {
      return NextResponse.json({ error: 'No categories to import' }, { status: 400 })
    }

    const results = {
      success: 0,
      failed: 0,
      skipped: 0,
      errors: [] as Array<{ row: number; name: string; error: string }>
    }

    // Process each category
    for (let i = 0; i < categories.length; i++) {
      const category = categories[i] as any
      const rowNumber = i + 2 // Account for header row

      try {
        // Handle multiple CSV formats
        let categoryName: string | null = null
        let description: string | null = null

        // Format 1: CSV with "Category" header
        if (category['Category']) {
          categoryName = category['Category'].trim()
          description = category['Description']?.trim() || null
        }
        // Format 2: CSV with column A only (first column, no specific header)
        else if (category[Object.keys(category)[0]]) {
          const firstColumn = Object.keys(category)[0]
          categoryName = category[firstColumn].trim()
        }

        // Validate required fields
        if (!categoryName || categoryName === '') {
          results.skipped++
          results.errors.push({
            row: rowNumber,
            name: 'N/A',
            error: 'Category name is required'
          })
          continue
        }

        // Check if category already exists
        const existingCategory = await prisma.category.findFirst({
          where: {
            businessId,
            name: categoryName,
            parentId: null // Only check top-level categories
          }
        })

        if (existingCategory) {
          results.skipped++
          results.errors.push({
            row: rowNumber,
            name: categoryName,
            error: 'Category with this name already exists'
          })
          continue
        }

        // Create category
        await prisma.category.create({
          data: {
            name: categoryName,
            description,
            businessId
          }
        })

        results.success++
      } catch (error: any) {
        results.failed++
        results.errors.push({
          row: rowNumber,
          name: category['Category'] || 'N/A',
          error: error.message
        })
      }
    }

    return NextResponse.json({
      success: true,
      results
    })

  } catch (error: any) {
    console.error('Import categories error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to import categories' },
      { status: 500 }
    )
  }
}
