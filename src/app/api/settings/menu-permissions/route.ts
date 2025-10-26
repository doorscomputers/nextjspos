/**
 * API Route: Get All Menu Permissions Structure
 * GET /api/settings/menu-permissions
 *
 * Returns the complete hierarchical menu structure
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getMenuStructure, getAllMenuPermissions } from '@/lib/menu-permissions'
import { hasPermission, PERMISSIONS } from '@/lib/rbac'

export async function GET(request: NextRequest) {
  try {
    // Authentication check
    const session = await getServerSession(authOptions)
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Authorization check - must have role view or update permission
    if (
      !hasPermission(session.user, PERMISSIONS.ROLE_VIEW) &&
      !hasPermission(session.user, PERMISSIONS.USER_VIEW)
    ) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Get query parameters
    const searchParams = request.nextUrl.searchParams
    const format = searchParams.get('format') || 'tree' // 'tree' or 'flat'

    let menuData

    if (format === 'flat') {
      menuData = await getAllMenuPermissions()
    } else {
      menuData = await getMenuStructure()
    }

    return NextResponse.json({
      success: true,
      data: menuData,
    })
  } catch (error) {
    console.error('Error fetching menu permissions:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
