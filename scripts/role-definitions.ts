/**
 * Comprehensive Role Definitions
 *
 * This file defines all the roles in the system with their specific permissions.
 * Use this to easily create and manage roles with consistent permissions.
 */

import { PERMISSIONS } from '../src/lib/rbac'

export interface RoleDefinition {
  name: string
  description: string
  permissions: string[]
  isDefault?: boolean
  locationRequired?: boolean
}

export const ROLE_DEFINITIONS: Record<string, RoleDefinition> = {
  // =============================================
  // SUPER ADMIN - Full System Access
  // =============================================
  SUPER_ADMIN: {
    name: 'Super Admin',
    description: 'Full system access - all permissions',
    permissions: Object.values(PERMISSIONS),
    isDefault: true,
    locationRequired: false
  },

  // =============================================
  // SYSTEM ADMINISTRATOR - Same as Super Admin
  // =============================================
  SYSTEM_ADMINISTRATOR: {
    name: 'System Administrator',
    description: 'Full system access - all permissions',
    permissions: Object.values(PERMISSIONS),
    isDefault: false,
    locationRequired: false
  },

  // =============================================
  // REPORTS ADMIN - View Only Access
  // =============================================
  REPORTS_ADMIN: {
    name: 'Reports Admin',
    description: 'View all reports and data - no transactions or modifications',
    permissions: [
      // Dashboard & Reports
      PERMISSIONS.DASHBOARD_VIEW,
      PERMISSIONS.REPORT_PURCHASE_ITEMS,
      PERMISSIONS.REPORT_VIEW,

      // View Products
      PERMISSIONS.PRODUCT_VIEW,
      PERMISSIONS.PRODUCT_LIST,

      // View Customers
      PERMISSIONS.CUSTOMER_VIEW,

      // View Suppliers
      PERMISSIONS.SUPPLIER_VIEW,

      // View Sales
      PERMISSIONS.SALE_VIEW,

      // View Purchases
      PERMISSIONS.PURCHASE_VIEW,

      // View Transfers
      PERMISSIONS.TRANSFER_VIEW,

      // View Categories/Brands/Units
      PERMISSIONS.CATEGORY_VIEW,
      PERMISSIONS.BRAND_VIEW,
      PERMISSIONS.UNIT_VIEW
    ],
    isDefault: false,
    locationRequired: false
  },

  // =============================================
  // WAREHOUSE MANAGER - Full Product & Purchase Management
  // =============================================
  WAREHOUSE_MANAGER: {
    name: 'Warehouse Manager',
    description: 'Manage products, purchases, and transfers - full warehouse operations',
    permissions: [
      // Dashboard
      PERMISSIONS.DASHBOARD_VIEW,

      // Products - Full CRUD
      PERMISSIONS.PRODUCT_VIEW,
      PERMISSIONS.PRODUCT_LIST,
      PERMISSIONS.PRODUCT_CREATE,
      PERMISSIONS.PRODUCT_UPDATE,
      PERMISSIONS.PRODUCT_DELETE,

      // Product Details
      PERMISSIONS.PRODUCT_PRICE_VIEW,
      PERMISSIONS.PRODUCT_PRICE_EDIT,
      PERMISSIONS.PRODUCT_COST_VIEW,

      // Categories/Brands/Units - Full CRUD
      PERMISSIONS.CATEGORY_VIEW,
      PERMISSIONS.CATEGORY_CREATE,
      PERMISSIONS.CATEGORY_UPDATE,
      PERMISSIONS.CATEGORY_DELETE,
      PERMISSIONS.BRAND_VIEW,
      PERMISSIONS.BRAND_CREATE,
      PERMISSIONS.BRAND_UPDATE,
      PERMISSIONS.BRAND_DELETE,
      PERMISSIONS.UNIT_VIEW,
      PERMISSIONS.UNIT_CREATE,
      PERMISSIONS.UNIT_UPDATE,
      PERMISSIONS.UNIT_DELETE,

      // Suppliers - Full CRUD
      PERMISSIONS.SUPPLIER_VIEW,
      PERMISSIONS.SUPPLIER_CREATE,
      PERMISSIONS.SUPPLIER_UPDATE,
      PERMISSIONS.SUPPLIER_DELETE,

      // Purchases - Full Operations
      PERMISSIONS.PURCHASE_VIEW,
      PERMISSIONS.PURCHASE_CREATE,
      PERMISSIONS.PURCHASE_UPDATE,
      PERMISSIONS.PURCHASE_DELETE,
      PERMISSIONS.PURCHASE_APPROVE,
      PERMISSIONS.REPORT_PURCHASE_ITEMS,

      // Transfers - Full Operations
      PERMISSIONS.TRANSFER_VIEW,
      PERMISSIONS.TRANSFER_CREATE,
      PERMISSIONS.TRANSFER_UPDATE,
      PERMISSIONS.TRANSFER_DELETE,
      PERMISSIONS.TRANSFER_APPROVE,
      PERMISSIONS.TRANSFER_SEND,
      PERMISSIONS.TRANSFER_RECEIVE,

      // Inventory
      PERMISSIONS.STOCK_VIEW,
      PERMISSIONS.STOCK_ADJUSTMENT,

      // Reports
      PERMISSIONS.REPORT_VIEW,
      PERMISSIONS.REPORT_PURCHASE_ITEMS
    ],
    isDefault: false,
    locationRequired: true
  },

  // =============================================
  // SALES CASHIER - POS Operations
  // =============================================
  SALES_CASHIER: {
    name: 'Sales Cashier',
    description: 'Process sales and view own sales reports - no cost visibility',
    permissions: [
      // Dashboard
      PERMISSIONS.DASHBOARD_VIEW,

      // Products - View Only (no cost)
      PERMISSIONS.PRODUCT_VIEW,
      PERMISSIONS.PRODUCT_LIST,
      PERMISSIONS.PRODUCT_PRICE_VIEW, // Can see retail price only

      // Sales - Own Sales Only
      PERMISSIONS.SALE_VIEW, // Limited to own sales
      PERMISSIONS.SALE_CREATE,

      // Customers
      PERMISSIONS.CUSTOMER_VIEW,
      PERMISSIONS.CUSTOMER_CREATE, // Can add walk-in customers

      // Reports - Own Sales Only
      PERMISSIONS.REPORT_VIEW // Limited to own sales reports
    ],
    isDefault: false,
    locationRequired: true
  },

  // =============================================
  // PRICE MANAGER - Product Pricing Only
  // =============================================
  PRICE_MANAGER: {
    name: 'Price Manager',
    description: 'Manage product prices - view products and update pricing',
    permissions: [
      // Dashboard
      PERMISSIONS.DASHBOARD_VIEW,

      // Products
      PERMISSIONS.PRODUCT_VIEW,
      PERMISSIONS.PRODUCT_LIST,
      PERMISSIONS.PRODUCT_PRICE_VIEW,
      PERMISSIONS.PRODUCT_PRICE_EDIT,
      PERMISSIONS.PRODUCT_PRICE_EDIT_ALL,
      PERMISSIONS.PRODUCT_PRICE_BULK_EDIT,
      PERMISSIONS.PRODUCT_COST_VIEW,

      // Categories/Brands (view only)
      PERMISSIONS.CATEGORY_VIEW,
      PERMISSIONS.BRAND_VIEW,
      PERMISSIONS.UNIT_VIEW
    ],
    isDefault: false,
    locationRequired: false
  },

  // =============================================
  // TRANSFER CREATOR - Create Transfer Requests
  // =============================================
  TRANSFER_CREATOR: {
    name: 'Transfer Creator',
    description: 'Create stock transfer requests between locations',
    permissions: [
      PERMISSIONS.DASHBOARD_VIEW,
      PERMISSIONS.PRODUCT_VIEW,
      PERMISSIONS.PRODUCT_LIST,
      PERMISSIONS.STOCK_VIEW,
      PERMISSIONS.TRANSFER_VIEW,
      PERMISSIONS.TRANSFER_CREATE
    ],
    isDefault: false,
    locationRequired: true
  },

  // =============================================
  // TRANSFER APPROVER - Approve Transfers
  // =============================================
  TRANSFER_APPROVER: {
    name: 'Transfer Approver',
    description: 'Review and approve stock transfer requests',
    permissions: [
      PERMISSIONS.DASHBOARD_VIEW,
      PERMISSIONS.PRODUCT_VIEW,
      PERMISSIONS.STOCK_VIEW,
      PERMISSIONS.TRANSFER_VIEW,
      PERMISSIONS.TRANSFER_APPROVE
    ],
    isDefault: false,
    locationRequired: true
  },

  // =============================================
  // TRANSFER SENDER - Send Approved Transfers
  // =============================================
  TRANSFER_SENDER: {
    name: 'Transfer Sender',
    description: 'Mark transfers as sent (shipped) from source location',
    permissions: [
      PERMISSIONS.DASHBOARD_VIEW,
      PERMISSIONS.PRODUCT_VIEW,
      PERMISSIONS.STOCK_VIEW,
      PERMISSIONS.TRANSFER_VIEW,
      PERMISSIONS.TRANSFER_SEND
    ],
    isDefault: false,
    locationRequired: true
  },

  // =============================================
  // TRANSFER RECEIVER - Receive Transfers
  // =============================================
  TRANSFER_RECEIVER: {
    name: 'Transfer Receiver',
    description: 'Receive and verify incoming stock transfers',
    permissions: [
      PERMISSIONS.DASHBOARD_VIEW,
      PERMISSIONS.PRODUCT_VIEW,
      PERMISSIONS.STOCK_VIEW,
      PERMISSIONS.TRANSFER_VIEW,
      PERMISSIONS.TRANSFER_RECEIVE
    ],
    isDefault: false,
    locationRequired: true
  },

  // =============================================
  // TRANSFER MANAGER - Full Transfer Operations
  // =============================================
  TRANSFER_MANAGER: {
    name: 'Transfer Manager',
    description: 'Full transfer operations - create, approve, send, receive',
    permissions: [
      PERMISSIONS.DASHBOARD_VIEW,
      PERMISSIONS.PRODUCT_VIEW,
      PERMISSIONS.PRODUCT_LIST,
      PERMISSIONS.STOCK_VIEW,
      PERMISSIONS.TRANSFER_VIEW,
      PERMISSIONS.TRANSFER_CREATE,
      PERMISSIONS.TRANSFER_UPDATE,
      PERMISSIONS.TRANSFER_APPROVE,
      PERMISSIONS.TRANSFER_SEND,
      PERMISSIONS.TRANSFER_RECEIVE,
      PERMISSIONS.REPORT_VIEW
    ],
    isDefault: false,
    locationRequired: true
  },

  // =============================================
  // INVENTORY AUDITOR - View & Audit Inventory
  // =============================================
  INVENTORY_AUDITOR: {
    name: 'Inventory Auditor',
    description: 'View and audit inventory levels - read-only access',
    permissions: [
      PERMISSIONS.DASHBOARD_VIEW,
      PERMISSIONS.PRODUCT_VIEW,
      PERMISSIONS.PRODUCT_LIST,
      PERMISSIONS.PRODUCT_COST_VIEW,
      PERMISSIONS.STOCK_VIEW,
      PERMISSIONS.REPORT_VIEW,
      PERMISSIONS.REPORT_PURCHASE_ITEMS
    ],
    isDefault: false,
    locationRequired: false
  }
}

// Helper function to get role permissions
export function getRolePermissions(roleName: string): string[] {
  const role = Object.values(ROLE_DEFINITIONS).find(r => r.name === roleName)
  return role?.permissions || []
}

// Helper function to check if role requires location
export function isLocationRequired(roleName: string): boolean {
  const role = Object.values(ROLE_DEFINITIONS).find(r => r.name === roleName)
  return role?.locationRequired || false
}
