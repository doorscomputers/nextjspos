/**
 * Universal Currency Formatting Utilities
 *
 * Formats currency values without currency symbols for universal use
 * Adds thousand separators for better readability
 */

/**
 * Format a number as currency without symbol
 * @param amount - The amount to format
 * @param decimals - Number of decimal places (default: 2)
 * @returns Formatted string with thousand separators (e.g., "15,999.99")
 */
export function formatCurrency(amount: number | string, decimals: number = 2): string {
  const numAmount = typeof amount === 'string' ? parseFloat(amount) : amount

  if (isNaN(numAmount)) {
    return '0.00'
  }

  // Format with thousand separators and specified decimals
  return numAmount.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })
}

/**
 * Parse a formatted currency string back to a number
 * @param formattedAmount - String like "15,999.99"
 * @returns Numeric value
 */
export function parseCurrency(formattedAmount: string): number {
  // Remove commas and parse
  const cleaned = formattedAmount.replace(/,/g, '')
  return parseFloat(cleaned) || 0
}

/**
 * Format currency for input fields (allows editing)
 * @param amount - The amount to format
 * @returns Formatted string suitable for input fields
 */
export function formatCurrencyInput(amount: number | string): string {
  const numAmount = typeof amount === 'string' ? parseFloat(amount) : amount

  if (isNaN(numAmount) || numAmount === 0) {
    return ''
  }

  return numAmount.toString()
}
