import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth.simple'
import { prisma } from '@/lib/prisma.simple'
import { PERMISSIONS } from '@/lib/rbac'
import { sendTelegramCustomerEditAlert } from '@/lib/telegram'

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
    const businessId = parseInt(String(user.businessId))
    const { id } = await params
    const customerId = parseInt(id)

    // Check permission
    if (!user.permissions?.includes(PERMISSIONS.CUSTOMER_UPDATE)) {
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

    // Verify customer exists and belongs to business
    const existingCustomer = await prisma.customer.findFirst({
      where: {
        id: customerId,
        businessId: parseInt(businessId),
        deletedAt: null
      }
    })

    if (!existingCustomer) {
      return NextResponse.json(
        { error: 'Customer not found' },
        { status: 404 }
      )
    }

    // Check if new name conflicts with another customer (case-insensitive)
    if (name.toLowerCase().trim() !== existingCustomer.name.toLowerCase().trim()) {
      const nameConflict = await prisma.customer.findFirst({
        where: {
          businessId: parseInt(businessId),
          name: {
            equals: name.trim(),
            mode: 'insensitive'
          },
          deletedAt: null,
          id: {
            not: customerId
          }
        }
      })

      if (nameConflict) {
        return NextResponse.json(
          { error: `Customer name "${name}" already exists. Please use a different name.` },
          { status: 409 }
        )
      }
    }

    // Update customer
    const customer = await prisma.customer.update({
      where: { id: customerId },
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
        creditLimit: creditLimit ? parseFloat(creditLimit) : null,
        isActive,
      },
    })

    // Send Telegram notification if name changed
    if (existingCustomer.name !== name) {
      try {
        await sendTelegramCustomerEditAlert({
          previousName: existingCustomer.name,
          currentName: name,
          changedBy: `${user.firstName} ${user.lastName || ''}`.trim() || user.username,
          timestamp: new Date(),
          customerDetails: {
            mobile: mobile || undefined,
            email: email || undefined,
            address: address || undefined,
          }
        })
      } catch (error) {
        console.error('Failed to send Telegram customer edit alert:', error)
        // Don't fail the request if Telegram notification fails
      }
    }

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
    const businessId = parseInt(String(user.businessId))
    const { id } = await params
    const customerId = parseInt(id)

    // Check permission
    if (!user.permissions?.includes(PERMISSIONS.CUSTOMER_DELETE)) {
      return NextResponse.json(
        { error: 'Forbidden - Insufficient permissions' },
        { status: 403 }
      )
    }

    // Verify customer exists and belongs to business
    const existingCustomer = await prisma.customer.findFirst({
      where: {
        id: customerId,
        businessId: parseInt(businessId),
        deletedAt: null
      }
    })

    if (!existingCustomer) {
      return NextResponse.json(
        { error: 'Customer not found' },
        { status: 404 }
      )
    }

    // Soft delete
    await prisma.customer.update({
      where: { id: customerId },
      data: { deletedAt: new Date() }
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
