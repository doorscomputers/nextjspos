/**
 * USE BUSINESS HOOK
 * =================
 *
 * This hook fetches and provides access to the current business's settings and configuration.
 * Since this is a multi-tenant POS system, each business has its own settings (currency, tax info,
 * accounting preferences, branding, etc.).
 *
 * WHAT IS "BUSINESS" IN THIS SYSTEM?
 * -----------------------------------
 * A "Business" represents a company/organization using the POS system. Each business:
 * - Has its own set of users, products, sales, and locations
 * - Operates independently from other businesses (multi-tenant isolation)
 * - Has custom settings like currency, tax configuration, fiscal year, etc.
 *
 * WHY USE THIS HOOK?
 * ------------------
 * - Access company-wide settings anywhere in your React components
 * - Display business name, logo, currency in the UI
 * - Use tax configuration for calculations
 * - Apply business-specific defaults (profit margin, discounts, etc.)
 * - Show loading state while fetching settings
 * - Handle errors gracefully
 *
 * WHAT THIS HOOK RETURNS:
 * -----------------------
 * @returns Object with:
 *   - **business**: Full business settings object (null until loaded)
 *   - **loading**: Boolean - true while fetching, false when done
 *   - **error**: String with error message, or null if no error
 *   - **companyName**: Convenience accessor for business.name (empty string if not loaded)
 *   - **refetch**: Function to manually reload business settings
 *
 * HOW IT WORKS:
 * -------------
 * 1. On component mount, automatically fetches business settings from API
 * 2. Makes GET request to /api/business/settings
 * 3. Stores result in React state (business, loading, error)
 * 4. Re-renders component when data arrives or error occurs
 *
 * COMMON USE CASES:
 * -----------------
 *
 * 1. **Display Company Name in Header**
 * ```tsx
 * import { useBusiness } from '@/hooks/useBusiness'
 *
 * export default function Header() {
 *   const { companyName, loading } = useBusiness()
 *
 *   return (
 *     <header>
 *       <h1>{loading ? 'Loading...' : companyName}</h1>
 *     </header>
 *   )
 * }
 * ```
 *
 * 2. **Show Company Logo**
 * ```tsx
 * const { business } = useBusiness()
 *
 * return (
 *   <div>
 *     {business?.logo && (
 *       <img src={business.logo} alt={business.name} />
 *     )}
 *   </div>
 * )
 * ```
 *
 * 3. **Use Currency Settings**
 * ```tsx
 * const { business } = useBusiness()
 *
 * const formatPrice = (amount: number) => {
 *   if (!business) return ''
 *   return `${business.currency.symbol}${amount.toFixed(2)}`
 * }
 *
 * return <div>Total: {formatPrice(150.00)}</div>  // "₱150.00"
 * ```
 *
 * 4. **Apply Tax Configuration**
 * ```tsx
 * const { business } = useBusiness()
 *
 * return (
 *   <div>
 *     <p>{business?.taxLabel1}: {business?.taxNumber1}</p>
 *     {business?.taxLabel2 && (
 *       <p>{business.taxLabel2}: {business.taxNumber2}</p>
 *     )}
 *   </div>
 * )
 * ```
 *
 * 5. **Handle Loading and Errors**
 * ```tsx
 * const { business, loading, error } = useBusiness()
 *
 * if (loading) return <LoadingSpinner />
 * if (error) return <ErrorMessage message={error} />
 * if (!business) return <div>No business data available</div>
 *
 * return <BusinessDashboard business={business} />
 * ```
 *
 * 6. **Manually Refresh Settings**
 * ```tsx
 * const { business, refetch } = useBusiness()
 *
 * const handleSaveSettings = async () => {
 *   await updateBusinessSettings(...)
 *   refetch()  // Reload settings to show updated values
 * }
 * ```
 *
 * BUSINESS SETTINGS EXPLAINED:
 * -----------------------------
 * - **name**: Company name displayed throughout the app
 * - **currency**: Which currency to use (₱ PHP, $ USD, etc.)
 * - **taxNumber1/taxLabel1**: Primary tax ID (e.g., "TIN" in Philippines)
 * - **taxNumber2/taxLabel2**: Secondary tax ID (optional)
 * - **defaultProfitPercent**: Default markup percentage for pricing
 * - **timeZone**: Company timezone for date/time display
 * - **fyStartMonth**: Fiscal year start month (1=January, 4=April, etc.)
 * - **accountingMethod**: "accrual" or "cash" accounting
 * - **defaultSalesDiscount**: Default discount percentage
 * - **sellPriceTax**: "includes" or "excludes" - does selling price include tax?
 * - **logo**: URL to company logo image
 * - **skuPrefix**: Prefix for auto-generated SKUs (e.g., "PROD-")
 * - **skuFormat**: SKU generation format
 * - **enableTooltip**: Show help tooltips in the UI?
 *
 * IMPORTANT NOTES:
 * ----------------
 * - This hook uses React's useState and useEffect (must be used in components, not outside)
 * - Data is fetched ONCE when component mounts (cached in component state)
 * - To reload data, call the `refetch()` function
 * - Always check `loading` before using `business` data
 * - Always handle the `error` state to show user-friendly messages
 */

import { useState, useEffect } from 'react'

/**
 * Business Settings Interface
 *
 * This defines the structure of business configuration data.
 * All these fields come from the Business table in the database.
 */
interface Business {
  id: number                           // Unique business identifier
  name: string                         // Company name
  currencyId: number                   // Which currency this business uses
  currency: {                          // Currency details (nested object)
    id: number
    name: string                       // Full name (e.g., "Philippine Peso")
    code: string                       // ISO code (e.g., "PHP")
    symbol: string                     // Symbol (e.g., "₱")
  }
  startDate: string | null             // Business establishment date
  taxNumber1: string                   // Primary tax registration number
  taxLabel1: string                    // Label for tax number (e.g., "TIN")
  taxNumber2: string | null            // Secondary tax number (optional)
  taxLabel2: string | null             // Label for secondary tax number
  defaultProfitPercent: number         // Default markup percentage
  timeZone: string                     // Business timezone
  fyStartMonth: number                 // Fiscal year start month (1-12)
  accountingMethod: string             // "accrual" or "cash"
  defaultSalesDiscount: number | null  // Default discount %
  sellPriceTax: string                 // "includes" or "excludes"
  logo: string | null                  // Logo image URL
  skuPrefix: string | null             // SKU prefix for products
  skuFormat: string                    // SKU generation format
  enableTooltip: boolean               // Enable UI tooltips?
}

/**
 * React hook for fetching and accessing current business settings
 *
 * Automatically loads business data when component mounts.
 * Provides loading/error states and refetch capability.
 */
export function useBusiness() {
  // State: Business data (null until loaded)
  const [business, setBusiness] = useState<Business | null>(null)

  // State: Loading flag (true during API call)
  const [loading, setLoading] = useState(true)

  // State: Error message (null if no error)
  const [error, setError] = useState<string | null>(null)

  // Effect: Fetch business data when component mounts
  // The empty dependency array [] means this runs ONCE on mount
  useEffect(() => {
    fetchBusiness()
  }, [])

  /**
   * Fetch business settings from API
   *
   * This function:
   * 1. Sets loading to true
   * 2. Makes API request to /api/business/settings
   * 3. Updates state based on response (success or error)
   * 4. Sets loading to false when done
   */
  const fetchBusiness = async () => {
    try {
      setLoading(true)

      // Make API request to get business settings
      const res = await fetch('/api/business/settings')

      if (res.ok) {
        // Success: Parse JSON and update business state
        const data = await res.json()
        setBusiness(data.business)
      } else {
        // HTTP error: Parse error message and update error state
        const errorData = await res.json()
        setError(errorData.error || 'Failed to fetch business settings')
      }
    } catch (err) {
      // Network error or other exception
      console.error('Error fetching business:', err)
      setError('Failed to fetch business settings')
    } finally {
      // Always set loading to false when done (success or failure)
      setLoading(false)
    }
  }

  // Return all the data and functions the component needs
  return {
    business,           // Full business object
    loading,            // Is data being fetched?
    error,              // Error message (if any)
    companyName: business?.name || '', // Convenient access to company name
    refetch: fetchBusiness  // Function to reload settings
  }
}
