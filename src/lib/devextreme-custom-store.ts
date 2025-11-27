import CustomStore from 'devextreme/data/custom_store'

// Minimum characters required for text filters to be applied
const MIN_FILTER_CHARS = 4

/**
 * Check if a filter value meets the minimum character requirement
 * Returns true if filter should be applied, false if it should be skipped
 */
function shouldApplyFilter(filterValue: any): boolean {
  if (filterValue === null || filterValue === undefined) return false
  if (typeof filterValue === 'string') {
    return filterValue.length === 0 || filterValue.length >= MIN_FILTER_CHARS
  }
  // Non-string values (numbers, booleans, dates) always apply
  return true
}

/**
 * Recursively process filter array to remove filters that don't meet minimum character requirement
 * Returns null if all filters are removed, otherwise returns filtered array
 */
function processFilters(filter: any): any {
  if (!filter) return null
  if (!Array.isArray(filter)) return filter

  // Simple filter: ["field", "operation", value]
  if (filter.length === 3 && typeof filter[0] === 'string' && typeof filter[1] === 'string') {
    const value = filter[2]
    if (!shouldApplyFilter(value)) {
      return null
    }
    return filter
  }

  // Complex filter with AND/OR: [filter1, "and"/"or", filter2, ...]
  const processedConditions: any[] = []
  let operator: string | null = null

  for (const item of filter) {
    if (typeof item === 'string' && (item === 'and' || item === 'or')) {
      operator = item
    } else if (Array.isArray(item)) {
      const processed = processFilters(item)
      if (processed !== null) {
        processedConditions.push(processed)
      }
    }
  }

  // If no conditions remain, return null
  if (processedConditions.length === 0) {
    return null
  }

  // If only one condition remains, return it directly
  if (processedConditions.length === 1) {
    return processedConditions[0]
  }

  // Rebuild filter array with operator
  const result: any[] = []
  processedConditions.forEach((condition, index) => {
    result.push(condition)
    if (index < processedConditions.length - 1 && operator) {
      result.push(operator)
    }
  })

  return result
}

/**
 * Creates a DevExtreme CustomStore with server-side operations
 * Supports pagination, filtering, sorting, and searching
 *
 * @param apiEndpoint - The API endpoint to fetch data from (e.g., '/api/products/devextreme')
 * @param options - Optional configuration
 * @returns CustomStore instance
 */
export function createDevExtremeCustomStore(
  apiEndpoint: string,
  options?: {
    key?: string
    onLoading?: () => void
    onLoaded?: () => void
    onError?: (error: any) => void
    minFilterChars?: number // Optional override for minimum filter characters
  }
) {
  return new CustomStore({
    key: options?.key || 'id',

    load: async (loadOptions) => {
      try {
        options?.onLoading?.()

        // Build query parameters from loadOptions
        const params = new URLSearchParams()

        // Pagination
        if (loadOptions.skip !== undefined) {
          params.append('skip', loadOptions.skip.toString())
        }
        if (loadOptions.take !== undefined) {
          params.append('take', loadOptions.take.toString())
        }

        // Sorting
        if (loadOptions.sort) {
          const sortInfo = Array.isArray(loadOptions.sort) ? loadOptions.sort[0] : loadOptions.sort
          if (sortInfo) {
            params.append('sort', sortInfo.selector)
            params.append('sortOrder', sortInfo.desc ? 'desc' : 'asc')
          }
        }

        // Searching - apply minimum character requirement
        if (loadOptions.searchValue) {
          const searchValue = loadOptions.searchValue.toString()
          // Only apply search if empty (clearing) or meets minimum character requirement
          if (searchValue.length === 0 || searchValue.length >= (options?.minFilterChars ?? MIN_FILTER_CHARS)) {
            params.append('searchValue', searchValue)
            if (loadOptions.searchExpr) {
              params.append('searchExpr', loadOptions.searchExpr.toString())
            }
            if (loadOptions.searchOperation) {
              params.append('searchOperation', loadOptions.searchOperation.toString())
            }
          }
        }

        // Filtering - process to remove filters that don't meet minimum character requirement
        if (loadOptions.filter) {
          const processedFilter = processFilters(loadOptions.filter)
          if (processedFilter !== null) {
            params.append('filter', JSON.stringify(processedFilter))
          }
        }

        // Make API request
        const response = await fetch(`${apiEndpoint}?${params.toString()}`)

        if (!response.ok) {
          throw new Error(`API request failed: ${response.statusText}`)
        }

        const result = await response.json()

        options?.onLoaded?.()

        // Return data in DevExtreme format
        return {
          data: result.data || [],
          totalCount: result.totalCount || 0
        }
      } catch (error) {
        console.error('CustomStore load error:', error)
        options?.onError?.(error)
        throw error
      }
    },

    // Optional: Implement byKey for details
    byKey: async (key) => {
      try {
        const response = await fetch(`${apiEndpoint}/${key}`)
        if (!response.ok) {
          throw new Error(`API request failed: ${response.statusText}`)
        }
        const result = await response.json()
        return result.data || result
      } catch (error) {
        console.error('CustomStore byKey error:', error)
        options?.onError?.(error)
        throw error
      }
    }
  })
}

/**
 * Creates a simple in-memory CustomStore for small datasets
 * Useful for local filtering/sorting without server calls
 *
 * @param data - Array of data items
 * @param key - Unique key field
 * @returns CustomStore instance
 */
export function createLocalCustomStore<T extends Record<string, any>>(
  data: T[],
  key: keyof T = 'id' as keyof T
) {
  return new CustomStore({
    key: key as string,
    loadMode: 'raw',
    load: () => Promise.resolve(data),
    byKey: (keyValue) => {
      const item = data.find((item) => item[key] === keyValue)
      return Promise.resolve(item)
    }
  })
}

/**
 * Debounce function for search inputs
 * Delays execution until user stops typing
 *
 * @param func - Function to debounce
 * @param delay - Delay in milliseconds (default: 300ms)
 * @returns Debounced function
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  delay: number = 300
): (...args: Parameters<T>) => void {
  let timeoutId: NodeJS.Timeout

  return function debounced(...args: Parameters<T>) {
    clearTimeout(timeoutId)
    timeoutId = setTimeout(() => {
      func(...args)
    }, delay)
  }
}
