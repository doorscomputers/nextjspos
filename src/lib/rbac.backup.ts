/**
 * RBAC Backup File - Created before fixing menu permissions for Bulk Pricer role
 * Date: 2025-10-29
 * Purpose: Backup of DEFAULT_ROLES configuration before menu permissions fix
 */

export type Permission = string

export interface RBACUser {
  id: string
  permissions: Permission[]
  roles: string[]
  businessId?: string
  locationIds?: number[]
}

export const PERMISSIONS = {
  // Products - Multi-Location Pricing
  PRODUCT_PRICE_EDIT: 'product.price.edit', // Edit location prices for own location
  PRODUCT_PRICE_EDIT_ALL: 'product.price.edit_all', // Edit location prices for all locations
  PRODUCT_PRICE_BULK_EDIT: 'product.price.bulk_edit', // Bulk price editing across multiple products
  PRODUCT_PRICE_MULTI_LOCATION_UPDATE: 'product.price.multi_location_update', // Replicate price changes across selected locations
  // ... (all other permissions would be backed up here)
}

export const DEFAULT_ROLES_BACKUP = {
  BULK_PRICER: {
    name: 'Bulk Pricer',
    description: 'Specialized role for bulk price editing across multiple locations',
    category: 'Product & Inventory',
    permissions: [
      'dashboard.view',
      'product.view',
      'product.price.edit',
      'product.price.edit_all',
      'product.price.bulk_edit',
      'product.price.multi_location_update',
      'product.price.export',
      'product.view_purchase_price',
      'product.view_profit_margin',
      'report.view',
      'report.stock_alert',
      'stock_report.view',
    ],
  },
} as const

// This is a backup of the original configuration before any changes
// File: src/lib/rbac.backup.ts
// Created by Claude on 2025-10-29
// Reason: Fix menu permissions for Bulk Pricer role access to Price Editor menu