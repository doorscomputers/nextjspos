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

  // Products
  PRODUCT_VIEW: 'product.view',
  PRODUCT_CREATE: 'product.create',
  PRODUCT_UPDATE: 'product.update',
  PRODUCT_DELETE: 'product.delete',
  PRODUCT_VIEW_PURCHASE_PRICE: 'product.view_purchase_price',
  PRODUCT_OPENING_STOCK: 'product.opening_stock',
  PRODUCT_VIEW_ALL_BRANCH_STOCK: 'product.view_all_branch_stock',
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

  // Sales
  SELL_VIEW: 'sell.view',
  SELL_CREATE: 'sell.create',
  SELL_UPDATE: 'sell.update',
  SELL_DELETE: 'sell.delete',
  SELL_VIEW_OWN: 'sell.view_own',

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

  // Suppliers
  SUPPLIER_VIEW: 'supplier.view',
  SUPPLIER_CREATE: 'supplier.create',
  SUPPLIER_UPDATE: 'supplier.update',
  SUPPLIER_DELETE: 'supplier.delete',

  // Reports - Granular Access
  REPORT_VIEW: 'report.view', // General report access

  // Sales Reports
  REPORT_SALES_VIEW: 'report.sales.view',
  REPORT_SALES_DAILY: 'report.sales.daily',
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
 */
export const DEFAULT_ROLES = {
  SUPER_ADMIN: {
    name: 'Super Admin',
    permissions: Object.values(PERMISSIONS), // Has ALL permissions
  },
  BRANCH_ADMIN: {
    name: 'Branch Admin',
    permissions: [
      PERMISSIONS.DASHBOARD_VIEW,
      PERMISSIONS.USER_VIEW,
      PERMISSIONS.USER_CREATE,
      PERMISSIONS.USER_UPDATE,
      PERMISSIONS.USER_DELETE,
      PERMISSIONS.ROLE_VIEW,
      PERMISSIONS.ROLE_CREATE,
      PERMISSIONS.ROLE_UPDATE,
      PERMISSIONS.ROLE_DELETE,
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
      // Product Master Data - Full Access
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
      PERMISSIONS.INVENTORY_CORRECTION_VIEW,
      PERMISSIONS.INVENTORY_CORRECTION_CREATE,
      PERMISSIONS.INVENTORY_CORRECTION_UPDATE,
      PERMISSIONS.INVENTORY_CORRECTION_DELETE,
      PERMISSIONS.INVENTORY_CORRECTION_APPROVE,
      PERMISSIONS.PHYSICAL_INVENTORY_EXPORT,
      PERMISSIONS.PHYSICAL_INVENTORY_IMPORT,
      PERMISSIONS.SELL_VIEW,
      PERMISSIONS.SELL_CREATE,
      PERMISSIONS.SELL_UPDATE,
      PERMISSIONS.SELL_DELETE,
      PERMISSIONS.PURCHASE_VIEW,
      PERMISSIONS.PURCHASE_CREATE,
      PERMISSIONS.PURCHASE_UPDATE,
      PERMISSIONS.PURCHASE_DELETE,
      PERMISSIONS.PURCHASE_APPROVE,
      PERMISSIONS.PURCHASE_RECEIVE,
      PERMISSIONS.PURCHASE_VIEW_COST,
      PERMISSIONS.PURCHASE_RECEIPT_CREATE,
      PERMISSIONS.PURCHASE_RECEIPT_APPROVE,
      PERMISSIONS.PURCHASE_RECEIPT_VIEW,
      PERMISSIONS.PURCHASE_RETURN_VIEW,
      PERMISSIONS.PURCHASE_RETURN_CREATE,
      PERMISSIONS.PURCHASE_RETURN_UPDATE,
      PERMISSIONS.PURCHASE_RETURN_DELETE,
      PERMISSIONS.PURCHASE_RETURN_APPROVE,
      PERMISSIONS.PURCHASE_AMENDMENT_VIEW,
      PERMISSIONS.PURCHASE_AMENDMENT_CREATE,
      PERMISSIONS.PURCHASE_AMENDMENT_APPROVE,
      PERMISSIONS.PURCHASE_AMENDMENT_REJECT,
      PERMISSIONS.QC_INSPECTION_VIEW,
      PERMISSIONS.QC_INSPECTION_CREATE,
      PERMISSIONS.QC_INSPECTION_CONDUCT,
      PERMISSIONS.QC_INSPECTION_APPROVE,
      PERMISSIONS.QC_TEMPLATE_VIEW,
      PERMISSIONS.QC_TEMPLATE_MANAGE,
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
      PERMISSIONS.CUSTOMER_VIEW,
      PERMISSIONS.CUSTOMER_CREATE,
      PERMISSIONS.CUSTOMER_UPDATE,
      PERMISSIONS.CUSTOMER_DELETE,
      PERMISSIONS.SUPPLIER_VIEW,
      PERMISSIONS.SUPPLIER_CREATE,
      PERMISSIONS.SUPPLIER_UPDATE,
      PERMISSIONS.SUPPLIER_DELETE,
      PERMISSIONS.REPORT_VIEW,
      // All Reports - Full Access
      PERMISSIONS.REPORT_SALES_VIEW,
      PERMISSIONS.REPORT_SALES_DAILY,
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
      PERMISSIONS.BUSINESS_SETTINGS_VIEW,
      PERMISSIONS.BUSINESS_SETTINGS_EDIT,
      PERMISSIONS.LOCATION_VIEW,
      PERMISSIONS.LOCATION_CREATE,
      PERMISSIONS.LOCATION_UPDATE,
      PERMISSIONS.ACCESS_ALL_LOCATIONS,
      PERMISSIONS.STOCK_TRANSFER_VIEW,
      PERMISSIONS.STOCK_TRANSFER_CREATE,
      PERMISSIONS.STOCK_TRANSFER_CHECK,
      PERMISSIONS.STOCK_TRANSFER_SEND,
      PERMISSIONS.STOCK_TRANSFER_RECEIVE,
      PERMISSIONS.STOCK_TRANSFER_VERIFY,
      PERMISSIONS.STOCK_TRANSFER_COMPLETE,
      PERMISSIONS.STOCK_TRANSFER_CANCEL,
      PERMISSIONS.AUDIT_LOG_VIEW,
      PERMISSIONS.FREEBIE_ADD,
      PERMISSIONS.FREEBIE_APPROVE,
      PERMISSIONS.FREEBIE_VIEW_LOG,
    ],
  },
  BRANCH_MANAGER: {
    name: 'Branch Manager',
    permissions: [
      PERMISSIONS.DASHBOARD_VIEW,
      PERMISSIONS.USER_VIEW,
      PERMISSIONS.PRODUCT_VIEW,
      PERMISSIONS.PRODUCT_CREATE,
      PERMISSIONS.PRODUCT_UPDATE,
      PERMISSIONS.PRODUCT_OPENING_STOCK,
      PERMISSIONS.ACCESS_DEFAULT_SELLING_PRICE,
      PERMISSIONS.PRODUCT_LOCK_OPENING_STOCK,
      // Product Master Data - View Only (No Create/Update/Delete)
      PERMISSIONS.PRODUCT_CATEGORY_VIEW,
      PERMISSIONS.PRODUCT_BRAND_VIEW,
      PERMISSIONS.PRODUCT_UNIT_VIEW,
      PERMISSIONS.PRODUCT_WARRANTY_VIEW,
      PERMISSIONS.INVENTORY_CORRECTION_VIEW,
      PERMISSIONS.INVENTORY_CORRECTION_CREATE,
      PERMISSIONS.INVENTORY_CORRECTION_UPDATE,
      PERMISSIONS.INVENTORY_CORRECTION_APPROVE,
      PERMISSIONS.PHYSICAL_INVENTORY_EXPORT,
      PERMISSIONS.PHYSICAL_INVENTORY_IMPORT,
      PERMISSIONS.SELL_VIEW,
      PERMISSIONS.SELL_CREATE,
      PERMISSIONS.SELL_UPDATE,
      PERMISSIONS.SELL_DELETE,
      PERMISSIONS.PURCHASE_VIEW,
      PERMISSIONS.PURCHASE_CREATE,
      PERMISSIONS.PURCHASE_UPDATE,
      PERMISSIONS.PURCHASE_APPROVE,
      PERMISSIONS.PURCHASE_RECEIVE,
      PERMISSIONS.PURCHASE_RECEIPT_CREATE,
      PERMISSIONS.PURCHASE_RECEIPT_APPROVE,
      PERMISSIONS.PURCHASE_RECEIPT_VIEW,
      PERMISSIONS.PURCHASE_RETURN_VIEW,
      PERMISSIONS.PURCHASE_RETURN_CREATE,
      PERMISSIONS.PURCHASE_RETURN_UPDATE,
      PERMISSIONS.PURCHASE_RETURN_APPROVE,
      PERMISSIONS.PURCHASE_AMENDMENT_VIEW,
      PERMISSIONS.PURCHASE_AMENDMENT_CREATE,
      PERMISSIONS.PURCHASE_AMENDMENT_APPROVE,
      PERMISSIONS.QC_INSPECTION_VIEW,
      PERMISSIONS.QC_INSPECTION_CREATE,
      PERMISSIONS.QC_INSPECTION_CONDUCT,
      PERMISSIONS.QC_INSPECTION_APPROVE,
      PERMISSIONS.QC_TEMPLATE_VIEW,
      PERMISSIONS.ACCOUNTS_PAYABLE_VIEW,
      PERMISSIONS.ACCOUNTS_PAYABLE_CREATE,
      PERMISSIONS.PAYMENT_VIEW,
      PERMISSIONS.PAYMENT_CREATE,
      PERMISSIONS.BANK_TRANSACTION_VIEW,
      PERMISSIONS.EXPENSE_VIEW,
      PERMISSIONS.EXPENSE_CREATE,
      PERMISSIONS.EXPENSE_UPDATE,
      PERMISSIONS.CUSTOMER_VIEW,
      PERMISSIONS.CUSTOMER_CREATE,
      PERMISSIONS.CUSTOMER_UPDATE,
      PERMISSIONS.SUPPLIER_VIEW,
      PERMISSIONS.SUPPLIER_CREATE,
      PERMISSIONS.SUPPLIER_UPDATE,
      PERMISSIONS.REPORT_VIEW,
      // Reports - Sales and Stock Only (No Purchase/Financial)
      PERMISSIONS.REPORT_SALES_VIEW,
      PERMISSIONS.REPORT_SALES_DAILY,
      PERMISSIONS.REPORT_STOCK_ALERT,
      PERMISSIONS.STOCK_REPORT_VIEW,
      PERMISSIONS.INVENTORY_LEDGER_VIEW,
      PERMISSIONS.REPORT_TRANSFER_VIEW,
      PERMISSIONS.REPORT_TRANSFER_TRENDS,
      PERMISSIONS.LOCATION_VIEW,
      PERMISSIONS.STOCK_TRANSFER_VIEW,
      PERMISSIONS.STOCK_TRANSFER_CREATE,
      PERMISSIONS.STOCK_TRANSFER_CHECK,
      PERMISSIONS.STOCK_TRANSFER_SEND,
      PERMISSIONS.STOCK_TRANSFER_RECEIVE,
      PERMISSIONS.STOCK_TRANSFER_VERIFY,
      PERMISSIONS.STOCK_TRANSFER_COMPLETE,
      PERMISSIONS.SHIFT_OPEN,
      PERMISSIONS.SHIFT_CLOSE,
      PERMISSIONS.SHIFT_VIEW,
      PERMISSIONS.SHIFT_VIEW_ALL,
      PERMISSIONS.CASH_IN_OUT,
      PERMISSIONS.CASH_COUNT,
      PERMISSIONS.CASH_APPROVE_LARGE_TRANSACTIONS,
      PERMISSIONS.VOID_CREATE,
      PERMISSIONS.VOID_APPROVE,
      PERMISSIONS.X_READING,
      PERMISSIONS.Z_READING,
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
      PERMISSIONS.FREEBIE_APPROVE,
      PERMISSIONS.FREEBIE_VIEW_LOG,
    ],
  },
  ACCOUNTING_STAFF: {
    name: 'Accounting Staff',
    permissions: [
      PERMISSIONS.DASHBOARD_VIEW,
      PERMISSIONS.PRODUCT_VIEW,
      PERMISSIONS.PRODUCT_VIEW_PURCHASE_PRICE,
      PERMISSIONS.SELL_VIEW,
      PERMISSIONS.PURCHASE_VIEW,
      PERMISSIONS.PURCHASE_CREATE,
      PERMISSIONS.PURCHASE_UPDATE,
      PERMISSIONS.PURCHASE_RECEIPT_CREATE,
      PERMISSIONS.PURCHASE_RECEIPT_VIEW,
      PERMISSIONS.PURCHASE_RETURN_VIEW,
      PERMISSIONS.PURCHASE_RETURN_CREATE,
      PERMISSIONS.PURCHASE_RETURN_UPDATE,
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
      PERMISSIONS.CUSTOMER_VIEW,
      PERMISSIONS.SUPPLIER_VIEW,
      PERMISSIONS.SUPPLIER_CREATE,
      PERMISSIONS.SUPPLIER_UPDATE,
      PERMISSIONS.REPORT_VIEW,
      // Reports - Purchase and Financial Only
      PERMISSIONS.REPORT_PURCHASE_VIEW,
      PERMISSIONS.REPORT_PURCHASE_ANALYTICS,
      PERMISSIONS.REPORT_PURCHASE_TRENDS,
      PERMISSIONS.REPORT_PURCHASE_ITEMS,
      PERMISSIONS.REPORT_PROFIT_LOSS,
      PERMISSIONS.REPORT_PROFITABILITY,
      PERMISSIONS.REPORT_PRODUCT_PURCHASE_HISTORY,
      PERMISSIONS.REPORT_PURCHASE_SELL,
      PERMISSIONS.STOCK_REPORT_VIEW,
      PERMISSIONS.INVENTORY_LEDGER_VIEW,
      PERMISSIONS.INVENTORY_LEDGER_EXPORT,
    ],
  },
  REGULAR_STAFF: {
    name: 'Regular Staff',
    permissions: [
      PERMISSIONS.DASHBOARD_VIEW,
      PERMISSIONS.PRODUCT_VIEW,
      PERMISSIONS.SELL_VIEW,
      PERMISSIONS.SELL_CREATE,
      PERMISSIONS.SELL_UPDATE,
      PERMISSIONS.CUSTOMER_VIEW,
      PERMISSIONS.CUSTOMER_CREATE,
      // Reports - Sales Only (Basic)
      PERMISSIONS.REPORT_SALES_VIEW,
      PERMISSIONS.REPORT_STOCK_ALERT,
      PERMISSIONS.STOCK_REPORT_VIEW,
    ],
  },
  CASHIER: {
    name: 'Regular Cashier',
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
      // Sales Reports - Cashier can view own sales data
      PERMISSIONS.REPORT_VIEW,
      PERMISSIONS.REPORT_SALES_VIEW,
      PERMISSIONS.SALES_REPORT_VIEW,
      PERMISSIONS.SALES_REPORT_DAILY,
      PERMISSIONS.SALES_REPORT_SUMMARY,
      PERMISSIONS.SALES_REPORT_JOURNAL,
      PERMISSIONS.SALES_REPORT_PER_ITEM,
      PERMISSIONS.SALES_REPORT_PER_CASHIER,
      PERMISSIONS.SALES_REPORT_ANALYTICS,
      // NO access to product master data (Categories, Brands, Units, Warranties)
      // NO access to purchase/financial/profit reports (intentionally restricted)
      // NO access to customer analysis or location comparison (restricted)
    ],
  },
} as const
