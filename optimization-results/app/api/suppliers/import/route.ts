import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { PERMISSIONS, isSuperAdmin } from '@/lib/rbac'

interface SupplierCSVRow {
  'Supplier': string
  'Contact Person'?: string
  'Email'?: string
  'Mobile'?: string
  'Alternate Number'?: string
  'Address'?: string
  'City'?: string
  'State'?: string
  'Country'?: string
  'Zip Code'?: string
  'Tax Number'?: string
  'Payment Terms (Days)'?: string
  'Credit Limit'?: string
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
    const { suppliers } = body

    if (!Array.isArray(suppliers) || suppliers.length === 0) {
      return NextResponse.json({ error: 'No suppliers to import' }, { status: 400 })
    }

    const results = {
      success: 0,
      failed: 0,
      skipped: 0,
      errors: [] as Array<{ row: number; name: string; error: string }>
    }

    // Process each supplier
    for (let i = 0; i < suppliers.length; i++) {
      const supplier = suppliers[i] as any
      const rowNumber = i + 2 // Account for header row

      try {
        // Handle multiple CSV formats
        let supplierName: string | null = null
        let contactPerson: string | null = null
        let email: string | null = null
        let mobile: string | null = null
        let alternateNumber: string | null = null
        let address: string | null = null
        let city: string | null = null
        let state: string | null = null
        let country: string | null = null
        let zipCode: string | null = null
        let taxNumber: string | null = null
        let paymentTerms: number | null = null
        let creditLimit: number | null = null

        // Format 1: CSV with "Supplier" header
        if (supplier['Supplier']) {
          supplierName = supplier['Supplier'].trim()
          contactPerson = supplier['Contact Person']?.trim() || null
          email = supplier['Email']?.trim() || null
          mobile = supplier['Mobile']?.trim() || null
          alternateNumber = supplier['Alternate Number']?.trim() || null
          address = supplier['Address']?.trim() || null
          city = supplier['City']?.trim() || null
          state = supplier['State']?.trim() || null
          country = supplier['Country']?.trim() || null
          zipCode = supplier['Zip Code']?.trim() || null
          taxNumber = supplier['Tax Number']?.trim() || null

          if (supplier['Payment Terms (Days)']) {
            paymentTerms = parseInt(supplier['Payment Terms (Days)'])
          }

          if (supplier['Credit Limit']) {
            creditLimit = parseFloat(supplier['Credit Limit'].replace(/[₱,]/g, ''))
          }
        }
        // Format 2: CSV with column A only (first column, no specific header)
        else if (supplier[Object.keys(supplier)[0]]) {
          const firstColumn = Object.keys(supplier)[0]
          supplierName = supplier[firstColumn].trim()
        }

        // Validate required fields
        if (!supplierName || supplierName === '') {
          results.skipped++
          results.errors.push({
            row: rowNumber,
            name: 'N/A',
            error: 'Supplier name is required'
          })
          continue
        }

        // Check if supplier already exists
        const existingSupplier = await prisma.supplier.findFirst({
          where: {
            businessId,
            name: supplierName
          }
        })

        if (existingSupplier) {
          results.skipped++
          results.errors.push({
            row: rowNumber,
            name: supplierName,
            error: 'Supplier with this name already exists'
          })
          continue
        }

        // Create supplier
        await prisma.supplier.create({
          data: {
            name: supplierName,
            contactPerson,
            email,
            mobile,
            alternateNumber,
            address,
            city,
            state,
            country,
            zipCode,
            taxNumber,
            paymentTerms,
            creditLimit,
            isActive: { select: { id: true, name: true } },
            businessId
          }
        })

        results.success++
      } catch (error: any) {
        results.failed++
        results.errors.push({
          row: rowNumber,
          name: supplier['Supplier'] || 'N/A',
          error: error.message
        })
      }
    }

    return NextResponse.json({
      success: { select: { id: true, name: true } },
      results
    })

  } catch (error: any) {
    console.error('Import suppliers error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to import suppliers' },
      { status: 500 }
    )
  }
}
