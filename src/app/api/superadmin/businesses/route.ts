import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth.simple'
import { prisma } from '@/lib/prisma'
import { isSuperAdmin, PERMISSIONS } from '@/lib/rbac'
import bcrypt from 'bcryptjs'

// GET - Fetch all businesses
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = session.user as any
    if (!isSuperAdmin({ id: user.id, permissions: user.permissions || [], roles: user.roles || [] })) {
      return NextResponse.json({ error: 'Forbidden - Super Admin access required' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '10')
    const search = searchParams.get('search') || ''

    const skip = (page - 1) * limit

    const where = search ? {
      OR: [
        { name: { contains: search, mode: 'insensitive' as const } },
        { owner: { username: { contains: search, mode: 'insensitive' as const } } },
        { owner: { email: { contains: search, mode: 'insensitive' as const } } },
      ]
    } : {}

    const [businesses, total] = await Promise.all([
      prisma.business.findMany({
        where,
        include: {
          owner: {
            select: {
              id: true,
              username: true,
              email: true,
              firstName: true,
              surname: true,
            }
          },
          currency: true,
          subscriptions: {
            orderBy: { createdAt: 'desc' },
            take: 1,
            include: {
              package: true
            }
          },
          _count: {
            select: {
              users: true,
              locations: true,
            }
          }
        },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' }
      }),
      prisma.business.count({ where })
    ])

    return NextResponse.json({
      businesses,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    })
  } catch (error) {
    console.error('Error fetching businesses:', error)
    return NextResponse.json({ error: 'Failed to fetch businesses' }, { status: 500 })
  }
}

// POST - Create new business
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = session.user as any
    if (!isSuperAdmin({ id: user.id, permissions: user.permissions || [], roles: user.roles || [] })) {
      return NextResponse.json({ error: 'Forbidden - Super Admin access required' }, { status: 403 })
    }

    const body = await request.json()
    const {
      // Business info
      name,
      currencyId,
      startDate,
      taxNumber1,
      taxLabel1,
      taxNumber2,
      taxLabel2,
      // Owner info
      ownerUsername,
      ownerEmail,
      ownerPassword,
      ownerFirstName,
      ownerSurname,
      // Subscription
      packageId,
      subscriptionStartDate,
      trialDays,
    } = body

    // Validate required fields
    if (!name || !currencyId || !taxNumber1 || !taxLabel1) {
      return NextResponse.json({ error: 'Missing required business fields' }, { status: 400 })
    }

    if (!ownerUsername || !ownerPassword || !ownerFirstName || !ownerSurname) {
      return NextResponse.json({ error: 'Missing required owner fields' }, { status: 400 })
    }

    // Check if username already exists
    const existingUser = await prisma.user.findUnique({
      where: { username: ownerUsername }
    })

    if (existingUser) {
      return NextResponse.json({ error: 'Username already exists' }, { status: 400 })
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(ownerPassword, 10)

    // Create business with owner in a transaction
    const result = await prisma.$transaction(async (tx) => {
      // Create owner user first
      const owner = await tx.user.create({
        data: {
          username: ownerUsername,
          email: ownerEmail,
          password: hashedPassword,
          firstName: ownerFirstName,
          surname: ownerSurname,
          userType: 'owner',
          allowLogin: true,
        }
      })

      // Create business
      const business = await tx.business.create({
        data: {
          name,
          ownerId: owner.id,
          currencyId: parseInt(currencyId),
          startDate: startDate ? new Date(startDate) : null,
          taxNumber1,
          taxLabel1,
          taxNumber2: taxNumber2 || null,
          taxLabel2: taxLabel2 || null,
        },
        include: {
          owner: {
            select: {
              id: true,
              username: true,
              email: true,
              firstName: true,
              surname: true,
            }
          },
          currency: true,
        }
      })

      // Update owner's businessId
      await tx.user.update({
        where: { id: owner.id },
        data: { businessId: business.id }
      })

      // Create default Admin role for this business
      const adminRole = await tx.role.create({
        data: {
          name: 'Admin',
          businessId: business.id,
          isDefault: true,
        }
      })

      // Get all non-superadmin permissions
      const permissions = await tx.permission.findMany({
        where: {
          NOT: {
            name: { startsWith: 'superadmin.' }
          }
        }
      })

      // Assign all permissions to Admin role
      await tx.rolePermission.createMany({
        data: permissions.map(perm => ({
          roleId: adminRole.id,
          permissionId: perm.id
        }))
      })

      // Assign Admin role to owner
      await tx.userRole.create({
        data: {
          userId: owner.id,
          roleId: adminRole.id
        }
      })

      // Create subscription if packageId provided
      if (packageId) {
        const pkg = await tx.package.findUnique({
          where: { id: parseInt(packageId) }
        })

        if (pkg) {
          const startDate = subscriptionStartDate ? new Date(subscriptionStartDate) : new Date()
          const trialEndDate = trialDays ? new Date(startDate.getTime() + trialDays * 24 * 60 * 60 * 1000) : null

          await tx.subscription.create({
            data: {
              businessId: business.id,
              packageId: pkg.id,
              startDate,
              trialEndDate,
              packagePrice: pkg.price,
              packageDetails: pkg as any,
              status: 'approved',
              createdBy: parseInt(user.id)
            }
          })
        }
      }

      return business
    })

    return NextResponse.json({
      business: result,
      message: 'Business created successfully'
    }, { status: 201 })

  } catch (error) {
    console.error('Error creating business:', error)
    return NextResponse.json({ error: 'Failed to create business' }, { status: 500 })
  }
}
