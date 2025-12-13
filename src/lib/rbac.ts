/**
 * ============================================================================
 * RBAC - ROLE-BASED ACCESS CONTROL SYSTEM (src/lib/rbac.ts)
 * ============================================================================
 *
 * PURPOSE: Defines all permissions and provides functions to check user access
 *
 * THIS FILE IS THE HEART OF THE APPLICATION'S SECURITY:
 * - Defines 200+ permissions for every feature
 * - Provides helper functions to check permissions
 * - Used by EVERY protected page and API route
 * - Enforces who can do what in the system
 *
 * HOW RBAC WORKS IN THIS APPLICATION:
 *
 * 1. PERMISSIONS (What actions exist)
 *    - Granular: "product.create", "sale.view", "report.financial"
 *    - Defined in PERMISSIONS object below
 *    - Format: "module.action" (e.g., "product.create")
 *
 * 2. ROLES (Collections of permissions)
 *    - Super Admin: ALL permissions (platform owner)
 *    - Admin: Most permissions (business owner)
 *    - Manager: Operational permissions (store manager)
 *    - Cashier: Basic POS permissions (frontline staff)
 *
 * 3. USERS (People with roles)
 *    - User → Has Roles → Roles have Permissions
 *    - User can also have direct permissions (overrides)
 *    - Loaded during login (src/lib/auth.ts)
 *    - Stored in JWT token
 *    - Available in session object
 *
 * USAGE FLOW:
 *
 * 1. USER LOGS IN:
 *    src/lib/auth.ts loads user + roles + permissions → stores in JWT
 *
 * 2. API ROUTE PROTECTION:
 *    ```typescript
 *    const session = await getServerSession(authOptions);
 *    if (!hasPermission(session.user, PERMISSIONS.PRODUCT_CREATE)) {
 *      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
 *    }
 *    ```
 *
 * 3. UI ELEMENT VISIBILITY:
 *    ```typescript
 *    const { can } = usePermissions();
 *    {can(PERMISSIONS.PRODUCT_CREATE) && <Button>Create Product</Button>}
 *    ```
 *
 * 4. MENU ITEM VISIBILITY:
 *    ```typescript
 *    // src/components/Sidebar.tsx
 *    {can(PERMISSIONS.PRODUCT_VIEW) && <Link>Products</Link>}
 *    ```
 *
 * KEY FUNCTIONS:
 * - hasPermission(user, permission) - Check single permission
 * - hasRole(user, roleName) - Check if user has role
 * - isSuperAdmin(user) - Check if Super Admin (has ALL permissions)
 * - hasAnyPermission(user, [...]) - Check multiple (OR logic)
 * - hasAllPermissions(user, [...]) - Check multiple (AND logic)
 *
 * PERMISSION CATEGORIES:
 * - Dashboard (home page access)
 * - Users & Roles (user management)
 * - Products (catalog management)
 * - Sales (POS transactions)
 * - Purchases (procurement)
 * - Customers & Suppliers (contacts)
 * - Inventory (stock management, transfers, corrections)
 * - Reports (sales, purchases, financial, inventory)
 * - Accounting (chart of accounts, financial statements)
 * - Expenses (expense tracking)
 * - HR (attendance, schedules)
 * - Settings (business settings, tax rates, locations)
 *
 * RELATED FILES:
 * - src/lib/auth.ts - Loads permissions during login
 * - src/hooks/usePermissions.ts - React hook for checking permissions
 * - src/components/Sidebar.tsx - Uses permissions for menu visibility
 * - src/app/api/*\/route.ts - All API routes check permissions
 * - prisma/schema.prisma - Permission database models
 */

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

/**
 * Permission Type
 * A permission is just a string like "product.create" or "sale.view"
 */
export type Permission = string

/**
 * RBAC User Interface
 *
 * This interface defines what user data is needed for permission checks.
 * Comes from NextAuth session object.
 */
export interface RBACUser {
  id: string // User ID
  permissions: Permission[] // Array of permission strings ["product.view", "sale.create"]
  roles: string[] // Array of role names ["Manager", "Cashier"]
  businessId?: string // Multi-tenant: which business user belongs to
  locationIds?: number[] // Which locations user has access to
}

/**
 * Check if user is Super Admin (platform owner)
 * This check is placed early to be used by other functions
 */
export function isSuperAdmin(user: RBACUser | null): boolean {
  if (!user) return false
  // Check by role name first (most reliable)
  // Support both old and new role names for backward compatibility
  if (user.roles?.includes('Super Admin')) return true
  if (user.roles?.includes('Admin Super')) return true  // Alternative name order
  if (user.roles?.includes('System Administrator')) return true
  if (user.roles?.includes('Super Admin (Legacy)')) return true
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
  USER_VIEW_ACTIVE_SESSIONS: 'user.view_active_sessions', // Monitor currently logged in users

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

  // Products - Multi-Location Pricing
  PRODUCT_PRICE_EDIT: 'product.price.edit', // Edit location prices for own location
  PRODUCT_PRICE_EDIT_ALL: 'product.price.edit_all', // Edit location prices for all locations
  PRODUCT_PRICE_GLOBAL: 'product.price.global', // Edit global/base prices
  PRODUCT_PRICE_BULK_EDIT: 'product.price.bulk_edit', // Bulk price editing across multiple products
  PRODUCT_PRICE_BULK_APPLY_ADVANCED: 'product.price.bulk_apply_advanced', // Bulk apply markup/margin panel
  PRODUCT_PRICE_MULTI_LOCATION_UPDATE: 'product.price.multi_location_update', // Replicate price changes across selected locations
  PRODUCT_PRICE_IMPORT: 'product.price.import', // Import prices from Excel
  PRODUCT_PRICE_EXPORT: 'product.price.export', // Export price lists
  PRODUCT_COST_AUDIT_VIEW: 'product.cost_audit.view', // View cost audit report
  PRODUCT_PRICE_COMPARISON_VIEW: 'product.price_comparison.view', // View price comparison report

  // Pricing Settings & Alerts
  PRICING_SETTINGS_VIEW: 'pricing.settings.view', // View pricing settings
  PRICING_SETTINGS_EDIT: 'pricing.settings.edit', // Edit pricing settings (strategy, rounding, alerts)
  PRICING_ALERTS_VIEW: 'pricing.alerts.view', // View pricing alerts (below cost/retail sales)
  PRICING_ALERTS_ACKNOWLEDGE: 'pricing.alerts.acknowledge', // Acknowledge/review pricing alerts

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
  INVENTORY_CORRECTION_REJECT: 'inventory_correction.reject',

  // Physical Inventory Count
  PHYSICAL_INVENTORY_EXPORT: 'physical_inventory.export',
  PHYSICAL_INVENTORY_IMPORT: 'physical_inventory.import',

  // Sales - Basic CRUD
  SELL_VIEW: 'sell.view',
  SELL_CREATE: 'sell.create',
  SELL_UPDATE: 'sell.update',
  SELL_DELETE: 'sell.delete',
  SELL_VIEW_OWN: 'sell.view_own',
  SELL_VOID: 'sell.void', // Void sales (requires manager authorization)
  SELL_REFUND: 'sell.refund', // Process customer refunds

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
  REPORT_UNPAID_INVOICES: 'report.unpaid_invoices', // Accounts Receivable / Credit customers
  REPORT_CUSTOMER_PAYMENTS: 'report.customer_payments', // Customer payment history
  REPORT_CASH_IN_OUT: 'report.cash_in_out', // Cash in/out movements report
  REPORT_DAILY_CASH_COLLECTION: 'report.daily_cash_collection', // Daily cash collection report with denominations
  REPORT_SALES_BY_HOUR: 'report.sales_by_hour', // Hourly sales breakdown for peak hours analysis
  REPORT_VOID_REFUND_ANALYSIS: 'report.void_refund_analysis', // Voided and refunded transactions tracking
  REPORT_EXCHANGE_ITEMS: 'report.exchange_items', // Exchange transactions report
  REPORT_SALES_BY_PERSONNEL: 'report.sales_by_personnel', // Sales performance by sales personnel

  // Sales Personnel Management
  SALES_PERSONNEL_VIEW: 'sales_personnel.view',
  SALES_PERSONNEL_CREATE: 'sales_personnel.create',
  SALES_PERSONNEL_UPDATE: 'sales_personnel.update',
  SALES_PERSONNEL_DELETE: 'sales_personnel.delete',

  // Cashier-only Reports
  CASHIER_REPORTS_VIEW: 'report.cashier.view',

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

  // ========== ACCOUNTING MODULE ==========
  // Master Access Control (required for all accounting features)
  ACCOUNTING_ACCESS: 'accounting.access', // Master switch - must have this to access any accounting features

  // Chart of Accounts Management
  ACCOUNTING_CHART_OF_ACCOUNTS_VIEW: 'accounting.chart_of_accounts.view',
  ACCOUNTING_CHART_OF_ACCOUNTS_EDIT: 'accounting.chart_of_accounts.edit',

  // Period Closing
  ACCOUNTING_PERIOD_CLOSE: 'accounting.period.close', // Month/quarter/year-end closing
  ACCOUNTING_PERIOD_REOPEN: 'accounting.period.reopen', // Reopen closed periods (very dangerous!)
  ACCOUNTING_PERIOD_VIEW: 'accounting.period.view', // View fiscal period information

  // Financial Statements
  ACCOUNTING_BALANCE_SHEET_VIEW: 'accounting.balance_sheet.view',
  ACCOUNTING_INCOME_STATEMENT_VIEW: 'accounting.income_statement.view',
  ACCOUNTING_CASH_FLOW_VIEW: 'accounting.cash_flow.view',
  ACCOUNTING_TRIAL_BALANCE_VIEW: 'accounting.trial_balance.view',
  ACCOUNTING_GENERAL_LEDGER_VIEW: 'accounting.general_ledger.view',

  // GL Entry Management
  ACCOUNTING_GL_ENTRIES_VIEW: 'accounting.gl_entries.view',
  ACCOUNTING_GL_ENTRIES_EXPORT: 'accounting.gl_entries.export', // Export to CSV, QuickBooks, Xero
  ACCOUNTING_GL_ENTRIES_CREATE: 'accounting.gl_entries.create', // Manual journal entries (advanced)
  ACCOUNTING_GL_ENTRIES_EDIT: 'accounting.gl_entries.edit', // Edit draft entries
  ACCOUNTING_GL_ENTRIES_POST: 'accounting.gl_entries.post', // Post entries to ledger
  ACCOUNTING_GL_ENTRIES_REVERSE: 'accounting.gl_entries.reverse', // Reverse posted entries

  // Business Intelligence & Analytics
  ACCOUNTING_BI_DASHBOARD_VIEW: 'accounting.bi_dashboard.view', // KPIs, ratios, trends
  ACCOUNTING_FORECAST_VIEW: 'accounting.forecast.view', // Sales forecasting & projections
  ACCOUNTING_TREND_ANALYSIS_VIEW: 'accounting.trend_analysis.view', // Historical trends

  // Budget Management
  ACCOUNTING_BUDGET_VIEW: 'accounting.budget.view',
  ACCOUNTING_BUDGET_CREATE: 'accounting.budget.create',
  ACCOUNTING_BUDGET_EDIT: 'accounting.budget.edit',
  ACCOUNTING_BUDGET_APPROVE: 'accounting.budget.approve',

  // Financial Snapshots & Caching
  ACCOUNTING_SNAPSHOT_VIEW: 'accounting.snapshot.view', // View cached financial data
  ACCOUNTING_SNAPSHOT_GENERATE: 'accounting.snapshot.generate', // Regenerate snapshots

  // Audit & Compliance
  ACCOUNTING_AUDIT_TRAIL_VIEW: 'accounting.audit_trail.view', // View all accounting changes
  ACCOUNTING_RECONCILIATION_VIEW: 'accounting.reconciliation.view', // View reconciliation reports
  ACCOUNTING_VALIDATION_RUN: 'accounting.validation.run', // Run accounting validation checks

  // Stock Transfers
  STOCK_TRANSFER_VIEW: 'stock_transfer.view',
  STOCK_TRANSFER_CREATE: 'stock_transfer.create',
  STOCK_TRANSFER_CHECK: 'stock_transfer.check',
  STOCK_TRANSFER_SEND: 'stock_transfer.send',
  STOCK_TRANSFER_RECEIVE: 'stock_transfer.receive',
  STOCK_TRANSFER_VERIFY: 'stock_transfer.verify',
  STOCK_TRANSFER_COMPLETE: 'stock_transfer.complete',
  STOCK_TRANSFER_CANCEL: 'stock_transfer.cancel',
  TRANSFER_APPROVE: 'stock_transfer.approve', // Alias for consistency
  TRANSFER_MANAGE: 'stock_transfer.manage', // Combined manage permission

  // Background Job Queue (Async Processing)
  JOB_VIEW: 'job.view', // View own jobs
  VIEW_ALL_JOBS: 'job.view_all', // View all jobs in business (admin)
  JOB_CANCEL: 'job.cancel', // Cancel own pending jobs
  JOB_RETRY: 'job.retry', // Retry failed jobs

  // Customer Returns
  CUSTOMER_RETURN_VIEW: 'customer_return.view',
  CUSTOMER_RETURN_CREATE: 'customer_return.create',
  CUSTOMER_RETURN_APPROVE: 'customer_return.approve',
  CUSTOMER_RETURN_DELETE: 'customer_return.delete',

  // Supplier Returns
  SUPPLIER_RETURN_VIEW: 'supplier_return.view',
  SUPPLIER_RETURN_CREATE: 'supplier_return.create',
  SUPPLIER_RETURN_APPROVE: 'supplier_return.approve',
  SUPPLIER_RETURN_MANAGE: 'supplier_return.manage', // Combined manage permission
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

  // Customers - Credit Limit Management (Field-Level Security)
  CUSTOMER_CREDIT_LIMIT_VIEW: 'customer.credit_limit.view', // Can see credit limit field
  CUSTOMER_CREDIT_LIMIT_EDIT: 'customer.credit_limit.edit', // Can edit credit limit
  CUSTOMER_CREDIT_OVERRIDE: 'customer.credit_override', // Can override credit limit during sale

  // Customers - AR Payment Collection
  PAYMENT_COLLECT_AR: 'payment.collect_ar', // Can collect accounts receivable payments

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
  STOCK_HISTORY_V3_VIEW: 'report.stock.history_v3.view', // Advanced stock history for admins with all locations
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

  // Printers
  PRINTER_VIEW: 'printer.view',
  PRINTER_CREATE: 'printer.create',
  PRINTER_UPDATE: 'printer.update',
  PRINTER_DELETE: 'printer.delete',
  PRINTER_ASSIGN: 'printer.assign', // Assign printers to locations

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

  // ========== TECHNICAL SERVICE & WARRANTY MANAGEMENT ==========

  // Serial Number Management (Product-Level Serial Tracking)
  SERIAL_NUMBER_CREATE: 'serial_number.create', // Register new serial numbers
  SERIAL_NUMBER_EDIT: 'serial_number.edit', // Edit serial number details
  SERIAL_NUMBER_DELETE: 'serial_number.delete', // Delete serial numbers (pre-sale only)
  SERIAL_NUMBER_LOOKUP: 'serial_number.lookup', // Search and lookup serial numbers
  SERIAL_NUMBER_ASSIGN: 'serial_number.assign', // Assign serial to customer via sale
  SERIAL_NUMBER_TRANSFER: 'serial_number.transfer', // Transfer serial between locations

  // Technical Service Employees (Technicians)
  TECHNICIAN_VIEW: 'technician.view', // View technician list
  TECHNICIAN_CREATE: 'technician.create', // Add new technicians
  TECHNICIAN_EDIT: 'technician.edit', // Edit technician info
  TECHNICIAN_DELETE: 'technician.delete', // Remove technicians
  TECHNICIAN_ASSIGN: 'technician.assign', // Assign technicians to jobs
  TECHNICIAN_PERFORMANCE_VIEW: 'technician.performance.view', // View performance metrics

  // Service Types (Repair Categories & Pricing)
  SERVICE_TYPE_VIEW: 'service_type.view', // View service type list
  SERVICE_TYPE_CREATE: 'service_type.create', // Create service types
  SERVICE_TYPE_EDIT: 'service_type.edit', // Edit service types
  SERVICE_TYPE_DELETE: 'service_type.delete', // Delete service types
  SERVICE_TYPE_PRICING_MANAGE: 'service_type.pricing.manage', // Manage service pricing

  // Service Warranty Claims (Customer Warranty Requests)
  WARRANTY_CLAIM_VIEW: 'warranty_claim.view', // View all warranty claims
  WARRANTY_CLAIM_VIEW_OWN: 'warranty_claim.view_own', // View own submitted claims
  WARRANTY_CLAIM_CREATE: 'warranty_claim.create', // Create new warranty claim
  WARRANTY_CLAIM_ACCEPT: 'warranty_claim.accept', // Accept claim for processing (reception)
  WARRANTY_CLAIM_INSPECT: 'warranty_claim.inspect', // Conduct inspection/diagnosis
  WARRANTY_CLAIM_ASSIGN: 'warranty_claim.assign', // Assign technician to claim
  WARRANTY_CLAIM_APPROVE: 'warranty_claim.approve', // Approve warranty claim (honor warranty)
  WARRANTY_CLAIM_REJECT: 'warranty_claim.reject', // Reject warranty claim (decline warranty)
  WARRANTY_CLAIM_UPDATE: 'warranty_claim.update', // Update claim details
  WARRANTY_CLAIM_DELETE: 'warranty_claim.delete', // Delete warranty claim
  WARRANTY_CLAIM_VOID: 'warranty_claim.void', // Void processed claim

  // Repair Job Orders (Work Orders for Repairs)
  JOB_ORDER_VIEW: 'job_order.view', // View all job orders
  JOB_ORDER_VIEW_OWN: 'job_order.view_own', // View own assigned jobs (technicians)
  JOB_ORDER_CREATE: 'job_order.create', // Create new job order
  JOB_ORDER_EDIT: 'job_order.edit', // Edit job order details
  JOB_ORDER_DELETE: 'job_order.delete', // Delete job order
  JOB_ORDER_DIAGNOSE: 'job_order.diagnose', // Update diagnosis/findings
  JOB_ORDER_ADD_PARTS: 'job_order.add_parts', // Add parts to job order
  JOB_ORDER_ESTIMATE: 'job_order.estimate', // Provide cost estimate
  JOB_ORDER_APPROVE_ESTIMATE: 'job_order.approve_estimate', // Customer approves estimate
  JOB_ORDER_START_REPAIR: 'job_order.start_repair', // Begin repair work
  JOB_ORDER_COMPLETE: 'job_order.complete', // Mark repair complete
  JOB_ORDER_QUALITY_CHECK: 'job_order.quality_check', // Conduct quality inspection
  JOB_ORDER_CLOSE: 'job_order.close', // Close job order (final)
  JOB_ORDER_REOPEN: 'job_order.reopen', // Reopen closed job order

  // Service Payments (Payment for Repairs)
  SERVICE_PAYMENT_VIEW: 'service_payment.view', // View service payments
  SERVICE_PAYMENT_CREATE: 'service_payment.create', // Process service payment
  SERVICE_PAYMENT_VOID: 'service_payment.void', // Void service payment
  SERVICE_PAYMENT_REFUND: 'service_payment.refund', // Refund service payment
  SERVICE_RECEIPT_PRINT: 'service_receipt.print', // Print service receipt

  // Service Reports & Analytics
  SERVICE_REPORT_VIEW: 'service_report.view', // View service reports
  SERVICE_REPORT_EXPORT: 'service_report.export', // Export service reports
  SERVICE_WARRANTY_SLIP_VIEW: 'service_warranty_slip.view', // View warranty slip
  SERVICE_WARRANTY_SLIP_PRINT: 'service_warranty_slip.print', // Print warranty slip
  TECHNICIAN_PERFORMANCE_REPORT: 'technician.performance.report', // Technician performance report
  REPAIR_ANALYTICS_VIEW: 'repair_analytics.view', // Repair analytics dashboard
  SERVICE_REVENUE_REPORT: 'service_revenue.report', // Service revenue reporting
  WARRANTY_ANALYTICS_VIEW: 'warranty_analytics.view', // Warranty claim analytics

  // ============================================================================
  // PACKAGE TEMPLATES - Pre-defined product bundles with custom pricing
  // ============================================================================
  PACKAGE_TEMPLATE_VIEW: 'package_template.view', // View package templates
  PACKAGE_TEMPLATE_CREATE: 'package_template.create', // Create package templates
  PACKAGE_TEMPLATE_EDIT: 'package_template.edit', // Edit package templates
  PACKAGE_TEMPLATE_DELETE: 'package_template.delete', // Delete package templates
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
    description: 'Full system access - platform owner/super admin with all technical service permissions',
    category: 'Administrative',
    permissions: Object.values(PERMISSIONS), // Has ALL permissions including technical service
  },

  // Organization request: Give Admin and All Branch Admin same capabilities as Super Admin.
  ADMIN: {
    name: 'Admin',
    description: 'Full system access equivalent to System Administrator (menus can still be hidden)',
    category: 'Administrative',
    permissions: Object.values(PERMISSIONS),
  },

  ALL_BRANCH_ADMIN: {
    name: 'All Branch Admin',
    description: 'Full system access across all branches, same as System Administrator',
    category: 'Administrative',
    permissions: Object.values(PERMISSIONS),
  },

  MULTI_LOCATION_PRICE_OPERATOR: {
    name: 'Multi-Location Price Operator',
    description: 'Applies coordinated price updates across selected locations with strict confirmations',
    category: 'Product & Inventory',
    permissions: [
      PERMISSIONS.DASHBOARD_VIEW,
      PERMISSIONS.PRODUCT_VIEW,
      PERMISSIONS.PRODUCT_VIEW_PURCHASE_PRICE,
      PERMISSIONS.PRODUCT_VIEW_PROFIT_MARGIN,
      PERMISSIONS.PRODUCT_VIEW_SUPPLIER,
      PERMISSIONS.ACCESS_ALL_LOCATIONS,
      PERMISSIONS.PRODUCT_PRICE_EDIT_ALL,
      PERMISSIONS.PRODUCT_PRICE_BULK_EDIT,
      PERMISSIONS.PRODUCT_PRICE_BULK_APPLY_ADVANCED,
      PERMISSIONS.PRODUCT_PRICE_MULTI_LOCATION_UPDATE,
      PERMISSIONS.PRODUCT_PRICE_EXPORT,
      PERMISSIONS.PRODUCT_COST_AUDIT_VIEW,
      PERMISSIONS.PRODUCT_PRICE_COMPARISON_VIEW,
      PERMISSIONS.PRICING_SETTINGS_VIEW,
      PERMISSIONS.PRICING_ALERTS_VIEW,
      PERMISSIONS.REPORT_VIEW,
      PERMISSIONS.REPORT_STOCK_ALERT,
      PERMISSIONS.STOCK_REPORT_VIEW,
    ],
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
      PERMISSIONS.USER_VIEW_ACTIVE_SESSIONS,
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
      PERMISSIONS.PRINTER_VIEW,
      PERMISSIONS.PRINTER_ASSIGN,
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
      PERMISSIONS.PRINTER_VIEW,
      PERMISSIONS.PRINTER_CREATE,
      PERMISSIONS.PRINTER_UPDATE,
      PERMISSIONS.PRINTER_DELETE,
      PERMISSIONS.PRINTER_ASSIGN,
    ],
  },

  // ============================================
  // CATEGORY 2: PRODUCT & INVENTORY ROLES
  // ============================================

  PRODUCT_CATALOG_MANAGER: {
    name: 'Product Catalog Manager',
    description: 'Creates and manages products, categories, brands, units, and pricing',
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
      // Multi-Location Pricing
      PERMISSIONS.PRODUCT_PRICE_EDIT_ALL,
      PERMISSIONS.PRODUCT_PRICE_GLOBAL,
      PERMISSIONS.PRODUCT_PRICE_BULK_EDIT,
      PERMISSIONS.PRODUCT_PRICE_MULTI_LOCATION_UPDATE,
      PERMISSIONS.PRODUCT_PRICE_IMPORT,
      PERMISSIONS.PRODUCT_PRICE_EXPORT,
      PERMISSIONS.PRODUCT_COST_AUDIT_VIEW,
      PERMISSIONS.PRODUCT_PRICE_COMPARISON_VIEW,
      PERMISSIONS.PRICING_SETTINGS_VIEW,
      PERMISSIONS.PRICING_SETTINGS_EDIT,
      PERMISSIONS.PRICING_ALERTS_VIEW,
      PERMISSIONS.PRICING_ALERTS_ACKNOWLEDGE,
      // Categories, Brands, Units, Warranties
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

  INVENTORY_COUNTER: {
    name: 'Inventory Counter',
    description: 'Physical stock counter - creates inventory corrections for assigned location only (cannot approve)',
    category: 'Product & Inventory',
    permissions: [
      PERMISSIONS.DASHBOARD_VIEW,
      PERMISSIONS.PRODUCT_VIEW,
      PERMISSIONS.INVENTORY_CORRECTION_VIEW,
      PERMISSIONS.INVENTORY_CORRECTION_CREATE,
      PERMISSIONS.INVENTORY_CORRECTION_UPDATE,
    ],
  },

  INVENTORY_CORRECTION_APPROVER: {
    name: 'Inventory Correction Approver',
    description: 'Approves or rejects inventory corrections from all locations (cannot create)',
    category: 'Product & Inventory',
    permissions: [
      PERMISSIONS.DASHBOARD_VIEW,
      PERMISSIONS.PRODUCT_VIEW,
      PERMISSIONS.INVENTORY_CORRECTION_VIEW,
      PERMISSIONS.INVENTORY_CORRECTION_APPROVE,
      PERMISSIONS.INVENTORY_CORRECTION_REJECT,
      PERMISSIONS.INVENTORY_CORRECTION_DELETE,
      PERMISSIONS.STOCK_REPORT_VIEW,
      PERMISSIONS.VIEW_INVENTORY_REPORTS,
      PERMISSIONS.ACCESS_ALL_LOCATIONS, // Can see corrections from all locations
    ],
  },

  PRICE_MANAGER: {
    name: 'Price Manager',
    description: 'Manages product pricing and cost analysis for assigned locations',
    category: 'Product & Inventory',
    permissions: [
      PERMISSIONS.DASHBOARD_VIEW,
      PERMISSIONS.PRODUCT_VIEW,
      PERMISSIONS.PRODUCT_VIEW_PURCHASE_PRICE,
      PERMISSIONS.PRODUCT_VIEW_PROFIT_MARGIN,
      PERMISSIONS.PRODUCT_VIEW_SUPPLIER,
      PERMISSIONS.ACCESS_DEFAULT_SELLING_PRICE,
      // Multi-Location Pricing - Full access for assigned locations
      PERMISSIONS.PRODUCT_PRICE_EDIT_ALL,
      PERMISSIONS.PRODUCT_PRICE_GLOBAL,
      PERMISSIONS.PRODUCT_PRICE_BULK_EDIT,
      PERMISSIONS.PRODUCT_PRICE_MULTI_LOCATION_UPDATE,
      PERMISSIONS.PRODUCT_PRICE_IMPORT,
      PERMISSIONS.PRODUCT_PRICE_EXPORT,
      PERMISSIONS.PRODUCT_COST_AUDIT_VIEW,
      PERMISSIONS.PRODUCT_PRICE_COMPARISON_VIEW,
      PERMISSIONS.PRICING_SETTINGS_VIEW,
      PERMISSIONS.PRICING_SETTINGS_EDIT,
      PERMISSIONS.PRICING_ALERTS_VIEW,
      PERMISSIONS.PRICING_ALERTS_ACKNOWLEDGE,
      // Inventory viewing only (no editing)
      PERMISSIONS.PRODUCT_VIEW_ALL_BRANCH_STOCK,
      // Reports
      PERMISSIONS.REPORT_VIEW,
      PERMISSIONS.REPORT_STOCK_ALERT,
      PERMISSIONS.STOCK_REPORT_VIEW,
      PERMISSIONS.REPORT_PURCHASE_VIEW,
      PERMISSIONS.REPORT_PURCHASE_ANALYTICS,
      PERMISSIONS.REPORT_PURCHASE_ITEMS,
      PERMISSIONS.REPORT_PRODUCT_PURCHASE_HISTORY,
      PERMISSIONS.REPORT_PURCHASE_SELL,
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
      PERMISSIONS.PAYMENT_COLLECT_AR, // Can collect AR payments (but cannot view/edit credit limits)
      PERMISSIONS.SHIFT_OPEN,
      PERMISSIONS.SHIFT_CLOSE,
      PERMISSIONS.SHIFT_VIEW,
      PERMISSIONS.CASH_IN_OUT,
      PERMISSIONS.CASH_COUNT,
      PERMISSIONS.X_READING,
      PERMISSIONS.Z_READING, // CRITICAL: Cashiers MUST generate Z Reading when closing shifts (BIR compliance)
      PERMISSIONS.VOID_CREATE,
      PERMISSIONS.SELL_VOID, // Can void sales with manager authorization
      PERMISSIONS.FREEBIE_ADD,
      PERMISSIONS.SERIAL_NUMBER_SCAN,
      // Basic sales reports
      PERMISSIONS.REPORT_VIEW,
      PERMISSIONS.REPORT_SALES_VIEW,
      PERMISSIONS.REPORT_SALES_TODAY,
      PERMISSIONS.SALES_REPORT_VIEW,
      PERMISSIONS.SALES_REPORT_DAILY,
      // Customer credit reports (critical for cash handling)
      PERMISSIONS.REPORT_UNPAID_INVOICES,
      PERMISSIONS.REPORT_CUSTOMER_PAYMENTS,
      // Cash movements tracking
      PERMISSIONS.REPORT_CASH_IN_OUT,
      PERMISSIONS.REPORT_DAILY_CASH_COLLECTION,
      PERMISSIONS.SALES_REPORT_DISCOUNT_ANALYSIS,
      // Operational analysis reports
      PERMISSIONS.REPORT_SALES_BY_HOUR,
      PERMISSIONS.REPORT_VOID_REFUND_ANALYSIS,
      PERMISSIONS.REPORT_EXCHANGE_ITEMS,
      // Cashier-only reports section
      PERMISSIONS.CASHIER_REPORTS_VIEW,
      // Sales Personnel - view only for dropdown selection
      PERMISSIONS.SALES_PERSONNEL_VIEW,
      // Package Templates - view only for loading in POS
      PERMISSIONS.PACKAGE_TEMPLATE_VIEW,
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
      PERMISSIONS.CUSTOMER_CREDIT_LIMIT_VIEW, // Can view customer credit limits
      PERMISSIONS.PAYMENT_COLLECT_AR, // Can collect AR payments
      PERMISSIONS.VOID_CREATE,
      PERMISSIONS.VOID_APPROVE,
      PERMISSIONS.SELL_VOID, // Can void sales with manager authorization
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
      // Sales Personnel management and reports
      PERMISSIONS.SALES_PERSONNEL_VIEW,
      PERMISSIONS.SALES_PERSONNEL_CREATE,
      PERMISSIONS.SALES_PERSONNEL_UPDATE,
      PERMISSIONS.REPORT_SALES_BY_PERSONNEL,
      // Package Templates
      PERMISSIONS.PACKAGE_TEMPLATE_VIEW,
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

  ACCOUNTANT: {
    name: 'Accountant',
    description: 'Full accounting module access - financial statements, period closing, and GL entries',
    category: 'Financial & Accounting',
    permissions: [
      PERMISSIONS.DASHBOARD_VIEW,
      // Master Access
      PERMISSIONS.ACCOUNTING_ACCESS, // Required for all accounting features

      // Chart of Accounts
      PERMISSIONS.ACCOUNTING_CHART_OF_ACCOUNTS_VIEW,
      PERMISSIONS.ACCOUNTING_CHART_OF_ACCOUNTS_EDIT,

      // Period Management
      PERMISSIONS.ACCOUNTING_PERIOD_VIEW,
      PERMISSIONS.ACCOUNTING_PERIOD_CLOSE,
      // NOTE: PERIOD_REOPEN not included - only Super Admin can reopen periods

      // Financial Statements (Full Access)
      PERMISSIONS.ACCOUNTING_BALANCE_SHEET_VIEW,
      PERMISSIONS.ACCOUNTING_INCOME_STATEMENT_VIEW,
      PERMISSIONS.ACCOUNTING_CASH_FLOW_VIEW,
      PERMISSIONS.ACCOUNTING_TRIAL_BALANCE_VIEW,
      PERMISSIONS.ACCOUNTING_GENERAL_LEDGER_VIEW,

      // GL Entries (Full Management)
      PERMISSIONS.ACCOUNTING_GL_ENTRIES_VIEW,
      PERMISSIONS.ACCOUNTING_GL_ENTRIES_EXPORT,
      PERMISSIONS.ACCOUNTING_GL_ENTRIES_CREATE,
      PERMISSIONS.ACCOUNTING_GL_ENTRIES_EDIT,
      PERMISSIONS.ACCOUNTING_GL_ENTRIES_POST,
      PERMISSIONS.ACCOUNTING_GL_ENTRIES_REVERSE,

      // Business Intelligence
      PERMISSIONS.ACCOUNTING_BI_DASHBOARD_VIEW,
      PERMISSIONS.ACCOUNTING_FORECAST_VIEW,
      PERMISSIONS.ACCOUNTING_TREND_ANALYSIS_VIEW,

      // Budget Management
      PERMISSIONS.ACCOUNTING_BUDGET_VIEW,
      PERMISSIONS.ACCOUNTING_BUDGET_CREATE,
      PERMISSIONS.ACCOUNTING_BUDGET_EDIT,
      // NOTE: BUDGET_APPROVE not included - requires manager approval

      // Snapshots & Validation
      PERMISSIONS.ACCOUNTING_SNAPSHOT_VIEW,
      PERMISSIONS.ACCOUNTING_SNAPSHOT_GENERATE,
      PERMISSIONS.ACCOUNTING_AUDIT_TRAIL_VIEW,
      PERMISSIONS.ACCOUNTING_RECONCILIATION_VIEW,
      PERMISSIONS.ACCOUNTING_VALIDATION_RUN,

      // Related Financial Data Access
      PERMISSIONS.PRODUCT_VIEW,
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
      PERMISSIONS.INVENTORY_CORRECTION_VIEW,

      // Financial Reports
      PERMISSIONS.REPORT_VIEW,
      PERMISSIONS.REPORT_PROFIT_LOSS,
      PERMISSIONS.REPORT_PROFITABILITY,
    ],
  },

  ACCOUNTING_VIEWER: {
    name: 'Accounting Viewer',
    description: 'View-only access to accounting reports and financial statements',
    category: 'Financial & Accounting',
    permissions: [
      PERMISSIONS.DASHBOARD_VIEW,
      PERMISSIONS.ACCOUNTING_ACCESS, // Required to see accounting menu

      // View-Only Access to Financial Statements
      PERMISSIONS.ACCOUNTING_BALANCE_SHEET_VIEW,
      PERMISSIONS.ACCOUNTING_INCOME_STATEMENT_VIEW,
      PERMISSIONS.ACCOUNTING_CASH_FLOW_VIEW,
      PERMISSIONS.ACCOUNTING_TRIAL_BALANCE_VIEW,
      PERMISSIONS.ACCOUNTING_GENERAL_LEDGER_VIEW,

      // View GL Entries & Export
      PERMISSIONS.ACCOUNTING_GL_ENTRIES_VIEW,
      PERMISSIONS.ACCOUNTING_GL_ENTRIES_EXPORT,

      // View Business Intelligence
      PERMISSIONS.ACCOUNTING_BI_DASHBOARD_VIEW,
      PERMISSIONS.ACCOUNTING_FORECAST_VIEW,
      PERMISSIONS.ACCOUNTING_TREND_ANALYSIS_VIEW,

      // View Budgets
      PERMISSIONS.ACCOUNTING_BUDGET_VIEW,

      // View Periods & Snapshots
      PERMISSIONS.ACCOUNTING_PERIOD_VIEW,
      PERMISSIONS.ACCOUNTING_SNAPSHOT_VIEW,
      PERMISSIONS.ACCOUNTING_RECONCILIATION_VIEW,

      // View Related Data
      PERMISSIONS.REPORT_VIEW,
      PERMISSIONS.REPORT_PROFIT_LOSS,
      PERMISSIONS.REPORT_PROFITABILITY,
    ],
  },

  FINANCIAL_ANALYST: {
    name: 'Financial Analyst',
    description: 'Business intelligence and forecasting specialist',
    category: 'Financial & Accounting',
    permissions: [
      PERMISSIONS.DASHBOARD_VIEW,
      PERMISSIONS.ACCOUNTING_ACCESS,

      // Full BI & Analytics Access
      PERMISSIONS.ACCOUNTING_BI_DASHBOARD_VIEW,
      PERMISSIONS.ACCOUNTING_FORECAST_VIEW,
      PERMISSIONS.ACCOUNTING_TREND_ANALYSIS_VIEW,

      // View Financial Statements for Analysis
      PERMISSIONS.ACCOUNTING_BALANCE_SHEET_VIEW,
      PERMISSIONS.ACCOUNTING_INCOME_STATEMENT_VIEW,
      PERMISSIONS.ACCOUNTING_CASH_FLOW_VIEW,
      PERMISSIONS.ACCOUNTING_TRIAL_BALANCE_VIEW,

      // Budget Analysis
      PERMISSIONS.ACCOUNTING_BUDGET_VIEW,
      PERMISSIONS.ACCOUNTING_BUDGET_CREATE,
      PERMISSIONS.ACCOUNTING_BUDGET_EDIT,

      // Export Capabilities
      PERMISSIONS.ACCOUNTING_GL_ENTRIES_VIEW,
      PERMISSIONS.ACCOUNTING_GL_ENTRIES_EXPORT,

      // Related Data for Analysis
      PERMISSIONS.PRODUCT_VIEW,
      PERMISSIONS.PRODUCT_VIEW_PURCHASE_PRICE,
      PERMISSIONS.PRODUCT_VIEW_PROFIT_MARGIN,
      PERMISSIONS.SELL_VIEW,
      PERMISSIONS.SELL_VIEW_COST,
      PERMISSIONS.SELL_VIEW_PROFIT,
      PERMISSIONS.PURCHASE_VIEW,
      PERMISSIONS.PURCHASE_VIEW_COST,

      // Reports
      PERMISSIONS.REPORT_VIEW,
      PERMISSIONS.REPORT_PROFIT_LOSS,
      PERMISSIONS.REPORT_PROFITABILITY,
      PERMISSIONS.REPORT_SALES_PROFITABILITY,
      PERMISSIONS.SALES_REPORT_VIEW,
      PERMISSIONS.SALES_REPORT_ANALYTICS,
      PERMISSIONS.REPORT_PURCHASE_ANALYTICS,
      PERMISSIONS.REPORT_PURCHASE_TRENDS,
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
      PERMISSIONS.REPORT_SALES_BY_PERSONNEL, // Sales by personnel report
      PERMISSIONS.SALES_PERSONNEL_VIEW, // View sales personnel for filtering
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
      // Sales by personnel report
      PERMISSIONS.REPORT_SALES_BY_PERSONNEL,
      PERMISSIONS.SALES_PERSONNEL_VIEW,
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

      // Multi-Location Pricing - Full Access
      PERMISSIONS.PRODUCT_PRICE_EDIT_ALL,
      PERMISSIONS.PRODUCT_PRICE_GLOBAL,
      PERMISSIONS.PRODUCT_PRICE_BULK_EDIT,
      PERMISSIONS.PRODUCT_PRICE_MULTI_LOCATION_UPDATE,
      PERMISSIONS.PRODUCT_PRICE_IMPORT,
      PERMISSIONS.PRODUCT_PRICE_EXPORT,
      PERMISSIONS.PRODUCT_COST_AUDIT_VIEW,
      PERMISSIONS.PRODUCT_PRICE_COMPARISON_VIEW,
      PERMISSIONS.PRICING_SETTINGS_VIEW,
      PERMISSIONS.PRICING_SETTINGS_EDIT,
      PERMISSIONS.PRICING_ALERTS_VIEW,
      PERMISSIONS.PRICING_ALERTS_ACKNOWLEDGE,

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

      // Inventory Management - View & Approve/Reject Only (NO CREATE/UPDATE/DELETE)
      PERMISSIONS.INVENTORY_CORRECTION_VIEW,
      PERMISSIONS.INVENTORY_CORRECTION_APPROVE,
      PERMISSIONS.INVENTORY_CORRECTION_REJECT,
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
      PERMISSIONS.CUSTOMER_CREDIT_LIMIT_VIEW,
      PERMISSIONS.CUSTOMER_CREDIT_LIMIT_EDIT,
      PERMISSIONS.CUSTOMER_CREDIT_OVERRIDE,
      PERMISSIONS.PAYMENT_COLLECT_AR,
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
      PERMISSIONS.SELL_VOID, // Can void sales with manager authorization

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
      PERMISSIONS.REPORT_DAILY_CASH_COLLECTION,

      // Business Settings - Full Access
      PERMISSIONS.BUSINESS_SETTINGS_VIEW,
      PERMISSIONS.BUSINESS_SETTINGS_EDIT,

      // Location Management - Full CRUD
      PERMISSIONS.LOCATION_VIEW,
      PERMISSIONS.LOCATION_CREATE,
      PERMISSIONS.LOCATION_UPDATE,
      PERMISSIONS.ACCESS_ALL_LOCATIONS,

      // Printer Management - Full Access
      PERMISSIONS.PRINTER_VIEW,
      PERMISSIONS.PRINTER_CREATE,
      PERMISSIONS.PRINTER_UPDATE,
      PERMISSIONS.PRINTER_DELETE,
      PERMISSIONS.PRINTER_ASSIGN,

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

      // Technical Service & Warranty Management - Full Access
      PERMISSIONS.SERIAL_NUMBER_VIEW,
      PERMISSIONS.SERIAL_NUMBER_CREATE,
      PERMISSIONS.SERIAL_NUMBER_EDIT,
      PERMISSIONS.SERIAL_NUMBER_LOOKUP,
      PERMISSIONS.SERIAL_NUMBER_ASSIGN,
      PERMISSIONS.SERIAL_NUMBER_TRACK,
      PERMISSIONS.SERIAL_NUMBER_SCAN,
      PERMISSIONS.SERIAL_NUMBER_TRANSFER,

      // Technician Management
      PERMISSIONS.TECHNICIAN_VIEW,
      PERMISSIONS.TECHNICIAN_CREATE,
      PERMISSIONS.TECHNICIAN_EDIT,
      PERMISSIONS.TECHNICIAN_ASSIGN,
      PERMISSIONS.TECHNICIAN_PERFORMANCE_VIEW,

      // Service Types
      PERMISSIONS.SERVICE_TYPE_VIEW,
      PERMISSIONS.SERVICE_TYPE_CREATE,
      PERMISSIONS.SERVICE_TYPE_EDIT,
      PERMISSIONS.SERVICE_TYPE_PRICING_MANAGE,

      // Warranty Claims - View & Approve/Reject
      PERMISSIONS.WARRANTY_CLAIM_VIEW,
      PERMISSIONS.WARRANTY_CLAIM_CREATE,
      PERMISSIONS.WARRANTY_CLAIM_ACCEPT,
      PERMISSIONS.WARRANTY_CLAIM_INSPECT,
      PERMISSIONS.WARRANTY_CLAIM_ASSIGN,
      PERMISSIONS.WARRANTY_CLAIM_APPROVE,
      PERMISSIONS.WARRANTY_CLAIM_REJECT,
      PERMISSIONS.WARRANTY_CLAIM_UPDATE,

      // Job Orders - View & Approve
      PERMISSIONS.JOB_ORDER_VIEW,
      PERMISSIONS.JOB_ORDER_CREATE,
      PERMISSIONS.JOB_ORDER_EDIT,
      PERMISSIONS.JOB_ORDER_DIAGNOSE,
      PERMISSIONS.JOB_ORDER_ADD_PARTS,
      PERMISSIONS.JOB_ORDER_ESTIMATE,
      PERMISSIONS.JOB_ORDER_APPROVE_ESTIMATE,
      PERMISSIONS.JOB_ORDER_START_REPAIR,
      PERMISSIONS.JOB_ORDER_COMPLETE,
      PERMISSIONS.JOB_ORDER_QUALITY_CHECK,
      PERMISSIONS.JOB_ORDER_CLOSE,
      PERMISSIONS.JOB_ORDER_REOPEN,

      // Service Payments
      PERMISSIONS.SERVICE_PAYMENT_VIEW,
      PERMISSIONS.SERVICE_PAYMENT_CREATE,
      PERMISSIONS.SERVICE_RECEIPT_PRINT,

      // Service Reports
      PERMISSIONS.SERVICE_REPORT_VIEW,
      PERMISSIONS.SERVICE_REPORT_EXPORT,
      PERMISSIONS.SERVICE_WARRANTY_SLIP_VIEW,
      PERMISSIONS.SERVICE_WARRANTY_SLIP_PRINT,
      PERMISSIONS.TECHNICIAN_PERFORMANCE_REPORT,
      PERMISSIONS.REPAIR_ANALYTICS_VIEW,
      PERMISSIONS.SERVICE_REVENUE_REPORT,
      PERMISSIONS.WARRANTY_ANALYTICS_VIEW,
    ],
  },

  WAREHOUSE_MANAGER: {
    name: 'Warehouse Manager',
    description: 'Full warehouse operations - receiving, transfers, inventory management',
    category: 'Convenience Admin',
    permissions: [
      PERMISSIONS.DASHBOARD_VIEW,
      PERMISSIONS.PRODUCT_VIEW,
      PERMISSIONS.PRODUCT_CATEGORY_VIEW,
      PERMISSIONS.PRODUCT_BRAND_VIEW,
      PERMISSIONS.PRODUCT_VIEW_PURCHASE_PRICE,
      PERMISSIONS.PRODUCT_VIEW_ALL_BRANCH_STOCK,
      // Pricing - View & Edit for own location
      PERMISSIONS.PRODUCT_PRICE_EDIT,
      PERMISSIONS.PRODUCT_PRICE_EXPORT,
      PERMISSIONS.PRODUCT_COST_AUDIT_VIEW,
      PERMISSIONS.PRODUCT_PRICE_COMPARISON_VIEW,
      PERMISSIONS.PRICING_SETTINGS_VIEW,
      // Inventory management - CREATE corrections but CANNOT APPROVE (requires invcorApprover)
      PERMISSIONS.INVENTORY_CORRECTION_VIEW,
      PERMISSIONS.INVENTORY_CORRECTION_CREATE,
      PERMISSIONS.INVENTORY_CORRECTION_UPDATE,
      // PERMISSIONS.INVENTORY_CORRECTION_APPROVE, // REMOVED - Must use invcorApprover or assign that role
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
      // Customer - for opening balance entry
      PERMISSIONS.CUSTOMER_VIEW,
      PERMISSIONS.CUSTOMER_UPDATE,
      // QC operations
      PERMISSIONS.QC_INSPECTION_VIEW,
      PERMISSIONS.QC_INSPECTION_CONDUCT,
      // Returns
      PERMISSIONS.SUPPLIER_RETURN_VIEW,
      PERMISSIONS.SUPPLIER_RETURN_CREATE,
      PERMISSIONS.PURCHASE_RETURN_VIEW,
      PERMISSIONS.PURCHASE_RETURN_APPROVE,
      // Reports
      PERMISSIONS.REPORT_VIEW,
      PERMISSIONS.REPORT_STOCK_ALERT,
      PERMISSIONS.STOCK_REPORT_VIEW,
      PERMISSIONS.INVENTORY_LEDGER_VIEW,
      PERMISSIONS.VIEW_INVENTORY_REPORTS,
      PERMISSIONS.REPORT_TRANSFER_VIEW,
      // Package Templates - can create and manage
      PERMISSIONS.PACKAGE_TEMPLATE_VIEW,
      PERMISSIONS.PACKAGE_TEMPLATE_CREATE,
      PERMISSIONS.PACKAGE_TEMPLATE_EDIT,
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
      PERMISSIONS.Z_READING, // CRITICAL: Cashiers MUST generate Z Reading when closing shifts (BIR compliance)
      PERMISSIONS.VOID_CREATE,
    ],
  },

  // ============================================
  // CATEGORY 11: TECHNICAL SERVICE & WARRANTY ROLES
  // ============================================

  TECHNICAL_SERVICE_MANAGER: {
    name: 'Technical Service Manager',
    description: 'Full access to all technical service and warranty operations',
    category: 'Technical Service',
    permissions: [
      PERMISSIONS.DASHBOARD_VIEW,

      // Product & Serial Number Access
      PERMISSIONS.PRODUCT_VIEW,
      PERMISSIONS.SERIAL_NUMBER_VIEW,
      PERMISSIONS.SERIAL_NUMBER_CREATE,
      PERMISSIONS.SERIAL_NUMBER_EDIT,
      PERMISSIONS.SERIAL_NUMBER_DELETE,
      PERMISSIONS.SERIAL_NUMBER_LOOKUP,
      PERMISSIONS.SERIAL_NUMBER_ASSIGN,
      PERMISSIONS.SERIAL_NUMBER_TRACK,
      PERMISSIONS.SERIAL_NUMBER_SCAN,
      PERMISSIONS.SERIAL_NUMBER_TRANSFER,

      // Technician Management - Full CRUD
      PERMISSIONS.TECHNICIAN_VIEW,
      PERMISSIONS.TECHNICIAN_CREATE,
      PERMISSIONS.TECHNICIAN_EDIT,
      PERMISSIONS.TECHNICIAN_DELETE,
      PERMISSIONS.TECHNICIAN_ASSIGN,
      PERMISSIONS.TECHNICIAN_PERFORMANCE_VIEW,

      // Service Type Management - Full CRUD
      PERMISSIONS.SERVICE_TYPE_VIEW,
      PERMISSIONS.SERVICE_TYPE_CREATE,
      PERMISSIONS.SERVICE_TYPE_EDIT,
      PERMISSIONS.SERVICE_TYPE_DELETE,
      PERMISSIONS.SERVICE_TYPE_PRICING_MANAGE,

      // Warranty Claims - Full Access
      PERMISSIONS.WARRANTY_CLAIM_VIEW,
      PERMISSIONS.WARRANTY_CLAIM_CREATE,
      PERMISSIONS.WARRANTY_CLAIM_ACCEPT,
      PERMISSIONS.WARRANTY_CLAIM_INSPECT,
      PERMISSIONS.WARRANTY_CLAIM_ASSIGN,
      PERMISSIONS.WARRANTY_CLAIM_APPROVE,
      PERMISSIONS.WARRANTY_CLAIM_REJECT,
      PERMISSIONS.WARRANTY_CLAIM_UPDATE,
      PERMISSIONS.WARRANTY_CLAIM_DELETE,
      PERMISSIONS.WARRANTY_CLAIM_VOID,

      // Job Orders - Full Access
      PERMISSIONS.JOB_ORDER_VIEW,
      PERMISSIONS.JOB_ORDER_CREATE,
      PERMISSIONS.JOB_ORDER_EDIT,
      PERMISSIONS.JOB_ORDER_DELETE,
      PERMISSIONS.JOB_ORDER_DIAGNOSE,
      PERMISSIONS.JOB_ORDER_ADD_PARTS,
      PERMISSIONS.JOB_ORDER_ESTIMATE,
      PERMISSIONS.JOB_ORDER_APPROVE_ESTIMATE,
      PERMISSIONS.JOB_ORDER_START_REPAIR,
      PERMISSIONS.JOB_ORDER_COMPLETE,
      PERMISSIONS.JOB_ORDER_QUALITY_CHECK,
      PERMISSIONS.JOB_ORDER_CLOSE,
      PERMISSIONS.JOB_ORDER_REOPEN,

      // Service Payments - Full Access
      PERMISSIONS.SERVICE_PAYMENT_VIEW,
      PERMISSIONS.SERVICE_PAYMENT_CREATE,
      PERMISSIONS.SERVICE_PAYMENT_VOID,
      PERMISSIONS.SERVICE_PAYMENT_REFUND,
      PERMISSIONS.SERVICE_RECEIPT_PRINT,

      // Service Reports - Full Access
      PERMISSIONS.SERVICE_REPORT_VIEW,
      PERMISSIONS.SERVICE_REPORT_EXPORT,
      PERMISSIONS.SERVICE_WARRANTY_SLIP_VIEW,
      PERMISSIONS.SERVICE_WARRANTY_SLIP_PRINT,
      PERMISSIONS.TECHNICIAN_PERFORMANCE_REPORT,
      PERMISSIONS.REPAIR_ANALYTICS_VIEW,
      PERMISSIONS.SERVICE_REVENUE_REPORT,
      PERMISSIONS.WARRANTY_ANALYTICS_VIEW,

      // Customer Access (for warranty claims)
      PERMISSIONS.CUSTOMER_VIEW,
      PERMISSIONS.CUSTOMER_CREATE,
      PERMISSIONS.CUSTOMER_UPDATE,

      // Sales Access (to view original sale for warranty validation)
      PERMISSIONS.SELL_VIEW,
    ],
  },

  TECHNICIAN: {
    name: 'Technician',
    description: 'Performs repairs, diagnoses issues, and updates job orders',
    category: 'Technical Service',
    permissions: [
      PERMISSIONS.DASHBOARD_VIEW,

      // Product & Serial Number - View & Scan
      PERMISSIONS.PRODUCT_VIEW,
      PERMISSIONS.SERIAL_NUMBER_VIEW,
      PERMISSIONS.SERIAL_NUMBER_LOOKUP,
      PERMISSIONS.SERIAL_NUMBER_SCAN,

      // Warranty Claims - View & Inspect
      PERMISSIONS.WARRANTY_CLAIM_VIEW_OWN,
      PERMISSIONS.WARRANTY_CLAIM_VIEW,
      PERMISSIONS.WARRANTY_CLAIM_INSPECT,

      // Job Orders - View Own & Update Progress
      PERMISSIONS.JOB_ORDER_VIEW_OWN,
      PERMISSIONS.JOB_ORDER_VIEW,
      PERMISSIONS.JOB_ORDER_DIAGNOSE,
      PERMISSIONS.JOB_ORDER_ADD_PARTS,
      PERMISSIONS.JOB_ORDER_ESTIMATE,
      PERMISSIONS.JOB_ORDER_START_REPAIR,
      PERMISSIONS.JOB_ORDER_COMPLETE,

      // Service Types - View Only (reference for repairs)
      PERMISSIONS.SERVICE_TYPE_VIEW,

      // Customer - View Only
      PERMISSIONS.CUSTOMER_VIEW,

      // Own Performance Reports
      PERMISSIONS.TECHNICIAN_PERFORMANCE_VIEW,
    ],
  },

  SERVICE_CASHIER: {
    name: 'Service Cashier',
    description: 'Processes service payments, prints receipts and warranty slips',
    category: 'Technical Service',
    permissions: [
      PERMISSIONS.DASHBOARD_VIEW,

      // Product & Serial Number - View & Lookup
      PERMISSIONS.PRODUCT_VIEW,
      PERMISSIONS.SERIAL_NUMBER_VIEW,
      PERMISSIONS.SERIAL_NUMBER_LOOKUP,

      // Warranty Claims - View Only
      PERMISSIONS.WARRANTY_CLAIM_VIEW,
      PERMISSIONS.WARRANTY_CLAIM_CREATE, // Can create claim on customer's behalf

      // Job Orders - View Only
      PERMISSIONS.JOB_ORDER_VIEW,

      // Service Payments - Create & Print
      PERMISSIONS.SERVICE_PAYMENT_VIEW,
      PERMISSIONS.SERVICE_PAYMENT_CREATE,
      PERMISSIONS.SERVICE_RECEIPT_PRINT,

      // Warranty Slips - View & Print
      PERMISSIONS.SERVICE_WARRANTY_SLIP_VIEW,
      PERMISSIONS.SERVICE_WARRANTY_SLIP_PRINT,

      // Service Types - View Only (for pricing reference)
      PERMISSIONS.SERVICE_TYPE_VIEW,

      // Customer Management
      PERMISSIONS.CUSTOMER_VIEW,
      PERMISSIONS.CUSTOMER_CREATE,
      PERMISSIONS.CUSTOMER_UPDATE,

      // Sales - View Only (for warranty validation)
      PERMISSIONS.SELL_VIEW,

      // Basic Service Reports
      PERMISSIONS.SERVICE_REPORT_VIEW,
    ],
  },

  WARRANTY_INSPECTOR: {
    name: 'Warranty Inspector',
    description: 'Inspects warranty claims and approves/rejects coverage',
    category: 'Technical Service',
    permissions: [
      PERMISSIONS.DASHBOARD_VIEW,

      // Product & Serial Number Access
      PERMISSIONS.PRODUCT_VIEW,
      PERMISSIONS.SERIAL_NUMBER_VIEW,
      PERMISSIONS.SERIAL_NUMBER_LOOKUP,
      PERMISSIONS.SERIAL_NUMBER_TRACK,

      // Warranty Claims - Inspect & Approve/Reject
      PERMISSIONS.WARRANTY_CLAIM_VIEW,
      PERMISSIONS.WARRANTY_CLAIM_ACCEPT,
      PERMISSIONS.WARRANTY_CLAIM_INSPECT,
      PERMISSIONS.WARRANTY_CLAIM_APPROVE,
      PERMISSIONS.WARRANTY_CLAIM_REJECT,
      PERMISSIONS.WARRANTY_CLAIM_UPDATE,

      // Job Orders - View Only
      PERMISSIONS.JOB_ORDER_VIEW,

      // Service Types - View Only
      PERMISSIONS.SERVICE_TYPE_VIEW,

      // Customer - View Only
      PERMISSIONS.CUSTOMER_VIEW,

      // Sales - View Only (for warranty validation)
      PERMISSIONS.SELL_VIEW,

      // Product Warranty Info
      PERMISSIONS.PRODUCT_WARRANTY_VIEW,

      // Warranty Analytics
      PERMISSIONS.WARRANTY_ANALYTICS_VIEW,
      PERMISSIONS.SERVICE_REPORT_VIEW,
    ],
  },

  SERVICE_RECEPTIONIST: {
    name: 'Service Receptionist',
    description: 'Receives warranty claims, creates job orders, and assigns technicians',
    category: 'Technical Service',
    permissions: [
      PERMISSIONS.DASHBOARD_VIEW,

      // Product & Serial Number - View & Lookup
      PERMISSIONS.PRODUCT_VIEW,
      PERMISSIONS.SERIAL_NUMBER_VIEW,
      PERMISSIONS.SERIAL_NUMBER_LOOKUP,

      // Warranty Claims - Create & Accept
      PERMISSIONS.WARRANTY_CLAIM_VIEW,
      PERMISSIONS.WARRANTY_CLAIM_CREATE,
      PERMISSIONS.WARRANTY_CLAIM_ACCEPT,
      PERMISSIONS.WARRANTY_CLAIM_UPDATE,

      // Job Orders - Create & Assign
      PERMISSIONS.JOB_ORDER_VIEW,
      PERMISSIONS.JOB_ORDER_CREATE,
      PERMISSIONS.JOB_ORDER_EDIT,
      PERMISSIONS.WARRANTY_CLAIM_ASSIGN, // Assign technicians

      // Technician Management - View & Assign
      PERMISSIONS.TECHNICIAN_VIEW,
      PERMISSIONS.TECHNICIAN_ASSIGN,

      // Service Types - View Only
      PERMISSIONS.SERVICE_TYPE_VIEW,

      // Customer Management
      PERMISSIONS.CUSTOMER_VIEW,
      PERMISSIONS.CUSTOMER_CREATE,
      PERMISSIONS.CUSTOMER_UPDATE,

      // Sales - View Only (for warranty validation)
      PERMISSIONS.SELL_VIEW,

      // Warranty Slips
      PERMISSIONS.SERVICE_WARRANTY_SLIP_VIEW,
      PERMISSIONS.SERVICE_WARRANTY_SLIP_PRINT,
    ],
  },

  REPAIR_QUALITY_INSPECTOR: {
    name: 'Repair Quality Inspector',
    description: 'Conducts quality checks on completed repairs before delivery',
    category: 'Technical Service',
    permissions: [
      PERMISSIONS.DASHBOARD_VIEW,

      // Product & Serial Number Access
      PERMISSIONS.PRODUCT_VIEW,
      PERMISSIONS.SERIAL_NUMBER_VIEW,
      PERMISSIONS.SERIAL_NUMBER_LOOKUP,

      // Warranty Claims - View Only
      PERMISSIONS.WARRANTY_CLAIM_VIEW,

      // Job Orders - View & Quality Check
      PERMISSIONS.JOB_ORDER_VIEW,
      PERMISSIONS.JOB_ORDER_QUALITY_CHECK,
      PERMISSIONS.JOB_ORDER_CLOSE,
      PERMISSIONS.JOB_ORDER_REOPEN, // Can reopen if quality fails

      // Service Types - View Only
      PERMISSIONS.SERVICE_TYPE_VIEW,

      // Technician Performance - View (for quality trends)
      PERMISSIONS.TECHNICIAN_PERFORMANCE_VIEW,
      PERMISSIONS.TECHNICIAN_VIEW,

      // Reports
      PERMISSIONS.SERVICE_REPORT_VIEW,
      PERMISSIONS.REPAIR_ANALYTICS_VIEW,
    ],
  },

  SERVICE_PARTS_COORDINATOR: {
    name: 'Service Parts Coordinator',
    description: 'Manages parts inventory for repairs and adds parts to job orders',
    category: 'Technical Service',
    permissions: [
      PERMISSIONS.DASHBOARD_VIEW,

      // Product Management - Full Access (for parts)
      PERMISSIONS.PRODUCT_VIEW,
      PERMISSIONS.PRODUCT_CREATE, // Can add new parts
      PERMISSIONS.PRODUCT_UPDATE,
      PERMISSIONS.STOCK_REPORT_VIEW,

      // Serial Number - View & Track
      PERMISSIONS.SERIAL_NUMBER_VIEW,
      PERMISSIONS.SERIAL_NUMBER_LOOKUP,

      // Job Orders - View & Add Parts
      PERMISSIONS.JOB_ORDER_VIEW,
      PERMISSIONS.JOB_ORDER_ADD_PARTS,

      // Warranty Claims - View Only
      PERMISSIONS.WARRANTY_CLAIM_VIEW,

      // Service Types - View Only
      PERMISSIONS.SERVICE_TYPE_VIEW,

      // Inventory Management
      PERMISSIONS.INVENTORY_CORRECTION_VIEW,
      PERMISSIONS.INVENTORY_CORRECTION_CREATE,
      PERMISSIONS.STOCK_TRANSFER_VIEW,

      // Supplier Access (for ordering parts)
      PERMISSIONS.SUPPLIER_VIEW,
      PERMISSIONS.PURCHASE_VIEW,
      PERMISSIONS.PURCHASE_CREATE, // Can create PO for parts
    ],
  },

  SERVICE_REPORT_VIEWER: {
    name: 'Service Report Viewer',
    description: 'View-only access to all service and warranty reports',
    category: 'Technical Service',
    permissions: [
      PERMISSIONS.DASHBOARD_VIEW,

      // Warranty Claims - View Only
      PERMISSIONS.WARRANTY_CLAIM_VIEW,

      // Job Orders - View Only
      PERMISSIONS.JOB_ORDER_VIEW,

      // Service Payments - View Only
      PERMISSIONS.SERVICE_PAYMENT_VIEW,

      // All Service Reports - View & Export
      PERMISSIONS.SERVICE_REPORT_VIEW,
      PERMISSIONS.SERVICE_REPORT_EXPORT,
      PERMISSIONS.SERVICE_WARRANTY_SLIP_VIEW,
      PERMISSIONS.TECHNICIAN_PERFORMANCE_REPORT,
      PERMISSIONS.TECHNICIAN_PERFORMANCE_VIEW,
      PERMISSIONS.REPAIR_ANALYTICS_VIEW,
      PERMISSIONS.SERVICE_REVENUE_REPORT,
      PERMISSIONS.WARRANTY_ANALYTICS_VIEW,

      // Technician Info - View Only
      PERMISSIONS.TECHNICIAN_VIEW,

      // Service Types - View Only
      PERMISSIONS.SERVICE_TYPE_VIEW,

      // Product & Serial - View Only
      PERMISSIONS.PRODUCT_VIEW,
      PERMISSIONS.SERIAL_NUMBER_VIEW,
    ],
  },

  // ============================================
  // CATEGORY 12: CROSS-LOCATION OPERATIONS
  // ============================================

  CROSS_LOCATION_APPROVER: {
    name: 'Cross-Location Approver',
    description: 'Approves transfers across all locations for Separation of Duties - APPROVE ONLY (creator must send, receiver must verify)',
    category: 'Operations',
    permissions: [
      // Dashboard
      PERMISSIONS.DASHBOARD_VIEW,

      // View Products (needed to see what\'s being transferred)
      PERMISSIONS.PRODUCT_VIEW,

      // Stock Transfers - APPROVE ONLY for proper SOD
      PERMISSIONS.STOCK_TRANSFER_VIEW,
      PERMISSIONS.STOCK_TRANSFER_CHECK, // APPROVE ONLY - ensures 2 people minimum
      PERMISSIONS.STOCK_TRANSFER_CANCEL, // Can cancel invalid transfers

      // WHY NO SEND/RECEIVE/VERIFY/COMPLETE?
      // Proper Separation of Duties (SOD):
      // - SENDER SIDE: Creator sends (after approval) = 2 people minimum
      // - RECEIVER SIDE: Receiver verifies and completes = Different location users
      // - APPROVER: Only approves, cannot execute = Prevents 1-person fraud

      // Serial Number Import (Historical data entry - not actual purchases)
      PERMISSIONS.PURCHASE_CREATE, // Needed for serial number bulk import menu

      // BIR Z-Reading Approval
      PERMISSIONS.Z_READING,

      // Access all locations (can approve transfers between ANY locations)
      PERMISSIONS.ACCESS_ALL_LOCATIONS,

      // Reports - View Only
      PERMISSIONS.REPORT_VIEW,
      PERMISSIONS.REPORT_TRANSFER_VIEW,
      PERMISSIONS.REPORT_SALES_VIEW,
      PERMISSIONS.REPORT_PURCHASE_VIEW,
      PERMISSIONS.STOCK_REPORT_VIEW,
      PERMISSIONS.VIEW_INVENTORY_REPORTS,

      // Audit Log - View only (track what they approved)
      PERMISSIONS.AUDIT_LOG_VIEW,

      // NO CREATE PERMISSIONS:
      // ❌ NO STOCK_TRANSFER_CREATE
      // ❌ NO SELL_CREATE
      // ❌ NO PURCHASE_CREATE
      // ❌ NO SETTINGS ACCESS
      // ❌ NO USER MANAGEMENT
      // ❌ NO ROLE MANAGEMENT
    ],
  },
} as const
