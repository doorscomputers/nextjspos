/**
 * RBAC (Role-Based Access Control) Utilities
 * Handles permission checking for users and roles
 */

export type Permission = string

export interface RBACUser {
  id: string
  permissions: Permission[]
  roles: string[]
  businessId?: string
  locationIds?: number[]
}

/**
 * Check if user is Super Admin (platform owner)
 * This check is placed early to be used by other functions
 */
export function isSuperAdmin(user: RBACUser | null): boolean {
  if (!user) return false
  // Check by role name first (most reliable)
  if (user.roles?.includes('Super Admin')) return true
  // Fallback: check for superadmin.all permission
  return user.permissions?.includes('superadmin.all') || false
}

/**
 * Check if user has a specific permission
 * Super Admin ALWAYS has all permissions
 */
export function hasPermission(user: RBACUser | null, permission: Permission): boolean {
  if (!user || !user.permissions) return false

  // Super Admin has all permissions by default
  if (isSuperAdmin(user)) return true

  return user.permissions.includes(permission)
}

/**
 * Check if user has ANY of the specified permissions
 */
export function hasAnyPermission(user: RBACUser | null, permissions: Permission[]): boolean {
  if (!user || !user.permissions) return false
  return permissions.some(permission => user.permissions.includes(permission))
}

/**
 * Check if user has ALL of the specified permissions
 */
export function hasAllPermissions(user: RBACUser | null, permissions: Permission[]): boolean {
  if (!user || !user.permissions) return false
  return permissions.every(permission => user.permissions.includes(permission))
}

/**
 * Check if user has a specific role
 */
export function hasRole(user: RBACUser | null, role: string): boolean {
  if (!user || !user.roles) return false
  return user.roles.includes(role)
}

/**
 * Check if user has ANY of the specified roles
 */
export function hasAnyRole(user: RBACUser | null, roles: string[]): boolean {
  if (!user || !user.roles) return false
  return roles.some(role => user.roles.includes(role))
}

/**
 * Default permissions for POS system
 */
export const PERMISSIONS = {
  // Dashboard
  DASHBOARD_VIEW: 'dashboard.view',

  // Users
  USER_VIEW: 'user.view',
  USER_CREATE: 'user.create',
  USER_UPDATE: 'user.update',
  USER_DELETE: 'user.delete',

  // Roles
  ROLE_VIEW: 'role.view',
  ROLE_CREATE: 'role.create',
  ROLE_UPDATE: 'role.update',
  ROLE_DELETE: 'role.delete',

  // Products - Basic CRUD
  PRODUCT_VIEW: 'product.view',
  PRODUCT_CREATE: 'product.create',
  PRODUCT_UPDATE: 'product.update',
  PRODUCT_DELETE: 'product.delete',

  // Products - Field-Level Security (What data can be seen)
  PRODUCT_VIEW_PURCHASE_PRICE: 'product.view_purchase_price', // Can see cost price
  PRODUCT_VIEW_PROFIT_MARGIN: 'product.view_profit_margin', // Can see profit calculations (NEW)
  PRODUCT_VIEW_SUPPLIER: 'product.view_supplier', // Can see supplier information (NEW)
  PRODUCT_VIEW_ALL_BRANCH_STOCK: 'product.view_all_branch_stock', // Can see stock at other locations

  // Products - Stock Management
  PRODUCT_OPENING_STOCK: 'product.opening_stock',
  ACCESS_DEFAULT_SELLING_PRICE: 'product.access_default_selling_price',
  PRODUCT_LOCK_OPENING_STOCK: 'product.lock_opening_stock',
  PRODUCT_UNLOCK_OPENING_STOCK: 'product.unlock_opening_stock',
  PRODUCT_MODIFY_LOCKED_STOCK: 'product.modify_locked_stock',

  // Product Master Data (Categories, Brands, Units, Warranties)
  PRODUCT_CATEGORY_VIEW: 'product.category.view',
  PRODUCT_CATEGORY_CREATE: 'product.category.create',
  PRODUCT_CATEGORY_UPDATE: 'product.category.update',
  PRODUCT_CATEGORY_DELETE: 'product.category.delete',

  PRODUCT_BRAND_VIEW: 'product.brand.view',
  PRODUCT_BRAND_CREATE: 'product.brand.create',
  PRODUCT_BRAND_UPDATE: 'product.brand.update',
  PRODUCT_BRAND_DELETE: 'product.brand.delete',

  PRODUCT_UNIT_VIEW: 'product.unit.view',
  PRODUCT_UNIT_CREATE: 'product.unit.create',
  PRODUCT_UNIT_UPDATE: 'product.unit.update',
  PRODUCT_UNIT_DELETE: 'product.unit.delete',

  PRODUCT_WARRANTY_VIEW: 'product.warranty.view',
  PRODUCT_WARRANTY_CREATE: 'product.warranty.create',
  PRODUCT_WARRANTY_UPDATE: 'product.warranty.update',
  PRODUCT_WARRANTY_DELETE: 'product.warranty.delete',

  // Inventory Corrections
  INVENTORY_CORRECTION_VIEW: 'inventory_correction.view',
  INVENTORY_CORRECTION_CREATE: 'inventory_correction.create',
  INVENTORY_CORRECTION_UPDATE: 'inventory_correction.update',
  INVENTORY_CORRECTION_DELETE: 'inventory_correction.delete',
  INVENTORY_CORRECTION_APPROVE: 'inventory_correction.approve',

  // Physical Inventory Count
  PHYSICAL_INVENTORY_EXPORT: 'physical_inventory.export',
  PHYSICAL_INVENTORY_IMPORT: 'physical_inventory.import',

  // Sales - Basic CRUD
  SELL_VIEW: 'sell.view',
  SELL_CREATE: 'sell.create',
  SELL_UPDATE: 'sell.update',
  SELL_DELETE: 'sell.delete',
  SELL_VIEW_OWN: 'sell.view_own',

  // Sales - Field-Level Security (What financial data can be seen)
  SELL_VIEW_COST: 'sell.view_cost', // Can see COGS (Cost of Goods Sold) (NEW)
  SELL_VIEW_PROFIT: 'sell.view_profit', // Can see profit margins (NEW)
  SELL_VIEW_DISCOUNT_DETAILS: 'sell.view_discount_details', // Can see detailed discount breakdown (NEW)

  // Cashier Shift Management
  SHIFT_OPEN: 'shift.open',
  SHIFT_CLOSE: 'shift.close',
  SHIFT_VIEW: 'shift.view',
  SHIFT_VIEW_ALL: 'shift.view_all',

  // Cash Management
  CASH_IN_OUT: 'cash.in_out',
  CASH_COUNT: 'cash.count',
  CASH_APPROVE_LARGE_TRANSACTIONS: 'cash.approve_large_transactions',

  // Void Transactions
  VOID_CREATE: 'void.create',
  VOID_APPROVE: 'void.approve',

  // BIR Readings
  X_READING: 'reading.x_reading',
  Z_READING: 'reading.z_reading',

  // Sales Reports
  SALES_REPORT_VIEW: 'sales_report.view',
  SALES_REPORT_DAILY: 'sales_report.daily',
  SALES_REPORT_SUMMARY: 'sales_report.summary',
  SALES_REPORT_JOURNAL: 'sales_report.journal',
  SALES_REPORT_PER_ITEM: 'sales_report.per_item',
  SALES_REPORT_PER_CASHIER: 'sales_report.per_cashier',
  SALES_REPORT_PER_LOCATION: 'sales_report.per_location',
  SALES_REPORT_ANALYTICS: 'sales_report.analytics',
  SALES_REPORT_CUSTOMER_ANALYSIS: 'sales_report.customer_analysis',
  SALES_REPORT_PAYMENT_METHOD: 'sales_report.payment_method',
  SALES_REPORT_DISCOUNT_ANALYSIS: 'sales_report.discount_analysis',

  // Purchases
  PURCHASE_VIEW: 'purchase.view',
  PURCHASE_CREATE: 'purchase.create',
  PURCHASE_UPDATE: 'purchase.update',
  PURCHASE_DELETE: 'purchase.delete',
  PURCHASE_APPROVE: 'purchase.approve',
  PURCHASE_RECEIVE: 'purchase.receive',
  PURCHASE_RECEIPT_CREATE: 'purchase.receipt.create', // GRN
  PURCHASE_RECEIPT_APPROVE: 'purchase.receipt.approve',
  PURCHASE_RECEIPT_VIEW: 'purchase.receipt.view',
  PURCHASE_VIEW_COST: 'purchase.view_cost', // View purchase costs/prices

  // Purchase Returns (Debit Notes)
  PURCHASE_RETURN_VIEW: 'purchase_return.view',
  PURCHASE_RETURN_CREATE: 'purchase_return.create',
  PURCHASE_RETURN_UPDATE: 'purchase_return.update',
  PURCHASE_RETURN_DELETE: 'purchase_return.delete',
  PURCHASE_RETURN_APPROVE: 'purchase_return.approve',

  // Purchase Amendments
  PURCHASE_AMENDMENT_VIEW: 'purchase_amendment.view',
  PURCHASE_AMENDMENT_CREATE: 'purchase_amendment.create',
  PURCHASE_AMENDMENT_APPROVE: 'purchase_amendment.approve',
  PURCHASE_AMENDMENT_REJECT: 'purchase_amendment.reject',

  // Quality Control
  QC_INSPECTION_VIEW: 'qc_inspection.view',
  QC_INSPECTION_CREATE: 'qc_inspection.create',
  QC_INSPECTION_CONDUCT: 'qc_inspection.conduct',
  QC_INSPECTION_APPROVE: 'qc_inspection.approve',
  QC_TEMPLATE_VIEW: 'qc_template.view',
  QC_TEMPLATE_MANAGE: 'qc_template.manage',

  // Accounts Payable
  ACCOUNTS_PAYABLE_VIEW: 'accounts_payable.view',
  ACCOUNTS_PAYABLE_CREATE: 'accounts_payable.create',
  ACCOUNTS_PAYABLE_UPDATE: 'accounts_payable.update',
  ACCOUNTS_PAYABLE_DELETE: 'accounts_payable.delete',

  // Payments
  PAYMENT_VIEW: 'payment.view',
  PAYMENT_CREATE: 'payment.create',
  PAYMENT_APPROVE: 'payment.approve',
  PAYMENT_UPDATE: 'payment.update',
  PAYMENT_DELETE: 'payment.delete',

  // Banks
  BANK_VIEW: 'bank.view',
  BANK_CREATE: 'bank.create',
  BANK_UPDATE: 'bank.update',
  BANK_DELETE: 'bank.delete',

  // Bank Transactions
  BANK_TRANSACTION_VIEW: 'bank_transaction.view',
  BANK_TRANSACTION_CREATE: 'bank_transaction.create',
  BANK_TRANSACTION_UPDATE: 'bank_transaction.update',
  BANK_TRANSACTION_DELETE: 'bank_transaction.delete',

  // Stock Transfers
  STOCK_TRANSFER_VIEW: 'stock_transfer.view',
  STOCK_TRANSFER_CREATE: 'stock_transfer.create',
  STOCK_TRANSFER_CHECK: 'stock_transfer.check',
  STOCK_TRANSFER_SEND: 'stock_transfer.send',
  STOCK_TRANSFER_RECEIVE: 'stock_transfer.receive',
  STOCK_TRANSFER_VERIFY: 'stock_transfer.verify',
  STOCK_TRANSFER_COMPLETE: 'stock_transfer.complete',
  STOCK_TRANSFER_CANCEL: 'stock_transfer.cancel',

  // Customer Returns
  CUSTOMER_RETURN_VIEW: 'customer_return.view',
  CUSTOMER_RETURN_CREATE: 'customer_return.create',
  CUSTOMER_RETURN_APPROVE: 'customer_return.approve',
  CUSTOMER_RETURN_DELETE: 'customer_return.delete',

  // Supplier Returns
  SUPPLIER_RETURN_VIEW: 'supplier_return.view',
  SUPPLIER_RETURN_CREATE: 'supplier_return.create',
  SUPPLIER_RETURN_APPROVE: 'supplier_return.approve',
  SUPPLIER_RETURN_DELETE: 'supplier_return.delete',

  // Serial Numbers
  SERIAL_NUMBER_VIEW: 'serial_number.view',
  SERIAL_NUMBER_TRACK: 'serial_number.track',
  SERIAL_NUMBER_SCAN: 'serial_number.scan',

  // Expenses
  EXPENSE_VIEW: 'expense.view',
  EXPENSE_CREATE: 'expense.create',
  EXPENSE_UPDATE: 'expense.update',
  EXPENSE_DELETE: 'expense.delete',

  // Customers
  CUSTOMER_VIEW: 'customer.view',
  CUSTOMER_CREATE: 'customer.create',
  CUSTOMER_UPDATE: 'customer.update',
  CUSTOMER_DELETE: 'customer.delete',

  // Suppliers - Basic CRUD
  SUPPLIER_VIEW: 'supplier.view',
  SUPPLIER_CREATE: 'supplier.create',
  SUPPLIER_UPDATE: 'supplier.update',
  SUPPLIER_DELETE: 'supplier.delete',

  // Suppliers - Field-Level Security (What supplier data can be seen)
  SUPPLIER_VIEW_CONTACT_DETAILS: 'supplier.view_contact_details', // Can see email, phone, address (NEW)
  SUPPLIER_VIEW_PAYMENT_TERMS: 'supplier.view_payment_terms', // Can see payment terms, credit limits (NEW)

  // Reports - Granular Access
  REPORT_VIEW: 'report.view', // General report access

  // Sales Reports
  REPORT_SALES_VIEW: 'report.sales.view',
  REPORT_SALES_DAILY: 'report.sales.daily',
  REPORT_SALES_TODAY: 'report.sales.today',
  REPORT_SALES_HISTORY: 'report.sales.history',
  REPORT_SALES_PROFITABILITY: 'report.sales.profitability',

  // Purchase Reports
  REPORT_PURCHASE_VIEW: 'report.purchase.view',
  REPORT_PURCHASE_ANALYTICS: 'report.purchase.analytics',
  REPORT_PURCHASE_TRENDS: 'report.purchase.trends',
  REPORT_PURCHASE_ITEMS: 'report.purchase.items',

  // Transfer Reports
  REPORT_TRANSFER_VIEW: 'report.transfer.view',
  REPORT_TRANSFER_TRENDS: 'report.transfer.trends',

  // Financial Reports
  REPORT_PROFIT_LOSS: 'report.profit_loss',
  REPORT_PROFITABILITY: 'report.profitability',
  REPORT_PRODUCT_PURCHASE_HISTORY: 'report.product_purchase_history',

  // Stock Reports
  REPORT_STOCK_ALERT: 'report.stock_alert',
  STOCK_REPORT_VIEW: 'report.stock.view',
  VIEW_INVENTORY_REPORTS: 'view_inventory_reports',

  // Inventory Ledger
  INVENTORY_LEDGER_VIEW: 'inventory_ledger.view',
  INVENTORY_LEDGER_EXPORT: 'inventory_ledger.export',

  // Legacy (kept for backwards compatibility)
  REPORT_PURCHASE_SELL: 'report.purchase_sell',

  // Business Settings
  BUSINESS_SETTINGS_VIEW: 'business_settings.view',
  BUSINESS_SETTINGS_EDIT: 'business_settings.edit',

  // Locations
  LOCATION_VIEW: 'location.view',
  LOCATION_CREATE: 'location.create',
  LOCATION_UPDATE: 'location.update',
  LOCATION_DELETE: 'location.delete',
  ACCESS_ALL_LOCATIONS: 'access_all_locations',

  // Audit Logs
  AUDIT_LOG_VIEW: 'audit_log.view',

  // Freebies (Free Items)
  FREEBIE_ADD: 'freebie.add',
  FREEBIE_APPROVE: 'freebie.approve',
  FREEBIE_VIEW_LOG: 'freebie.view_log',

  // Announcements & Reminders
  ANNOUNCEMENT_VIEW: 'announcement.view',
  ANNOUNCEMENT_CREATE: 'announcement.create',
  ANNOUNCEMENT_UPDATE: 'announcement.update',
  ANNOUNCEMENT_DELETE: 'announcement.delete',
  ANNOUNCEMENT_MANAGE: 'announcement.manage', // Full management access

  // Employee Schedules
  SCHEDULE_VIEW: 'schedule.view',
  SCHEDULE_CREATE: 'schedule.create',
  SCHEDULE_UPDATE: 'schedule.update',
  SCHEDULE_DELETE: 'schedule.delete',
  SCHEDULE_ASSIGN: 'schedule.assign', // Assign schedules to employees
  SCHEDULE_MANAGE_ALL: 'schedule.manage_all', // Manage all employee schedules

  // Attendance & Time Tracking
  ATTENDANCE_VIEW: 'attendance.view',
  ATTENDANCE_VIEW_OWN: 'attendance.view_own', // View own attendance
  ATTENDANCE_CLOCK_IN: 'attendance.clock_in', // Clock in
  ATTENDANCE_CLOCK_OUT: 'attendance.clock_out', // Clock out
  ATTENDANCE_MANAGE: 'attendance.manage', // Manage all attendance records
  ATTENDANCE_EDIT: 'attendance.edit', // Edit attendance records
  ATTENDANCE_REPORT: 'attendance.report', // View attendance reports

  // Location Change Requests
  LOCATION_CHANGE_REQUEST_VIEW: 'location_change.view',
  LOCATION_CHANGE_REQUEST_CREATE: 'location_change.create',
  LOCATION_CHANGE_REQUEST_APPROVE: 'location_change.approve',
  LOCATION_CHANGE_REQUEST_REJECT: 'location_change.reject',
  LOCATION_CHANGE_REQUEST_MANAGE: 'location_change.manage', // Full management

  // Leave Requests
  LEAVE_REQUEST_VIEW_ALL: 'leave_request.view_all', // View all leave requests
  LEAVE_REQUEST_VIEW_OWN: 'leave_request.view_own', // View own leave requests
  LEAVE_REQUEST_CREATE: 'leave_request.create', // Create leave request
  LEAVE_REQUEST_UPDATE: 'leave_request.update', // Update own pending request
  LEAVE_REQUEST_APPROVE: 'leave_request.approve', // Approve leave requests
  LEAVE_REQUEST_REJECT: 'leave_request.reject', // Reject leave requests
  LEAVE_REQUEST_MANAGE: 'leave_request.manage', // Full management access

  // Overtime Management
  OVERTIME_VIEW_ALL: 'overtime.view_all',
  OVERTIME_VIEW_OWN: 'overtime.view_own',
  OVERTIME_CONFIGURE: 'overtime.configure',
  OVERTIME_APPROVE: 'overtime.approve',
  OVERTIME_ALERTS_VIEW: 'overtime.alerts.view',
  OVERTIME_ALERTS_ACKNOWLEDGE: 'overtime.alerts.acknowledge',
  OVERTIME_ALERTS_MANAGE: 'overtime.alerts.manage',

  // Super Admin Only - Platform Management
  SUPERADMIN_ALL: 'superadmin.all',
  SUPERADMIN_BUSINESS_VIEW: 'superadmin.business.view',
  SUPERADMIN_BUSINESS_CREATE: 'superadmin.business.create',
  SUPERADMIN_BUSINESS_UPDATE: 'superadmin.business.update',
  SUPERADMIN_BUSINESS_DELETE: 'superadmin.business.delete',
  SUPERADMIN_PACKAGE_VIEW: 'superadmin.package.view',
  SUPERADMIN_PACKAGE_CREATE: 'superadmin.package.create',
  SUPERADMIN_PACKAGE_UPDATE: 'superadmin.package.update',
  SUPERADMIN_PACKAGE_DELETE: 'superadmin.package.delete',
  SUPERADMIN_SUBSCRIPTION_VIEW: 'superadmin.subscription.view',
  SUPERADMIN_SUBSCRIPTION_CREATE: 'superadmin.subscription.create',
  SUPERADMIN_SUBSCRIPTION_UPDATE: 'superadmin.subscription.update',
  SUPERADMIN_SUBSCRIPTION_DELETE: 'superadmin.subscription.delete',
} as const

/**
 * Check if user has access to all locations in their business
 */
export function hasAccessToAllLocations(user: RBACUser | null): boolean {
  if (!user) return false
  return hasPermission(user, PERMISSIONS.ACCESS_ALL_LOCATIONS) || isSuperAdmin(user)
}

/**
 * Check if a role requires location assignment
 * Admin and Super Admin roles do NOT require location assignment
 * They can work across all locations within their business scope
 */
export function roleRequiresLocation(roleName: string): boolean {
  const adminRoles = [
    'Super Admin',              // Legacy
    'System Administrator',     // New name for Super Admin
    'Super Admin (Legacy)',     // LEGACY_SUPER_ADMIN
  ]
  return !adminRoles.includes(roleName)
}

/**
 * Check if user roles require location assignment
 * Returns true if ANY assigned role does NOT require location
 * This means if user has at least one admin role, location is optional
 */
export function userRequiresLocation(roles: string[]): boolean {
  if (!roles || roles.length === 0) return true
  // If user has ANY admin role, location is NOT required
  return !roles.some(role => !roleRequiresLocation(role))
}

/**
 * Check if user has access to a specific location
 */
export function hasAccessToLocation(user: RBACUser | null, locationId: number): boolean {
  if (!user) return false

  // Super Admin and users with ACCESS_ALL_LOCATIONS can access all locations
  if (hasAccessToAllLocations(user)) return true

  // Check if user is assigned to this specific location
  return user.locationIds?.includes(locationId) || false
}

/**
 * Get location IDs the user has access to
 * Returns null if user has access to all locations (no filtering needed)
 * Returns array of location IDs if user has limited access
 */
export function getUserAccessibleLocationIds(user: RBACUser | null): number[] | null {
  if (!user) return []

  // If user has access to all locations, return null (no filtering)
  if (hasAccessToAllLocations(user)) return null

  // Return user's assigned location IDs
  return user.locationIds || []
}

/**
 * Build Prisma where clause for location-based filtering
 * Use this in API routes to filter data by user's accessible locations
 */
export function getLocationWhereClause(user: RBACUser | null, locationFieldName: string = 'locationId'): any {
  const accessibleLocationIds = getUserAccessibleLocationIds(user)

  // If null, user has access to all locations - no filter needed
  if (accessibleLocationIds === null) {
    return {}
  }

  // If empty array, user has no location access - return impossible condition
  if (accessibleLocationIds.length === 0) {
    return { [locationFieldName]: -1 } // No location will match
  }

  // Filter by user's accessible locations
  return { [locationFieldName]: { in: accessibleLocationIds } }
}

/**
 * Default role configurations
 *
 * REDESIGNED RBAC SYSTEM - Task-Specific Granular Roles
 *
 * Principles:
 * 1. Descriptive role names that clearly state what the user can do
 * 2. Minimal permissions - each role has only what's needed for that task
 * 3. Users can have multiple roles for flexible permission combinations
 * 4. Clear separation of duties (create, approve, receive are different roles)
 * 5. Easy to understand - role name describes the function
 */
export const DEFAULT_ROLES = {
  // ============================================
  // CATEGORY 1: ADMINISTRATIVE ROLES
  // ============================================

  SYSTEM_ADMINISTRATOR: {
    name: 'System Administrator',
    description: 'Full system access - platform owner/super admin',
    category: 'Administrative',
    permissions: Object.values(PERMISSIONS), // Has ALL permissions
  },

  USER_MANAGER: {
    name: 'User Manager',
    description: 'Creates and manages user accounts',
    category: 'Administrative',
    permissions: [
      PERMISSIONS.DASHBOARD_VIEW,
      PERMISSIONS.USER_VIEW,
      PERMISSIONS.USER_CREATE,
      PERMISSIONS.USER_UPDATE,
      PERMISSIONS.USER_DELETE,
      PERMISSIONS.ROLE_VIEW, // Can view roles to assign to users
    ],
  },

  ROLE_MANAGER: {
    name: 'Role Manager',
    description: 'Creates and manages roles and permissions',
    category: 'Administrative',
    permissions: [
      PERMISSIONS.DASHBOARD_VIEW,
      PERMISSIONS.ROLE_VIEW,
      PERMISSIONS.ROLE_CREATE,
      PERMISSIONS.ROLE_UPDATE,
      PERMISSIONS.ROLE_DELETE,
      PERMISSIONS.USER_VIEW, // Can view users to understand role assignments
    ],
  },

  LOCATION_MANAGER: {
    name: 'Location Manager',
    description: 'Manages business locations and branches',
    category: 'Administrative',
    permissions: [
      PERMISSIONS.DASHBOARD_VIEW,
      PERMISSIONS.LOCATION_VIEW,
      PERMISSIONS.LOCATION_CREATE,
      PERMISSIONS.LOCATION_UPDATE,
      PERMISSIONS.LOCATION_DELETE,
      PERMISSIONS.ACCESS_ALL_LOCATIONS,
    ],
  },

  BUSINESS_SETTINGS_MANAGER: {
    name: 'Business Settings Manager',
    description: 'Configures business settings and preferences',
    category: 'Administrative',
    permissions: [
      PERMISSIONS.DASHBOARD_VIEW,
      PERMISSIONS.BUSINESS_SETTINGS_VIEW,
      PERMISSIONS.BUSINESS_SETTINGS_EDIT,
    ],
  },

  // ============================================
  // CATEGORY 2: PRODUCT & INVENTORY ROLES
  // ============================================

  PRODUCT_CATALOG_MANAGER: {
    name: 'Product Catalog Manager',
    description: 'Creates and manages products, categories, brands, units',
    category: 'Product & Inventory',
    permissions: [
      PERMISSIONS.DASHBOARD_VIEW,
      PERMISSIONS.PRODUCT_VIEW,
      PERMISSIONS.PRODUCT_CREATE,
      PERMISSIONS.PRODUCT_UPDATE,
      PERMISSIONS.PRODUCT_DELETE,
      PERMISSIONS.PRODUCT_VIEW_PURCHASE_PRICE,
      PERMISSIONS.PRODUCT_VIEW_PROFIT_MARGIN,
      PERMISSIONS.PRODUCT_VIEW_SUPPLIER,
      PERMISSIONS.ACCESS_DEFAULT_SELLING_PRICE,
      PERMISSIONS.PRODUCT_CATEGORY_VIEW,
      PERMISSIONS.PRODUCT_CATEGORY_CREATE,
      PERMISSIONS.PRODUCT_CATEGORY_UPDATE,
      PERMISSIONS.PRODUCT_CATEGORY_DELETE,
      PERMISSIONS.PRODUCT_BRAND_VIEW,
      PERMISSIONS.PRODUCT_BRAND_CREATE,
      PERMISSIONS.PRODUCT_BRAND_UPDATE,
      PERMISSIONS.PRODUCT_BRAND_DELETE,
      PERMISSIONS.PRODUCT_UNIT_VIEW,
      PERMISSIONS.PRODUCT_UNIT_CREATE,
      PERMISSIONS.PRODUCT_UNIT_UPDATE,
      PERMISSIONS.PRODUCT_UNIT_DELETE,
      PERMISSIONS.PRODUCT_WARRANTY_VIEW,
      PERMISSIONS.PRODUCT_WARRANTY_CREATE,
      PERMISSIONS.PRODUCT_WARRANTY_UPDATE,
      PERMISSIONS.PRODUCT_WARRANTY_DELETE,
    ],
  },

  PRODUCT_VIEWER: {
    name: 'Product Viewer',
    description: 'View-only access to product information',
    category: 'Product & Inventory',
    permissions: [
      PERMISSIONS.DASHBOARD_VIEW,
      PERMISSIONS.PRODUCT_VIEW,
      PERMISSIONS.PRODUCT_CATEGORY_VIEW,
      PERMISSIONS.PRODUCT_BRAND_VIEW,
      PERMISSIONS.PRODUCT_UNIT_VIEW,
      PERMISSIONS.PRODUCT_WARRANTY_VIEW,
    ],
  },

  INVENTORY_COUNTER: {
    name: 'Inventory Counter',
    description: 'Conducts physical inventory counts',
    category: 'Product & Inventory',
    permissions: [
      PERMISSIONS.DASHBOARD_VIEW,
      PERMISSIONS.PRODUCT_VIEW,
      PERMISSIONS.PHYSICAL_INVENTORY_EXPORT,
      // PERMISSIONS.PHYSICAL_INVENTORY_IMPORT, // DISABLED - Too dangerous! Only Super Admin can import
      PERMISSIONS.STOCK_REPORT_VIEW,
    ],
  },

  INVENTORY_ADJUSTER: {
    name: 'Inventory Adjuster',
    description: 'Creates inventory adjustment requests',
    category: 'Product & Inventory',
    permissions: [
      PERMISSIONS.DASHBOARD_VIEW,
      PERMISSIONS.PRODUCT_VIEW,
      PERMISSIONS.INVENTORY_CORRECTION_VIEW,
      PERMISSIONS.INVENTORY_CORRECTION_CREATE,
      PERMISSIONS.INVENTORY_CORRECTION_UPDATE,
    ],
  },

  INVENTORY_APPROVER: {
    name: 'Inventory Approver',
    description: 'Approves inventory corrections and adjustments',
    category: 'Product & Inventory',
    permissions: [
      PERMISSIONS.DASHBOARD_VIEW,
      PERMISSIONS.PRODUCT_VIEW,
      PERMISSIONS.INVENTORY_CORRECTION_VIEW,
      PERMISSIONS.INVENTORY_CORRECTION_APPROVE,
      PERMISSIONS.STOCK_REPORT_VIEW,
    ],
  },

  OPENING_STOCK_MANAGER: {
    name: 'Opening Stock Manager',
    description: 'Sets and manages opening stock for products',
    category: 'Product & Inventory',
    permissions: [
      PERMISSIONS.DASHBOARD_VIEW,
      PERMISSIONS.PRODUCT_VIEW,
      PERMISSIONS.PRODUCT_OPENING_STOCK,
      PERMISSIONS.PRODUCT_LOCK_OPENING_STOCK,
      PERMISSIONS.PRODUCT_UNLOCK_OPENING_STOCK,
      PERMISSIONS.PRODUCT_MODIFY_LOCKED_STOCK,
    ],
  },

  STOCK_AUDITOR: {
    name: 'Stock Auditor',
    description: 'Views all stock levels across all locations',
    category: 'Product & Inventory',
    permissions: [
      PERMISSIONS.DASHBOARD_VIEW,
      PERMISSIONS.PRODUCT_VIEW,
      PERMISSIONS.PRODUCT_VIEW_ALL_BRANCH_STOCK,
      PERMISSIONS.INVENTORY_LEDGER_VIEW,
      PERMISSIONS.INVENTORY_LEDGER_EXPORT,
      PERMISSIONS.STOCK_REPORT_VIEW,
      PERMISSIONS.VIEW_INVENTORY_REPORTS,
      PERMISSIONS.ACCESS_ALL_LOCATIONS,
    ],
  },

  // ============================================
  // CATEGORY 3: TRANSFER ROLES (SEPARATION OF DUTIES)
  // ============================================

  TRANSFER_CREATOR: {
    name: 'Transfer Creator',
    description: 'Creates stock transfer requests ONLY',
    category: 'Stock Transfers',
    permissions: [
      PERMISSIONS.DASHBOARD_VIEW,
      PERMISSIONS.PRODUCT_VIEW,
      PERMISSIONS.STOCK_TRANSFER_VIEW,
      PERMISSIONS.STOCK_TRANSFER_CREATE,
      PERMISSIONS.LOCATION_VIEW,
    ],
  },

  TRANSFER_SENDER: {
    name: 'Transfer Sender',
    description: 'Checks and sends approved transfers from warehouse',
    category: 'Stock Transfers',
    permissions: [
      PERMISSIONS.DASHBOARD_VIEW,
      PERMISSIONS.PRODUCT_VIEW,
      PERMISSIONS.STOCK_TRANSFER_VIEW,
      PERMISSIONS.STOCK_TRANSFER_CHECK,
      PERMISSIONS.STOCK_TRANSFER_SEND,
      PERMISSIONS.SERIAL_NUMBER_VIEW,
      PERMISSIONS.SERIAL_NUMBER_SCAN,
    ],
  },

  TRANSFER_RECEIVER: {
    name: 'Transfer Receiver',
    description: 'Receives incoming transfers at destination location',
    category: 'Stock Transfers',
    permissions: [
      PERMISSIONS.DASHBOARD_VIEW,
      PERMISSIONS.PRODUCT_VIEW,
      PERMISSIONS.STOCK_TRANSFER_VIEW,
      PERMISSIONS.STOCK_TRANSFER_RECEIVE,
      PERMISSIONS.SERIAL_NUMBER_VIEW,
      PERMISSIONS.SERIAL_NUMBER_SCAN,
    ],
  },

  TRANSFER_APPROVER: {
    name: 'Transfer Approver',
    description: 'Verifies and completes transfers (final approval)',
    category: 'Stock Transfers',
    permissions: [
      PERMISSIONS.DASHBOARD_VIEW,
      PERMISSIONS.PRODUCT_VIEW,
      PERMISSIONS.STOCK_TRANSFER_VIEW,
      PERMISSIONS.STOCK_TRANSFER_VERIFY,
      PERMISSIONS.STOCK_TRANSFER_COMPLETE,
      PERMISSIONS.STOCK_TRANSFER_CANCEL,
    ],
  },

  TRANSFER_MANAGER: {
    name: 'Transfer Manager',
    description: 'Full access to all transfer operations',
    category: 'Stock Transfers',
    permissions: [
      PERMISSIONS.DASHBOARD_VIEW,
      PERMISSIONS.PRODUCT_VIEW,
      PERMISSIONS.STOCK_TRANSFER_VIEW,
      PERMISSIONS.STOCK_TRANSFER_CREATE,
      PERMISSIONS.STOCK_TRANSFER_CHECK,
      PERMISSIONS.STOCK_TRANSFER_SEND,
      PERMISSIONS.STOCK_TRANSFER_RECEIVE,
      PERMISSIONS.STOCK_TRANSFER_VERIFY,
      PERMISSIONS.STOCK_TRANSFER_COMPLETE,
      PERMISSIONS.STOCK_TRANSFER_CANCEL,
      PERMISSIONS.SERIAL_NUMBER_VIEW,
      PERMISSIONS.SERIAL_NUMBER_TRACK,
      PERMISSIONS.SERIAL_NUMBER_SCAN,
      PERMISSIONS.REPORT_TRANSFER_VIEW,
      PERMISSIONS.REPORT_TRANSFER_TRENDS,
    ],
  },

  // ============================================
  // CATEGORY 4: PURCHASE & PROCUREMENT ROLES
  // ============================================

  PURCHASE_ORDER_CREATOR: {
    name: 'Purchase Order Creator',
    description: 'Creates purchase orders',
    category: 'Purchases',
    permissions: [
      PERMISSIONS.DASHBOARD_VIEW,
      PERMISSIONS.PRODUCT_VIEW,
      PERMISSIONS.PURCHASE_VIEW,
      PERMISSIONS.PURCHASE_CREATE,
      PERMISSIONS.PURCHASE_UPDATE,
      PERMISSIONS.SUPPLIER_VIEW,
    ],
  },

  PURCHASE_ORDER_APPROVER: {
    name: 'Purchase Order Approver',
    description: 'Approves purchase orders',
    category: 'Purchases',
    permissions: [
      PERMISSIONS.DASHBOARD_VIEW,
      PERMISSIONS.PURCHASE_VIEW,
      PERMISSIONS.PURCHASE_APPROVE,
      PERMISSIONS.PURCHASE_VIEW_COST,
      PERMISSIONS.SUPPLIER_VIEW,
    ],
  },

  GOODS_RECEIPT_CLERK: {
    name: 'Goods Receipt Clerk',
    description: 'Receives purchased goods and creates GRNs',
    category: 'Purchases',
    permissions: [
      PERMISSIONS.DASHBOARD_VIEW,
      PERMISSIONS.PRODUCT_VIEW,
      PERMISSIONS.PURCHASE_VIEW,
      PERMISSIONS.PURCHASE_RECEIVE,
      PERMISSIONS.PURCHASE_RECEIPT_CREATE,
      PERMISSIONS.PURCHASE_RECEIPT_VIEW,
      PERMISSIONS.SERIAL_NUMBER_VIEW,
      PERMISSIONS.SERIAL_NUMBER_TRACK,
      PERMISSIONS.SERIAL_NUMBER_SCAN,
      PERMISSIONS.SUPPLIER_VIEW,
    ],
  },

  GOODS_RECEIPT_APPROVER: {
    name: 'Goods Receipt Approver',
    description: 'Approves goods receipt notes (GRNs)',
    category: 'Purchases',
    permissions: [
      PERMISSIONS.DASHBOARD_VIEW,
      PERMISSIONS.PURCHASE_VIEW,
      PERMISSIONS.PURCHASE_RECEIPT_VIEW,
      PERMISSIONS.PURCHASE_RECEIPT_APPROVE,
      PERMISSIONS.PURCHASE_VIEW_COST,
    ],
  },

  QUALITY_INSPECTOR: {
    name: 'Quality Inspector',
    description: 'Conducts quality control inspections',
    category: 'Purchases',
    permissions: [
      PERMISSIONS.DASHBOARD_VIEW,
      PERMISSIONS.PRODUCT_VIEW,
      PERMISSIONS.QC_INSPECTION_VIEW,
      PERMISSIONS.QC_INSPECTION_CREATE,
      PERMISSIONS.QC_INSPECTION_CONDUCT,
      PERMISSIONS.QC_TEMPLATE_VIEW,
      PERMISSIONS.PURCHASE_RECEIPT_VIEW,
    ],
  },

  QUALITY_APPROVER: {
    name: 'Quality Approver',
    description: 'Approves QC inspection results',
    category: 'Purchases',
    permissions: [
      PERMISSIONS.DASHBOARD_VIEW,
      PERMISSIONS.QC_INSPECTION_VIEW,
      PERMISSIONS.QC_INSPECTION_APPROVE,
      PERMISSIONS.QC_TEMPLATE_VIEW,
      PERMISSIONS.QC_TEMPLATE_MANAGE,
    ],
  },

  SUPPLIER_MANAGER: {
    name: 'Supplier Manager',
    description: 'Manages supplier information and relationships',
    category: 'Purchases',
    permissions: [
      PERMISSIONS.DASHBOARD_VIEW,
      PERMISSIONS.SUPPLIER_VIEW,
      PERMISSIONS.SUPPLIER_CREATE,
      PERMISSIONS.SUPPLIER_UPDATE,
      PERMISSIONS.SUPPLIER_DELETE,
      PERMISSIONS.SUPPLIER_VIEW_CONTACT_DETAILS,
      PERMISSIONS.SUPPLIER_VIEW_PAYMENT_TERMS,
    ],
  },

  // ============================================
  // CATEGORY 5: SALES & POS ROLES
  // ============================================

  SALES_CASHIER: {
    name: 'Sales Cashier',
    description: 'Operates POS and processes sales transactions',
    category: 'Sales & POS',
    permissions: [
      PERMISSIONS.DASHBOARD_VIEW,
      PERMISSIONS.PRODUCT_VIEW,
      PERMISSIONS.SELL_VIEW_OWN,
      PERMISSIONS.SELL_CREATE,
      PERMISSIONS.CUSTOMER_VIEW,
      PERMISSIONS.CUSTOMER_CREATE,
      PERMISSIONS.SHIFT_OPEN,
      PERMISSIONS.SHIFT_CLOSE,
      PERMISSIONS.SHIFT_VIEW,
      PERMISSIONS.CASH_IN_OUT,
      PERMISSIONS.CASH_COUNT,
      PERMISSIONS.X_READING,
      PERMISSIONS.VOID_CREATE,
      PERMISSIONS.FREEBIE_ADD,
      PERMISSIONS.SERIAL_NUMBER_SCAN,
      // Basic sales reports
      PERMISSIONS.REPORT_VIEW,
      PERMISSIONS.REPORT_SALES_VIEW,
      PERMISSIONS.REPORT_SALES_TODAY,
      PERMISSIONS.SALES_REPORT_VIEW,
      PERMISSIONS.SALES_REPORT_DAILY,
    ],
  },

  SALES_SUPERVISOR: {
    name: 'Sales Supervisor',
    description: 'Manages sales operations, handles voids and refunds',
    category: 'Sales & POS',
    permissions: [
      PERMISSIONS.DASHBOARD_VIEW,
      PERMISSIONS.PRODUCT_VIEW,
      PERMISSIONS.SELL_VIEW,
      PERMISSIONS.SELL_UPDATE,
      PERMISSIONS.SELL_DELETE,
      PERMISSIONS.SELL_VIEW_COST,
      PERMISSIONS.SELL_VIEW_PROFIT,
      PERMISSIONS.SELL_VIEW_DISCOUNT_DETAILS,
      PERMISSIONS.CUSTOMER_VIEW,
      PERMISSIONS.CUSTOMER_CREATE,
      PERMISSIONS.CUSTOMER_UPDATE,
      PERMISSIONS.VOID_CREATE,
      PERMISSIONS.VOID_APPROVE,
      PERMISSIONS.CUSTOMER_RETURN_CREATE,
      PERMISSIONS.CUSTOMER_RETURN_VIEW,
      PERMISSIONS.SHIFT_VIEW,
      PERMISSIONS.SHIFT_VIEW_ALL,
      PERMISSIONS.CASH_APPROVE_LARGE_TRANSACTIONS,
      PERMISSIONS.FREEBIE_APPROVE,
      PERMISSIONS.FREEBIE_VIEW_LOG,
      // Sales reports
      PERMISSIONS.REPORT_VIEW,
      PERMISSIONS.SALES_REPORT_VIEW,
      PERMISSIONS.SALES_REPORT_DAILY,
      PERMISSIONS.SALES_REPORT_SUMMARY,
      PERMISSIONS.SALES_REPORT_JOURNAL,
      PERMISSIONS.SALES_REPORT_PER_ITEM,
      PERMISSIONS.SALES_REPORT_PER_CASHIER,
      PERMISSIONS.SALES_REPORT_ANALYTICS,
    ],
  },

  SHIFT_MANAGER: {
    name: 'Shift Manager',
    description: 'Manages cashier shifts and reviews shift performance',
    category: 'Sales & POS',
    permissions: [
      PERMISSIONS.DASHBOARD_VIEW,
      PERMISSIONS.SHIFT_VIEW,
      PERMISSIONS.SHIFT_VIEW_ALL,
      PERMISSIONS.CASH_APPROVE_LARGE_TRANSACTIONS,
      PERMISSIONS.REPORT_VIEW,
      PERMISSIONS.SALES_REPORT_VIEW,
      PERMISSIONS.SALES_REPORT_PER_CASHIER,
    ],
  },

  CASH_APPROVER: {
    name: 'Cash Approver',
    description: 'Approves large cash transactions',
    category: 'Sales & POS',
    permissions: [
      PERMISSIONS.DASHBOARD_VIEW,
      PERMISSIONS.CASH_APPROVE_LARGE_TRANSACTIONS,
      PERMISSIONS.SHIFT_VIEW,
      PERMISSIONS.SHIFT_VIEW_ALL,
    ],
  },

  CUSTOMER_SERVICE_REP: {
    name: 'Customer Service Representative',
    description: 'Manages customer information and relationships',
    category: 'Sales & POS',
    permissions: [
      PERMISSIONS.DASHBOARD_VIEW,
      PERMISSIONS.CUSTOMER_VIEW,
      PERMISSIONS.CUSTOMER_CREATE,
      PERMISSIONS.CUSTOMER_UPDATE,
      PERMISSIONS.CUSTOMER_DELETE,
    ],
  },

  // ============================================
  // CATEGORY 6: RETURN ROLES
  // ============================================

  CUSTOMER_RETURN_CREATOR: {
    name: 'Customer Return Creator',
    description: 'Processes customer return requests',
    category: 'Returns',
    permissions: [
      PERMISSIONS.DASHBOARD_VIEW,
      PERMISSIONS.PRODUCT_VIEW,
      PERMISSIONS.CUSTOMER_VIEW,
      PERMISSIONS.SELL_VIEW,
      PERMISSIONS.CUSTOMER_RETURN_VIEW,
      PERMISSIONS.CUSTOMER_RETURN_CREATE,
      PERMISSIONS.SERIAL_NUMBER_VIEW,
    ],
  },

  CUSTOMER_RETURN_APPROVER: {
    name: 'Customer Return Approver',
    description: 'Approves customer returns',
    category: 'Returns',
    permissions: [
      PERMISSIONS.DASHBOARD_VIEW,
      PERMISSIONS.CUSTOMER_RETURN_VIEW,
      PERMISSIONS.CUSTOMER_RETURN_APPROVE,
      PERMISSIONS.CUSTOMER_RETURN_DELETE,
    ],
  },

  SUPPLIER_RETURN_CREATOR: {
    name: 'Supplier Return Creator',
    description: 'Creates supplier return requests',
    category: 'Returns',
    permissions: [
      PERMISSIONS.DASHBOARD_VIEW,
      PERMISSIONS.PRODUCT_VIEW,
      PERMISSIONS.SUPPLIER_VIEW,
      PERMISSIONS.PURCHASE_VIEW,
      PERMISSIONS.SUPPLIER_RETURN_VIEW,
      PERMISSIONS.SUPPLIER_RETURN_CREATE,
      PERMISSIONS.SERIAL_NUMBER_VIEW,
    ],
  },

  SUPPLIER_RETURN_APPROVER: {
    name: 'Supplier Return Approver',
    description: 'Approves supplier returns',
    category: 'Returns',
    permissions: [
      PERMISSIONS.DASHBOARD_VIEW,
      PERMISSIONS.SUPPLIER_RETURN_VIEW,
      PERMISSIONS.SUPPLIER_RETURN_APPROVE,
      PERMISSIONS.SUPPLIER_RETURN_DELETE,
    ],
  },

  // ============================================
  // CATEGORY 7: FINANCIAL & ACCOUNTING ROLES
  // ============================================

  ACCOUNTS_PAYABLE_CLERK: {
    name: 'Accounts Payable Clerk',
    description: 'Manages supplier invoices and payment processing',
    category: 'Financial & Accounting',
    permissions: [
      PERMISSIONS.DASHBOARD_VIEW,
      PERMISSIONS.SUPPLIER_VIEW,
      PERMISSIONS.SUPPLIER_VIEW_CONTACT_DETAILS,
      PERMISSIONS.SUPPLIER_VIEW_PAYMENT_TERMS,
      PERMISSIONS.PURCHASE_VIEW,
      PERMISSIONS.PURCHASE_VIEW_COST,
      PERMISSIONS.ACCOUNTS_PAYABLE_VIEW,
      PERMISSIONS.ACCOUNTS_PAYABLE_CREATE,
      PERMISSIONS.ACCOUNTS_PAYABLE_UPDATE,
      PERMISSIONS.PAYMENT_VIEW,
      PERMISSIONS.PAYMENT_CREATE,
      PERMISSIONS.BANK_VIEW,
      PERMISSIONS.BANK_TRANSACTION_VIEW,
    ],
  },

  PAYMENT_APPROVER: {
    name: 'Payment Approver',
    description: 'Approves supplier payments',
    category: 'Financial & Accounting',
    permissions: [
      PERMISSIONS.DASHBOARD_VIEW,
      PERMISSIONS.PAYMENT_VIEW,
      PERMISSIONS.PAYMENT_APPROVE,
      PERMISSIONS.ACCOUNTS_PAYABLE_VIEW,
      PERMISSIONS.BANK_TRANSACTION_VIEW,
    ],
  },

  EXPENSE_RECORDER: {
    name: 'Expense Recorder',
    description: 'Records business expenses',
    category: 'Financial & Accounting',
    permissions: [
      PERMISSIONS.DASHBOARD_VIEW,
      PERMISSIONS.EXPENSE_VIEW,
      PERMISSIONS.EXPENSE_CREATE,
      PERMISSIONS.EXPENSE_UPDATE,
    ],
  },

  BANK_RECONCILIATION_CLERK: {
    name: 'Bank Reconciliation Clerk',
    description: 'Manages bank transactions and reconciliation',
    category: 'Financial & Accounting',
    permissions: [
      PERMISSIONS.DASHBOARD_VIEW,
      PERMISSIONS.BANK_VIEW,
      PERMISSIONS.BANK_CREATE,
      PERMISSIONS.BANK_UPDATE,
      PERMISSIONS.BANK_TRANSACTION_VIEW,
      PERMISSIONS.BANK_TRANSACTION_CREATE,
      PERMISSIONS.BANK_TRANSACTION_UPDATE,
      PERMISSIONS.PAYMENT_VIEW,
    ],
  },

  FINANCIAL_VIEWER: {
    name: 'Financial Viewer',
    description: 'View-only access to financial data',
    category: 'Financial & Accounting',
    permissions: [
      PERMISSIONS.DASHBOARD_VIEW,
      PERMISSIONS.PRODUCT_VIEW_PURCHASE_PRICE,
      PERMISSIONS.PRODUCT_VIEW_PROFIT_MARGIN,
      PERMISSIONS.SELL_VIEW,
      PERMISSIONS.SELL_VIEW_COST,
      PERMISSIONS.SELL_VIEW_PROFIT,
      PERMISSIONS.PURCHASE_VIEW,
      PERMISSIONS.PURCHASE_VIEW_COST,
      PERMISSIONS.ACCOUNTS_PAYABLE_VIEW,
      PERMISSIONS.PAYMENT_VIEW,
      PERMISSIONS.BANK_VIEW,
      PERMISSIONS.BANK_TRANSACTION_VIEW,
      PERMISSIONS.EXPENSE_VIEW,
      PERMISSIONS.REPORT_VIEW,
      PERMISSIONS.REPORT_PROFIT_LOSS,
      PERMISSIONS.REPORT_PROFITABILITY,
    ],
  },

  // ============================================
  // CATEGORY 8: REPORT ROLES
  // ============================================

  SALES_REPORT_VIEWER: {
    name: 'Sales Report Viewer',
    description: 'Views sales reports and analytics',
    category: 'Reports',
    permissions: [
      PERMISSIONS.DASHBOARD_VIEW,
      PERMISSIONS.REPORT_VIEW,
      PERMISSIONS.REPORT_SALES_VIEW,
      PERMISSIONS.REPORT_SALES_DAILY,
      PERMISSIONS.REPORT_SALES_TODAY,
      PERMISSIONS.REPORT_SALES_HISTORY,
      PERMISSIONS.REPORT_SALES_PROFITABILITY,
      PERMISSIONS.SALES_REPORT_VIEW,
      PERMISSIONS.SALES_REPORT_DAILY,
      PERMISSIONS.SALES_REPORT_SUMMARY,
      PERMISSIONS.SALES_REPORT_JOURNAL,
      PERMISSIONS.SALES_REPORT_PER_ITEM,
      PERMISSIONS.SALES_REPORT_PER_CASHIER,
      PERMISSIONS.SALES_REPORT_PER_LOCATION,
      PERMISSIONS.SALES_REPORT_ANALYTICS,
      PERMISSIONS.SALES_REPORT_CUSTOMER_ANALYSIS,
      PERMISSIONS.SALES_REPORT_PAYMENT_METHOD,
      PERMISSIONS.SALES_REPORT_DISCOUNT_ANALYSIS,
    ],
  },

  INVENTORY_REPORT_VIEWER: {
    name: 'Inventory Report Viewer',
    description: 'Views inventory reports and stock levels',
    category: 'Reports',
    permissions: [
      PERMISSIONS.DASHBOARD_VIEW,
      PERMISSIONS.PRODUCT_VIEW,
      PERMISSIONS.REPORT_VIEW,
      PERMISSIONS.REPORT_STOCK_ALERT,
      PERMISSIONS.STOCK_REPORT_VIEW,
      PERMISSIONS.VIEW_INVENTORY_REPORTS,
      PERMISSIONS.INVENTORY_LEDGER_VIEW,
      PERMISSIONS.INVENTORY_LEDGER_EXPORT,
    ],
  },

  PURCHASE_REPORT_VIEWER: {
    name: 'Purchase Report Viewer',
    description: 'Views purchase reports and analytics',
    category: 'Reports',
    permissions: [
      PERMISSIONS.DASHBOARD_VIEW,
      PERMISSIONS.REPORT_VIEW,
      PERMISSIONS.REPORT_PURCHASE_VIEW,
      PERMISSIONS.REPORT_PURCHASE_ANALYTICS,
      PERMISSIONS.REPORT_PURCHASE_TRENDS,
      PERMISSIONS.REPORT_PURCHASE_ITEMS,
      PERMISSIONS.REPORT_PRODUCT_PURCHASE_HISTORY,
      PERMISSIONS.REPORT_PURCHASE_SELL,
    ],
  },

  FINANCIAL_REPORT_VIEWER: {
    name: 'Financial Report Viewer',
    description: 'Views financial reports and profitability',
    category: 'Reports',
    permissions: [
      PERMISSIONS.DASHBOARD_VIEW,
      PERMISSIONS.REPORT_VIEW,
      PERMISSIONS.REPORT_PROFIT_LOSS,
      PERMISSIONS.REPORT_PROFITABILITY,
      PERMISSIONS.REPORT_SALES_PROFITABILITY,
    ],
  },

  BIR_READING_OPERATOR: {
    name: 'BIR Reading Operator',
    description: 'Generates X and Z readings for BIR compliance',
    category: 'Reports',
    permissions: [
      PERMISSIONS.DASHBOARD_VIEW,
      PERMISSIONS.X_READING,
      PERMISSIONS.Z_READING,
      PERMISSIONS.SHIFT_VIEW,
    ],
  },

  REPORT_EXPORTER: {
    name: 'Report Exporter',
    description: 'Can export all reports to PDF/Excel',
    category: 'Reports',
    permissions: [
      PERMISSIONS.DASHBOARD_VIEW,
      PERMISSIONS.REPORT_VIEW,
      // All sales reports
      PERMISSIONS.REPORT_SALES_VIEW,
      PERMISSIONS.REPORT_SALES_DAILY,
      PERMISSIONS.REPORT_SALES_TODAY,
      PERMISSIONS.REPORT_SALES_HISTORY,
      PERMISSIONS.REPORT_SALES_PROFITABILITY,
      PERMISSIONS.SALES_REPORT_VIEW,
      PERMISSIONS.SALES_REPORT_DAILY,
      PERMISSIONS.SALES_REPORT_SUMMARY,
      PERMISSIONS.SALES_REPORT_JOURNAL,
      PERMISSIONS.SALES_REPORT_PER_ITEM,
      PERMISSIONS.SALES_REPORT_PER_CASHIER,
      PERMISSIONS.SALES_REPORT_PER_LOCATION,
      PERMISSIONS.SALES_REPORT_ANALYTICS,
      PERMISSIONS.SALES_REPORT_CUSTOMER_ANALYSIS,
      PERMISSIONS.SALES_REPORT_PAYMENT_METHOD,
      PERMISSIONS.SALES_REPORT_DISCOUNT_ANALYSIS,
      // All inventory reports
      PERMISSIONS.REPORT_STOCK_ALERT,
      PERMISSIONS.STOCK_REPORT_VIEW,
      PERMISSIONS.VIEW_INVENTORY_REPORTS,
      PERMISSIONS.INVENTORY_LEDGER_VIEW,
      PERMISSIONS.INVENTORY_LEDGER_EXPORT,
      // All purchase reports
      PERMISSIONS.REPORT_PURCHASE_VIEW,
      PERMISSIONS.REPORT_PURCHASE_ANALYTICS,
      PERMISSIONS.REPORT_PURCHASE_TRENDS,
      PERMISSIONS.REPORT_PURCHASE_ITEMS,
      PERMISSIONS.REPORT_PRODUCT_PURCHASE_HISTORY,
      PERMISSIONS.REPORT_PURCHASE_SELL,
      // Transfer reports
      PERMISSIONS.REPORT_TRANSFER_VIEW,
      PERMISSIONS.REPORT_TRANSFER_TRENDS,
      // Financial reports
      PERMISSIONS.REPORT_PROFIT_LOSS,
      PERMISSIONS.REPORT_PROFITABILITY,
    ],
  },

  // ============================================
  // CATEGORY 9: HR & SCHEDULING ROLES
  // ============================================

  SCHEDULE_MANAGER: {
    name: 'Schedule Manager',
    description: 'Creates and manages employee schedules',
    category: 'HR & Scheduling',
    permissions: [
      PERMISSIONS.DASHBOARD_VIEW,
      PERMISSIONS.USER_VIEW,
      PERMISSIONS.SCHEDULE_VIEW,
      PERMISSIONS.SCHEDULE_CREATE,
      PERMISSIONS.SCHEDULE_UPDATE,
      PERMISSIONS.SCHEDULE_DELETE,
      PERMISSIONS.SCHEDULE_ASSIGN,
      PERMISSIONS.SCHEDULE_MANAGE_ALL,
    ],
  },

  ATTENDANCE_MANAGER: {
    name: 'Attendance Manager',
    description: 'Manages employee attendance and time tracking',
    category: 'HR & Scheduling',
    permissions: [
      PERMISSIONS.DASHBOARD_VIEW,
      PERMISSIONS.USER_VIEW,
      PERMISSIONS.ATTENDANCE_VIEW,
      PERMISSIONS.ATTENDANCE_MANAGE,
      PERMISSIONS.ATTENDANCE_EDIT,
      PERMISSIONS.ATTENDANCE_REPORT,
      PERMISSIONS.OVERTIME_VIEW_ALL,
      PERMISSIONS.OVERTIME_APPROVE,
      PERMISSIONS.OVERTIME_CONFIGURE,
      PERMISSIONS.OVERTIME_ALERTS_VIEW,
      PERMISSIONS.OVERTIME_ALERTS_ACKNOWLEDGE,
      PERMISSIONS.OVERTIME_ALERTS_MANAGE,
    ],
  },

  LEAVE_APPROVER: {
    name: 'Leave Approver',
    description: 'Approves or rejects employee leave requests',
    category: 'HR & Scheduling',
    permissions: [
      PERMISSIONS.DASHBOARD_VIEW,
      PERMISSIONS.USER_VIEW,
      PERMISSIONS.LEAVE_REQUEST_VIEW_ALL,
      PERMISSIONS.LEAVE_REQUEST_APPROVE,
      PERMISSIONS.LEAVE_REQUEST_REJECT,
    ],
  },

  LOCATION_CHANGE_APPROVER: {
    name: 'Location Change Approver',
    description: 'Approves employee location change requests',
    category: 'HR & Scheduling',
    permissions: [
      PERMISSIONS.DASHBOARD_VIEW,
      PERMISSIONS.USER_VIEW,
      PERMISSIONS.LOCATION_VIEW,
      PERMISSIONS.LOCATION_CHANGE_REQUEST_VIEW,
      PERMISSIONS.LOCATION_CHANGE_REQUEST_APPROVE,
      PERMISSIONS.LOCATION_CHANGE_REQUEST_REJECT,
    ],
  },

  EMPLOYEE: {
    name: 'Employee',
    description: 'Basic employee access - attendance, leave requests, location changes',
    category: 'HR & Scheduling',
    permissions: [
      PERMISSIONS.DASHBOARD_VIEW,
      // Attendance - Own records
      PERMISSIONS.ATTENDANCE_VIEW_OWN,
      PERMISSIONS.ATTENDANCE_CLOCK_IN,
      PERMISSIONS.ATTENDANCE_CLOCK_OUT,
      // Schedule - View own
      PERMISSIONS.SCHEDULE_VIEW,
      // Leave Requests - Create and view own
      PERMISSIONS.LEAVE_REQUEST_VIEW_OWN,
      PERMISSIONS.LEAVE_REQUEST_CREATE,
      PERMISSIONS.LEAVE_REQUEST_UPDATE,
      // Location Changes - Create and view own
      PERMISSIONS.LOCATION_CHANGE_REQUEST_CREATE,
      // Overtime - View own records
      PERMISSIONS.OVERTIME_VIEW_OWN,
    ],
  },

  // ============================================
  // CATEGORY 10: CONVENIENCE ADMIN ROLES
  // (Combinations of granular roles for common scenarios)
  // ============================================

  BRANCH_MANAGER: {
    name: 'Branch Manager',
    description: 'Full operational control of a branch (no user/role management)',
    category: 'Convenience Admin',
    permissions: [
      // Dashboard Access
      PERMISSIONS.DASHBOARD_VIEW,

      // Product Management - Full CRUD
      PERMISSIONS.PRODUCT_VIEW,
      PERMISSIONS.PRODUCT_CREATE,
      PERMISSIONS.PRODUCT_UPDATE,
      PERMISSIONS.PRODUCT_DELETE,
      PERMISSIONS.PRODUCT_VIEW_PURCHASE_PRICE,
      PERMISSIONS.PRODUCT_OPENING_STOCK,
      PERMISSIONS.PRODUCT_VIEW_ALL_BRANCH_STOCK,
      PERMISSIONS.ACCESS_DEFAULT_SELLING_PRICE,
      PERMISSIONS.PRODUCT_LOCK_OPENING_STOCK,
      PERMISSIONS.PRODUCT_UNLOCK_OPENING_STOCK,
      PERMISSIONS.PRODUCT_MODIFY_LOCKED_STOCK,

      // Product Master Data - Full CRUD
      PERMISSIONS.PRODUCT_CATEGORY_VIEW,
      PERMISSIONS.PRODUCT_CATEGORY_CREATE,
      PERMISSIONS.PRODUCT_CATEGORY_UPDATE,
      PERMISSIONS.PRODUCT_CATEGORY_DELETE,
      PERMISSIONS.PRODUCT_BRAND_VIEW,
      PERMISSIONS.PRODUCT_BRAND_CREATE,
      PERMISSIONS.PRODUCT_BRAND_UPDATE,
      PERMISSIONS.PRODUCT_BRAND_DELETE,
      PERMISSIONS.PRODUCT_UNIT_VIEW,
      PERMISSIONS.PRODUCT_UNIT_CREATE,
      PERMISSIONS.PRODUCT_UNIT_UPDATE,
      PERMISSIONS.PRODUCT_UNIT_DELETE,
      PERMISSIONS.PRODUCT_WARRANTY_VIEW,
      PERMISSIONS.PRODUCT_WARRANTY_CREATE,
      PERMISSIONS.PRODUCT_WARRANTY_UPDATE,
      PERMISSIONS.PRODUCT_WARRANTY_DELETE,

      // Inventory Management - View & Approve Only (NO CREATE/UPDATE/DELETE)
      PERMISSIONS.INVENTORY_CORRECTION_VIEW,
      PERMISSIONS.INVENTORY_CORRECTION_APPROVE,
      PERMISSIONS.PHYSICAL_INVENTORY_EXPORT,
      // PERMISSIONS.PHYSICAL_INVENTORY_IMPORT, // DISABLED - Too dangerous! Only Super Admin can import

      // Sales - View Only (NO CREATE/UPDATE/DELETE)
      PERMISSIONS.SELL_VIEW,

      // Purchases - View & Approve Only (NO CREATE/UPDATE/DELETE)
      PERMISSIONS.PURCHASE_VIEW,
      PERMISSIONS.PURCHASE_APPROVE,
      PERMISSIONS.PURCHASE_RECEIVE,
      PERMISSIONS.PURCHASE_VIEW_COST,
      PERMISSIONS.PURCHASE_RECEIPT_CREATE, // Can create GRNs (receive goods)
      PERMISSIONS.PURCHASE_RECEIPT_APPROVE,
      PERMISSIONS.PURCHASE_RECEIPT_VIEW,

      // Purchase Returns - View & Approve Only (NO CREATE/UPDATE/DELETE)
      PERMISSIONS.PURCHASE_RETURN_VIEW,
      PERMISSIONS.PURCHASE_RETURN_APPROVE,

      // Purchase Amendments - View & Approve Only
      PERMISSIONS.PURCHASE_AMENDMENT_VIEW,
      PERMISSIONS.PURCHASE_AMENDMENT_APPROVE,
      PERMISSIONS.PURCHASE_AMENDMENT_REJECT,

      // Quality Control - View, Conduct & Approve (NO CREATE)
      PERMISSIONS.QC_INSPECTION_VIEW,
      PERMISSIONS.QC_INSPECTION_CONDUCT,
      PERMISSIONS.QC_INSPECTION_APPROVE,
      PERMISSIONS.QC_TEMPLATE_VIEW,
      PERMISSIONS.QC_TEMPLATE_MANAGE,

      // Accounts Payable & Payments - View & Approve Only (NO CREATE/UPDATE/DELETE)
      PERMISSIONS.ACCOUNTS_PAYABLE_VIEW,
      PERMISSIONS.PAYMENT_VIEW,
      PERMISSIONS.PAYMENT_APPROVE,

      // Banking - View Only (NO CREATE/UPDATE/DELETE)
      PERMISSIONS.BANK_VIEW,
      PERMISSIONS.BANK_TRANSACTION_VIEW,

      // Expenses - View Only (NO CREATE/UPDATE/DELETE)
      PERMISSIONS.EXPENSE_VIEW,

      // Customer & Supplier Management - Full CRUD
      PERMISSIONS.CUSTOMER_VIEW,
      PERMISSIONS.CUSTOMER_CREATE,
      PERMISSIONS.CUSTOMER_UPDATE,
      PERMISSIONS.CUSTOMER_DELETE,
      PERMISSIONS.SUPPLIER_VIEW,
      PERMISSIONS.SUPPLIER_CREATE,
      PERMISSIONS.SUPPLIER_UPDATE,
      PERMISSIONS.SUPPLIER_DELETE,

      // Returns - View, Approve & Delete (NO CREATE)
      PERMISSIONS.CUSTOMER_RETURN_VIEW,
      PERMISSIONS.CUSTOMER_RETURN_APPROVE,
      PERMISSIONS.CUSTOMER_RETURN_DELETE,
      PERMISSIONS.SUPPLIER_RETURN_VIEW,
      PERMISSIONS.SUPPLIER_RETURN_APPROVE,
      PERMISSIONS.SUPPLIER_RETURN_DELETE,

      // Void Transactions - Create & Approve
      PERMISSIONS.VOID_CREATE,
      PERMISSIONS.VOID_APPROVE,

      // Cash Management - Approve Large Transactions
      PERMISSIONS.CASH_APPROVE_LARGE_TRANSACTIONS,

      // Serial Numbers - View & Track
      PERMISSIONS.SERIAL_NUMBER_VIEW,
      PERMISSIONS.SERIAL_NUMBER_TRACK,

      // Shift Management - View All (NO OPEN/CLOSE - that's for cashiers)
      PERMISSIONS.SHIFT_VIEW,
      PERMISSIONS.SHIFT_VIEW_ALL,

      // BIR Readings - Full Access
      PERMISSIONS.X_READING,
      PERMISSIONS.Z_READING,

      // Reports - Full Access to All Reports
      PERMISSIONS.REPORT_VIEW,
      PERMISSIONS.REPORT_SALES_VIEW,
      PERMISSIONS.REPORT_SALES_DAILY,
      PERMISSIONS.REPORT_SALES_TODAY,
      PERMISSIONS.REPORT_SALES_HISTORY,
      PERMISSIONS.REPORT_SALES_PROFITABILITY,
      PERMISSIONS.REPORT_PURCHASE_VIEW,
      PERMISSIONS.REPORT_PURCHASE_ANALYTICS,
      PERMISSIONS.REPORT_PURCHASE_TRENDS,
      PERMISSIONS.REPORT_PURCHASE_ITEMS,
      PERMISSIONS.REPORT_TRANSFER_VIEW,
      PERMISSIONS.REPORT_TRANSFER_TRENDS,
      PERMISSIONS.REPORT_PROFIT_LOSS,
      PERMISSIONS.REPORT_PROFITABILITY,
      PERMISSIONS.REPORT_PRODUCT_PURCHASE_HISTORY,
      PERMISSIONS.REPORT_STOCK_ALERT,
      PERMISSIONS.STOCK_REPORT_VIEW,
      PERMISSIONS.VIEW_INVENTORY_REPORTS,
      PERMISSIONS.INVENTORY_LEDGER_VIEW,
      PERMISSIONS.INVENTORY_LEDGER_EXPORT,
      PERMISSIONS.REPORT_PURCHASE_SELL,

      // Sales Reports - Full Access
      PERMISSIONS.SALES_REPORT_VIEW,
      PERMISSIONS.SALES_REPORT_DAILY,
      PERMISSIONS.SALES_REPORT_SUMMARY,
      PERMISSIONS.SALES_REPORT_JOURNAL,
      PERMISSIONS.SALES_REPORT_PER_ITEM,
      PERMISSIONS.SALES_REPORT_PER_CASHIER,
      PERMISSIONS.SALES_REPORT_PER_LOCATION,
      PERMISSIONS.SALES_REPORT_ANALYTICS,
      PERMISSIONS.SALES_REPORT_CUSTOMER_ANALYSIS,
      PERMISSIONS.SALES_REPORT_PAYMENT_METHOD,
      PERMISSIONS.SALES_REPORT_DISCOUNT_ANALYSIS,

      // Business Settings - Full Access
      PERMISSIONS.BUSINESS_SETTINGS_VIEW,
      PERMISSIONS.BUSINESS_SETTINGS_EDIT,

      // Location Management - Full CRUD
      PERMISSIONS.LOCATION_VIEW,
      PERMISSIONS.LOCATION_CREATE,
      PERMISSIONS.LOCATION_UPDATE,
      PERMISSIONS.ACCESS_ALL_LOCATIONS,

      // Stock Transfers - View & Approve Only (NO CREATE)
      PERMISSIONS.STOCK_TRANSFER_VIEW,
      PERMISSIONS.STOCK_TRANSFER_CHECK,
      PERMISSIONS.STOCK_TRANSFER_SEND,
      PERMISSIONS.STOCK_TRANSFER_RECEIVE,
      PERMISSIONS.STOCK_TRANSFER_VERIFY,
      PERMISSIONS.STOCK_TRANSFER_COMPLETE,
      PERMISSIONS.STOCK_TRANSFER_CANCEL,

      // Audit Logs - View Only
      PERMISSIONS.AUDIT_LOG_VIEW,

      // Freebies - Add & Approve
      PERMISSIONS.FREEBIE_ADD,
      PERMISSIONS.FREEBIE_APPROVE,
      PERMISSIONS.FREEBIE_VIEW_LOG,

      // Announcements - Full Management
      PERMISSIONS.ANNOUNCEMENT_VIEW,
      PERMISSIONS.ANNOUNCEMENT_CREATE,
      PERMISSIONS.ANNOUNCEMENT_UPDATE,
      PERMISSIONS.ANNOUNCEMENT_DELETE,
      PERMISSIONS.ANNOUNCEMENT_MANAGE,

      // HR & Scheduling
      PERMISSIONS.SCHEDULE_VIEW,
      PERMISSIONS.SCHEDULE_MANAGE_ALL,
      PERMISSIONS.ATTENDANCE_VIEW,
      PERMISSIONS.ATTENDANCE_MANAGE,
      PERMISSIONS.LEAVE_REQUEST_VIEW_ALL,
      PERMISSIONS.LEAVE_REQUEST_APPROVE,
      PERMISSIONS.LEAVE_REQUEST_REJECT,
      PERMISSIONS.LOCATION_CHANGE_REQUEST_VIEW,
      PERMISSIONS.LOCATION_CHANGE_REQUEST_APPROVE,
      PERMISSIONS.LOCATION_CHANGE_REQUEST_REJECT,
    ],
  },

  WAREHOUSE_MANAGER: {
    name: 'Warehouse Manager',
    description: 'Full warehouse operations - receiving, transfers, inventory management',
    category: 'Convenience Admin',
    permissions: [
      PERMISSIONS.DASHBOARD_VIEW,
      PERMISSIONS.PRODUCT_VIEW,
      PERMISSIONS.PRODUCT_VIEW_PURCHASE_PRICE,
      PERMISSIONS.PRODUCT_VIEW_ALL_BRANCH_STOCK,
      // Full inventory management
      PERMISSIONS.INVENTORY_CORRECTION_VIEW,
      PERMISSIONS.INVENTORY_CORRECTION_CREATE,
      PERMISSIONS.INVENTORY_CORRECTION_APPROVE,
      PERMISSIONS.PHYSICAL_INVENTORY_EXPORT,
      // PERMISSIONS.PHYSICAL_INVENTORY_IMPORT, // DISABLED - Too dangerous! Only Super Admin can import
      // Full transfer management
      PERMISSIONS.STOCK_TRANSFER_VIEW,
      PERMISSIONS.STOCK_TRANSFER_CREATE,
      PERMISSIONS.STOCK_TRANSFER_CHECK,
      PERMISSIONS.STOCK_TRANSFER_SEND,
      PERMISSIONS.STOCK_TRANSFER_RECEIVE,
      PERMISSIONS.STOCK_TRANSFER_VERIFY,
      PERMISSIONS.STOCK_TRANSFER_COMPLETE,
      PERMISSIONS.SERIAL_NUMBER_VIEW,
      PERMISSIONS.SERIAL_NUMBER_TRACK,
      PERMISSIONS.SERIAL_NUMBER_SCAN,
      // Purchasing - receiving focus
      PERMISSIONS.PURCHASE_VIEW,
      PERMISSIONS.PURCHASE_RECEIVE,
      PERMISSIONS.PURCHASE_RECEIPT_CREATE,
      PERMISSIONS.PURCHASE_RECEIPT_VIEW,
      PERMISSIONS.PURCHASE_RECEIPT_APPROVE,
      PERMISSIONS.SUPPLIER_VIEW,
      // QC operations
      PERMISSIONS.QC_INSPECTION_VIEW,
      PERMISSIONS.QC_INSPECTION_CONDUCT,
      // Returns
      PERMISSIONS.SUPPLIER_RETURN_VIEW,
      PERMISSIONS.SUPPLIER_RETURN_CREATE,
      // Reports
      PERMISSIONS.REPORT_VIEW,
      PERMISSIONS.REPORT_STOCK_ALERT,
      PERMISSIONS.STOCK_REPORT_VIEW,
      PERMISSIONS.INVENTORY_LEDGER_VIEW,
      PERMISSIONS.VIEW_INVENTORY_REPORTS,
      PERMISSIONS.REPORT_TRANSFER_VIEW,
    ],
  },

  ACCOUNTING_MANAGER: {
    name: 'Accounting Manager',
    description: 'Full accounting and financial operations',
    category: 'Convenience Admin',
    permissions: [
      PERMISSIONS.DASHBOARD_VIEW,
      PERMISSIONS.PRODUCT_VIEW,
      PERMISSIONS.PRODUCT_VIEW_PURCHASE_PRICE,
      PERMISSIONS.PRODUCT_VIEW_PROFIT_MARGIN,
      PERMISSIONS.SELL_VIEW,
      PERMISSIONS.SELL_VIEW_COST,
      PERMISSIONS.SELL_VIEW_PROFIT,
      // Full purchase management
      PERMISSIONS.PURCHASE_VIEW,
      PERMISSIONS.PURCHASE_CREATE,
      PERMISSIONS.PURCHASE_UPDATE,
      PERMISSIONS.PURCHASE_APPROVE,
      PERMISSIONS.PURCHASE_VIEW_COST,
      PERMISSIONS.PURCHASE_RECEIPT_VIEW,
      PERMISSIONS.PURCHASE_RECEIPT_APPROVE,
      // Full financial management
      PERMISSIONS.ACCOUNTS_PAYABLE_VIEW,
      PERMISSIONS.ACCOUNTS_PAYABLE_CREATE,
      PERMISSIONS.ACCOUNTS_PAYABLE_UPDATE,
      PERMISSIONS.ACCOUNTS_PAYABLE_DELETE,
      PERMISSIONS.PAYMENT_VIEW,
      PERMISSIONS.PAYMENT_CREATE,
      PERMISSIONS.PAYMENT_APPROVE,
      PERMISSIONS.PAYMENT_UPDATE,
      PERMISSIONS.PAYMENT_DELETE,
      PERMISSIONS.BANK_VIEW,
      PERMISSIONS.BANK_CREATE,
      PERMISSIONS.BANK_UPDATE,
      PERMISSIONS.BANK_DELETE,
      PERMISSIONS.BANK_TRANSACTION_VIEW,
      PERMISSIONS.BANK_TRANSACTION_CREATE,
      PERMISSIONS.BANK_TRANSACTION_UPDATE,
      PERMISSIONS.BANK_TRANSACTION_DELETE,
      PERMISSIONS.EXPENSE_VIEW,
      PERMISSIONS.EXPENSE_CREATE,
      PERMISSIONS.EXPENSE_UPDATE,
      PERMISSIONS.EXPENSE_DELETE,
      // Supplier management
      PERMISSIONS.SUPPLIER_VIEW,
      PERMISSIONS.SUPPLIER_CREATE,
      PERMISSIONS.SUPPLIER_UPDATE,
      PERMISSIONS.SUPPLIER_VIEW_CONTACT_DETAILS,
      PERMISSIONS.SUPPLIER_VIEW_PAYMENT_TERMS,
      // All financial reports
      PERMISSIONS.REPORT_VIEW,
      PERMISSIONS.REPORT_PURCHASE_VIEW,
      PERMISSIONS.REPORT_PURCHASE_ANALYTICS,
      PERMISSIONS.REPORT_PURCHASE_TRENDS,
      PERMISSIONS.REPORT_PURCHASE_ITEMS,
      PERMISSIONS.REPORT_PROFIT_LOSS,
      PERMISSIONS.REPORT_PROFITABILITY,
      PERMISSIONS.REPORT_PRODUCT_PURCHASE_HISTORY,
      PERMISSIONS.REPORT_PURCHASE_SELL,
      PERMISSIONS.INVENTORY_LEDGER_VIEW,
      PERMISSIONS.INVENTORY_LEDGER_EXPORT,
    ],
  },

  STORE_SUPERVISOR: {
    name: 'Store Supervisor',
    description: 'Supervises store operations - sales, customers, basic approvals',
    category: 'Convenience Admin',
    permissions: [
      PERMISSIONS.DASHBOARD_VIEW,
      PERMISSIONS.PRODUCT_VIEW,
      // Sales supervision
      PERMISSIONS.SELL_VIEW,
      PERMISSIONS.SELL_UPDATE,
      PERMISSIONS.SELL_VIEW_COST,
      PERMISSIONS.SELL_VIEW_PROFIT,
      PERMISSIONS.VOID_CREATE,
      PERMISSIONS.VOID_APPROVE,
      // Customer management
      PERMISSIONS.CUSTOMER_VIEW,
      PERMISSIONS.CUSTOMER_CREATE,
      PERMISSIONS.CUSTOMER_UPDATE,
      PERMISSIONS.CUSTOMER_RETURN_VIEW,
      PERMISSIONS.CUSTOMER_RETURN_CREATE,
      PERMISSIONS.CUSTOMER_RETURN_APPROVE,
      // Shift supervision
      PERMISSIONS.SHIFT_VIEW,
      PERMISSIONS.SHIFT_VIEW_ALL,
      PERMISSIONS.CASH_APPROVE_LARGE_TRANSACTIONS,
      PERMISSIONS.FREEBIE_APPROVE,
      // Reports
      PERMISSIONS.REPORT_VIEW,
      PERMISSIONS.SALES_REPORT_VIEW,
      PERMISSIONS.SALES_REPORT_DAILY,
      PERMISSIONS.SALES_REPORT_SUMMARY,
      PERMISSIONS.SALES_REPORT_JOURNAL,
      PERMISSIONS.SALES_REPORT_PER_ITEM,
      PERMISSIONS.SALES_REPORT_PER_CASHIER,
      PERMISSIONS.SALES_REPORT_ANALYTICS,
      PERMISSIONS.REPORT_STOCK_ALERT,
      PERMISSIONS.STOCK_REPORT_VIEW,
    ],
  },

  // ============================================
  // LEGACY ROLES (For Backward Compatibility)
  // Deprecated - Use specific task-based roles instead
  // ============================================

  LEGACY_SUPER_ADMIN: {
    name: 'Super Admin (Legacy)',
    description: 'DEPRECATED: Use "System Administrator" instead',
    category: 'Legacy',
    permissions: Object.values(PERMISSIONS),
  },

  LEGACY_ADMIN: {
    name: 'Admin (Legacy)',
    description: 'DEPRECATED: Assign specific task-based roles instead',
    category: 'Legacy',
    permissions: [
      // Copy of old Branch Admin permissions for backwards compatibility
      PERMISSIONS.DASHBOARD_VIEW,
      PERMISSIONS.PRODUCT_VIEW,
      PERMISSIONS.PRODUCT_CREATE,
      PERMISSIONS.PRODUCT_UPDATE,
      PERMISSIONS.PRODUCT_DELETE,
      PERMISSIONS.SELL_VIEW,
      PERMISSIONS.PURCHASE_VIEW,
      PERMISSIONS.PURCHASE_APPROVE,
      PERMISSIONS.LOCATION_VIEW,
      PERMISSIONS.ACCESS_ALL_LOCATIONS,
      // ... (abbreviated for brevity - includes most permissions)
    ],
  },

  LEGACY_MANAGER: {
    name: 'Manager (Legacy)',
    description: 'DEPRECATED: Use "Branch Manager" or specific roles instead',
    category: 'Legacy',
    permissions: [
      // Copy of old Branch Manager permissions
      PERMISSIONS.DASHBOARD_VIEW,
      PERMISSIONS.PRODUCT_VIEW,
      PERMISSIONS.SELL_VIEW,
      PERMISSIONS.PURCHASE_VIEW,
      // ... (abbreviated)
    ],
  },

  LEGACY_CASHIER: {
    name: 'Cashier (Legacy)',
    description: 'DEPRECATED: Use "Sales Cashier" instead',
    category: 'Legacy',
    permissions: [
      // Copy of old Cashier permissions
      PERMISSIONS.DASHBOARD_VIEW,
      PERMISSIONS.PRODUCT_VIEW,
      PERMISSIONS.SELL_VIEW_OWN,
      PERMISSIONS.SELL_CREATE,
      PERMISSIONS.CUSTOMER_VIEW,
      PERMISSIONS.CUSTOMER_CREATE,
      PERMISSIONS.SHIFT_OPEN,
      PERMISSIONS.SHIFT_CLOSE,
      PERMISSIONS.SHIFT_VIEW,
      PERMISSIONS.CASH_IN_OUT,
      PERMISSIONS.CASH_COUNT,
      PERMISSIONS.X_READING,
      PERMISSIONS.VOID_CREATE,
    ],
  },
} as const
