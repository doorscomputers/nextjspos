/**
 * Types for Transaction Impact Report
 * Shows what inventory changed after each transaction
 */

export interface ProductImpact {
  productId: number
  productName: string
  sku: string
  variationId: number
  variationName: string
  locationId: number
  locationName: string
  previousQty: number
  changeQty: number
  newQty: number
}

export interface LocationImpact {
  locationId: number
  locationName: string
  type: 'source' | 'destination' | 'single'
  products: ProductImpact[]
}

export interface TransactionImpact {
  transactionType: 'purchase' | 'sale' | 'transfer' | 'adjustment' | 'correction' | 'return'
  transactionId: number | string
  referenceNumber: string
  transactionDate: Date
  locations: LocationImpact[]
  totalProductsAffected: number
  totalUnitsChanged: number
  performedBy?: string
}

export interface ImpactReportResponse {
  success: boolean
  impact?: TransactionImpact
  error?: string
}
