import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth.simple'
import { prisma } from '@/lib/prisma.simple'
import { PERMISSIONS } from '@/lib/rbac'

// GET - Get single supplier
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

    const supplier = await prisma.supplier.findFirst({
      where: {
        id: parseInt(id),
        businessId: parseInt(businessId),
        deletedAt: null,
      },
    })

    if (!supplier) {
      return NextResponse.json({ error: 'Supplier not found' }, { status: 404 })
    }

    return NextResponse.json(supplier)
  } catch (error) {
    console.error('Error fetching supplier:', error)
    return NextResponse.json(
      { error: 'Failed to fetch supplier' },
      { status: 500 }
    )
  }
}

// PUT - Update supplier
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
    if (!user.permissions?.includes(PERMISSIONS.SUPPLIER_UPDATE)) {
      return NextResponse.json(
        { error: 'Forbidden - Insufficient permissions' },
        { status: 403 }
      )
    }

    // Verify supplier belongs to user's business
    const existing = await prisma.supplier.findFirst({
      where: {
        id: parseInt(id),
        businessId: parseInt(businessId),
        deletedAt: null,
      },
    })

    if (!existing) {
      return NextResponse.json({ error: 'Supplier not found' }, { status: 404 })
    }

    const body = await request.json()
    const {
      name,
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
      isActive,
    } = body

    // Validation
    if (name && name.trim().length === 0) {
      return NextResponse.json(
        { error: 'Supplier name cannot be empty' },
        { status: 400 }
      )
    }

    // Update supplier
    const supplier = await prisma.supplier.update({
      where: { id: parseInt(id) },
      data: {
        name,
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
        paymentTerms: paymentTerms ? parseInt(paymentTerms) : undefined,
        creditLimit: creditLimit ? parseFloat(creditLimit) : undefined,
        isActive,
      },
    })

    return NextResponse.json(supplier)
  } catch (error) {
    console.error('Error updating supplier:', error)
    return NextResponse.json(
      { error: 'Failed to update supplier' },
      { status: 500 }
    )
  }
}

// DELETE - Soft delete supplier
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
    if (!user.permissions?.includes(PERMISSIONS.SUPPLIER_DELETE)) {
      return NextResponse.json(
        { error: 'Forbidden - Insufficient permissions' },
        { status: 403 }
      )
    }

    // Verify supplier belongs to user's business
    const existing = await prisma.supplier.findFirst({
      where: {
        id: parseInt(id),
        businessId: parseInt(businessId),
        deletedAt: null,
      },
    })

    if (!existing) {
      return NextResponse.json({ error: 'Supplier not found' }, { status: 404 })
    }

    // Soft delete
    await prisma.supplier.update({
      where: { id: parseInt(id) },
      data: { deletedAt: new Date() },
    })

    return NextResponse.json({ message: 'Supplier deleted successfully' })
  } catch (error) {
    console.error('Error deleting supplier:', error)
    return NextResponse.json(
      { error: 'Failed to delete supplier' },
      { status: 500 }
    )
  }
}
