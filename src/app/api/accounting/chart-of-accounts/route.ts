import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { PERMISSIONS } from '@/lib/rbac'

/**
 * GET /api/accounting/chart-of-accounts
 * Get chart of accounts with optional filtering
 *
 * Query params:
 * - accountType: Filter by account type (asset, liability, equity, revenue, expense)
 * - activeOnly: Return only active accounts (default: false)
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = session.user as any
    const businessId = user.businessId

    // Check permission
    if (!user.permissions?.includes(PERMISSIONS.EXPENSE_VIEW)) {
      return NextResponse.json(
        { error: 'Forbidden - Insufficient permissions' },
        { status: 403 }
      )
    }

    // Parse query parameters
    const { searchParams } = new URL(request.url)
    const accountType = searchParams.get('accountType')
    const activeOnly = searchParams.get('activeOnly') === 'true'

    const where: any = {
      businessId: parseInt(businessId),
    }

    if (accountType) {
      where.accountType = accountType
    }

    if (activeOnly) {
      where.isActive = true
    }

    const accounts = await prisma.chartOfAccounts.findMany({
      where,
      orderBy: [
        { accountCode: 'asc' },
        { accountName: 'asc' },
      ],
      select: {
        id: true,
        accountCode: true,
        accountName: true,
        accountType: true,
        normalBalance: true,
        currentBalance: true,
        isActive: true,
        parentAccountId: true,
      },
    })

    return NextResponse.json(accounts)
  } catch (error) {
    console.error('Error fetching chart of accounts:', error)
    return NextResponse.json(
      { error: 'Failed to fetch chart of accounts' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/accounting/chart-of-accounts
 * Create a new account in the chart of accounts
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = session.user as any
    const businessId = user.businessId

    // Check permission (only admins can create accounts)
    if (!user.permissions?.includes(PERMISSIONS.ACCESS_ALL_LOCATIONS)) {
      return NextResponse.json(
        { error: 'Forbidden - Insufficient permissions' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const {
      accountCode,
      accountName,
      accountType,
      normalBalance,
      parentAccountId,
      description,
    } = body

    // Validation
    if (!accountCode || !accountName || !accountType || !normalBalance) {
      return NextResponse.json(
        { error: 'Missing required fields: accountCode, accountName, accountType, normalBalance' },
        { status: 400 }
      )
    }

    // Check if account code already exists
    const existingAccount = await prisma.chartOfAccounts.findFirst({
      where: {
        businessId: parseInt(businessId),
        accountCode,
      },
    })

    if (existingAccount) {
      return NextResponse.json(
        { error: `Account code ${accountCode} already exists` },
        { status: 400 }
      )
    }

    // Create account
    const account = await prisma.chartOfAccounts.create({
      data: {
        businessId: parseInt(businessId),
        accountCode,
        accountName,
        accountType,
        normalBalance,
        parentAccountId: parentAccountId ? parseInt(parentAccountId) : null,
        description: description || null,
        currentBalance: 0,
        ytdDebit: 0,
        ytdCredit: 0,
        isActive: true,
      },
    })

    return NextResponse.json(account, { status: 201 })
  } catch (error) {
    console.error('Error creating account:', error)
    return NextResponse.json(
      { error: 'Failed to create account' },
      { status: 500 }
    )
  }
}
