import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { isSuperAdmin } from '@/lib/rbac'

interface ErrorItem {
  row: number
  sku: string
  error: string
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
    const { errors } = body

    if (!Array.isArray(errors) || errors.length === 0) {
      return NextResponse.json({ error: 'No errors to process' }, { status: 400 })
    }

    const results = {
      success: 0,
      failed: 0,
      skipped: 0,
      errors: [] as Array<{ name: string; error: string }>
    }

    // Extract unique category names from error messages
    const categoryNames = new Set<string>()

    for (const errorItem of errors as ErrorItem[]) {
      const match = errorItem.error.match(/Category "([^"]+)" not found/)
      if (match && match[1]) {
        categoryNames.add(match[1])
      }
    }

    // Create categories
    for (const categoryName of Array.from(categoryNames)) {
      try {
        // Check if category already exists
        const existingCategory = await prisma.category.findFirst({
          where: {
            businessId,
            name: categoryName,
            parentId: null
          }
        })

        if (existingCategory) {
          results.skipped++
          results.errors.push({
            name: categoryName,
            error: 'Category already exists'
          })
          continue
        }

        // Create category
        await prisma.category.create({
          data: {
            name: categoryName,
            description: `Auto-imported from CSV errors`,
            businessId
          }
        })

        results.success++
      } catch (error: any) {
        results.failed++
        results.errors.push({
          name: categoryName,
          error: error.message
        })
      }
    }

    return NextResponse.json({
      success: { select: { id: true, name: true } },
      results,
      message: `Created ${results.success} categories from error list`
    })

  } catch (error: any) {
    console.error('Import categories from errors:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to import categories' },
      { status: 500 }
    )
  }
}
