/**
 * Chart of Accounts Initialization API Route
 * Creates standard accounting accounts for a business
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { hasPermission, PERMISSIONS } from '@/lib/rbac'
import { initializeChartOfAccounts } from '@/lib/chartOfAccounts'
import { prisma } from '@/lib/prisma'

/**
 * POST /api/accounting/chart-of-accounts/initialize
 *
 * Initializes the Chart of Accounts with standard accounts
 *
 * FOR NON-ACCOUNTANTS:
 * This creates all the "folders" (accounts) where your financial
 * transactions will be organized. Think of it as setting up your
 * filing system for money.
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check permissions
    if (!hasPermission(session.user, PERMISSIONS.ACCOUNTING_ACCESS)) {
      return NextResponse.json(
        { error: 'You do not have permission to access accounting features' },
        { status: 403 }
      )
    }

    // Check if already initialized
    const existingAccounts = await prisma.chartOfAccounts.count({
      where: { businessId: parseInt(session.user.businessId) }
    })

    if (existingAccounts > 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'Chart of Accounts already initialized',
          message: `Found ${existingAccounts} existing accounts. Initialization not needed.`,
          data: { existingAccountCount: existingAccounts }
        },
        { status: 400 }
      )
    }

    // Initialize Chart of Accounts
    const accounts = await initializeChartOfAccounts(parseInt(session.user.businessId))

    // Log the initialization
    await prisma.accountingAuditLog.create({
      data: {
        businessId: parseInt(session.user.businessId),
        entityType: 'ChartOfAccounts',
        entityId: 0,
        action: 'initialize',
        description: `Chart of Accounts initialized with ${accounts.length} standard accounts`,
        userId: session.user.id,
        newValues: {
          accountCount: accounts.length,
          accounts: accounts.map(a => ({ code: a.accountCode, name: a.accountName }))
        }
      }
    })

    return NextResponse.json({
      success: true,
      message: `Successfully created ${accounts.length} standard accounting accounts`,
      data: {
        accountCount: accounts.length,
        accounts: accounts.map(a => ({
          code: a.accountCode,
          name: a.accountName,
          type: a.accountType,
          subType: a.accountSubType
        })),
        summary: {
          assets: accounts.filter(a => a.accountType === 'asset').length,
          liabilities: accounts.filter(a => a.accountType === 'liability').length,
          equity: accounts.filter(a => a.accountType === 'equity').length,
          revenue: accounts.filter(a => a.accountType === 'revenue').length,
          expenses: accounts.filter(a => a.accountType === 'expense').length,
        }
      }
    })
  } catch (error) {
    console.error('Initialize COA Error:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to initialize Chart of Accounts',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

/**
 * GET /api/accounting/chart-of-accounts/initialize
 *
 * Check if Chart of Accounts has been initialized
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!hasPermission(session.user, PERMISSIONS.ACCOUNTING_ACCESS)) {
      return NextResponse.json(
        { error: 'No accounting access' },
        { status: 403 }
      )
    }

    const accountCount = await prisma.chartOfAccounts.count({
      where: { businessId: parseInt(session.user.businessId) }
    })

    const accounts = await prisma.chartOfAccounts.findMany({
      where: { businessId: parseInt(session.user.businessId) },
      select: {
        accountCode: true,
        accountName: true,
        accountType: true,
        currentBalance: true
      },
      orderBy: { accountCode: 'asc' }
    })

    return NextResponse.json({
      success: true,
      data: {
        initialized: accountCount > 0,
        accountCount,
        accounts,
        summary: {
          assets: accounts.filter(a => a.accountType === 'asset').length,
          liabilities: accounts.filter(a => a.accountType === 'liability').length,
          equity: accounts.filter(a => a.accountType === 'equity').length,
          revenue: accounts.filter(a => a.accountType === 'revenue').length,
          expenses: accounts.filter(a => a.accountType === 'expense').length,
        }
      }
    })
  } catch (error) {
    console.error('Check COA Error:', error)
    return NextResponse.json(
      { error: 'Failed to check Chart of Accounts status', details: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 }
    )
  }
}
