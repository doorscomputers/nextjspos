/**
 * Sales Due API - Fetches ALL sales with outstanding balances
 *
 * This endpoint mirrors the exact logic used by the dashboard Invoice Due calculation
 * to ensure 100% accuracy. NO arbitrary limits - fetches all matching records.
 *
 * Used by: Sales page when "Due (With Balance)" filter is selected
 * Must match: Dashboard Invoice Due metric exactly
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth.simple'
import { prisma } from '@/lib/prisma.simple'
import { PERMISSIONS } from '@/lib/rbac'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = session.user as any
    const businessId = parseInt(String(user.businessId))

    // Check permission
    if (!user.permissions?.includes(PERMISSIONS.SELL_VIEW) &&
        !user.permissions?.includes(PERMISSIONS.SELL_VIEW_OWN)) {
      return NextResponse.json(
        { error: 'Forbidden - Insufficient permissions' },
        { status: 403 }
      )
    }

    // Get the total Invoice Due using the EXACT same SQL as dashboard
    // This guarantees the total will match
    const invoiceDueResult = await prisma.$queryRaw<[{ total_due: bigint | null }]>`
      SELECT COALESCE(SUM(s.total_amount - COALESCE(s.paid_amount, 0)), 0) as total_due
      FROM sales s
      LEFT JOIN customers c ON s.customer_id = c.id
      WHERE s.business_id = ${businessId}
        AND s.status NOT IN ('cancelled', 'voided')
        AND s.customer_id IS NOT NULL
        AND (c.name IS NULL OR c.name NOT ILIKE '%Walk-in%')
        AND (s.total_amount - COALESCE(s.paid_amount, 0)) > 0
        AND s.deleted_at IS NULL
    `

    const totalInvoiceDue = Number(invoiceDueResult[0]?.total_due || 0)

    // Fetch ALL sales with balance due (no limits)
    // Uses Prisma for better type safety and includes
    const sales = await prisma.sale.findMany({
      where: {
        businessId,
        status: { notIn: ['cancelled', 'voided'] },
        customerId: { not: null },
        deletedAt: null,
        NOT: {
          customer: {
            name: {
              contains: 'Walk-in',
              mode: 'insensitive'
            }
          }
        }
      },
      include: {
        customer: {
          select: {
            id: true,
            name: true,
            mobile: true,
            email: true,
          },
        },
        items: {
          select: {
            id: true,
            quantity: true,
            unitPrice: true,
          }
        },
        payments: {
          select: {
            id: true,
            paymentMethod: true,
            amount: true,
          }
        },
        location: {
          select: {
            id: true,
            name: true,
          }
        }
      },
      orderBy: {
        saleDate: 'desc',
      },
    })

    // Filter to only sales with balance > 0 and transform data
    const salesWithBalance = sales
      .map(sale => {
        const totalAmount = parseFloat(sale.totalAmount.toString())
        const paidAmount = parseFloat(sale.paidAmount?.toString() || '0')
        const balanceAmount = totalAmount - paidAmount

        return {
          id: sale.id,
          invoiceNumber: sale.invoiceNumber,
          saleDate: sale.saleDate,
          status: sale.status,
          subtotal: parseFloat(sale.subtotal.toString()),
          discountAmount: parseFloat(sale.discountAmount.toString()),
          totalAmount,
          paidAmount,
          balanceAmount,
          customer: sale.customer,
          location: sale.location,
          items: sale.items,
          payments: sale.payments,
        }
      })
      .filter(sale => sale.balanceAmount > 0)

    return NextResponse.json({
      sales: salesWithBalance,
      summary: {
        totalInvoiceDue,  // This ALWAYS matches dashboard
        count: salesWithBalance.length,
      }
    })

  } catch (error) {
    console.error('Error fetching sales due:', error)
    return NextResponse.json(
      { error: 'Failed to fetch sales due' },
      { status: 500 }
    )
  }
}
