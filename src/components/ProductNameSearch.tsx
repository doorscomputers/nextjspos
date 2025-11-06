"use client"

import { useState, useRef, useCallback, useEffect } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import { Loader2, ChevronDown, ChevronUp } from 'lucide-react'

/**
 * ProductNameSearch Component
 *
 * Search products by name with keyboard navigation.
 *
 * WORKFLOW:
 * 1. User types product name → Dropdown shows results
 * 2. User presses ↓ or ↑ to navigate results
 * 3. User presses Enter to select highlighted item
 * 4. Item added to cart/list via onProductSelect callback
 * 5. Field clears, ready for next search
 *
 * SEARCH METHODS:
 * - "beginsWith": Fast prefix search (WHERE name LIKE 'ABC%')
 * - "contains": Slower full search (WHERE name LIKE '%ABC%')
 *
 * @param onProductSelect - Callback when product selected
 * @param searchMethod - "beginsWith" (fast) or "contains" (slow)
 * @param onSearchMethodChange - Callback to change search method
 * @param placeholder - Input placeholder
 * @param autoFocus - Auto-focus on mount
 */

interface ProductVariation {
  id: number
  name: string
  sku: string | null
  barcode: string | null
  enableSerialNumber: boolean
  defaultPurchasePrice?: number | null
  defaultSellingPrice?: number | null
}

interface Product {
  id: number
  name: string
  categoryName?: string | null
  variations: ProductVariation[]
  matchType?: 'exact' | 'fuzzy'
}

interface ProductNameSearchProps {
  onProductSelect: (product: Product, variation: ProductVariation) => void
  searchMethod: 'beginsWith' | 'contains'
  onSearchMethodChange: (method: 'beginsWith' | 'contains') => void
  placeholder?: string
  disabled?: boolean
  autoFocus?: boolean
  className?: string
}

export default function ProductNameSearch({
  onProductSelect,
  searchMethod,
  onSearchMethodChange,
  placeholder = "Search by product name...",
  disabled = false,
  autoFocus = false,
  className = ""
}: ProductNameSearchProps) {
  const [query, setQuery] = useState('')
  const [searching, setSearching] = useState(false)
  const [results, setResults] = useState<Product[]>([])
  const [showDropdown, setShowDropdown] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(0)

  const inputRef = useRef<HTMLInputElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Search products by name
  const searchProducts = useCallback(async (searchQuery: string) => {
    if (!searchQuery.trim()) {
      setResults([])
      setShowDropdown(false)
      return
    }

    try {
      setSearching(true)

      const response = await fetch(
        `/api/products/search?type=name&query=${encodeURIComponent(searchQuery)}&method=${searchMethod}`
      )

      if (!response.ok) {
        throw new Error('Search failed')
      }

      const data = await response.json()
      setResults(data.products || [])
      setShowDropdown(data.products && data.products.length > 0)
      setSelectedIndex(0) // Reset selection to first item
    } catch (error) {
      console.error('Product name search error:', error)
      toast.error('Failed to search products')
      setResults([])
      setShowDropdown(false)
    } finally {
      setSearching(false)
    }
  }, [searchMethod])

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      searchProducts(query)
    }, 300) // 300ms debounce

    return () => clearTimeout(timer)
  }, [query, searchProducts])

  // Handle keyboard navigation
  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showDropdown || results.length === 0) {
      return
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIndex((prev) => (prev + 1) % results.length)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIndex((prev) => (prev - 1 + results.length) % results.length)
    } else if (e.key === 'Enter') {
      e.preventDefault()
      handleSelectProduct(results[selectedIndex])
    } else if (e.key === 'Escape') {
      e.preventDefault()
      setShowDropdown(false)
    }
  }, [showDropdown, results, selectedIndex])

  // Handle product selection
  const handleSelectProduct = useCallback((product: Product) => {
    if (!product || !product.variations || product.variations.length === 0) {
      toast.error('Product has no variations available')
      return
    }

    // If product has only one variation, auto-select it
    if (product.variations.length === 1) {
      onProductSelect(product, product.variations[0])
      toast.success(`Added: ${product.name} - ${product.variations[0].name}`)

      // Clear field
      setQuery('')
      setResults([])
      setShowDropdown(false)

      // Re-focus
      setTimeout(() => {
        inputRef.current?.focus()
      }, 100)
    } else {
      // Multiple variations - show selection dialog
      // For now, auto-select first variation (you can enhance this later with a dialog)
      onProductSelect(product, product.variations[0])
      toast.success(`Added: ${product.name} - ${product.variations[0].name}`)

      setQuery('')
      setResults([])
      setShowDropdown(false)

      setTimeout(() => {
        inputRef.current?.focus()
      }, 100)
    }
  }, [onProductSelect])

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  return (
    <div className={className}>
      {/* Search Method Toggle */}
      <div className="flex items-center gap-4 mb-3">
        <Label className="text-gray-900 dark:text-gray-200 font-medium flex items-center gap-2">
          <span className="text-lg">🔍</span>
          Search by Product Name
          {searching && <Loader2 className="w-4 h-4 animate-spin text-blue-600" />}
        </Label>

        <div className="flex items-center gap-3 text-sm">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name="searchMethod"
              value="beginsWith"
              checked={searchMethod === 'beginsWith'}
              onChange={() => onSearchMethodChange('beginsWith')}
              className="w-4 h-4 text-blue-600"
            />
            <span className="text-gray-700 dark:text-gray-300">
              Begins With <span className="text-green-600 font-semibold">(Fast ⚡)</span>
            </span>
          </label>

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name="searchMethod"
              value="contains"
              checked={searchMethod === 'contains'}
              onChange={() => onSearchMethodChange('contains')}
              className="w-4 h-4 text-blue-600"
            />
            <span className="text-gray-700 dark:text-gray-300">
              Contains <span className="text-orange-600 font-semibold">(Slower 🐌)</span>
            </span>
          </label>
        </div>
      </div>

      {/* Search Input */}
      <div className="relative" ref={dropdownRef}>
        <Input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => {
            if (results.length > 0) setShowDropdown(true)
          }}
          placeholder={placeholder}
          disabled={disabled || searching}
          autoFocus={autoFocus}
          className="text-base"
        />

        {/* Dropdown Results */}
        {showDropdown && results.length > 0 && (
          <div className="absolute z-50 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg shadow-xl max-h-80 overflow-y-auto">
            {results.map((product, index) => (
              <div
                key={product.id}
                className={`px-4 py-3 cursor-pointer transition-colors ${
                  index === selectedIndex
                    ? 'bg-blue-100 dark:bg-blue-900/50'
                    : 'hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
                onClick={() => handleSelectProduct(product)}
                onMouseEnter={() => setSelectedIndex(index)}
              >
                <div className="font-semibold text-gray-900 dark:text-white">
                  {product.name}
                  {product.matchType === 'exact' && (
                    <span className="ml-2 text-xs bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300 px-2 py-0.5 rounded">
                      Exact Match
                    </span>
                  )}
                </div>
                {product.categoryName && (
                  <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                    {product.categoryName}
                  </div>
                )}
                <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                  {product.variations.length} variation(s)
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Help Text */}
      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 flex items-center gap-1">
        <ChevronDown className="w-3 h-3" />
        <ChevronUp className="w-3 h-3" />
        <span><strong>Arrow keys</strong> to navigate,</span>
        <strong>Enter</strong> to select
      </p>
    </div>
  )
}
