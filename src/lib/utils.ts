import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Format a number as Philippine Peso currency with commas
 * @param amount - The number to format
 * @param decimals - Number of decimal places (default: 2)
 * @returns Formatted string with commas (e.g., "15,330.00")
 */
export function formatCurrency(amount: number, decimals: number = 2): string {
  return amount.toLocaleString('en-PH', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  })
}
