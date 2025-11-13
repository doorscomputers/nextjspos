import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth.simple'
import { prisma } from '@/lib/prisma.simple'
import { PERMISSIONS } from '@/lib/rbac'

// GET - List all customers
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = session.user as any
    const businessId = parseInt(String(user.businessId))
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

    const customers = await prisma.customer.findMany({
      where,
      orderBy: {
        name: 'asc',
      },
    })

    // Calculate AR balance for each customer (unpaid invoices)
    const customersWithBalance = await Promise.all(
      customers.map(async (customer) => {
        const unpaidInvoices = await prisma.sale.findMany({
          where: {
            customerId: customer.id,
            status: 'pending', // Credit sales not fully paid
            deletedAt: null,
          },
          select: {
            totalAmount: true,
            paidAmount: true,
          },
        })

        // Calculate total AR balance
        const arBalance = unpaidInvoices.reduce((total, invoice) => {
          const balance = parseFloat(invoice.totalAmount.toString()) - parseFloat(invoice.paidAmount.toString())
          return total + balance
        }, 0)

        return {
          ...customer,
          arBalance: arBalance > 0 ? arBalance : 0,
          hasUnpaidInvoices: arBalance > 0,
        }
      })
    )

    return NextResponse.json(customersWithBalance)
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
