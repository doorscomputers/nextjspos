import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth.simple'
import { prisma } from '@/lib/prisma'
import { hasPermission, PERMISSIONS } from '@/lib/rbac'
import { NextResponse } from 'next/server'
import { z } from 'zod'

// Validation schema for updating a printer
const updatePrinterSchema = z.object({
  name: z.string().min(1, 'Printer name is required').optional(),
  connectionType: z.enum(['network', 'windows', 'linux']).optional(),
  capabilityProfile: z.enum(['default', 'simple', 'SP2000', 'TEP-200M', 'P822D']).optional(),
  charPerLine: z.number().int().min(20).max(80).optional(),
  ipAddress: z.string().optional(),
  port: z.string().optional(),
  path: z.string().optional(),
})

/**
 * GET /api/printers/[id]
 * Get a single printer by ID
 */
export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!hasPermission(session.user, PERMISSIONS.PRINTER_VIEW)) {
      return NextResponse.json(
        { error: 'Forbidden - Insufficient permissions to view printers' },
        { status: 403 }
      )
    }

    // Parse ID as integer
    const printerId = parseInt(params.id)
    if (isNaN(printerId)) {
      return NextResponse.json(
        { error: 'Invalid printer ID' },
        { status: 400 }
      )
    }

    const printer = await prisma.printer.findFirst({
      where: {
        id: printerId,
        businessId: parseInt(session.user.businessId), // Prevent cross-tenant access
        deletedAt: null,
      },
      include: {
        business: {
          select: {
            id: true,
            name: true,
          }
        },
        locations: {
          select: {
            id: true,
            name: true,
            city: true,
          }
        }
      },
    })

    if (!printer) {
      return NextResponse.json(
        { error: 'Printer not found' },
        { status: 404 }
      )
    }

    return NextResponse.json(printer)
  } catch (error) {
    console.error('Error fetching printer:', {
      error,
      printerId: params.id,
      userId: session?.user?.id,
    })
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * PUT /api/printers/[id]
 * Update an existing printer
 */
export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!hasPermission(session.user, PERMISSIONS.PRINTER_UPDATE)) {
      return NextResponse.json(
        { error: 'Forbidden - Insufficient permissions to update printers' },
        { status: 403 }
      )
    }

    // Parse ID as integer
    const printerId = parseInt(params.id)
    if (isNaN(printerId)) {
      return NextResponse.json(
        { error: 'Invalid printer ID' },
        { status: 400 }
      )
    }

    // Verify printer exists and belongs to user's business
    const existingPrinter = await prisma.printer.findFirst({
      where: {
        id: printerId,
        businessId: parseInt(session.user.businessId),
        deletedAt: null,
      },
    })

    if (!existingPrinter) {
      return NextResponse.json(
        { error: 'Printer not found' },
        { status: 404 }
      )
    }

    // Validate request body
    const body = await request.json()
    const validationResult = updatePrinterSchema.safeParse(body)

    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validationResult.error.errors },
        { status: 400 }
      )
    }

    const data = validationResult.data

    // Check for duplicate name if name is being updated
    if (data.name && data.name !== existingPrinter.name) {
      const duplicatePrinter = await prisma.printer.findFirst({
        where: {
          businessId: parseInt(session.user.businessId),
          name: data.name,
          id: { not: printerId },
          deletedAt: null,
        }
      })

      if (duplicatePrinter) {
        return NextResponse.json(
          { error: 'A printer with this name already exists in your business' },
          { status: 409 }
        )
      }
    }

    // Validate connection-specific fields
    const connectionType = data.connectionType || existingPrinter.connectionType
    if (connectionType === 'network' && !data.ipAddress && !existingPrinter.ipAddress) {
      return NextResponse.json(
        { error: 'Network printers require an IP address' },
        { status: 400 }
      )
    }
    if ((connectionType === 'windows' || connectionType === 'linux') && !data.path && !existingPrinter.path) {
      return NextResponse.json(
        { error: 'Local printers require a device path' },
        { status: 400 }
      )
    }

    // Update printer
    const updatedPrinter = await prisma.printer.update({
      where: { id: printerId },
      data: {
        ...data,
        updatedAt: new Date(),
      },
      include: {
        business: {
          select: {
            id: true,
            name: true,
          }
        },
        locations: {
          select: {
            id: true,
            name: true,
          }
        }
      },
    })

    return NextResponse.json(updatedPrinter)
  } catch (error) {
    console.error('Error updating printer:', {
      error,
      printerId: params.id,
      userId: session?.user?.id,
    })
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/printers/[id]
 * Delete a printer (soft delete)
 */
export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!hasPermission(session.user, PERMISSIONS.PRINTER_DELETE)) {
      return NextResponse.json(
        { error: 'Forbidden - Insufficient permissions to delete printers' },
        { status: 403 }
      )
    }

    // Parse ID as integer
    const printerId = parseInt(params.id)
    if (isNaN(printerId)) {
      return NextResponse.json(
        { error: 'Invalid printer ID' },
        { status: 400 }
      )
    }

    // Verify printer exists and belongs to user's business
    const existingPrinter = await prisma.printer.findFirst({
      where: {
        id: printerId,
        businessId: parseInt(session.user.businessId),
        deletedAt: null,
      },
      include: {
        locations: true,
      }
    })

    if (!existingPrinter) {
      return NextResponse.json(
        { error: 'Printer not found' },
        { status: 404 }
      )
    }

    // Check if printer is assigned to any locations
    if (existingPrinter.locations.length > 0) {
      return NextResponse.json(
        {
          error: 'Cannot delete printer that is assigned to business locations',
          details: `This printer is currently assigned to ${existingPrinter.locations.length} location(s). Please unassign it first.`
        },
        { status: 409 }
      )
    }

    // Soft delete the printer
    await prisma.printer.update({
      where: { id: printerId },
      data: {
        deletedAt: new Date(),
      },
    })

    return NextResponse.json({
      message: 'Printer deleted successfully'
    })
  } catch (error) {
    console.error('Error deleting printer:', {
      error,
      printerId: params.id,
      userId: session?.user?.id,
    })
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
