'use client'

import { useState } from 'react'
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

interface PriceUpdateFormProps {
  product: Product
  selectedLocationCount: number
  onPriceUpdate: (newPrice: number) => void
  updating: boolean
}

export default function PriceUpdateForm({
  product,
  selectedLocationCount,
  onPriceUpdate,
  updating
}: PriceUpdateFormProps) {
  const [newPrice, setNewPrice] = useState('')
  const [showConfirmation, setShowConfirmation] = useState(false)

  const currentPrice = product.currentPrice
  const costPrice = product.costPrice

  const handlePriceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value || ''

    // Only allow numbers and one decimal point
    // Remove any characters that are not digits or decimal point
    value = value.replace(/[^0-9.]/g, '')

    // Ensure only one decimal point
    const parts = value.split('.')
    if (parts.length > 2) {
      value = parts[0] + '.' + parts.slice(1).join('')
    }

    // Limit to 2 decimal places for currency
    if (parts.length === 2 && parts[1].length > 2) {
      value = parts[0] + '.' + parts[1].substring(0, 2)
    }

    // Don't allow zero as a valid price
    if (value === '0' || value === '0.00' || value === '0.0') {
      value = ''
    }

    // Remove leading zeros (but keep one zero if it's "0.something")
    if (value.length > 1 && value.startsWith('0') && !value.startsWith('0.')) {
      value = value.replace(/^0+/, '')
    }

    // Don't allow negative numbers
    value = value.replace(/^-+/, '')

    setNewPrice(value)
  }

  const getPriceDifference = () => {
    const newPriceNum = parseFloat(newPrice) || 0
    return newPriceNum - currentPrice
  }

  const getPricePercentage = () => {
    if (currentPrice === 0) return 0
    const newPriceNum = parseFloat(newPrice) || 0
    return ((newPriceNum - currentPrice) / currentPrice) * 100
  }

  const getNewProfitMargin = () => {
    const newPriceNum = parseFloat(newPrice) || 0
    if (newPriceNum === 0) return 0
    return ((newPriceNum - costPrice) / newPriceNum) * 100
  }

  const handleUpdatePrice = () => {
    const newPriceNum = parseFloat(newPrice)

    // Comprehensive validation
    if (!newPrice || newPrice.trim() === '') {
      alert('Please enter a price')
      return
    }

    if (isNaN(newPriceNum) || newPriceNum <= 0) {
      alert('Please enter a valid price greater than 0')
      return
    }

    // Check if the price is reasonable (not too high)
    if (newPriceNum > 1000000) {
      alert('Price seems too high. Please enter a reasonable amount.')
      return
    }

    // Allow updating even if price matches current
    // This lets users force-apply prices to all locations
    setShowConfirmation(true)
  }

  const confirmUpdate = () => {
    const newPriceNum = parseFloat(newPrice)
    onPriceUpdate(newPriceNum)
    setShowConfirmation(false)
    setNewPrice('')
  }

  const priceDifference = getPriceDifference()
  const pricePercentage = getPricePercentage()
  const newProfitMargin = getNewProfitMargin()

  return (
    <div className="space-y-6">
      {/* Current Price Reference */}
      <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4">
        <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-3">
          Current Price Reference
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <div className="text-sm text-gray-600 dark:text-gray-400">Current Price</div>
            <div className="text-xl font-bold text-gray-900 dark:text-gray-100">
              ₱{formatCurrency(currentPrice)}
            </div>
          </div>
          <div>
            <div className="text-sm text-gray-600 dark:text-gray-400">Cost Price</div>
            <div className="text-xl font-bold text-gray-900 dark:text-gray-100">
              ₱{formatCurrency(costPrice)}
            </div>
          </div>
          <div>
            <div className="text-sm text-gray-600 dark:text-gray-400">Current Margin</div>
            <div className={`text-xl font-bold ${
              ((currentPrice - costPrice) / currentPrice * 100) > 0
                ? 'text-green-600 dark:text-green-400'
                : 'text-red-600 dark:text-red-400'
            }`}>
              {((currentPrice - costPrice) / currentPrice * 100).toFixed(2)}%
            </div>
          </div>
        </div>
      </div>

      {/* New Price Input */}
      <div className="space-y-2">
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
          Enter New Price
        </label>
        <div className="relative">
          <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500 dark:text-gray-400 text-lg">
            ₱
          </span>
          <input
            type="number"
            value={newPrice}
            onChange={handlePriceChange}
            placeholder="0.00"
            step="0.01"
            min="0"
            className="w-full pl-8 pr-4 py-3 text-lg border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            disabled={updating}
          />
        </div>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Enter the new selling price for this product
        </p>
      </div>

      {/* Price Change Preview */}
      {newPrice && parseFloat(newPrice) > 0 && (
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
          <h4 className="font-medium text-blue-900 dark:text-blue-100 mb-3">
            📊 Price Change Preview
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <div className="text-sm text-blue-700 dark:text-blue-300">Change Amount</div>
              <div className={`text-xl font-bold ${
                priceDifference > 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
              }`}>
                {priceDifference > 0 ? '+' : ''}₱{formatCurrency(priceDifference)}
              </div>
            </div>
            <div>
              <div className="text-sm text-blue-700 dark:text-blue-300">Change Percentage</div>
              <div className={`text-xl font-bold ${
                pricePercentage > 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
              }`}>
                {pricePercentage > 0 ? '+' : ''}{pricePercentage.toFixed(2)}%
              </div>
            </div>
            <div>
              <div className="text-sm text-blue-700 dark:text-blue-300">New Profit Margin</div>
              <div className={`text-xl font-bold ${
                newProfitMargin > 30 ? 'text-green-600 dark:text-green-400' :
                newProfitMargin > 15 ? 'text-green-500' :
                newProfitMargin > 0 ? 'text-yellow-600 dark:text-yellow-400' :
                'text-red-600 dark:text-red-400'
              }`}>
                {newProfitMargin.toFixed(2)}%
              </div>
            </div>
            <div>
              <div className="text-sm text-blue-700 dark:text-blue-300">New Profit/Unit</div>
              <div className="text-xl font-bold text-blue-600 dark:text-blue-400">
                ₱{formatCurrency(parseFloat(newPrice) - costPrice)}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Same Price Info (non-blocking) */}
      {newPrice && parseFloat(newPrice) === currentPrice && (
        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3 text-sm">
          <div className="flex items-center gap-2 text-amber-800 dark:text-amber-200">
            <span>ℹ️</span>
            <span>
              This price matches the current displayed price. You can still proceed to apply it to all selected locations.
            </span>
          </div>
        </div>
      )}

      {/* Update Button */}
      <div className="flex gap-3">
        <button
          onClick={handleUpdatePrice}
          disabled={!newPrice || parseFloat(newPrice) <= 0 || updating}
          className={`flex-1 px-6 py-3 rounded-lg font-semibold text-white transition-all duration-200 ${
            !newPrice || parseFloat(newPrice) <= 0 || updating
              ? 'bg-gray-400 cursor-not-allowed opacity-50'
              : 'bg-blue-600 hover:bg-blue-700 hover:shadow-lg transform hover:scale-105'
          }`}
        >
          {updating ? (
            <span className="flex items-center justify-center gap-2">
              <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              Updating Price...
            </span>
          ) : (
            <span className="flex items-center justify-center gap-2">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
              </svg>
              Update Price
            </span>
          )}
        </button>

        {newPrice && (
          <button
            onClick={() => setNewPrice('')}
            disabled={updating}
            className="px-6 py-3 rounded-lg font-medium bg-gray-200 text-gray-700 hover:bg-gray-300 transition-colors"
          >
            Clear
          </button>
        )}
      </div>

      {/* Location Count Reminder */}
      <div className="text-center text-sm text-gray-600 dark:text-gray-400">
        This update will apply to <strong>{selectedLocationCount}</strong> location{selectedLocationCount !== 1 ? 's' : ''}
      </div>

      {/* Confirmation Dialog */}
      {showConfirmation && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
              Confirm Price Update
            </h3>

            <div className="space-y-3 mb-6">
              <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4">
                <div className="font-medium text-gray-900 dark:text-gray-100 mb-2">
                  {product.name}
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  SKU: {product.sku}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 text-center">
                <div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">From</div>
                  <div className="font-semibold text-gray-900 dark:text-gray-100">
                    ₱{formatCurrency(currentPrice)}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">To</div>
                  <div className={`font-semibold ${
                    priceDifference > 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
                  }`}>
                    ₱{formatCurrency(parseFloat(newPrice))}
                  </div>
                </div>
              </div>

              <div className="text-center text-sm text-gray-600 dark:text-gray-400">
                This change will be applied to <strong>{selectedLocationCount}</strong> location{selectedLocationCount !== 1 ? 's' : ''}
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowConfirmation(false)}
                className="flex-1 px-4 py-2 rounded-lg font-medium bg-gray-200 text-gray-700 hover:bg-gray-300 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmUpdate}
                className="flex-1 px-4 py-2 rounded-lg font-medium bg-blue-600 text-white hover:bg-blue-700 transition-colors"
              >
                Confirm Update
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Help Text */}
      <div className="text-sm text-gray-600 dark:text-gray-400 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
        <p className="font-medium text-amber-800 dark:text-amber-200 mb-1">
          📱 Telegram Notification:
        </p>
        <p>
          A notification will be sent automatically showing the old price, new price, your name, the time of change, product name, SKU, and the locations where the price was updated.
        </p>
      </div>
    </div>
  )
}