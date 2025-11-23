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
  const [query, setQuery] = useState('') // Actual search query used for API call
  const [searchInput, setSearchInput] = useState('') // User typing input (not auto-searched)
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

  // Manual search trigger
  const handleSearch = useCallback(() => {
    setQuery(searchInput)
    searchProducts(searchInput)
  }, [searchInput, searchProducts])

  // Trigger search when query changes (from manual search button)
  useEffect(() => {
    if (query) {
      searchProducts(query)
    }
  }, [query, searchProducts])

  // Handle keyboard navigation
  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    // If dropdown is not shown, Enter key triggers search
    if (!showDropdown || results.length === 0) {
      if (e.key === 'Enter') {
        e.preventDefault()
        handleSearch()
      }
      return
    }

    // Dropdown navigation
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
  }, [showDropdown, results, selectedIndex, handleSearch])

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

      // Clear fields
      setQuery('')
      setSearchInput('')
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
      setSearchInput('')
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

      {/* Search Input with Button */}
      <div className="relative" ref={dropdownRef}>
        <div className="flex gap-2">
          <div className="relative flex-1">
          <Input
            ref={inputRef}
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={handleKeyDown}
            onFocus={() => {
              if (results.length > 0) setShowDropdown(true)
            }}
            placeholder={`${placeholder} (Press Enter or click Search)`}
            disabled={disabled || searching}
            autoFocus={autoFocus}
            className="text-base pr-10"
          />
          {searchInput && (
            <button
              onClick={() => {
                setSearchInput('')
                setQuery('')
                setResults([])
                setShowDropdown(false)
              }}
              className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              title="Clear search"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
        <button
          onClick={handleSearch}
          disabled={disabled || searching || !searchInput.trim()}
          className="px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white font-medium rounded-lg shadow-md hover:shadow-lg transition-all duration-200 flex items-center gap-2"
        >
          {searching ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Searching...
            </>
          ) : (
            <>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              Search
            </>
          )}
        </button>
        </div>

        {/* Dropdown Results */}
        {showDropdown && results.length > 0 && (
          <div className="absolute z-50 w-full mt-12 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg shadow-xl max-h-80 overflow-y-auto">
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
