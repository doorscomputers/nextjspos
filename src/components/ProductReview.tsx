'use client'

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
  const profitMargin = product.currentPrice > 0
    ? ((product.currentPrice - product.costPrice) / product.currentPrice) * 100
    : 0

  const priceChange = 0 // This will be calculated when user enters new price

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

        {/* Pricing Information */}
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Current Selling Price
            </label>
            <div className="text-2xl font-bold text-green-600 dark:text-green-400">
              ₱{product.currentPrice.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Current price that will be updated
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Cost Price
            </label>
            <div className="text-lg text-gray-900 dark:text-gray-100">
              ₱{product.costPrice.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Purchase cost (for reference)
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Current Profit Margin
            </label>
            <div className={`text-lg font-semibold ${
              profitMargin > 30 ? 'text-green-600 dark:text-green-400' :
              profitMargin > 15 ? 'text-green-500' :
              profitMargin > 0 ? 'text-yellow-600 dark:text-yellow-400' :
              'text-red-600 dark:text-red-400'
            }`}>
              {profitMargin.toFixed(2)}%
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              {(product.currentPrice - product.costPrice).toFixed(2)} profit per unit
            </p>
          </div>
        </div>
      </div>

      {/* Product Summary */}
      <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
        <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
          <h4 className="font-medium text-blue-900 dark:text-blue-100 mb-2">
            📊 Product Summary
          </h4>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <div className="text-gray-600 dark:text-gray-400">Profit/Unit</div>
              <div className="font-semibold text-gray-900 dark:text-gray-100">
                ₱{(product.currentPrice - product.costPrice).toFixed(2)}
              </div>
            </div>
            <div>
              <div className="text-gray-600 dark:text-gray-400">Margin</div>
              <div className={`font-semibold ${
                profitMargin > 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
              }`}>
                {profitMargin.toFixed(2)}%
              </div>
            </div>
            <div>
              <div className="text-gray-600 dark:text-gray-400">Markup</div>
              <div className="font-semibold text-gray-900 dark:text-gray-100">
                {product.costPrice > 0 ?
                  (((product.currentPrice - product.costPrice) / product.costPrice) * 100).toFixed(2) + '%'
                  : 'N/A'
                }
              </div>
            </div>
            <div>
              <div className="text-gray-600 dark:text-gray-400">Status</div>
              <div className="font-semibold text-blue-600 dark:text-blue-400">
                Ready to Update
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Help Text */}
      <div className="mt-4 text-sm text-gray-600 dark:text-gray-400">
        <p>
          📝 <strong>Next Step:</strong> Select the location(s) where you want to update the price, then enter the new price in Step 4.
        </p>
        <p className="mt-1">
          📱 <strong>Telegram Notification:</strong> A notification will be sent to the Telegram group when the price is updated, showing the old price, new price, user who made the change, and location.
        </p>
      </div>
    </div>
  )
}