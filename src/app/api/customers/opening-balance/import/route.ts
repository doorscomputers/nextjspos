import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth.simple'
import { prisma } from '@/lib/prisma.simple'
import { PERMISSIONS } from '@/lib/rbac'
import * as XLSX from 'xlsx'
import Papa from 'papaparse'

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
 * Helper function to parse file data (supports CSV and Excel)
 */
async function parseFileData(file: File): Promise<ImportRow[]> {
  const arrayBuffer = await file.arrayBuffer()
  const buffer = Buffer.from(arrayBuffer)
  const fileName = file.name.toLowerCase()

  if (fileName.endsWith('.csv')) {
    const text = buffer.toString('utf-8')
    const result = Papa.parse(text, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (header) => header.trim(),
    })
    return (result.data || []) as ImportRow[]
  } else if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
    const workbook = XLSX.read(buffer, { type: 'buffer' })
    const sheetName = workbook.SheetNames[0]
    const worksheet = workbook.Sheets[sheetName]
    return (XLSX.utils.sheet_to_json(worksheet) || []) as ImportRow[]
  } else {
    throw new Error('Invalid file type. Please upload a CSV or Excel (.xlsx/.xls) file.')
  }
}

/**
 * GET /api/customers/opening-balance/import
 * Download Excel template for bulk import
 */
export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Create sample template
    const template = [
      { 'CustomerName': 'Juan Dela Cruz', 'OpeningBalance': 15000, 'Notes': 'From old system - 2024' },
      { 'CustomerName': 'Maria Santos', 'OpeningBalance': 8500, 'Notes': 'Legacy balance' },
      { 'CustomerName': 'ABC Corporation', 'OpeningBalance': 125000, 'Notes': 'Previous outstanding' },
    ]

    const worksheet = XLSX.utils.json_to_sheet(template)
    worksheet['!cols'] = [{ wch: 30 }, { wch: 20 }, { wch: 40 }]

    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Opening Balance Import')

    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' })

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': 'attachment; filename="opening-balance-import-template.xlsx"',
      },
    })
  } catch (error) {
    console.error('Template download error:', error)
    return NextResponse.json(
      { error: 'Failed to generate template' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/customers/opening-balance/import
 *
 * Bulk import opening balances from CSV or Excel file.
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

    // Parse FormData to get file
    const formData = await request.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json(
        { error: 'No file uploaded. Please select a CSV or Excel file.' },
        { status: 400 }
      )
    }

    // Parse file (CSV or Excel)
    let data: ImportRow[]
    try {
      data = await parseFileData(file)
    } catch (err: any) {
      return NextResponse.json(
        { error: err.message || 'Failed to parse file' },
        { status: 400 }
      )
    }

    if (!Array.isArray(data) || data.length === 0) {
      return NextResponse.json(
        { error: 'No data found in file. Please check your file contains data.' },
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
            ? `+₱${amount.toLocaleString()} (${phDate}) - ${notes} [Import]`
            : `+₱${amount.toLocaleString()} (${phDate}) [Import]`

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
            ? `Opening Balance | ₱${amount.toLocaleString()} (${phDate}) - ${notes} [Import]`
            : `Opening Balance | ₱${amount.toLocaleString()} (${phDate}) [Import]`

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
