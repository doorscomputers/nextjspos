import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth.simple'
import { prisma } from '@/lib/prisma.simple'
import { PERMISSIONS } from '@/lib/rbac'

// GET - List all customers
// NOTE: NO permission check - all authenticated users can view customers
// This is essential for POS functionality where cashiers need to select customers
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = session.user as any
    console.log('[API /customers GET] User:', user.username, 'BusinessId:', user.businessId)
    const businessId = parseInt(String(user.businessId))

    if (isNaN(businessId)) {
      console.error('[API /customers GET] Invalid businessId:', user.businessId)
      return NextResponse.json({ error: 'Invalid business ID' }, { status: 400 })
    }
    // Get query parameters for filtering
    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search')
    const activeOnly = searchParams.get('activeOnly') === 'true'

    const where: any = {
      businessId: parseInt(businessId),
      deletedAt: null,
    }

    if (activeOnly) {
      where.isActive = true
    }

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { mobile: { contains: search, mode: 'insensitive' } },
      ]
    }

    console.log('[API /customers GET] Fetching customers for businessId:', businessId)
    // OPTIMIZED: Fetch customers with their sales in a single query (fixes N+1 problem)
    const customers = await prisma.customer.findMany({
      where,
      include: {
        sales: {
          where: {
            deletedAt: null,
            status: { notIn: ["voided", "cancelled"] }, // Exclude voided/cancelled from AR calculation
          },
          select: {
            totalAmount: true,
            paidAmount: true,
          },
        },
      },
      orderBy: {
        name: 'asc',
      },
    })
    console.log('[API /customers GET] Found', customers.length, 'customers')

    // Calculate AR balance for each customer (unpaid invoices)
    try {
      // OPTIMIZED: Calculate AR balances in memory (no additional DB queries)
      const customersWithBalance = customers.map((customer) => {
        try {
          // Calculate total AR balance (only include invoices with outstanding balance)
          const arBalance = customer.sales.reduce((total, invoice) => {
            const totalAmount = parseFloat(invoice.totalAmount.toString())
            const paidAmount = parseFloat(invoice.paidAmount?.toString() || '0')
            const balance = totalAmount - paidAmount
            // Only add if there's an outstanding balance (more than 1 cent)
            return balance > 0.01 ? total + balance : total
          }, 0)

          // Remove sales array from response (not needed in client)
          const { sales, ...customerData } = customer

          return {
            ...customerData,
            arBalance: arBalance > 0 ? arBalance : 0,
            hasUnpaidInvoices: arBalance > 0,
          }
        } catch (customerError) {
          console.error('[API /customers GET] Error calculating AR for customer', customer.id, ':', customerError)
          // Return customer without AR balance if there's an error
          const { sales, ...customerData } = customer
          return {
            ...customerData,
            arBalance: 0,
            hasUnpaidInvoices: false,
          }
        }
      })

      console.log('[API /customers GET] Returning', customersWithBalance.length, 'customers with AR balances')
      return NextResponse.json(customersWithBalance)
    } catch (arError) {
      console.error('[API /customers GET] Error in AR calculation, returning customers without AR:', arError)
      // If AR calculation fails, return customers without AR balance
      const customersBasic = customers.map(c => ({
        ...c,
        arBalance: 0,
        hasUnpaidInvoices: false,
      }))
      return NextResponse.json(customersBasic)
    }
  } catch (error) {
    console.error('Error fetching customers:', error)
    return NextResponse.json(
      { error: 'Failed to fetch customers' },
      { status: 500 }
    )
  }
}

// POST - Create new customer
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = session.user as any
    const businessId = parseInt(String(user.businessId))
    // Check permission
    if (!user.permissions?.includes(PERMISSIONS.CUSTOMER_CREATE)) {
      return NextResponse.json(
        { error: 'Forbidden - Insufficient permissions' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const {
      name,
      email,
      mobile,
      alternateNumber,
      address,
      city,
      state,
      country,
      zipCode,
      taxNumber,
      creditLimit,
      isActive = true,
    } = body

    // Validation
    if (!name || name.trim().length === 0) {
      return NextResponse.json(
        { error: 'Customer name is required' },
        { status: 400 }
      )
    }

    // Check if customer name already exists for this business (case-insensitive)
    const existingCustomer = await prisma.customer.findFirst({
      where: {
        businessId: parseInt(businessId),
        name: {
          equals: name.trim(),
          mode: 'insensitive'
        },
        deletedAt: null
      }
    })

    if (existingCustomer) {
      return NextResponse.json(
        { error: `Customer name "${name}" already exists. Please use a different name.` },
        { status: 409 }
      )
    }

    // Create customer
    const customer = await prisma.customer.create({
      data: {
        businessId: parseInt(businessId),
        name,
        email,
        mobile,
        alternateNumber,
        address,
        city,
        state,
        country,
        zipCode,
        taxNumber,
        creditLimit: creditLimit ? parseFloat(creditLimit) : null,
        isActive,
      },
    })

    return NextResponse.json(customer, { status: 201 })
  } catch (error) {
    console.error('Error creating customer:', error)
    return NextResponse.json(
      { error: 'Failed to create customer' },
      { status: 500 }
    )
  }
}
