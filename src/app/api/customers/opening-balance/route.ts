import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth.simple'
import { prisma } from '@/lib/prisma.simple'
import { PERMISSIONS } from '@/lib/rbac'

/**
 * POST /api/customers/opening-balance
 *
 * Creates or updates an Opening Balance invoice for a customer.
 * This allows entering previous outstanding balances into the AR system.
 *
 * - If customer has no existing OB invoice: Creates new one
 * - If customer already has OB invoice: Updates the amount (adds to it)
 * - History is tracked in notes field for audit trail
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = session.user as any
    const businessId = parseInt(String(user.businessId))

    // Check permission - CUSTOMER_UPDATE is available to Warehouse Manager and Admin
    if (!user.permissions?.includes(PERMISSIONS.CUSTOMER_UPDATE)) {
      return NextResponse.json(
        { error: 'Forbidden - You do not have permission to manage opening balances' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { customerId, amount, notes } = body

    // Validation
    if (!customerId || isNaN(parseInt(String(customerId)))) {
      return NextResponse.json(
        { error: 'Customer ID is required' },
        { status: 400 }
      )
    }

    if (!amount || isNaN(parseFloat(String(amount))) || parseFloat(String(amount)) <= 0) {
      return NextResponse.json(
        { error: 'Amount must be a positive number' },
        { status: 400 }
      )
    }

    const customerIdNum = parseInt(String(customerId))
    const amountNum = parseFloat(String(amount))

    // Verify customer exists and belongs to this business
    const customer = await prisma.customer.findFirst({
      where: {
        id: customerIdNum,
        businessId,
        deletedAt: null,
      },
    })

    if (!customer) {
      return NextResponse.json(
        { error: 'Customer not found' },
        { status: 404 }
      )
    }

    // Get first active location for this business (location doesn't matter for OB invoices)
    const location = await prisma.businessLocation.findFirst({
      where: {
        businessId,
        isActive: true,
        deletedAt: null,
      },
      orderBy: { id: 'asc' },
    })

    if (!location) {
      return NextResponse.json(
        { error: 'No active business location found' },
        { status: 400 }
      )
    }

    // Format date for notes (Philippine format)
    const now = new Date()
    const phDate = now.toLocaleDateString('en-PH', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      timeZone: 'Asia/Manila',
    })

    // Check for existing OB invoice for this customer
    const existingOBInvoice = await prisma.sale.findFirst({
      where: {
        businessId,
        customerId: customerIdNum,
        invoiceNumber: { startsWith: 'OB-' },
        deletedAt: null,
        status: { notIn: ['cancelled', 'voided'] },
      },
    })

    if (existingOBInvoice) {
      // UPDATE existing OB invoice
      const previousAmount = parseFloat(existingOBInvoice.totalAmount.toString())
      const newTotalAmount = previousAmount + amountNum

      // Build new notes entry
      const notesEntry = notes
        ? `+₱${amountNum.toLocaleString()} (${phDate}) - ${notes}`
        : `+₱${amountNum.toLocaleString()} (${phDate})`

      // Append to existing notes
      const updatedNotes = existingOBInvoice.notes
        ? `${existingOBInvoice.notes} | ${notesEntry}`
        : `Opening Balance | ${notesEntry}`

      // Update the invoice
      const updatedInvoice = await prisma.sale.update({
        where: { id: existingOBInvoice.id },
        data: {
          totalAmount: newTotalAmount,
          subtotal: newTotalAmount,
          notes: updatedNotes,
        },
        include: {
          customer: {
            select: { id: true, name: true },
          },
        },
      })

      console.log(`[Opening Balance] Updated OB invoice ${updatedInvoice.invoiceNumber} for customer ${customer.name}: ₱${previousAmount} + ₱${amountNum} = ₱${newTotalAmount}`)

      return NextResponse.json({
        success: true,
        action: 'updated',
        invoice: {
          id: updatedInvoice.id,
          invoiceNumber: updatedInvoice.invoiceNumber,
          totalAmount: newTotalAmount,
          previousAmount: previousAmount,
          amountAdded: amountNum,
          customerId: customerIdNum,
          customerName: customer.name,
        },
      })
    } else {
      // CREATE new OB invoice
      const invoiceNumber = `OB-${customerIdNum}`

      // Build notes with initial entry
      const initialNotes = notes
        ? `Opening Balance | ₱${amountNum.toLocaleString()} (${phDate}) - ${notes}`
        : `Opening Balance | ₱${amountNum.toLocaleString()} (${phDate})`

      // Get today's date for saleDate (as UTC date for storage)
      const today = new Date()
      today.setHours(0, 0, 0, 0)

      // Create the OB invoice
      const newInvoice = await prisma.sale.create({
        data: {
          businessId,
          locationId: location.id,
          customerId: customerIdNum,
          invoiceNumber,
          saleDate: today,
          status: 'pending', // Pending because it's unpaid
          saleType: 'regular',
          subtotal: amountNum,
          taxAmount: 0,
          discountAmount: 0,
          shippingCost: 0,
          totalAmount: amountNum,
          paidAmount: 0,
          notes: initialNotes,
          createdBy: parseInt(String(user.id)),
        },
        include: {
          customer: {
            select: { id: true, name: true },
          },
        },
      })

      console.log(`[Opening Balance] Created OB invoice ${newInvoice.invoiceNumber} for customer ${customer.name}: ₱${amountNum}`)

      return NextResponse.json({
        success: true,
        action: 'created',
        invoice: {
          id: newInvoice.id,
          invoiceNumber: newInvoice.invoiceNumber,
          totalAmount: amountNum,
          previousAmount: 0,
          amountAdded: amountNum,
          customerId: customerIdNum,
          customerName: customer.name,
        },
      })
    }
  } catch (error) {
    console.error('[Opening Balance] Error:', error)
    return NextResponse.json(
      { error: 'Failed to process opening balance', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
  }
}

/**
 * GET /api/customers/opening-balance?customerId=123
 *
 * If customerId provided: Gets the opening balance invoice for that customer
 * If no customerId: Gets ALL opening balance invoices for the business
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = session.user as any
    const businessId = parseInt(String(user.businessId))

    const { searchParams } = new URL(request.url)
    const customerId = searchParams.get('customerId')

    // If customerId provided, return single customer's OB invoice
    if (customerId) {
      const customerIdNum = parseInt(customerId)

      const obInvoice = await prisma.sale.findFirst({
        where: {
          businessId,
          customerId: customerIdNum,
          invoiceNumber: { startsWith: 'OB-' },
          deletedAt: null,
          status: { notIn: ['cancelled', 'voided'] },
        },
        select: {
          id: true,
          invoiceNumber: true,
          totalAmount: true,
          paidAmount: true,
          notes: true,
          saleDate: true,
          createdAt: true,
        },
      })

      if (!obInvoice) {
        return NextResponse.json({
          exists: false,
          invoice: null,
        })
      }

      const totalAmount = parseFloat(obInvoice.totalAmount.toString())
      const paidAmount = parseFloat(obInvoice.paidAmount?.toString() || '0')

      return NextResponse.json({
        exists: true,
        invoice: {
          id: obInvoice.id,
          invoiceNumber: obInvoice.invoiceNumber,
          totalAmount,
          paidAmount,
          remainingBalance: totalAmount - paidAmount,
          notes: obInvoice.notes,
          saleDate: obInvoice.saleDate,
          createdAt: obInvoice.createdAt,
        },
      })
    }

    // No customerId - return ALL OB invoices for the business
    const obInvoices = await prisma.sale.findMany({
      where: {
        businessId,
        invoiceNumber: { startsWith: 'OB-' },
        deletedAt: null,
        status: { notIn: ['cancelled', 'voided'] },
      },
      include: {
        customer: {
          select: {
            id: true,
            name: true,
            mobile: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    })

    const invoices = obInvoices.map((inv) => {
      const totalAmount = parseFloat(inv.totalAmount.toString())
      const paidAmount = parseFloat(inv.paidAmount?.toString() || '0')
      return {
        id: inv.id,
        invoiceNumber: inv.invoiceNumber,
        customerId: inv.customerId,
        customerName: inv.customer?.name || 'Unknown',
        customerMobile: inv.customer?.mobile || '',
        totalAmount,
        paidAmount,
        remainingBalance: totalAmount - paidAmount,
        notes: inv.notes,
        saleDate: inv.saleDate,
        createdAt: inv.createdAt,
      }
    })

    return NextResponse.json({
      invoices,
      total: invoices.length,
      totalBalance: invoices.reduce((sum, inv) => sum + inv.totalAmount, 0),
      totalPaid: invoices.reduce((sum, inv) => sum + inv.paidAmount, 0),
      totalRemaining: invoices.reduce((sum, inv) => sum + inv.remainingBalance, 0),
    })
  } catch (error) {
    console.error('[Opening Balance GET] Error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch opening balance' },
      { status: 500 }
    )
  }
}
