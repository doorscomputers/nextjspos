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
 * Check if user has a specific permission
 */
export function hasPermission(user: RBACUser | null, permission: Permission): boolean {
  if (!user || !user.permissions) return false
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

  // Reports
  REPORT_VIEW: 'report.view',
  REPORT_PROFIT_LOSS: 'report.profit_loss',
  REPORT_PURCHASE_SELL: 'report.purchase_sell',
  STOCK_REPORT_VIEW: 'report.stock.view',

  // Business Settings
  BUSINESS_SETTINGS_VIEW: 'business_settings.view',
  BUSINESS_SETTINGS_EDIT: 'business_settings.edit',

  // Locations
  LOCATION_VIEW: 'location.view',
  LOCATION_CREATE: 'location.create',
  LOCATION_UPDATE: 'location.update',
  LOCATION_DELETE: 'location.delete',
  ACCESS_ALL_LOCATIONS: 'access_all_locations',

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
 * Check if user is Super Admin (platform owner)
 */
export function isSuperAdmin(user: RBACUser | null): boolean {
  if (!user) return false
  return hasPermission(user, PERMISSIONS.SUPERADMIN_ALL) || hasRole(user, 'Super Admin')
}

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
      PERMISSIONS.REPORT_PROFIT_LOSS,
      PERMISSIONS.REPORT_PURCHASE_SELL,
      PERMISSIONS.STOCK_REPORT_VIEW,
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
      PERMISSIONS.STOCK_REPORT_VIEW,
      PERMISSIONS.LOCATION_VIEW,
      PERMISSIONS.STOCK_TRANSFER_VIEW,
      PERMISSIONS.STOCK_TRANSFER_CREATE,
      PERMISSIONS.STOCK_TRANSFER_CHECK,
      PERMISSIONS.STOCK_TRANSFER_SEND,
      PERMISSIONS.STOCK_TRANSFER_RECEIVE,
      PERMISSIONS.STOCK_TRANSFER_VERIFY,
      PERMISSIONS.STOCK_TRANSFER_COMPLETE,
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
      PERMISSIONS.REPORT_PROFIT_LOSS,
      PERMISSIONS.REPORT_PURCHASE_SELL,
      PERMISSIONS.STOCK_REPORT_VIEW,
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
    ],
  },
} as const
