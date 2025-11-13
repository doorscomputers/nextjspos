import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth.simple'
import prisma from '@/lib/prisma.simple'
import { hasAnyRole } from '@/lib/rbac'
import { Prisma } from '@prisma/client'

/**
 * GET /api/admin/check-invoice-conflicts
 *
 * Check for invoice number conflicts in production database:
 * - Duplicate invoice numbers in sales table
 * - Current invoice sequences with day column
 * - Recent sales to see what's happening
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

    console.log('[CheckConflicts] Admin:', session.user.username, 'checking invoice conflicts')

    // 1. Check for duplicate invoice numbers
    const duplicates = await prisma.$queryRaw<Array<{
      invoice_number: string
      count: bigint
      business_id: number
    }>>`
      SELECT invoice_number, business_id, COUNT(*) as count
      FROM sales
      WHERE business_id = ${parseInt(session.user.businessId)}
      GROUP BY invoice_number, business_id
      HAVING COUNT(*) > 1
    `

    // 2. Get recent sales
    const recentSales = await prisma.sale.findMany({
      where: {
        businessId: parseInt(session.user.businessId),
      },
      take: 20,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        invoiceNumber: true,
        totalAmount: true,
        status: true,
        createdAt: true,
        location: {
          select: {
            name: true,
          }
        }
      }
    })

    // 3. Get invoice sequences
    const sequences = await prisma.invoiceSequence.findMany({
      where: {
        businessId: parseInt(session.user.businessId),
      },
      orderBy: { id: 'desc' },
    })

    // 4. Check today's date
    const now = new Date()
    const year = now.getFullYear()
    const month = now.getMonth() + 1
    const day = now.getDate()

    return NextResponse.json({
      success: true,
      currentDate: {
        year,
        month,
        day,
        formatted: `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
      },
      duplicates: duplicates.map(d => ({
        invoiceNumber: d.invoice_number,
        count: Number(d.count),
        businessId: d.business_id,
      })),
      hasDuplicates: duplicates.length > 0,
      recentSales: recentSales.map(s => ({
        id: s.id,
        invoiceNumber: s.invoiceNumber,
        location: s.location?.name,
        totalAmount: parseFloat(s.totalAmount.toString()),
        status: s.status,
        createdAt: s.createdAt,
      })),
      sequences: sequences.map(seq => ({
        id: seq.id,
        locationId: seq.locationId,
        year: seq.year,
        month: seq.month,
        day: seq.day,
        sequence: seq.sequence,
        formatted: `${seq.year}-${String(seq.month).padStart(2, '0')}-${String(seq.day).padStart(2, '0')} = ${seq.sequence}`
      })),
      hasOldSequences: sequences.some(s => s.day !== day),
      sequenceCount: sequences.length,
    })
  } catch (error: any) {
    console.error('[CheckConflicts] Error:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to check invoice conflicts',
        details: error.message,
      },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/admin/check-invoice-conflicts
 *
 * Delete a specific sale by invoice number (for cleaning up failed attempts)
 */
export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    if (!hasAnyRole(session.user, ['Super Admin', 'Admin'])) {
      return NextResponse.json(
        {
          success: false,
          error: 'Forbidden - Super Admin or Admin required'
        },
        { status: 403 }
      )
    }

    const { searchParams } = new URL(request.url)
    const invoiceNumber = searchParams.get('invoiceNumber')

    if (!invoiceNumber) {
      return NextResponse.json(
        { success: false, error: 'Invoice number required' },
        { status: 400 }
      )
    }

    // Delete the sale (cascade will handle related records)
    const deleted = await prisma.sale.deleteMany({
      where: {
        businessId: parseInt(session.user.businessId),
        invoiceNumber: invoiceNumber,
      }
    })

    return NextResponse.json({
      success: true,
      message: `Deleted ${deleted.count} sale(s) with invoice number ${invoiceNumber}`,
      deletedCount: deleted.count,
    })
  } catch (error: any) {
    console.error('[CheckConflicts] Delete error:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to delete sale',
        details: error.message,
      },
      { status: 500 }
    )
  }
}
