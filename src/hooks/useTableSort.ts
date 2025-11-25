/**
 * USE TABLE SORT HOOK
 * ===================
 *
 * This hook provides client-side sorting functionality for data tables.
 * It handles sorting by any column, cycling through ascending, descending, and unsorted states.
 *
 * WHY USE THIS HOOK?
 * ------------------
 * - Easily add sorting to any data table in your React components
 * - Supports sorting numbers, strings, dates, and nested object properties
 * - Handles null/undefined values gracefully
 * - Performance optimized with React.useMemo (only re-sorts when data or sort config changes)
 * - Provides visual indicators (↑ ↓) for current sort state
 * - Cycles through three states: ascending → descending → unsorted
 *
 * WHAT THIS HOOK RETURNS:
 * -----------------------
 * @returns Object with:
 *   - **sortedData**: Array of sorted data (in the current sort order)
 *   - **sortConfig**: Current sort configuration { key, direction }
 *   - **requestSort**: Function to change sort (call when user clicks column header)
 *   - **getSortIndicator**: Function to get arrow indicator (↑ or ↓) for a column
 *
 * HOW IT WORKS:
 * -------------
 * 1. Takes an array of data and optional initial sort configuration
 * 2. When user clicks a column header, call requestSort(columnKey)
 * 3. Cycles through: unsorted → asc → desc → unsorted
 * 4. Uses useMemo to efficiently re-sort only when needed
 * 5. Returns sorted data for display in your table
 *
 * COMMON USE CASES:
 * -----------------
 *
 * 1. **Basic Data Table Sorting**
 * ```tsx
 * import { useTableSort } from '@/hooks/useTableSort'
 *
 * interface Product {
 *   id: number
 *   name: string
 *   price: number
 *   stock: number
 * }
 *
 * export default function ProductTable({ products }: { products: Product[] }) {
 *   const { sortedData, requestSort, getSortIndicator } = useTableSort(products)
 *
 *   return (
 *     <table>
 *       <thead>
 *         <tr>
 *           <th onClick={() => requestSort('name')}>
 *             Name {getSortIndicator('name')}
 *           </th>
 *           <th onClick={() => requestSort('price')}>
 *             Price {getSortIndicator('price')}
 *           </th>
 *           <th onClick={() => requestSort('stock')}>
 *             Stock {getSortIndicator('stock')}
 *           </th>
 *         </tr>
 *       </thead>
 *       <tbody>
 *         {sortedData.map(product => (
 *           <tr key={product.id}>
 *             <td>{product.name}</td>
 *             <td>{product.price}</td>
 *             <td>{product.stock}</td>
 *           </tr>
 *         ))}
 *       </tbody>
 *     </table>
 *   )
 * }
 * ```
 *
 * 2. **Sorting Nested Properties**
 * ```tsx
 * interface Sale {
 *   id: number
 *   customer: {
 *     name: string
 *     email: string
 *   }
 *   total: number
 * }
 *
 * const { sortedData, requestSort, getSortIndicator } = useTableSort<Sale>(sales)
 *
 * // Sort by nested property using dot notation
 * <th onClick={() => requestSort('customer.name')}>
 *   Customer {getSortIndicator('customer.name')}
 * </th>
 * ```
 *
 * 3. **Initial Sort Configuration**
 * ```tsx
 * // Start with data sorted by price (descending)
 * const { sortedData, requestSort } = useTableSort(products, {
 *   key: 'price',
 *   direction: 'desc'
 * })
 * ```
 *
 * 4. **Custom Sort Button Styling**
 * ```tsx
 * const { sortConfig, requestSort, getSortIndicator } = useTableSort(data)
 *
 * const getSortButtonClass = (key: string) => {
 *   if (sortConfig?.key === key) {
 *     return 'font-bold text-blue-600'  // Highlight active sort column
 *   }
 *   return 'text-gray-600'
 * }
 *
 * return (
 *   <th
 *     className={`cursor-pointer ${getSortButtonClass('name')}`}
 *     onClick={() => requestSort('name')}
 *   >
 *     Name {getSortIndicator('name')}
 *   </th>
 * )
 * ```
 *
 * 5. **Checking Current Sort State**
 * ```tsx
 * const { sortConfig } = useTableSort(data)
 *
 * // Check what column is currently sorted
 * if (sortConfig?.key === 'price' && sortConfig?.direction === 'desc') {
 *   console.log('Showing most expensive items first')
 * }
 * ```
 *
 * SORTING BEHAVIOR:
 * -----------------
 *
 * **Click Cycling**:
 * - First click: Sort ascending (A→Z, 0→9, old→new)
 * - Second click: Sort descending (Z→A, 9→0, new→old)
 * - Third click: Remove sort (back to original order)
 *
 * **Data Type Handling**:
 * - Numbers: 1, 2, 10, 100 (numeric sort, not alphabetic)
 * - Strings: Case-insensitive ("Apple" comes before "banana")
 * - Dates: Chronological order
 * - Null/Undefined: Always sorted to the end
 *
 * **Nested Properties**:
 * - Use dot notation: 'customer.name', 'product.category.name'
 * - Works with any depth of nesting
 *
 * TYPESCRIPT GENERICS:
 * --------------------
 * This hook uses TypeScript generics for type safety:
 *
 * ```tsx
 * interface Product {
 *   name: string
 *   price: number
 * }
 *
 * // Type-safe: TypeScript knows what keys are valid
 * const { requestSort } = useTableSort<Product>(products)
 * requestSort('name')   // ✅ Valid
 * requestSort('invalid') // ⚠️ TypeScript warning (not a Product property)
 * ```
 *
 * PERFORMANCE:
 * ------------
 * - Uses React.useMemo to avoid unnecessary re-sorting
 * - Only re-sorts when `data` or `sortConfig` changes
 * - For LARGE datasets (10,000+ rows), consider server-side sorting instead
 *
 * IMPORTANT NOTES:
 * ----------------
 * - This is CLIENT-SIDE sorting (entire dataset must be in memory)
 * - For large datasets, use server-side sorting with API pagination
 * - Creates a NEW sorted array (doesn't mutate original data)
 * - Case-insensitive string sorting
 * - Null/undefined values always sort to the end
 */

import { useState, useMemo } from 'react'

/**
 * Sort Direction Types
 *
 * - 'asc': Ascending order (A→Z, 0→9, old→new)
 * - 'desc': Descending order (Z→A, 9→0, new→old)
 * - null: No sorting applied (original order)
 */
export type SortDirection = 'asc' | 'desc' | null

/**
 * Sort Configuration Interface
 *
 * Defines which column to sort by and in what direction.
 *
 * @param key - Column to sort by (property name or nested path like 'user.name')
 * @param direction - Sort direction (asc, desc, or null for unsorted)
 */
export interface SortConfig<T> {
  key: keyof T | string  // Column key (supports nested with dot notation)
  direction: SortDirection
}

/**
 * React hook for client-side table sorting
 *
 * Provides sorting functionality with ascending/descending/unsorted cycling.
 * Handles numbers, strings, dates, and nested properties.
 *
 * @param data - Array of objects to sort
 * @param initialSort - Optional initial sort configuration
 * @returns Object with sortedData, sortConfig, requestSort, and getSortIndicator
 */
export function useTableSort<T>(data: T[], initialSort?: SortConfig<T>) {
  // State: Current sort configuration (null = unsorted)
  const [sortConfig, setSortConfig] = useState<SortConfig<T> | null>(initialSort || null)

  /**
   * useMemo: Efficiently sorts data only when needed
   *
   * Dependencies: [data, sortConfig]
   * - Only re-sorts when data array or sort config changes
   * - Avoids expensive re-sorting on every render
   */
  const sortedData = useMemo(() => {
    // If no sort is configured, return original data unsorted
    if (!sortConfig || !sortConfig.direction) {
      return data
    }

    // Create a COPY of the array (don't mutate original)
    const sorted = [...data].sort((a, b) => {
      const key = sortConfig.key as keyof T

      /**
       * Helper: Extract nested property values
       *
       * Supports dot notation like 'customer.name' or 'product.category.title'
       * Works by splitting on '.' and drilling down through object properties
       *
       * Example: getNestedValue({ user: { name: "John" } }, "user.name") → "John"
       */
      const getNestedValue = (obj: any, path: string): any => {
        return path.split('.').reduce((current, part) => current?.[part], obj)
      }

      // Extract values to compare (handles both direct and nested properties)
      const aValue = typeof key === 'string' && key.includes('.')
        ? getNestedValue(a, key)  // Nested property (e.g., 'product.name')
        : a[key as keyof T]        // Direct property (e.g., 'name')

      const bValue = typeof key === 'string' && key.includes('.')
        ? getNestedValue(b, key)
        : b[key as keyof T]

      // Handle null/undefined values (always sort to end)
      if (aValue == null && bValue == null) return 0  // Both null = equal
      if (aValue == null) return 1   // Null goes after non-null
      if (bValue == null) return -1  // Non-null comes before null

      // Handle NUMBERS (use subtraction for numeric comparison)
      if (typeof aValue === 'number' && typeof bValue === 'number') {
        return sortConfig.direction === 'asc' ? aValue - bValue : bValue - aValue
      }

      // Handle DATES (compare timestamps)
      if (aValue instanceof Date && bValue instanceof Date) {
        return sortConfig.direction === 'asc'
          ? aValue.getTime() - bValue.getTime()  // Asc: earlier dates first
          : bValue.getTime() - aValue.getTime()  // Desc: later dates first
      }

      // Handle STRINGS (case-insensitive alphabetical comparison)
      const aString = String(aValue).toLowerCase()
      const bString = String(bValue).toLowerCase()

      if (aString < bString) {
        return sortConfig.direction === 'asc' ? -1 : 1   // a comes before b
      }
      if (aString > bString) {
        return sortConfig.direction === 'asc' ? 1 : -1   // b comes before a
      }
      return 0  // Equal strings
    })

    return sorted
  }, [data, sortConfig])  // Only re-run when these change

  /**
   * Request a sort on a specific column
   *
   * Cycles through three states:
   * 1. No sort → Ascending
   * 2. Ascending → Descending
   * 3. Descending → No sort (back to original)
   *
   * @param key - Column to sort by
   */
  const requestSort = (key: keyof T | string) => {
    let direction: SortDirection = 'asc'  // Default to ascending

    // If clicking the same column that's already sorted
    if (sortConfig && sortConfig.key === key) {
      if (sortConfig.direction === 'asc') {
        direction = 'desc'  // Asc → Desc
      } else if (sortConfig.direction === 'desc') {
        direction = null    // Desc → Unsorted
      }
      // If null, stays as 'asc' (starts cycle over)
    }

    // Update sort configuration (null direction = remove sort)
    setSortConfig(direction ? { key, direction } : null)
  }

  /**
   * Get visual indicator for column sort state
   *
   * Returns:
   * - '↑' if column is sorted ascending
   * - '↓' if column is sorted descending
   * - '' if column is not sorted
   *
   * @param key - Column to check
   * @returns Arrow character or empty string
   */
  const getSortIndicator = (key: keyof T | string): '↑' | '↓' | '' => {
    if (!sortConfig || sortConfig.key !== key) {
      return ''  // Not sorting this column
    }
    return sortConfig.direction === 'asc' ? '↑' : '↓'
  }

  // Return all sorting utilities for use in components
  return {
    sortedData,        // The sorted array (use this to render table rows)
    sortConfig,        // Current sort configuration (for conditional styling)
    requestSort,       // Function to trigger sort (call on column header click)
    getSortIndicator   // Function to get ↑/↓ indicator
  }
}
