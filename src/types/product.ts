/**
 * Product Management TypeScript Types
 * Defines all types for product-related functionality
 */

import { Decimal } from '@prisma/client/runtime/library'

// ============================================
// CORE PRODUCT TYPES
// ============================================

export interface Product {
  id: number
  businessId: number
  name: string
  type: 'single' | 'variable' | 'combo'
  sku: string
  barcodeType: string | null
  description: string | null
  productDescription: string | null
  image: string | null
  brochure: string | null
  enableStock: boolean
  alertQuantity: Decimal | null
  purchasePrice: Decimal | null
  sellingPrice: Decimal | null
  weight: Decimal | null
  preparationTime: number | null
  enableProductInfo: boolean
  notForSelling: boolean
  createdAt: Date
  updatedAt: Date
  deletedAt: Date | null

  // Relations
  categoryId: number | null
  category?: Category | null
  brandId: number | null
  brand?: Brand | null
  unitId: number | null
  unit?: Unit | null
  taxId: number | null
  tax?: TaxRate | null
  taxType: string | null

  variations?: ProductVariation[]
  variationLocationDetails?: VariationLocationDetail[]
  comboProducts?: ComboProduct[]
  comboItems?: ComboProduct[]
  stockTransactions?: StockTransaction[]
}

export interface ProductVariation {
  id: number
  productId: number
  product?: Product
  name: string
  sku: string
  purchasePrice: Decimal
  sellingPrice: Decimal
  isDefault: boolean
  subSku: string | null
  createdAt: Date
  updatedAt: Date
  deletedAt: Date | null

  // Relations
  unitId: number | null
  unit?: Unit | null
  variationLocationDetails?: VariationLocationDetail[]
  stockTransactions?: StockTransaction[]
}

export interface VariationLocationDetail {
  id: number
  productId: number
  product?: Product
  productVariationId: number
  productVariation?: ProductVariation
  locationId: number
  qtyAvailable: Decimal
  sellingPrice: Decimal | null
  createdAt: Date
  updatedAt: Date
}

export interface ComboProduct {
  id: number
  parentProductId: number
  childProductId: number
  quantity: Decimal
  parentProduct?: Product
  childProduct?: Product
  createdAt: Date
  updatedAt: Date
}

// ============================================
// SUPPORTING TYPES
// ============================================

export interface Category {
  id: number
  businessId: number
  name: string
  shortCode: string | null
  description: string | null
  parentId: number | null
  createdAt: Date
  updatedAt: Date
  deletedAt: Date | null
  parent?: Category | null
  subcategories?: Category[]
  products?: Product[]
}

export interface Brand {
  id: number
  businessId: number
  name: string
  description: string | null
  createdAt: Date
  updatedAt: Date
  deletedAt: Date | null
  products?: Product[]
}

export interface Unit {
  id: number
  businessId: number
  name: string
  shortName: string
  allowDecimal: boolean
  createdAt: Date
  updatedAt: Date
  deletedAt: Date | null
  products?: Product[]
  productVariations?: ProductVariation[]
}

export interface TaxRate {
  id: number
  businessId: number
  name: string
  amount: Decimal
  isDefault: boolean
  createdAt: Date
  updatedAt: Date
  deletedAt: Date | null
  products?: Product[]
}

export interface BusinessLocation {
  id: number
  businessId: number
  name: string
  landmark: string | null
  country: string
  state: string
  city: string
  zipCode: string
  mobile: string | null
  alternateNumber: string | null
  email: string | null
  createdAt: Date
  updatedAt: Date
  deletedAt: Date | null
}

// ============================================
// STOCK TRANSACTION TYPES
// ============================================

export interface StockTransaction {
  id: number
  businessId: number
  productId: number
  product?: Product
  productVariationId: number
  productVariation?: ProductVariation
  locationId: number
  type: StockTransactionType
  quantity: Decimal
  unitCost: Decimal | null
  balanceQty: Decimal
  referenceType: string | null
  referenceId: number | null
  createdBy: number
  notes: string | null
  createdAt: Date
}

export type StockTransactionType =
  | 'opening_stock'
  | 'sale'
  | 'purchase'
  | 'transfer_in'
  | 'transfer_out'
  | 'adjustment'

// ============================================
// OPENING STOCK TYPES
// ============================================

export interface OpeningStockInput {
  productId: number
  variationId: number
  locationId: number
  quantity: number
  unitCost: number
  lotNumber?: string
  expiryDate?: string
}

export interface OpeningStockData {
  variations: {
    id: number
    name: string
    sku: string
    locations: {
      locationId: number
      locationName: string
      qtyAvailable: number
      openingStock?: {
        id: number
        quantity: number
        unitCost: number
        lotNumber?: string
        expiryDate?: string
      }
    }[]
  }[]
}

// ============================================
// STOCK HISTORY TYPES
// ============================================

export interface StockHistoryEntry {
  id: number
  date: Date
  referenceNumber: string | null
  transactionType: StockTransactionType
  transactionTypeLabel: string
  quantityAdded: number
  quantityRemoved: number
  runningBalance: number
  unitCost: number | null
  notes: string | null
  createdBy: string
}

export interface StockHistoryFilters {
  variationId: number
  locationId: number
  startDate?: Date
  endDate?: Date
}

// ============================================
// PRODUCT DUPLICATION TYPES
// ============================================

export interface DuplicateProductOptions {
  includeVariations: boolean
  includeStock: boolean
  nameSuffix?: string
}

export interface DuplicateProductResult {
  productId: number
  message: string
}

// ============================================
// PRODUCT DELETE VALIDATION TYPES
// ============================================

export interface ProductDeleteValidation {
  canDelete: boolean
  reasons: string[]
  hasPurchases: boolean
  hasOpeningStockSold: boolean
  hasStockAdjustments: boolean
}

// ============================================
// PRODUCT LISTING & FILTERING TYPES
// ============================================

export interface ProductListFilters {
  search?: string
  categoryId?: number
  brandId?: number
  type?: 'single' | 'variable' | 'combo'
  locationId?: number
  page?: number
  limit?: number
  sortBy?: 'name' | 'sku' | 'createdAt' | 'sellingPrice'
  sortOrder?: 'asc' | 'desc'
}

export interface ProductListResponse {
  products: Product[]
  total: number
  page: number
  limit: number
  totalPages: number
}

// ============================================
// PRODUCT VIEW TYPES
// ============================================

export interface ProductDetailView extends Product {
  variations: (ProductVariation & {
    variationLocationDetails: (VariationLocationDetail & {
      location?: BusinessLocation
    })[]
  })[]
  comboProducts?: (ComboProduct & {
    childProduct: Product
  })[]
  totalStock: number
  stockByLocation: {
    locationId: number
    locationName: string
    quantity: number
  }[]
}

// ============================================
// API REQUEST/RESPONSE TYPES
// ============================================

export interface CreateProductRequest {
  name: string
  type: 'single' | 'variable' | 'combo'
  categoryId?: number
  subCategoryId?: number
  brandId?: number
  unitId?: number
  taxId?: number
  taxType?: 'inclusive' | 'exclusive'
  sku?: string
  barcodeType?: string
  description?: string
  productDescription?: string
  image?: string
  brochure?: string
  enableStock?: boolean
  alertQuantity?: number
  purchasePrice?: number
  sellingPrice?: number
  weight?: number
  preparationTime?: number
  enableProductInfo?: boolean
  notForSelling?: boolean
  variations?: CreateProductVariationRequest[]
  variationSkuType?: 'with_variation' | 'with_out_variation'
  comboItems?: CreateComboItemRequest[]
}

export interface CreateProductVariationRequest {
  id?: number
  name: string
  sku?: string
  purchasePrice: number
  sellingPrice: number
  isDefault?: boolean
  subSku?: string
  unitId?: number
}

export interface CreateComboItemRequest {
  productId: number
  quantity: number
}

export interface UpdateProductRequest extends CreateProductRequest {
  // All fields are the same as create, but product ID comes from URL params
}

export interface ProductActionResponse {
  success: boolean
  message: string
  data?: any
}
