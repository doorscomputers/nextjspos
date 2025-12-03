import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth.simple'
import { prisma } from '@/lib/prisma.simple'

/**
 * DevExtreme-compatible Sales API endpoint
 * Supports server-side pagination, filtering, sorting, and searching
 * Used by DevExtreme CustomStore with remoteOperations enabled
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = session.user as any
    const businessId = parseInt(user.businessId)

    if (!businessId) {
      return NextResponse.json({ error: 'No business associated with user' }, { status: 400 })
    }

    // Parse DevExtreme load options
    const { searchParams } = new URL(request.url)

    // Pagination
    const skip = parseInt(searchParams.get('skip') || '0')
    const take = Math.min(parseInt(searchParams.get('take') || '50'), 200) // Max 200 per page

    // Search
    const searchValue = searchParams.get('searchValue')?.trim() || ''
    const exactInvoice = searchParams.get('exactInvoice')?.trim() || '' // Exact invoice number match

    // Sorting
    const sortField = searchParams.get('sort')
    const sortOrder = searchParams.get('sortOrder') || 'desc'

    // Status filter
    const statusFilter = searchParams.get('status')

    // Build base where clause
    const whereClause: any = {
      businessId,
      deletedAt: null
    }

    // Apply status filter
    if (statusFilter && statusFilter !== 'all') {
      whereClause.status = statusFilter
    }

    // Apply exact invoice match (used by VoidDialog when invoice is already known)
    if (exactInvoice) {
      console.log('[DevExtreme Sales API] Exact invoice lookup:', exactInvoice)
      whereClause.invoiceNumber = exactInvoice
    }
    // Apply search across multiple fields (partial match)
    else if (searchValue) {
      console.log('[DevExtreme Sales API] Searching for:', searchValue)
      whereClause.OR = [
        { invoiceNumber: { contains: searchValue, mode: 'insensitive' } },
        { customer: { name: { contains: searchValue, mode: 'insensitive' } } },
        { customer: { mobile: { contains: searchValue, mode: 'insensitive' } } }
      ]
    }

    console.log('[DevExtreme Sales API] Where clause:', JSON.stringify(whereClause, null, 2))

    // Build order by clause
    const orderBy: any = {}
    if (sortField) {
      // Handle nested fields (e.g., customer.name)
      if (sortField.includes('.')) {
        const [relation, field] = sortField.split('.')
        orderBy[relation] = { [field]: sortOrder.toLowerCase() }
      } else {
        orderBy[sortField] = sortOrder.toLowerCase()
      }
    } else {
      orderBy.createdAt = 'desc' // Default sort
    }

    // Execute queries in parallel
    const [sales, totalCount] = await Promise.all([
      prisma.sale.findMany({
        where: whereClause,
        select: {
          id: true,
          invoiceNumber: true,
          saleDate: true,
          locationId: true, // IMPORTANT: Required for Exchange Dialog location filtering
          subtotal: true,
          taxAmount: true,
          discountAmount: true,
          shippingCost: true,
          totalAmount: true,
          status: true,
          notes: true,
          createdAt: true,
          customer: {
            select: {
              id: true,
              name: true,
              mobile: true
            }
          },
          items: {
            select: {
              id: true,
              productId: true,
              productVariationId: true,
              quantity: true,
              unitPrice: true,
              discountAmount: true,
              discountType: true,
              serialNumbers: true,
              product: {
                select: {
                  name: true,
                  sku: true
                }
              }
            }
          },
          payments: {
            select: {
              id: true,
              paymentMethod: true,
              amount: true
            }
          }
        },
        orderBy,
        skip,
        take
      }),
      prisma.sale.count({ where: whereClause })
    ])

    console.log('[DevExtreme Sales API] Found', sales.length, 'sales out of', totalCount, 'total')
    if (searchValue && sales.length > 0) {
      console.log('[DevExtreme Sales API] First sale invoice:', sales[0].invoiceNumber)
    }

    // Transform data for DevExtreme
    const transformedData = sales.map((sale) => {
      // Calculate payment summary
      const paymentSummary = sale.payments.length > 0
        ? sale.payments.map(p => `${getPaymentMethodLabel(p.paymentMethod)}: ₱${parseFloat(p.amount.toString()).toFixed(2)}`).join(', ')
        : 'No payment'

      return {
        id: sale.id,
        invoiceNumber: sale.invoiceNumber,
        saleDate: sale.saleDate,
        locationId: sale.locationId, // IMPORTANT: Required for Exchange Dialog location filtering
        customerName: sale.customer?.name || 'Walk-in Customer',
        customerMobile: sale.customer?.mobile || null,
        itemCount: sale.items.length,
        subtotal: parseFloat(sale.subtotal.toString()),
        taxAmount: parseFloat(sale.taxAmount.toString()),
        discountAmount: parseFloat(sale.discountAmount.toString()),
        totalAmount: parseFloat(sale.totalAmount.toString()),
        paymentSummary: paymentSummary,
        status: sale.status,
        statusBadge: sale.status,
        createdAt: sale.createdAt,
        notes: sale.notes,
        // Include full data for actions/modals
        customer: sale.customer,
        items: sale.items.map(item => {
          const quantity = parseFloat(item.quantity.toString())
          const unitPrice = parseFloat(item.unitPrice.toString())
          const discountAmount = item.discountAmount ? parseFloat(item.discountAmount.toString()) : 0
          const lineTotal = quantity * unitPrice // Calculate lineTotal from quantity * unitPrice

          return {
            id: item.id,
            productId: item.productId,
            productVariationId: item.productVariationId,
            quantity,
            unitPrice,
            discountAmount,
            discountType: item.discountType,
            lineTotal,
            serialNumbers: item.serialNumbers,
            product: item.product
          }
        }),
        payments: sale.payments.map(p => ({
          id: p.id,
          paymentMethod: p.paymentMethod,
          amount: parseFloat(p.amount.toString())
        }))
      }
    })

    // Return DevExtreme-compatible response
    return NextResponse.json({
      data: transformedData,
      totalCount: totalCount
    })
  } catch (error) {
    console.error('DevExtreme Sales API error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch sales', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

/**
 * Get payment method label
 */
function getPaymentMethodLabel(method: string): string {
  const labels: Record<string, string> = {
    'cash': 'Cash',
    'card': 'Card',
    'bank_transfer': 'Bank Transfer',
    'cheque': 'Cheque',
    'other': 'Other'
  }
  return labels[method] || method
}
