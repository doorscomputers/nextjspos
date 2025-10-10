import { useState, useMemo } from 'react'

export type SortDirection = 'asc' | 'desc' | null

export interface SortConfig<T> {
  key: keyof T | string
  direction: SortDirection
}

export function useTableSort<T>(data: T[], initialSort?: SortConfig<T>) {
  const [sortConfig, setSortConfig] = useState<SortConfig<T> | null>(initialSort || null)

  const sortedData = useMemo(() => {
    if (!sortConfig || !sortConfig.direction) {
      return data
    }

    const sorted = [...data].sort((a, b) => {
      const key = sortConfig.key as keyof T

      // Handle nested keys (e.g., 'product.name')
      const getNestedValue = (obj: any, path: string): any => {
        return path.split('.').reduce((current, part) => current?.[part], obj)
      }

      const aValue = typeof key === 'string' && key.includes('.')
        ? getNestedValue(a, key)
        : a[key as keyof T]

      const bValue = typeof key === 'string' && key.includes('.')
        ? getNestedValue(b, key)
        : b[key as keyof T]

      // Handle null/undefined
      if (aValue == null && bValue == null) return 0
      if (aValue == null) return 1
      if (bValue == null) return -1

      // Handle numbers
      if (typeof aValue === 'number' && typeof bValue === 'number') {
        return sortConfig.direction === 'asc' ? aValue - bValue : bValue - aValue
      }

      // Handle dates
      if (aValue instanceof Date && bValue instanceof Date) {
        return sortConfig.direction === 'asc'
          ? aValue.getTime() - bValue.getTime()
          : bValue.getTime() - aValue.getTime()
      }

      // Handle strings (case-insensitive)
      const aString = String(aValue).toLowerCase()
      const bString = String(bValue).toLowerCase()

      if (aString < bString) {
        return sortConfig.direction === 'asc' ? -1 : 1
      }
      if (aString > bString) {
        return sortConfig.direction === 'asc' ? 1 : -1
      }
      return 0
    })

    return sorted
  }, [data, sortConfig])

  const requestSort = (key: keyof T | string) => {
    let direction: SortDirection = 'asc'

    if (sortConfig && sortConfig.key === key) {
      if (sortConfig.direction === 'asc') {
        direction = 'desc'
      } else if (sortConfig.direction === 'desc') {
        direction = null
      }
    }

    setSortConfig(direction ? { key, direction } : null)
  }

  const getSortIndicator = (key: keyof T | string): '↑' | '↓' | '' => {
    if (!sortConfig || sortConfig.key !== key) {
      return ''
    }
    return sortConfig.direction === 'asc' ? '↑' : '↓'
  }

  return {
    sortedData,
    sortConfig,
    requestSort,
    getSortIndicator
  }
}
