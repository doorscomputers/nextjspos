import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getToken } from 'next-auth/jwt'
import { PERMISSIONS } from '@/lib/rbac'

/**
 * Route Protection Middleware
 *
 * This middleware checks if the user has the required menu permission
 * to access a specific route. If they don't have permission, they are
 * redirected to the dashboard with an error message.
 *
 * This prevents users from accessing routes directly by typing the URL
 * even if the menu item is hidden from the sidebar.
 */

interface RoutePermissionMap {
  [pattern: string]: string // route pattern => menu key required
}

// Define which routes require which menu permissions
// Pattern matching supports wildcards (*)
const ROUTE_PERMISSIONS: RoutePermissionMap = {
  // Dashboard
  '/dashboard': 'dashboard',

  // Products
  '/dashboard/products': 'products',
  '/dashboard/products/*': 'products',
  '/dashboard/categories': 'products',
  '/dashboard/brands': 'products',
  '/dashboard/units': 'products',
  '/dashboard/product-pricing': 'products',

  // Purchases
  '/dashboard/purchases': 'purchases',
  '/dashboard/purchases/create': 'purchases_add',
  '/dashboard/purchases/receipts': 'goods_received',
  '/dashboard/purchases/suggestions': 'reorder_suggestions',
  '/dashboard/serial-lookup': 'serial_number_lookup',
  '/dashboard/accounts-payable': 'accounts_payable',
  '/dashboard/payments': 'payments',
  '/dashboard/banks': 'banks',
  '/dashboard/bank-transactions': 'bank_transactions',
  '/dashboard/post-dated-cheques': 'post_dated_cheques',

  // POS & Sales
  '/dashboard/pos': 'point_of_sale',
  '/dashboard/shifts/begin': 'begin_shift',
  '/dashboard/shifts/close': 'close_shift',
  '/dashboard/readings/x-reading': 'x_reading',
  '/dashboard/readings/z-reading': 'z_reading',
  '/dashboard/readings/history': 'readings_history',
  '/dashboard/sales': 'sales_list',

  // Stock Transfers
  '/dashboard/transfers': 'stock_transfers',
  '/dashboard/transfers/create': 'create_transfer',
  '/dashboard/reports/my-transfers': 'my_transfers_report',
  '/dashboard/reports/my-received-transfers': 'my_received_transfers_report',

  // Reports
  '/dashboard/reports': 'reports',
  '/dashboard/reports/sales': 'sales_reports',
  '/dashboard/reports/purchases': 'purchase_reports',
  '/dashboard/reports/purchases-items': 'purchase_items_report',
  '/dashboard/reports/transfers': 'transfer_reports',
  '/dashboard/reports/inventory': 'inventory_reports',

  // Settings (require user/role update permissions)
  '/dashboard/settings/user-menu-manager': 'settings',
}

/**
 * Check if a route matches a pattern
 * Supports wildcards: /dashboard/products/* matches /dashboard/products/123
 */
function matchesPattern(pathname: string, pattern: string): boolean {
  if (pattern === pathname) return true

  if (pattern.endsWith('/*')) {
    const basePattern = pattern.slice(0, -2)
    return pathname.startsWith(basePattern)
  }

  return false
}

/**
 * Get the required menu key for a given route
 */
function getRequiredMenuKey(pathname: string): string | null {
  for (const [pattern, menuKey] of Object.entries(ROUTE_PERMISSIONS)) {
    if (matchesPattern(pathname, pattern)) {
      return menuKey
    }
  }
  return null
}

/**
 * Check if user has access to a menu key
 * This queries the user's menu permissions from the database
 */
async function hasMenuAccess(userId: number, menuKey: string): Promise<boolean> {
  try {
    // This would normally call the API endpoint we created
    // For middleware, we need direct database access
    const response = await fetch(`${process.env.NEXTAUTH_URL}/api/settings/menu-permissions/user/${userId}`, {
      headers: {
        'Cache-Control': 'no-cache'
      }
    })

    if (!response.ok) return false

    const data = await response.json()
    const accessibleKeys: string[] = data.data?.accessibleMenuKeys || []

    return accessibleKeys.includes(menuKey)
  } catch (error) {
    console.error('[Route Protection] Error checking menu access:', error)
    // Fail open: allow access if check fails
    return true
  }
}

/**
 * Main middleware function
 */
export async function routeProtectionMiddleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Skip protection for non-dashboard routes
  if (!pathname.startsWith('/dashboard')) {
    return NextResponse.next()
  }

  // Skip protection for API routes
  if (pathname.startsWith('/api')) {
    return NextResponse.next()
  }

  // Get the user's session token
  const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET })

  if (!token || !token.userId) {
    // Not authenticated - redirect to login
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('callbackUrl', pathname)
    return NextResponse.redirect(loginUrl)
  }

  // Check if this route requires a menu permission
  const requiredMenuKey = getRequiredMenuKey(pathname)

  if (!requiredMenuKey) {
    // No specific permission required for this route
    return NextResponse.next()
  }

  // Check if user has access to this menu
  const hasAccess = await hasMenuAccess(token.userId as number, requiredMenuKey)

  if (!hasAccess) {
    console.log(`[Route Protection] BLOCKED: User ${token.username} tried to access ${pathname} (requires menu: ${requiredMenuKey})`)

    // Redirect to dashboard with error message
    const dashboardUrl = new URL('/dashboard', request.url)
    dashboardUrl.searchParams.set('error', 'unauthorized')
    dashboardUrl.searchParams.set('route', pathname)

    return NextResponse.redirect(dashboardUrl)
  }

  // User has access - allow request
  return NextResponse.next()
}

/**
 * Export a simplified version for use in middleware.ts
 * This can be called directly from the main middleware file
 */
export const config = {
  matcher: [
    '/dashboard/:path*',
    '/((?!api|_next/static|_next/image|favicon.ico).*)'
  ]
}
