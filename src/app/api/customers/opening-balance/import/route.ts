import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth.simple'
import { prisma } from '@/lib/prisma.simple'
import { PERMISSIONS } from '@/lib/rbac'

interface ImportRow {
  CustomerName?: string
  OpeningBalance?: string | number
  Notes?: string
  // Alternative column names
  Name?: string
  customer_name?: string
  opening_balance?: string | number
  Amount?: string | number
  Balance?: string | number
  notes?: string
}

interface ImportResult {
  success: number
  failed: number
  skipped: number
  totalAmountImported: number
  errors: Array<{
    row: number
    customerName: string
    error: string
  }>
  successDetails: Array<{
    row: number
    customerName: string
    customerId: number
    amount: number
    invoiceNumber: string
    action: 'created' | 'updated'
  }>
}

/**
 * POST /api/customers/opening-balance/import
 *
 * Bulk import opening balances from CSV data.
 * Matches customers by name (case-insensitive).
 * Creates or updates OB invoices for each matched customer.
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = session.user as any
    const businessId = parseInt(String(user.businessId))
    const userId = parseInt(String(user.id))

    // Check permission - CUSTOMER_UPDATE
    if (!user.permissions?.includes(PERMISSIONS.CUSTOMER_UPDATE)) {
      return NextResponse.json(
        { error: 'Forbidden - You do not have permission to import opening balances' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { data } = body as { data: ImportRow[] }

    if (!data || !Array.isArray(data) || data.length === 0) {
      return NextResponse.json(
        { error: 'No data provided. Please upload a CSV file with customer data.' },
        { status: 400 }
      )
    }

    // Get first active location for this business
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

    // Get all customers for this business (for matching)
    const customers = await prisma.customer.findMany({
      where: {
        businessId,
        deletedAt: null,
      },
      select: {
        id: true,
        name: true,
      },
    })

    // Create case-insensitive lookup map
    const customerMap = new Map<string, { id: number; name: string }>()
    for (const customer of customers) {
      const normalizedName = customer.name.toLowerCase().trim()
      customerMap.set(normalizedName, customer)
    }

    // Format date for notes (Philippine format)
    const now = new Date()
    const phDate = now.toLocaleDateString('en-PH', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      timeZone: 'Asia/Manila',
    })

    // Get today's date for saleDate
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    // Process results
    const result: ImportResult = {
      success: 0,
      failed: 0,
      skipped: 0,
      totalAmountImported: 0,
      errors: [],
      successDetails: [],
    }

    // Process each row
    for (let i = 0; i < data.length; i++) {
      const row = data[i]
      const rowNumber = i + 2 // +2 because row 1 is header, array is 0-indexed

      // Extract customer name (support multiple column names)
      const customerName = (
        row.CustomerName || row.Name || row.customer_name || ''
      ).toString().trim()

      // Extract amount (support multiple column names)
      const amountRaw = row.OpeningBalance || row.opening_balance || row.Amount || row.Balance || '0'
      const amountStr = amountRaw.toString().replace(/[₱,\s]/g, '').trim()
      const amount = parseFloat(amountStr)

      // Extract notes
      const notes = (row.Notes || row.notes || '').toString().trim()

      // Skip empty rows
      if (!customerName || customerName.toUpperCase() === 'NULL') {
        result.skipped++
        continue
      }

      // Validate amount
      if (isNaN(amount) || amount <= 0) {
        result.failed++
        result.errors.push({
          row: rowNumber,
          customerName,
          error: `Invalid amount: "${amountRaw}". Must be a positive number.`,
        })
        continue
      }

      // Find customer (case-insensitive)
      const normalizedName = customerName.toLowerCase().trim()
      const customer = customerMap.get(normalizedName)

      if (!customer) {
        result.failed++
        result.errors.push({
          row: rowNumber,
          customerName,
          error: 'Customer not found in database. Name must match exactly (case-insensitive).',
        })
        continue
      }

      try {
        // Check for existing OB invoice for this customer
        const existingOBInvoice = await prisma.sale.findFirst({
          where: {
            businessId,
            customerId: customer.id,
            invoiceNumber: { startsWith: 'OB-' },
            deletedAt: null,
            status: { notIn: ['cancelled', 'voided'] },
          },
        })

        if (existingOBInvoice) {
          // UPDATE existing OB invoice
          const previousAmount = parseFloat(existingOBInvoice.totalAmount.toString())
          const newTotalAmount = previousAmount + amount

          // Build new notes entry
          const notesEntry = notes
            ? `+₱${amount.toLocaleString()} (${phDate}) - ${notes} [CSV Import]`
            : `+₱${amount.toLocaleString()} (${phDate}) [CSV Import]`

          // Append to existing notes
          const updatedNotes = existingOBInvoice.notes
            ? `${existingOBInvoice.notes} | ${notesEntry}`
            : `Opening Balance | ${notesEntry}`

          // Update the invoice
          await prisma.sale.update({
            where: { id: existingOBInvoice.id },
            data: {
              totalAmount: newTotalAmount,
              subtotal: newTotalAmount,
              notes: updatedNotes,
            },
          })

          result.success++
          result.totalAmountImported += amount
          result.successDetails.push({
            row: rowNumber,
            customerName: customer.name,
            customerId: customer.id,
            amount,
            invoiceNumber: existingOBInvoice.invoiceNumber,
            action: 'updated',
          })
        } else {
          // CREATE new OB invoice
          const invoiceNumber = `OB-${customer.id}`

          // Build notes with initial entry
          const initialNotes = notes
            ? `Opening Balance | ₱${amount.toLocaleString()} (${phDate}) - ${notes} [CSV Import]`
            : `Opening Balance | ₱${amount.toLocaleString()} (${phDate}) [CSV Import]`

          // Create the OB invoice
          const newInvoice = await prisma.sale.create({
            data: {
              businessId,
              locationId: location.id,
              customerId: customer.id,
              invoiceNumber,
              saleDate: today,
              status: 'pending',
              saleType: 'regular',
              subtotal: amount,
              taxAmount: 0,
              discountAmount: 0,
              shippingCost: 0,
              totalAmount: amount,
              paidAmount: 0,
              notes: initialNotes,
              createdBy: userId,
            },
          })

          result.success++
          result.totalAmountImported += amount
          result.successDetails.push({
            row: rowNumber,
            customerName: customer.name,
            customerId: customer.id,
            amount,
            invoiceNumber: newInvoice.invoiceNumber,
            action: 'created',
          })
        }
      } catch (error) {
        result.failed++
        result.errors.push({
          row: rowNumber,
          customerName,
          error: `Database error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        })
      }
    }

    console.log(`[Opening Balance Import] Completed: ${result.success} success, ${result.failed} failed, ${result.skipped} skipped. Total amount: ₱${result.totalAmountImported.toLocaleString()}`)

    return NextResponse.json({
      success: true,
      results: result,
    })
  } catch (error) {
    console.error('[Opening Balance Import] Error:', error)
    return NextResponse.json(
      { error: 'Failed to import opening balances', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
  }
}
