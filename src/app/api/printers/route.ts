import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth.simple'
import { prisma } from '@/lib/prisma.simple'
import { hasPermission, PERMISSIONS } from '@/lib/rbac'
import { NextResponse } from 'next/server'
import { z } from 'zod'

// Validation schema for creating a printer
const createPrinterSchema = z.object({
  name: z.string().min(1, 'Printer name is required'),
  connectionType: z.enum(['network', 'windows', 'linux'], {
    errorMap: () => ({ message: 'Connection type must be network, windows, or linux' })
  }),
  capabilityProfile: z.enum(['default', 'simple', 'SP2000', 'TEP-200M', 'P822D']).default('default'),
  charPerLine: z.number().int().min(20).max(80).default(42),
  // Network printer fields
  ipAddress: z.string().optional(),
  port: z.string().default('9100'),
  // Local printer fields
  path: z.string().optional(),
}).refine((data) => {
  // If connection type is network, IP address is required
  if (data.connectionType === 'network' && !data.ipAddress) {
    return false
  }
  // If connection type is local (windows/linux), path is required
  if ((data.connectionType === 'windows' || data.connectionType === 'linux') && !data.path) {
    return false
  }
  return true
}, {
  message: 'Network printers require IP address, local printers require device path',
  path: ['ipAddress', 'path']
})

/**
 * GET /api/printers
 * List all printers for the authenticated user's business
 */
export async function GET(request: Request) {
  try {
    // 1. Authentication check
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // 2. Permission check
    if (!hasPermission(session.user, PERMISSIONS.PRINTER_VIEW)) {
      return NextResponse.json(
        { error: 'Forbidden - Insufficient permissions to view printers' },
        { status: 403 }
      )
    }

    // 3. Parse query parameters
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '50')
    const search = searchParams.get('search') || ''
    const connectionType = searchParams.get('connectionType')

    // 4. Build filters with multi-tenant isolation
    const where: any = {
      businessId: parseInt(session.user.businessId), // Multi-tenant isolation
      deletedAt: null, // Exclude soft-deleted printers
    }

    // Search filter
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { ipAddress: { contains: search, mode: 'insensitive' } },
        { path: { contains: search, mode: 'insensitive' } },
      ]
    }

    // Connection type filter
    if (connectionType) {
      where.connectionType = connectionType
    }

    // 5. Fetch printers with pagination
    const [printers, total] = await Promise.all([
      prisma.printer.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
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
        orderBy: { createdAt: 'desc' },
      }),
      prisma.printer.count({ where }),
    ])

    // 6. Return response with metadata
    return NextResponse.json({
      data: printers,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    })
  } catch (error) {
    console.error('Error fetching printers:', {
      error,
      userId: session?.user?.id,
      businessId: session?.user?.businessId,
    })
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/printers
 * Create a new printer for the authenticated user's business
 */
export async function POST(request: Request) {
  try {
    // 1. Authentication check
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // 2. Permission check
    if (!hasPermission(session.user, PERMISSIONS.PRINTER_CREATE)) {
      return NextResponse.json(
        { error: 'Forbidden - Insufficient permissions to create printers' },
        { status: 403 }
      )
    }

    // 3. Parse and validate request body
    const body = await request.json()
    const validationResult = createPrinterSchema.safeParse(body)

    if (!validationResult.success) {
      return NextResponse.json(
        {
          error: 'Validation failed',
          details: validationResult.error.errors
        },
        { status: 400 }
      )
    }

    const data = validationResult.data

    // 4. Check for duplicate printer name in the same business
    const existingPrinter = await prisma.printer.findFirst({
      where: {
        businessId: parseInt(session.user.businessId),
        name: data.name,
        deletedAt: null,
      }
    })

    if (existingPrinter) {
      return NextResponse.json(
        { error: 'A printer with this name already exists in your business' },
        { status: 409 }
      )
    }

    // 5. Create printer with tenant isolation
    const printer = await prisma.printer.create({
      data: {
        name: data.name,
        connectionType: data.connectionType,
        capabilityProfile: data.capabilityProfile,
        charPerLine: data.charPerLine,
        ipAddress: data.ipAddress || null,
        port: data.port || '9100',
        path: data.path || null,
        businessId: parseInt(session.user.businessId),
      },
      include: {
        business: {
          select: {
            id: true,
            name: true,
          }
        }
      },
    })

    return NextResponse.json(printer, { status: 201 })
  } catch (error) {
    console.error('Error creating printer:', {
      error,
      userId: session?.user?.id,
      businessId: session?.user?.businessId,
    })
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
