import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth.simple'
import { PERMISSIONS } from '@/lib/rbac'
import { prisma } from '@/lib/prisma'

/**
 * POST /api/settings/menu-management/add-accounts-receivable
 *
 * Adds the "Accounts Receivable" menu item under "Financial Reports".
 * This is a one-time migration endpoint to fix missing menu in production.
 *
 * Safe to run multiple times (uses upsert).
 */
export async function POST() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user has permission to manage roles/menus
    if (!session.user.permissions.includes(PERMISSIONS.ROLE_UPDATE)) {
      return NextResponse.json({ error: 'Forbidden - requires ROLE_UPDATE permission' }, { status: 403 })
    }

    // Find the Financial Reports parent menu
    const parentMenu = await prisma.menuPermission.findFirst({
      where: { key: 'financial_reports' }
    })

    if (!parentMenu) {
      return NextResponse.json({
        success: false,
        error: 'Parent menu "financial_reports" not found in database. Cannot add Accounts Receivable.'
      }, { status: 400 })
    }

    // Upsert the Accounts Receivable menu (safe - creates if not exists, updates if exists)
    const menu = await prisma.menuPermission.upsert({
      where: { key: 'accounts_receivable' },
      update: {
        name: 'Accounts Receivable',
        href: '/dashboard/reports/accounts-receivable',
        parentId: parentMenu.id,
        order: 8
      },
      create: {
        key: 'accounts_receivable',
        name: 'Accounts Receivable',
        href: '/dashboard/reports/accounts-receivable',
        parentId: parentMenu.id,
        order: 8
      }
    })

    return NextResponse.json({
      success: true,
      message: 'Accounts Receivable menu added successfully under Financial Reports',
      data: {
        id: menu.id,
        key: menu.key,
        name: menu.name,
        href: menu.href,
        parentId: menu.parentId
      }
    })

  } catch (error) {
    console.error('Error adding accounts receivable menu:', error)
    return NextResponse.json({
      success: false,
      error: 'Failed to add menu',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

// Also support GET for easy browser testing
export async function GET() {
  return NextResponse.json({
    message: 'Use POST method to add the Accounts Receivable menu',
    endpoint: '/api/settings/menu-management/add-accounts-receivable',
    method: 'POST',
    requires: 'Authentication with ROLE_UPDATE permission'
  })
}
