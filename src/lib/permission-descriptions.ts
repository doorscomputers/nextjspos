/**
 * Permission Descriptions
 * Provides user-friendly descriptions for each permission
 */

export const PERMISSION_DESCRIPTIONS: Record<string, string> = {
  // Dashboard
  'dashboard.view': 'View the main dashboard with analytics and overview',

  // Users
  'user.view': 'View user accounts and their details',
  'user.create': 'Create new user accounts',
  'user.update': 'Edit existing user information',
  'user.delete': 'Delete or deactivate user accounts',

  // Roles & Permissions
  'role.view': 'View roles and their permissions',
  'role.create': 'Create new roles with custom permissions',
  'role.update': 'Edit existing roles and modify permissions',
  'role.delete': 'Delete custom roles',

  // Products - Basic
  'product.view': 'View product catalog and details',
  'product.create': 'Add new products to inventory',
  'product.update': 'Edit product information and pricing',
  'product.delete': 'Remove products from system',

  // Products - Field Level
  'product.view_purchase_price': 'See product cost/purchase prices',
  'product.view_profit_margin': 'View profit margins and markup calculations',
  'product.view_supplier': 'See product supplier information',
  'product.view_all_branch_stock': 'View stock levels across all branches',

  // Product - Pricing
  'product.access_default_selling_price': 'Set and modify default selling prices',
  'product.manage_multi_price': 'Manage multiple price tiers per product',

  // Product - Opening Stock
  'product.opening_stock': 'Set beginning inventory quantities',
  'product.lock_opening_stock': 'Lock opening stock to prevent changes',
  'product.unlock_opening_stock': 'Unlock previously locked opening stock',
  'product.modify_locked_stock': 'Edit opening stock even when locked',

  // Product Categories
  'product_category.view': 'View product categories',
  'product_category.create': 'Create new product categories',
  'product_category.update': 'Edit product categories',
  'product_category.delete': 'Delete product categories',

  // Product Brands
  'product_brand.view': 'View product brands',
  'product_brand.create': 'Add new product brands',
  'product_brand.update': 'Edit product brands',
  'product_brand.delete': 'Delete product brands',

  // Product Units
  'product_unit.view': 'View units of measurement (pieces, boxes, kg)',
  'product_unit.create': 'Create custom units of measurement',
  'product_unit.update': 'Edit unit definitions',
  'product_unit.delete': 'Delete units of measurement',

  // Product Warranty
  'product_warranty.view': 'View warranty information',
  'product_warranty.create': 'Create warranty terms for products',
  'product_warranty.update': 'Edit warranty information',
  'product_warranty.delete': 'Delete warranty terms',

  // Sales - Basic
  'sell.view': 'View sales transactions',
  'sell.view_own': 'View only own sales transactions',
  'sell.create': 'Process new sales transactions',
  'sell.update': 'Edit sales transactions',
  'sell.delete': 'Delete sales transactions',

  // Sales - Advanced
  'sell.view_cost': 'View cost of goods sold',
  'sell.view_profit': 'View profit margins on sales',
  'sell.view_discount_details': 'See detailed discount breakdown',
  'sell.add_discount': 'Apply discounts to sales',
  'sell.add_refund': 'Process sales refunds',

  // Cashier Shifts
  'shift.open': 'Open a cashier shift',
  'shift.close': 'Close a cashier shift',
  'shift.view': 'View shift information',
  'shift.view_all': 'View all cashier shifts system-wide',

  // Cash Management
  'cash_in_out': 'Record cash deposits and withdrawals',
  'cash.count': 'Perform cash count/reconciliation',
  'cash.approve_large_transactions': 'Approve large cash transactions',

  // Stock Transfers
  'stock_transfer.view': 'View stock transfer requests',
  'stock_transfer.create': 'Create new transfer requests',
  'stock_transfer.check': 'Check/verify items before sending',
  'stock_transfer.send': 'Send items from warehouse',
  'stock_transfer.receive': 'Receive transferred items',
  'stock_transfer.verify': 'Verify received items',
  'stock_transfer.complete': 'Complete/finalize transfers',
  'stock_transfer.cancel': 'Cancel transfer requests',

  // Purchases
  'purchase.view': 'View purchase orders',
  'purchase.create': 'Create new purchase orders',
  'purchase.update': 'Edit purchase orders',
  'purchase.delete': 'Delete purchase orders',
  'purchase.approve': 'Approve purchase orders',
  'purchase.receive': 'Receive purchased goods',
  'purchase.view_cost': 'View purchase costs and pricing',

  // Purchase Receipts (GRN)
  'purchase.receipt.view': 'View goods received notes (GRN)',
  'purchase.receipt.create': 'Record goods receipt',
  'purchase.receipt.approve': 'Approve goods received',

  // Purchase Amendments
  'purchase.amendment.view': 'View purchase amendments',
  'purchase.amendment.create': 'Create purchase amendments',
  'purchase.amendment.approve': 'Approve purchase amendments',
  'purchase.amendment.reject': 'Reject purchase amendments',

  // Purchase Returns
  'purchase_return.view': 'View returns to suppliers',
  'purchase_return.create': 'Create supplier return requests',
  'purchase_return.approve': 'Approve supplier returns',
  'purchase_return.delete': 'Delete supplier return requests',

  // Quality Control
  'qc.inspection.view': 'View QC inspection records',
  'qc.inspection.create': 'Create QC inspections',
  'qc.inspection.conduct': 'Perform quality inspections',
  'qc.inspection.approve': 'Approve QC inspections',
  'qc.template.view': 'View QC inspection templates',
  'qc.template.manage': 'Create and edit QC templates',

  // Inventory Corrections
  'inventory_correction.view': 'View inventory adjustments',
  'inventory_correction.create': 'Create inventory correction requests',
  'inventory_correction.update': 'Edit correction requests',
  'inventory_correction.approve': 'Approve inventory corrections',

  // Physical Inventory
  'physical_inventory.export': 'Export inventory for counting',
  'physical_inventory.import': 'Import counted inventory',

  // Serial Numbers
  'serial_number.view': 'View serial numbers',
  'serial_number.track': 'Track serial numbered items',
  'serial_number.scan': 'Scan serial numbers',

  // Customers
  'customer.view': 'View customer information',
  'customer.create': 'Add new customers',
  'customer.update': 'Edit customer details',
  'customer.delete': 'Delete customers',

  // Customer Returns
  'customer_return.view': 'View customer returns',
  'customer_return.create': 'Process customer return requests',
  'customer_return.approve': 'Approve customer returns',
  'customer_return.delete': 'Delete return requests',

  // Suppliers
  'supplier.view': 'View supplier information',
  'supplier.create': 'Add new suppliers',
  'supplier.update': 'Edit supplier details',
  'supplier.delete': 'Delete suppliers',

  // Supplier Returns
  'supplier_return.view': 'View supplier returns',
  'supplier_return.create': 'Create return to supplier',
  'supplier_return.approve': 'Approve supplier returns',
  'supplier_return.delete': 'Delete supplier returns',

  // Accounts Payable
  'accounts_payable.view': 'View outstanding payables',
  'accounts_payable.create': 'Record new payables',
  'accounts_payable.update': 'Edit payable records',
  'accounts_payable.delete': 'Delete payable records',

  // Payments
  'payment.view': 'View payment records',
  'payment.create': 'Record new payments to suppliers',
  'payment.update': 'Edit payment records',
  'payment.delete': 'Delete payment records',
  'payment.approve': 'Approve supplier payments',

  // Banking
  'bank.view': 'View bank accounts',
  'bank.create': 'Add new bank accounts',
  'bank.update': 'Edit bank account information',
  'bank.delete': 'Delete bank accounts',
  'bank.transaction.view': 'View bank transactions',
  'bank.transaction.record': 'Record bank transactions',
  'bank.reconciliation': 'Perform bank reconciliation',

  // Expenses
  'expense.view': 'View expense records',
  'expense.create': 'Record new expenses',
  'expense.update': 'Edit expense records',
  'expense.delete': 'Delete expense records',
  'expense.approve': 'Approve expense claims',

  // Expense Categories
  'expense_category.view': 'View expense categories',
  'expense_category.create': 'Create expense categories',
  'expense_category.update': 'Edit expense categories',
  'expense_category.delete': 'Delete expense categories',

  // Void Transactions
  'void.create': 'Void/cancel transactions',
  'void.approve': 'Approve void requests',

  // Freebies
  'freebie.add': 'Add free items to sales',
  'freebie.approve': 'Approve freebie requests',
  'freebie.view_log': 'View freebie history log',

  // Package Templates
  'package_template.view': 'View package templates (product bundles)',
  'package_template.create': 'Create new package templates',
  'package_template.edit': 'Edit existing package templates',
  'package_template.delete': 'Delete package templates',

  // BIR Readings (Philippines)
  'x_reading': 'Generate X-Reading (mid-shift report)',
  'z_reading': 'Generate Z-Reading (end-of-day report)',

  // Reports - Sales
  'report.view': 'Access reports module',
  'report.sales.view': 'View sales reports',
  'report.sales.daily': 'View daily sales reports',
  'report.sales.today': 'View today\'s sales summary',
  'report.sales.history': 'View historical sales data',
  'report.sales.profitability': 'View sales profitability reports',

  // Sales Reports Detailed
  'sales_report.view': 'Access sales reporting section',
  'sales_report.daily': 'View daily sales breakdown',
  'sales_report.summary': 'View sales summary reports',
  'sales_report.journal': 'View sales journal entries',
  'sales_report.per_item': 'View sales by product/item',
  'sales_report.per_cashier': 'View sales by cashier',
  'sales_report.per_location': 'View sales by location/branch',
  'sales_report.analytics': 'View sales analytics dashboard',
  'sales_report.customer_analysis': 'View customer buying patterns',
  'sales_report.payment_method': 'View sales by payment method',
  'sales_report.discount_analysis': 'View discount usage analysis',

  // Reports - Purchase
  'report.purchase.view': 'View purchase reports',
  'report.purchase.analytics': 'View purchase analytics',
  'report.purchase.trends': 'View purchasing trends',
  'report.purchase.items': 'View purchased items report',
  'report.purchase_sell': 'Compare purchase vs sell data',

  // Reports - Transfer
  'report.transfer.view': 'View transfer reports',
  'report.transfer.trends': 'View transfer trends and patterns',

  // Reports - Financial
  'report.profit_loss': 'View profit & loss statement',
  'report.profitability': 'View profitability analysis',

  // Reports - Inventory
  'report.stock_alert': 'View low stock alerts',
  'stock_report.view': 'View stock reports',
  'view_inventory_reports': 'Access inventory reports',
  'inventory_ledger.view': 'View inventory ledger',
  'inventory_ledger.export': 'Export inventory ledger',
  'report.product_purchase_history': 'View product purchase history',

  // Business Settings
  'business_settings.view': 'View business configuration',
  'business_settings.edit': 'Modify business settings',

  // Locations
  'location.view': 'View branch/location information',
  'location.create': 'Create new branches/locations',
  'location.update': 'Edit location details',
  'location.delete': 'Delete locations',
  'access_all_locations': 'Access all branches (not location-restricted)',

  // Audit Log
  'audit_log.view': 'View system activity audit log',

  // Announcements
  'announcement.view': 'View system announcements',
  'announcement.create': 'Create new announcements',
  'announcement.update': 'Edit announcements',
  'announcement.delete': 'Delete announcements',
  'announcement.manage': 'Full announcement management',

  // HR & Scheduling
  'schedule.view': 'View employee schedules',
  'schedule.create': 'Create employee schedules',
  'schedule.update': 'Edit employee schedules',
  'schedule.delete': 'Delete schedules',
  'schedule.manage_all': 'Manage all employee schedules',

  // Attendance
  'attendance.view': 'View attendance records',
  'attendance.clock_in': 'Clock in/start shift',
  'attendance.clock_out': 'Clock out/end shift',
  'attendance.edit': 'Edit attendance records',
  'attendance.report': 'View attendance reports',
  'attendance.view_own': 'View only own attendance',
  'attendance.manage': 'Manage all attendance records',

  // Leave Requests
  'leave_request.view_own': 'View own leave requests',
  'leave_request.create': 'Submit leave requests',
  'leave_request.view_all': 'View all leave requests',
  'leave_request.approve': 'Approve leave requests',
  'leave_request.reject': 'Reject leave requests',

  // Location Change Requests
  'location_change_request.view': 'View location change requests',
  'location_change_request.create': 'Request location/branch change',
  'location_change_request.approve': 'Approve location change requests',
  'location_change_request.reject': 'Reject location change requests',

  // Overtime
  'overtime.alerts.view': 'View overtime alerts',
  'overtime.alerts.acknowledge': 'Acknowledge overtime notifications',
  'overtime.alerts.manage': 'Manage overtime alert settings',

  // Super Admin
  'superadmin.all': 'Full system access (developer/owner only)',
  'superadmin.business.view': 'View all businesses (multi-tenant)',
  'superadmin.business.create': 'Create new businesses',
  'superadmin.business.edit': 'Edit any business',
  'superadmin.business.delete': 'Delete businesses',
}

export const CATEGORY_DESCRIPTIONS: Record<string, string> = {
  'dashboard': 'Main dashboard and overview',
  'user': 'User account management',
  'role': 'Role and permission management',
  'product': 'Product catalog and inventory',
  'product_category': 'Product categories',
  'product_brand': 'Product brands',
  'product_unit': 'Units of measurement',
  'product_warranty': 'Product warranties',
  'sell': 'Sales transactions (POS)',
  'shift': 'Cashier shift management',
  'cash': 'Cash management',
  'stock_transfer': 'Stock transfers between locations',
  'purchase': 'Purchase orders and procurement',
  'purchase_return': 'Returns to suppliers',
  'qc': 'Quality control inspections',
  'inventory_correction': 'Inventory adjustments',
  'physical_inventory': 'Physical stock counting',
  'serial_number': 'Serial number tracking',
  'customer': 'Customer management',
  'customer_return': 'Customer returns/refunds',
  'supplier': 'Supplier management',
  'supplier_return': 'Supplier returns',
  'accounts_payable': 'Money owed to suppliers',
  'payment': 'Supplier payments',
  'bank': 'Bank account management',
  'expense': 'Business expenses',
  'expense_category': 'Expense categories',
  'void': 'Void/cancel transactions',
  'freebie': 'Free items/promotional items',
  'package_template': 'Package templates (product bundles)',
  'x_reading': 'X-Reading reports (BIR)',
  'z_reading': 'Z-Reading reports (BIR)',
  'report': 'Reports and analytics',
  'sales_report': 'Sales analysis reports',
  'stock_report': 'Inventory reports',
  'inventory_ledger': 'Inventory ledger',
  'business_settings': 'Business configuration',
  'location': 'Branch/location management',
  'audit_log': 'System activity log',
  'announcement': 'System announcements',
  'schedule': 'Employee scheduling',
  'attendance': 'Employee attendance',
  'leave_request': 'Leave/vacation requests',
  'location_change_request': 'Location transfer requests',
  'overtime': 'Overtime tracking',
  'superadmin': 'Super Admin (platform level)',
  'access_all_locations': 'Cross-branch access',
  'view_inventory_reports': 'Inventory reporting',
}
