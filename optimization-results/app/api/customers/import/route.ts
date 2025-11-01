import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { isSuperAdmin } from '@/lib/rbac'

interface CustomerCSVRow {
  'Name': string
  'Address'?: string
  'ContactNumber'?: string
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
    const { customers } = body

    if (!Array.isArray(customers) || customers.length === 0) {
      return NextResponse.json({ error: 'No customers to import' }, { status: 400 })
    }

    const results = {
      success: 0,
      failed: 0,
      skipped: 0,
      errors: [] as Array<{ row: number; name: string; error: string }>
    }

    // Process each customer
    for (let i = 0; i < customers.length; i++) {
      const customer = customers[i] as any
      const rowNumber = i + 2 // Account for header row

      try {
        // Handle multiple CSV formats
        let customerName: string | null = null
        let address: string | null = null
        let mobile: string | null = null

        // Format 1: CSV with standard headers
        if (customer['Name']) {
          customerName = customer['Name'].trim()
          address = customer['Address']?.trim() || null
          mobile = customer['ContactNumber']?.trim() || null
        }
        // Format 2: CSV with different casing or first column
        else if (customer[Object.keys(customer)[0]]) {
          const keys = Object.keys(customer)
          customerName = customer[keys[0]]?.trim() || null
          address = customer[keys[1]]?.trim() || null
          mobile = customer[keys[2]]?.trim() || null
        }

        // Validate required fields
        if (!customerName || customerName === '') {
          results.skipped++
          results.errors.push({
            row: rowNumber,
            name: 'N/A',
            error: 'Customer name is required'
          })
          continue
        }

        // Skip rows with 'NULL' as the name
        if (customerName.toUpperCase() === 'NULL') {
          results.skipped++
          results.errors.push({
            row: rowNumber,
            name: customerName,
            error: 'Invalid customer name (NULL)'
          })
          continue
        }

        // Clean up NULL values from CSV
        if (address && address.toUpperCase() === 'NULL') {
          address = null
        }
        if (mobile && mobile.toUpperCase() === 'NULL') {
          mobile = null
        }

        // Check if customer already exists by name and mobile
        const existingCustomer = await prisma.customer.findFirst({
          where: {
            businessId,
            name: customerName,
            ...(mobile && { mobile })
          }
        })

        if (existingCustomer) {
          results.skipped++
          results.errors.push({
            row: rowNumber,
            name: customerName,
            error: 'Customer with this name and mobile already exists'
          })
          continue
        }

        // Create customer
        await prisma.customer.create({
          data: {
            name: customerName,
            address,
            mobile,
            businessId,
            isActive: { select: { id: true, name: true } }
          }
        })

        results.success++
      } catch (error: any) {
        results.failed++
        results.errors.push({
          row: rowNumber,
          name: customer['Name'] || 'N/A',
          error: error.message
        })
      }
    }

    return NextResponse.json({
      success: { select: { id: true, name: true } },
      results
    })

  } catch (error: any) {
    console.error('Import customers error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to import customers' },
      { status: 500 }
    )
  }
}
