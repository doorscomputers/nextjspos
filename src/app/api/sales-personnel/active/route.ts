import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth.simple'
import { prisma } from '@/lib/prisma.simple'

/**
 * GET /api/sales-personnel/active
 *
 * Returns list of active sales personnel for dropdown selection.
 * No pagination - returns all active personnel.
 * Minimal permission check - any authenticated user with a business can access.
 * Used in POS for selecting salesperson during sale creation.
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = session.user as any
    const businessId = parseInt(user.businessId)
    if (!businessId || isNaN(businessId)) {
      return NextResponse.json({ error: 'No business associated with user' }, { status: 400 })
    }

    // Optional search parameter
    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search')?.trim() || ''

    // Build where clause - only active, non-deleted personnel
    const whereClause: any = {
      businessId,
      isActive: true,
      deletedAt: null
    }

    // Apply search filter if provided
    if (search) {
      whereClause.OR = [
        { employeeCode: { contains: search, mode: 'insensitive' } },
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } }
      ]
    }

    // Query active sales personnel
    const salesPersonnel = await prisma.salesPersonnel.findMany({
      where: whereClause,
      select: {
        id: true,
        employeeCode: true,
        firstName: true,
        lastName: true
      },
      orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }]
    })

    // Transform for dropdown use
    const personnel = salesPersonnel.map(person => ({
      id: person.id,
      employeeCode: person.employeeCode,
      firstName: person.firstName,
      lastName: person.lastName,
      fullName: `${person.firstName} ${person.lastName}`,
      label: `${person.firstName} ${person.lastName} (${person.employeeCode})`
    }))

    return NextResponse.json({ salesPersonnel: personnel })
  } catch (error) {
    console.error('Error fetching active sales personnel:', error)
    return NextResponse.json({ error: 'Failed to fetch active sales personnel' }, { status: 500 })
  }
}
