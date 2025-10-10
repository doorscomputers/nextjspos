import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { PERMISSIONS } from '@/lib/rbac'

// GET - Get single customer
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = session.user as any
    const businessId = user.businessId
    const { id } = await params

    const customer = await prisma.customer.findFirst({
      where: {
        id: parseInt(id),
        businessId: parseInt(businessId),
        deletedAt: null,
      },
    })

    if (!customer) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 })
    }

    return NextResponse.json(customer)
  } catch (error) {
    console.error('Error fetching customer:', error)
    return NextResponse.json(
      { error: 'Failed to fetch customer' },
      { status: 500 }
    )
  }
}

// PUT - Update customer
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = session.user as any
    const businessId = user.businessId
    const { id } = await params

    // Check permission
    if (!user.permissions?.includes(PERMISSIONS.CUSTOMER_UPDATE)) {
      return NextResponse.json(
        { error: 'Forbidden - Insufficient permissions' },
        { status: 403 }
      )
    }

    // Verify customer belongs to user's business
    const existing = await prisma.customer.findFirst({
      where: {
        id: parseInt(id),
        businessId: parseInt(businessId),
        deletedAt: null,
      },
    })

    if (!existing) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 })
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
      isActive,
    } = body

    // Validation
    if (name && name.trim().length === 0) {
      return NextResponse.json(
        { error: 'Customer name cannot be empty' },
        { status: 400 }
      )
    }

    // Update customer
    const customer = await prisma.customer.update({
      where: { id: parseInt(id) },
      data: {
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
        creditLimit: creditLimit ? parseFloat(creditLimit) : undefined,
        isActive,
      },
    })

    return NextResponse.json(customer)
  } catch (error) {
    console.error('Error updating customer:', error)
    return NextResponse.json(
      { error: 'Failed to update customer' },
      { status: 500 }
    )
  }
}

// DELETE - Soft delete customer
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = session.user as any
    const businessId = user.businessId
    const { id } = await params

    // Check permission
    if (!user.permissions?.includes(PERMISSIONS.CUSTOMER_DELETE)) {
      return NextResponse.json(
        { error: 'Forbidden - Insufficient permissions' },
        { status: 403 }
      )
    }

    // Verify customer belongs to user's business
    const existing = await prisma.customer.findFirst({
      where: {
        id: parseInt(id),
        businessId: parseInt(businessId),
        deletedAt: null,
      },
    })

    if (!existing) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 })
    }

    // Soft delete
    await prisma.customer.update({
      where: { id: parseInt(id) },
      data: { deletedAt: new Date() },
    })

    return NextResponse.json({ message: 'Customer deleted successfully' })
  } catch (error) {
    console.error('Error deleting customer:', error)
    return NextResponse.json(
      { error: 'Failed to delete customer' },
      { status: 500 }
    )
  }
}
