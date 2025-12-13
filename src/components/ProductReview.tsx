'use client'

import { formatCurrency } from '@/lib/currencyUtils'

interface Product {
  id: number
  name: string
  sku: string
  variationName?: string
  currentPrice: number
  costPrice: number
  productVariationId: number
}

interface ProductReviewProps {
  product: Product
}

export default function ProductReview({ product }: ProductReviewProps) {
  return (
    <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Product Information */}
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Product Name
            </label>
            <div className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              {product.name}
            </div>
            {product.variationName && (
              <div className="text-sm text-gray-600 dark:text-gray-400">
                Variation: {product.variationName}
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              SKU
            </label>
            <div className="text-lg font-mono text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-800 px-3 py-2 rounded border border-gray-300 dark:border-gray-600">
              {product.sku}
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Product identifier (read-only)
            </p>
          </div>
        </div>

        {/* Cost Price Information */}
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Cost Price
            </label>
            <div className="text-lg text-gray-900 dark:text-gray-100">
              ₱{formatCurrency(product.costPrice)}
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Purchase cost (for reference)
            </p>
          </div>

          {/* Note about location-specific pricing */}
          <div className="bg-amber-50 dark:bg-amber-900/20 rounded-lg p-4 border border-amber-200 dark:border-amber-800">
            <h4 className="font-medium text-amber-900 dark:text-amber-100 mb-2">
              Location-Specific Pricing
            </h4>
            <p className="text-sm text-amber-800 dark:text-amber-200">
              Selling prices vary by location. To view current prices for all locations,
              visit the <strong>Price Comparison</strong> page under Reports.
            </p>
          </div>
        </div>
      </div>

      {/* Help Text */}
      <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
        <div className="text-sm text-gray-600 dark:text-gray-400">
          <p>
            Select the location(s) where you want to update the price, then enter the new price in Step 4.
          </p>
          <p className="mt-1">
            A notification will be sent to the Telegram group when the price is updated, showing the old price, new price, user who made the change, and location.
          </p>
        </div>
      </div>
    </div>
  )
}