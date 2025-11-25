/**
 * USE CURRENCY HOOK
 * =================
 *
 * This hook provides currency information and formatting utilities for the current business.
 * It fetches the business's configured currency and provides a helper function to format
 * monetary amounts consistently throughout the app.
 *
 * WHY USE THIS HOOK?
 * ------------------
 * - Automatically uses the correct currency for the business (₱ for Philippines, $ for US, etc.)
 * - Provides consistent currency formatting across the entire application
 * - Handles number localization (adds commas for thousands)
 * - Ensures all prices display with exactly 2 decimal places
 * - Falls back to Philippine Peso (₱) if currency can't be loaded
 *
 * WHAT THIS HOOK RETURNS:
 * -----------------------
 * @returns Object with:
 *   - **currencySymbol**: The currency symbol (e.g., "₱", "$", "€")
 *   - **currencyCode**: The ISO currency code (e.g., "PHP", "USD", "EUR")
 *   - **loading**: Boolean - true while fetching currency, false when done
 *   - **formatCurrency**: Function to format a number as currency string
 *
 * HOW IT WORKS:
 * -------------
 * 1. On component mount, fetches business settings from API
 * 2. Extracts currency information (symbol and code)
 * 3. Stores in React state for use in formatCurrency function
 * 4. Defaults to Philippine Peso (₱ PHP) if fetch fails
 *
 * COMMON USE CASES:
 * -----------------
 *
 * 1. **Display Formatted Prices**
 * ```tsx
 * import { useCurrency } from '@/hooks/useCurrency'
 *
 * export default function ProductCard({ price }) {
 *   const { formatCurrency } = useCurrency()
 *
 *   return (
 *     <div>
 *       <p>Price: {formatCurrency(price)}</p>
 *       {/* Displays: "Price: ₱1,250.00" */}
 *     </div>
 *   )
 * }
 * ```
 *
 * 2. **Format Totals in Invoice**
 * ```tsx
 * const { formatCurrency } = useCurrency()
 *
 * const subtotal = 1000
 * const tax = 120
 * const total = subtotal + tax
 *
 * return (
 *   <div>
 *     <p>Subtotal: {formatCurrency(subtotal)}</p>  {/* ₱1,000.00 */}
 *     <p>Tax: {formatCurrency(tax)}</p>            {/* ₱120.00 */}
 *     <p>Total: {formatCurrency(total)}</p>        {/* ₱1,120.00 */}
 *   </div>
 * )
 * ```
 *
 * 3. **Show Currency Symbol Separately**
 * ```tsx
 * const { currencySymbol } = useCurrency()
 *
 * return (
 *   <div>
 *     <span>All prices in {currencySymbol}</span>
 *   </div>
 * )
 * ```
 *
 * 4. **Use Currency Code (for API requests)**
 * ```tsx
 * const { currencyCode } = useCurrency()
 *
 * const sendToPaymentGateway = async (amount) => {
 *   await fetch('/api/payment', {
 *     method: 'POST',
 *     body: JSON.stringify({
 *       amount,
 *       currency: currencyCode  // "PHP", "USD", etc.
 *     })
 *   })
 * }
 * ```
 *
 * 5. **Handle Loading State**
 * ```tsx
 * const { formatCurrency, loading } = useCurrency()
 *
 * if (loading) {
 *   return <div>Loading prices...</div>
 * }
 *
 * return <div>Price: {formatCurrency(100)}</div>
 * ```
 *
 * 6. **Format String Numbers**
 * ```tsx
 * const { formatCurrency } = useCurrency()
 *
 * // Works with both numbers and numeric strings
 * formatCurrency(1500)      // ₱1,500.00
 * formatCurrency("1500")    // ₱1,500.00
 * formatCurrency("1500.50") // ₱1,500.50
 * formatCurrency("invalid") // ₱0.00 (safely handles invalid input)
 * ```
 *
 * FORMATTING EXAMPLES:
 * --------------------
 * The formatCurrency function formats numbers according to these rules:
 *
 * Input          → Output
 * ----------------------------
 * 100            → ₱100.00
 * 1000           → ₱1,000.00
 * 1234.5         → ₱1,234.50
 * 1234.567       → ₱1,234.57 (rounds to 2 decimals)
 * 0              → ₱0.00
 * -500           → ₱-500.00
 * "1500"         → ₱1,500.00 (accepts strings)
 * "abc"          → ₱0.00 (invalid input defaults to 0)
 *
 * IMPORTANT NOTES:
 * ----------------
 * - Always uses 2 decimal places (standard for currency)
 * - Adds thousands separators (commas) for readability
 * - Currency symbol appears BEFORE the amount (₱1,000.00 not 1,000.00₱)
 * - Defaults to Philippine Peso (₱ PHP) if business settings can't be loaded
 * - Number formatting uses 'en-US' locale for consistency
 */

import { useState, useEffect } from 'react'

/**
 * Currency Interface
 *
 * Defines the structure of currency data from the database.
 */
interface Currency {
  id: number      // Database ID
  code: string    // ISO currency code (e.g., "PHP", "USD", "EUR")
  name: string    // Full currency name (e.g., "Philippine Peso")
  symbol: string  // Currency symbol (e.g., "₱", "$", "€")
}

/**
 * Business Interface (partial - only currency-related fields)
 */
interface Business {
  id: number
  name: string
  currency: Currency  // The currency this business uses
}

/**
 * React hook for currency information and formatting
 *
 * Fetches the business's currency settings and provides a formatCurrency
 * helper function for consistent monetary display throughout the app.
 */
export function useCurrency() {
  // State: Currency symbol (defaults to Philippine Peso)
  const [currencySymbol, setCurrencySymbol] = useState('₱')

  // State: Currency code (defaults to PHP)
  const [currencyCode, setCurrencyCode] = useState('PHP')

  // State: Loading flag
  const [loading, setLoading] = useState(true)

  // Effect: Fetch currency settings when component mounts
  useEffect(() => {
    fetchBusinessSettings()
  }, [])

  /**
   * Fetch business settings to get currency information
   *
   * Makes API call to get business data, extracts currency info,
   * and updates state. Keeps defaults if fetch fails.
   */
  const fetchBusinessSettings = async () => {
    try {
      const response = await fetch('/api/business/settings')

      if (response.ok) {
        const data = await response.json()
        const business: Business = data.business

        // If business has currency configured, use it
        if (business?.currency) {
          setCurrencySymbol(business.currency.symbol)
          setCurrencyCode(business.currency.code)
        }
      }
    } catch (error) {
      console.error('Error fetching currency settings:', error)
      // Keep default Philippine Peso (₱ PHP) on error
      // This ensures the app still works even if API is down
    } finally {
      setLoading(false)
    }
  }

  /**
   * Format a number as a currency string
   *
   * Takes a number or numeric string and formats it with:
   * - Currency symbol at the beginning
   * - Thousands separators (commas)
   * - Exactly 2 decimal places
   *
   * @param amount - Number or numeric string to format
   * @returns Formatted currency string (e.g., "₱1,234.56")
   *
   * Examples:
   * - formatCurrency(1000) → "₱1,000.00"
   * - formatCurrency("1500.5") → "₱1,500.50"
   * - formatCurrency("invalid") → "₱0.00"
   */
  const formatCurrency = (amount: number | string): string => {
    // Convert string to number if needed
    const numAmount = typeof amount === 'string' ? parseFloat(amount) : amount

    // If conversion failed (NaN), show 0.00
    if (isNaN(numAmount)) return `${currencySymbol}0.00`

    // Format with locale-specific thousand separators and 2 decimals
    return `${currencySymbol}${numAmount.toLocaleString('en-US', {
      minimumFractionDigits: 2,  // Always show 2 decimals (100 → 100.00)
      maximumFractionDigits: 2,  // Never show more than 2 decimals (100.567 → 100.57)
    })}`
  }

  // Return currency data and formatting function
  return {
    currencySymbol,   // Symbol to display (₱, $, €)
    currencyCode,     // ISO code (PHP, USD, EUR)
    loading,          // Is data being fetched?
    formatCurrency,   // Function to format numbers as currency
  }
}
