import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth.simple'
import { prisma } from '@/lib/prisma.simple'
import { hasPermission, PERMISSIONS } from '@/lib/rbac'
import { createAuditLog, AuditAction, EntityType } from '@/lib/auditLog'

/**
 * GET /api/sales/[id]/reprint
 * Get sale details for reprinting receipt
 * Creates audit log entry for reprint action
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const saleId = parseInt(params.id)
    const businessId = parseInt(session.user.businessId)
    const userId = parseInt(session.user.id)

    // Check permission for reprinting receipts
    const canViewAll = hasPermission(session.user, PERMISSIONS.SELL_VIEW)
    const canViewOwn = hasPermission(session.user, PERMISSIONS.SELL_VIEW_OWN)

    if (!canViewAll && !canViewOwn) {
      return NextResponse.json(
        { error: 'Forbidden - Missing sell.view or sell.view_own permission' },
        { status: 403 }
      )
    }

    // Get sale with all related data
    const sale = await prisma.sale.findFirst({
      where: {
        id: saleId,
        businessId,
      },
      include: {
        customer: {
          select: {
            id: true,
            name: true,
            mobile: true,
            email: true,
            address: true,
            taxNumber: true,
          },
        },
        items: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
                sku: true,
              },
            },
            productVariation: {
              select: {
                id: true,
                name: true,
                sku: true,
              },
            },
          },
        },
        payments: true,
        cashierShift: {
          select: {
            shiftNumber: true,
          },
        },
      },
    })

    if (!sale) {
      return NextResponse.json({ error: 'Sale not found' }, { status: 404 })
    }

    // If user only has view_own permission, verify they created this sale
    if (canViewOwn && !canViewAll && sale.createdBy !== userId) {
      return NextResponse.json(
        { error: 'Forbidden - You can only reprint your own sales' },
        { status: 403 }
      )
    }

    // Get business information for receipt header
    const business = await prisma.business.findUnique({
      where: { id: businessId },
      select: {
        name: true,
        address1: true,
        address2: true,
        city: true,
        state: true,
        zipCode: true,
        country: true,
        phone: true,
        email: true,
        website: true,
        taxNumber1: true,
        taxLabel1: true,
        taxNumber2: true,
        taxLabel2: true,
      },
    })

    // Get location information
    const location = await prisma.businessLocation.findUnique({
      where: { id: sale.locationId },
      select: {
        name: true,
        address: true,
        phone: true,
      },
    })

    // Get cashier information
    const cashier = await prisma.user.findUnique({
      where: { id: sale.createdBy },
      select: {
        firstName: true,
        lastName: true,
        username: true,
      },
    })

    // Calculate VAT breakdown for BIR compliance
    const grossSales = parseFloat(sale.totalAmount.toString())
    let vatableSales = 0
    let vatAmount = 0
    let vatExemptAmount = 0

    if (sale.vatExempt) {
      vatExemptAmount = grossSales
    } else {
      vatableSales = grossSales / 1.12
      vatAmount = vatableSales * 0.12
    }

    // Format response
    const receiptData = {
      // Sale Info
      id: sale.id,
      invoiceNumber: sale.invoiceNumber,
      saleDate: sale.saleDate,
      createdAt: sale.createdAt,
      status: sale.status,
      shiftNumber: sale.cashierShift?.shiftNumber || 'N/A',

      // Business Info
      business: {
        name: business?.name || '',
        address: `${business?.address1 || ''}, ${business?.city || ''}`,
        phone: business?.phone || '',
        email: business?.email || '',
        tin: business?.taxNumber1 || '',
      },

      // Location Info
      location: {
        name: location?.name || '',
        address: location?.address || '',
        phone: location?.phone || '',
      },

      // Cashier Info
      cashier: cashier
        ? `${cashier.firstName || ''} ${cashier.lastName || ''}`.trim() || cashier.username
        : 'N/A',

      // Customer Info
      customer: sale.customer
        ? {
            name: sale.customer.name,
            mobile: sale.customer.mobile,
            email: sale.customer.email,
            address: sale.customer.address,
            tin: sale.customer.taxNumber,
          }
        : null,

      // Items
      items: sale.items.map(item => ({
        product: item.product?.name || 'Unknown Product',
        variation: item.productVariation?.name || '',
        sku: item.productVariation?.sku || item.product?.sku || '',
        quantity: parseFloat(item.quantity.toString()),
        unitPrice: parseFloat(item.unitPrice.toString()),
        subtotal: parseFloat(item.quantity.toString()) * parseFloat(item.unitPrice.toString()),
        serialNumbers: item.serialNumbers,
      })),

      // Amounts
      subtotal: parseFloat(sale.subtotal.toString()),
      discountAmount: parseFloat(sale.discountAmount.toString()),
      discountType: sale.discountType,
      seniorCitizenId: sale.seniorCitizenId,
      seniorCitizenName: sale.seniorCitizenName,
      pwdId: sale.pwdId,
      pwdName: sale.pwdName,
      shippingCost: parseFloat(sale.shippingCost.toString()),
      totalAmount: parseFloat(sale.totalAmount.toString()),

      // VAT Breakdown (BIR Compliance)
      vatableSales,
      vatAmount,
      vatExemptAmount,
      vatExempt: sale.vatExempt,

      // Payments
      payments: sale.payments.map(payment => ({
        method: payment.paymentMethod,
        amount: parseFloat(payment.amount.toString()),
        reference: payment.referenceNumber,
        paidAt: payment.paidAt,
      })),

      // Warranty
      warrantyTerms: sale.warrantyTerms,

      // Notes
      notes: sale.notes,

      // Reprint indicator
      isReprint: true,
      reprintDate: new Date(),
      reprintBy: session.user.username || session.user.name || 'Unknown',
    }

    // Create audit log for reprint action
    await createAuditLog({
      businessId,
      userId: parseInt(session.user.id),
      username: session.user.username || session.user.name || 'Unknown',
      action: AuditAction.SALE_UPDATE,
      entityType: EntityType.SALE,
      entityIds: [saleId],
      description: `Receipt reprinted for Invoice ${sale.invoiceNumber}`,
      metadata: {
        invoiceNumber: sale.invoiceNumber,
        totalAmount: grossSales,
        reprintReason: 'Manual reprint request',
      },
    })

    return NextResponse.json({ receipt: receiptData })
  } catch (error: any) {
    console.error('Error retrieving sale for reprint:', error)
    return NextResponse.json(
      { error: 'Failed to retrieve sale for reprint', details: error.message },
      { status: 500 }
    )
  }
}
