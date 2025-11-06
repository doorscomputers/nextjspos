"use client"

import { useState, useEffect, useRef } from 'react'
import { Input } from '@/components/ui/input'
import { Loader2 } from 'lucide-react'

/**
 * Unified Product Search Component (POS-style)
 *
 * Fast single-field search that handles both SKU and product name.
 * Same experience as POS page - instant, keyboard-navigable dropdown.
 *
 * Features:
 * - Single search field (no separate SKU/Name fields)
 * - Searches: Exact SKU → Partial SKU → Product Name
 * - Live dropdown with results
 * - Keyboard navigation (Arrow keys, Enter, Escape)
 * - Barcode scanner support (auto-selects on Enter if exact match)
 * - Debounced API calls (300ms)
 */

interface ProductVariation {
  id: number
  name: string
  sku: string | null
  enableSerialNumber: boolean
  defaultPurchasePrice?: number | null
  defaultSellingPrice?: number | null
}

interface Product {
  id: number
  name: string
  sku?: string | null
  categoryName?: string | null
  variations: ProductVariation[]
  matchType?: 'exact' | 'fuzzy'
}

interface UnifiedProductSearchProps {
  onProductSelect: (product: Product, variation: ProductVariation) => void
  placeholder?: string
  disabled?: boolean
  autoFocus?: boolean
  className?: string
}

export default function UnifiedProductSearch({
  onProductSelect,
  placeholder = "🔍 Scan barcode or search product (SKU, Name)...",
  disabled = false,
  autoFocus = true,
  className = ""
}: UnifiedProductSearchProps) {
  const [searchTerm, setSearchTerm] = useState('')
  const [searchResults, setSearchResults] = useState<Product[]>([])
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [showDropdown, setShowDropdown] = useState(false)
  const [searching, setSearching] = useState(false)

  const inputRef = useRef<HTMLInputElement>(null)
  const searchResultRefs = useRef<(HTMLDivElement | null)[]>([])

  // Debounced search
  useEffect(() => {
    if (!searchTerm || searchTerm.trim() === '') {
      setShowDropdown(false)
      setSearchResults([])
      return
    }

    setSearching(true)

    // Debounce: wait 300ms after user stops typing
    const timer = setTimeout(async () => {
      try {
        const response = await fetch(
          `/api/products/search?q=${encodeURIComponent(searchTerm.trim())}&limit=10`
        )

        if (response.ok) {
          const data = await response.json()
          if (data.products && data.products.length > 0) {
            setSearchResults(data.products)
            setShowDropdown(true)
            setSelectedIndex(0)
          } else {
            setSearchResults([])
            setShowDropdown(false)
          }
        }
      } catch (error) {
        console.error('Search error:', error)
        setSearchResults([])
        setShowDropdown(false)
      } finally {
        setSearching(false)
      }
    }, 300)

    return () => {
      clearTimeout(timer)
      setSearching(false)
    }
  }, [searchTerm])

  // Scroll selected item into view
  useEffect(() => {
    if (showDropdown && searchResultRefs.current[selectedIndex]) {
      searchResultRefs.current[selectedIndex]?.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest'
      })
    }
  }, [selectedIndex, showDropdown])

  const handleSelectProduct = (product: Product, variationIndex = 0) => {
    const variation = product.variations[variationIndex]
    if (variation) {
      onProductSelect(product, variation)
      setSearchTerm('')
      setShowDropdown(false)
      setSelectedIndex(0)

      // Re-focus for next scan/search
      setTimeout(() => {
        inputRef.current?.focus()
      }, 100)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      if (showDropdown && searchResults.length > 0) {
        setSelectedIndex((prev) =>
          prev < searchResults.length - 1 ? prev + 1 : 0
        )
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      if (showDropdown && searchResults.length > 0) {
        setSelectedIndex((prev) =>
          prev > 0 ? prev - 1 : searchResults.length - 1
        )
      }
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (showDropdown && searchResults.length > 0) {
        handleSelectProduct(searchResults[selectedIndex])
      }
    } else if (e.key === 'Escape') {
      setShowDropdown(false)
      setSearchTerm('')
    }
  }

  return (
    <div className={`relative ${className}`}>
      <div className="relative">
        <Input
          ref={inputRef}
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          autoFocus={autoFocus}
          className="text-lg h-12 pr-10 font-medium"
        />

        {searching && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            <Loader2 className="w-5 h-5 animate-spin text-blue-600" />
          </div>
        )}
      </div>

      {/* Search Results Dropdown */}
      {showDropdown && searchResults.length > 0 && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-96 overflow-y-auto">
          {searchResults.map((product, productIndex) => (
            <div key={product.id}>
              {product.variations.map((variation, varIndex) => {
                const flatIndex = productIndex // Simplified for single variation selection
                const isSelected = flatIndex === selectedIndex

                return (
                  <div
                    key={variation.id}
                    ref={(el) => (searchResultRefs.current[flatIndex] = el)}
                    onClick={() => handleSelectProduct(product, varIndex)}
                    className={`px-4 py-3 cursor-pointer border-b border-gray-100 hover:bg-blue-50 ${
                      isSelected ? 'bg-blue-100' : ''
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="font-semibold text-gray-900">
                          {product.name}
                          {product.variations.length > 1 && (
                            <span className="ml-2 text-sm text-gray-600">
                              - {variation.name}
                            </span>
                          )}
                        </div>
                        <div className="text-sm text-gray-500">
                          SKU: {variation.sku || 'N/A'}
                          {product.matchType === 'exact' && (
                            <span className="ml-2 px-2 py-0.5 bg-green-100 text-green-700 text-xs rounded-full">
                              Exact Match
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          ))}
        </div>
      )}

      <p className="text-xs text-gray-500 mt-1">
        Type SKU or product name. Use ↑↓ arrows to navigate, Enter to select, Esc to clear
      </p>
    </div>
  )
}
