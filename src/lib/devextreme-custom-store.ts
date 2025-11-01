import CustomStore from 'devextreme/data/custom_store'

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

        // Searching
        if (loadOptions.searchValue) {
          params.append('searchValue', loadOptions.searchValue.toString())
          if (loadOptions.searchExpr) {
            params.append('searchExpr', loadOptions.searchExpr.toString())
          }
          if (loadOptions.searchOperation) {
            params.append('searchOperation', loadOptions.searchOperation.toString())
          }
        }

        // Filtering
        if (loadOptions.filter) {
          params.append('filter', JSON.stringify(loadOptions.filter))
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
