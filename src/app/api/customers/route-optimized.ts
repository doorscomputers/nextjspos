import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { PERMISSIONS } from '@/lib/rbac'

// OPTIMIZED GET - Server-side pagination, filtering, and sorting for DevExtreme DataGrid
export async function GET(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions)

        if (!session?.user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const user = session.user as any
        const businessId = user.businessId

        // Check permission
        if (!user.permissions?.includes(PERMISSIONS.CUSTOMER_VIEW)) {
            return NextResponse.json(
                { error: 'Forbidden - Insufficient permissions' },
                { status: 403 }
            )
        }

        // Parse DevExtreme DataGrid parameters
        const { searchParams } = new URL(request.url)

        // Pagination
        const skip = searchParams.get('skip') ? parseInt(searchParams.get('skip')!) : 0
        const take = searchParams.get('take') ? parseInt(searchParams.get('take')!) : 50

        // Sorting
        const sortBy = searchParams.get('sortBy') || 'createdAt'
        const sortOrder = searchParams.get('sortOrder') || 'desc'

        // Filtering
        const search = searchParams.get('search')?.trim() || ''
        const isActive = searchParams.get('isActive')
        const customerType = searchParams.get('customerType')?.trim() || ''
        const locationId = searchParams.get('locationId') ? parseInt(searchParams.get('locationId')!) : null

        // Build where clause
        const where: any = {
            businessId: parseInt(businessId),
            deletedAt: null,
        }

        // Apply filters
        if (search) {
            where.OR = [
                { name: { contains: search, mode: 'insensitive' } },
                { email: { contains: search, mode: 'insensitive' } },
                { phoneNumber: { contains: search, mode: 'insensitive' } },
                { address: { contains: search, mode: 'insensitive' } }
            ]
        }

        if (isActive !== null && isActive !== undefined) {
            where.isActive = isActive === 'true'
        }

        if (customerType) {
            where.customerType = customerType
        }

        if (locationId) {
            where.locationId = parseInt(locationId)
        }

        // Build orderBy clause
        const orderBy: any = {}
        if (sortBy === 'location') {
            orderBy.location = { name: sortOrder }
        } else {
            orderBy[sortBy] = sortOrder
        }

        // Get total count for pagination
        const totalCount = await prisma.customer.count({
            where
        })

        // Fetch customers with optimized includes
        const customers = await prisma.customer.findMany({
            where,
            select: {
                id: true,
                name: true,
                email: true,
                phoneNumber: true,
                address: true,
                city: true,
                state: true,
                postalCode: true,
                country: true,
                customerType: true,
                isActive: true,
                creditLimit: true,
                notes: true,
                createdAt: true,
                updatedAt: true,
                // Minimal relation data
                location: {
                    select: {
                        id: true,
                        name: true
                    }
                },
                createdByUser: {
                    select: {
                        id: true,
                        username: true,
                        firstName: true,
                        lastName: true
                    }
                }
            },
            orderBy,
            skip,
            take
        })

        // Calculate additional metrics for each customer
        const customersWithMetrics = customers.map((customer: any) => {
            return {
                ...customer,
                // Additional calculated fields (simplified for now)
                totalSales: 0,
                salesCount: 0,
                totalPaid: 0,
                paymentsCount: 0,
                balance: 0,
                // Format dates
                createdAt: customer.createdAt.toISOString(),
                updatedAt: customer.updatedAt.toISOString(),
                // Format location name
                locationName: customer.location?.name || 'N/A',
                // Format creator name
                creatorName: customer.createdByUser
                    ? `${customer.createdByUser.firstName || ''} ${customer.createdByUser.lastName || ''}`.trim() || customer.createdByUser.username
                    : 'Unknown'
            }
        })

        return NextResponse.json({
            data: customersWithMetrics,
            totalCount,
            // DevExtreme DataGrid expects these fields
            summary: [{
                totalCount
            }]
        })

    } catch (error) {
        console.error('Customers API error:', error)
        return NextResponse.json(
            { error: 'Failed to fetch customers' },
            { status: 500 }
        )
    }
}
