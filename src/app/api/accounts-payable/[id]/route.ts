import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth.simple'
import { prisma } from '@/lib/prisma.simple'
import { PERMISSIONS } from '@/lib/rbac'

// GET - Get specific accounts payable entry
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

    // Check permission
    if (!user.permissions?.includes(PERMISSIONS.ACCOUNTS_PAYABLE_VIEW)) {
      return NextResponse.json(
        { error: 'Forbidden - Insufficient permissions' },
        { status: 403 }
      )
    }

    const accountsPayable = await prisma.accountsPayable.findFirst({
      where: {
        id: parseInt(id),
        businessId: parseInt(businessId),
        deletedAt: null,
      },
      include: {
        supplier: true,
        purchase: {
          include: {
            items: {
              include: {
                receiptItems: true,
              },
            },
          },
        },
        payments: {
          orderBy: {
            paymentDate: 'desc',
          },
        },
      },
    })

    if (!accountsPayable) {
      return NextResponse.json(
        { error: 'Accounts payable entry not found' },
        { status: 404 }
      )
    }

    return NextResponse.json(accountsPayable)
  } catch (error) {
    console.error('Error fetching accounts payable:', error)
    return NextResponse.json(
      { error: 'Failed to fetch accounts payable' },
      { status: 500 }
    )
  }
}

// PUT - Update accounts payable entry
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
    if (!user.permissions?.includes(PERMISSIONS.ACCOUNTS_PAYABLE_UPDATE)) {
      return NextResponse.json(
        { error: 'Forbidden - Insufficient permissions' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { invoiceNumber, invoiceDate, dueDate, totalAmount, paymentTerms, notes } = body

    // Verify exists and belongs to business
    const existing = await prisma.accountsPayable.findFirst({
      where: {
        id: parseInt(id),
        businessId: parseInt(businessId),
        deletedAt: null,
      },
    })

    if (!existing) {
      return NextResponse.json(
        { error: 'Accounts payable entry not found' },
        { status: 404 }
      )
    }

    const updateData: any = {}

    if (invoiceNumber !== undefined) updateData.invoiceNumber = invoiceNumber
    if (invoiceDate !== undefined) updateData.invoiceDate = new Date(invoiceDate)
    if (dueDate !== undefined) updateData.dueDate = new Date(dueDate)
    if (totalAmount !== undefined) {
      updateData.totalAmount = parseFloat(totalAmount)
      // Recalculate balance amount
      const paidAmount = parseFloat(existing.paidAmount.toString())
      updateData.balanceAmount = parseFloat(totalAmount) - paidAmount
    }
    if (paymentTerms !== undefined) updateData.paymentTerms = parseInt(paymentTerms)
    if (notes !== undefined) updateData.notes = notes

    const updated = await prisma.accountsPayable.update({
      where: { id: parseInt(id) },
      data: updateData,
      include: {
        supplier: true,
        purchase: true,
        payments: true,
      },
    })

    return NextResponse.json(updated)
  } catch (error) {
    console.error('Error updating accounts payable:', error)
    return NextResponse.json(
      {
        error: 'Failed to update accounts payable',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

// DELETE - Delete accounts payable entry
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
    if (!user.permissions?.includes(PERMISSIONS.ACCOUNTS_PAYABLE_DELETE)) {
      return NextResponse.json(
        { error: 'Forbidden - Insufficient permissions' },
        { status: 403 }
      )
    }

    // Verify exists and belongs to business
    const existing = await prisma.accountsPayable.findFirst({
      where: {
        id: parseInt(id),
        businessId: parseInt(businessId),
        deletedAt: null,
      },
      include: {
        payments: true,
      },
    })

    if (!existing) {
      return NextResponse.json(
        { error: 'Accounts payable entry not found' },
        { status: 404 }
      )
    }

    // Check if there are payments
    if (existing.payments.length > 0) {
      return NextResponse.json(
        { error: 'Cannot delete accounts payable with existing payments' },
        { status: 400 }
      )
    }

    // Soft delete
    await prisma.accountsPayable.update({
      where: { id: parseInt(id) },
      data: { deletedAt: new Date() },
    })

    return NextResponse.json({ message: 'Accounts payable deleted successfully' })
  } catch (error) {
    console.error('Error deleting accounts payable:', error)
    return NextResponse.json(
      {
        error: 'Failed to delete accounts payable',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
