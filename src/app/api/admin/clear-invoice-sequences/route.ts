import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth.simple'
import prisma from '@/lib/prisma.simple'
import { hasAnyRole } from '@/lib/rbac'

/**
 * POST /api/admin/clear-invoice-sequences
 *
 * Clears the invoice_sequences table to resolve conflicts after schema changes.
 * This is safe because invoice sequences regenerate automatically on next sale.
 *
 * ADMIN ONLY: Requires Super Admin or Admin role
 */
export async function POST(request: NextRequest) {
  try {
    // Authentication check
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Admin authorization check
    if (!hasAnyRole(session.user, ['Super Admin', 'Admin', 'All Branch Admin'])) {
      return NextResponse.json(
        {
          success: false,
          error: 'Forbidden - Admin access required to clear invoice sequences'
        },
        { status: 403 }
      )
    }

    console.log('[ClearSequences] Admin:', session.user.username, 'clearing invoice sequences')

    // Count existing records
    const count = await prisma.invoiceSequence.count()
    console.log('[ClearSequences] Found', count, 'sequence records')

    if (count === 0) {
      return NextResponse.json({
        success: true,
        message: 'No sequences to clear. Table is already empty.',
        deletedCount: 0,
      })
    }

    // Delete all records
    const result = await prisma.invoiceSequence.deleteMany({})
    console.log('[ClearSequences] Deleted', result.count, 'records')

    return NextResponse.json({
      success: true,
      message: `Successfully cleared ${result.count} invoice sequence records. Sequences will regenerate automatically on next sale.`,
      deletedCount: result.count,
    })
  } catch (error: any) {
    console.error('[ClearSequences] Error:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to clear invoice sequences',
        details: error.message,
      },
      { status: 500 }
    )
  }
}

/**
 * GET /api/admin/clear-invoice-sequences
 *
 * Check how many invoice sequence records exist
 */
export async function GET(request: NextRequest) {
  try {
    // Authentication check
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Admin authorization check
    if (!hasAnyRole(session.user, ['Super Admin', 'Admin', 'All Branch Admin'])) {
      return NextResponse.json(
        {
          success: false,
          error: 'Forbidden - Admin access required'
        },
        { status: 403 }
      )
    }

    const count = await prisma.invoiceSequence.count()
    const sequences = await prisma.invoiceSequence.findMany({
      take: 10,
      orderBy: { id: 'desc' },
    })

    return NextResponse.json({
      success: true,
      count,
      recentSequences: sequences,
    })
  } catch (error: any) {
    console.error('[ClearSequences] Error:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to get invoice sequences',
        details: error.message,
      },
      { status: 500 }
    )
  }
}
