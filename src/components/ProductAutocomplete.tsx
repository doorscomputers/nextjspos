"use client"

import { useState, useEffect, useRef, useCallback } from 'react'
import { MagnifyingGlassIcon, XMarkIcon } from '@heroicons/react/24/outline'
import { Input } from '@/components/ui/input'
import { toast } from 'sonner'

interface ProductVariation {
  id: number
  name: string
  sku: string | null
  barcode: string | null
  enableSerialNumber: boolean
  defaultPurchasePrice: number | null
  defaultSellingPrice: number | null
}

interface Product {
  id: number
  name: string
  categoryName: string | null
  variations: ProductVariation[]
  matchType?: 'exact' | 'fuzzy'
}

interface ProductAutocompleteProps {
  onProductSelect: (product: Product, variation: ProductVariation) => void
  placeholder?: string
  autoFocus?: boolean
}

export default function ProductAutocomplete({
  onProductSelect,
  placeholder = "Search by SKU/barcode (exact) or product name (contains)...",
  autoFocus = false,
}: ProductAutocompleteProps) {
  const [searchTerm, setSearchTerm] = useState('')
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(false)
  const [showDropdown, setShowDropdown] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [totalVariations, setTotalVariations] = useState(0)

  const inputRef = useRef<HTMLInputElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const searchTimeoutRef = useRef<NodeJS.Timeout>()

  // Calculate total variations and build flat list for keyboard navigation
  const flatVariations = useCallback(() => {
    const flat: Array<{ product: Product; variation: ProductVariation; index: number }> = []
    let index = 0

    products.forEach((product) => {
      product.variations.forEach((variation) => {
        flat.push({ product, variation, index })
        index++
      })
    })

    return flat
  }, [products])

  // Search products with debounce
  useEffect(() => {
    if (!searchTerm.trim()) {
      setProducts([])
      setShowDropdown(false)
      setSelectedIndex(0)
      return
    }

    // Clear previous timeout
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current)
    }

    // Debounce search by 300ms
    searchTimeoutRef.current = setTimeout(async () => {
      try {
        setLoading(true)
        const response = await fetch(
          `/api/products/search?q=${encodeURIComponent(searchTerm)}&limit=20`
        )

        if (response.ok) {
          const data = await response.json()
          console.log('Search API response:', data)
          console.log('Products found:', data.products?.length || 0)
          setProducts(data.products || [])

          // Calculate total variations for keyboard navigation
          const total = (data.products || []).reduce(
            (sum: number, p: Product) => sum + p.variations.length,
            0
          )
          console.log('Total variations:', total)
          setTotalVariations(total)
          setSelectedIndex(0)
          setShowDropdown(true)
          console.log('Dropdown should now be visible')
        } else {
          console.error('Failed to search products')
          setProducts([])
          setShowDropdown(false)
        }
      } catch (error) {
        console.error('Error searching products:', error)
        setProducts([])
        setShowDropdown(false)
      } finally {
        setLoading(false)
      }
    }, 300)

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current)
      }
    }
  }, [searchTerm])

  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showDropdown || products.length === 0) {
      return
    }

    const variations = flatVariations()

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setSelectedIndex((prev) => (prev + 1) % totalVariations)
        scrollToSelected('down')
        break

      case 'ArrowUp':
        e.preventDefault()
        setSelectedIndex((prev) => (prev - 1 + totalVariations) % totalVariations)
        scrollToSelected('up')
        break

      case 'Enter':
        e.preventDefault()
        if (variations[selectedIndex]) {
          const { product, variation } = variations[selectedIndex]
          handleSelect(product, variation)
        }
        break

      case 'Escape':
        e.preventDefault()
        setShowDropdown(false)
        setSearchTerm('')
        break
    }
  }

  // Scroll selected item into view
  const scrollToSelected = (direction: 'up' | 'down') => {
    setTimeout(() => {
      const selectedElement = dropdownRef.current?.querySelector(
        `[data-index="${selectedIndex}"]`
      )
      if (selectedElement) {
        selectedElement.scrollIntoView({
          behavior: 'smooth',
          block: 'nearest',
        })
      }
    }, 0)
  }

  // Handle product selection
  const handleSelect = (product: Product, variation: ProductVariation) => {
    onProductSelect(product, variation)
    setSearchTerm('')
    setProducts([])
    setShowDropdown(false)
    setSelectedIndex(0)

    // Focus back on input for quick consecutive additions
    inputRef.current?.focus()

    // Show success message based on match type
    const matchType = product.matchType === 'exact' ? '(Exact SKU/Barcode match)' : ''
    toast.success(`Added: ${product.name} - ${variation.name} ${matchType}`)
  }

  // Clear search
  const handleClear = () => {
    setSearchTerm('')
    setProducts([])
    setShowDropdown(false)
    setSelectedIndex(0)
    inputRef.current?.focus()
  }

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(event.target as Node)
      ) {
        setShowDropdown(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  return (
    <div className="relative w-full">
      {/* Search Input */}
      <div className="relative">
        <MagnifyingGlassIcon className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
        <Input
          ref={inputRef}
          type="text"
          placeholder={placeholder}
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => {
            if (products.length > 0) {
              setShowDropdown(true)
            }
          }}
          autoFocus={autoFocus}
          className="pl-10 pr-10 text-base"
        />
        {searchTerm && (
          <button
            type="button"
            onClick={handleClear}
            className="absolute right-3 top-3 hover:bg-gray-100 dark:hover:bg-gray-700 rounded p-1 transition-colors"
            tabIndex={-1}
          >
            <XMarkIcon className="h-5 w-5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300" />
          </button>
        )}
      </div>

      {/* Loading indicator */}
      {loading && (
        <div className="absolute right-12 top-3 text-sm text-gray-500">
          Searching...
        </div>
      )}

      {/* Dropdown Results */}
      {showDropdown && products.length > 0 && (
        <div
          ref={dropdownRef}
          className="absolute z-50 w-full mt-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg max-h-96 overflow-y-auto"
        >
          {products.map((product) => (
            <div
              key={product.id}
              className="border-b border-gray-200 dark:border-gray-700 last:border-b-0"
            >
              {/* Product Header */}
              <div className="px-4 py-2 font-medium text-gray-900 dark:text-white bg-gray-50 dark:bg-gray-700/50 sticky top-0 z-10">
                {product.name}
                {product.categoryName && (
                  <span className="ml-2 text-xs text-gray-500 dark:text-gray-400 font-normal">
                    ({product.categoryName})
                  </span>
                )}
                {product.matchType === 'exact' && (
                  <span className="ml-2 text-xs bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 px-2 py-0.5 rounded font-normal">
                    Exact Match
                  </span>
                )}
              </div>

              {/* Variations */}
              {product.variations.map((variation, vIndex) => {
                const globalIndex = flatVariations().findIndex(
                  (item) => item.variation.id === variation.id
                )
                const isSelected = globalIndex === selectedIndex

                return (
                  <button
                    key={variation.id}
                    type="button"
                    data-index={globalIndex}
                    onClick={() => handleSelect(product, variation)}
                    onMouseEnter={() => setSelectedIndex(globalIndex)}
                    className={`
                      w-full px-4 py-3 text-left flex justify-between items-center transition-colors
                      ${
                        isSelected
                          ? 'bg-blue-50 dark:bg-blue-900/20 border-l-4 border-blue-600'
                          : 'hover:bg-gray-50 dark:hover:bg-gray-700/30 border-l-4 border-transparent'
                      }
                    `}
                  >
                    <div className="flex-1">
                      <div className="font-medium text-gray-900 dark:text-white">
                        {variation.name}
                      </div>
                      <div className="text-sm text-gray-600 dark:text-gray-400 space-x-3">
                        {variation.sku && (
                          <span>
                            SKU: <span className="font-mono">{variation.sku}</span>
                          </span>
                        )}
                        {variation.barcode && (
                          <span>
                            Barcode: <span className="font-mono">{variation.barcode}</span>
                          </span>
                        )}
                        {variation.enableSerialNumber && (
                          <span className="text-blue-600 dark:text-blue-400">
                            ⚠️ Requires Serial
                          </span>
                        )}
                      </div>
                      {variation.defaultPurchasePrice !== null && (
                        <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                          Default Purchase Price: ₱{variation.defaultPurchasePrice.toFixed(2)}
                        </div>
                      )}
                    </div>
                    {isSelected && (
                      <div className="ml-4 text-blue-600 dark:text-blue-400 font-medium text-sm">
                        Press Enter
                      </div>
                    )}
                  </button>
                )
              })}
            </div>
          ))}
        </div>
      )}

      {/* No Results */}
      {showDropdown && !loading && products.length === 0 && searchTerm.trim() && (
        <div className="absolute z-50 w-full mt-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg">
          <div className="px-4 py-8 text-center text-gray-500 dark:text-gray-400">
            <p className="font-medium">No products found</p>
            <p className="text-sm mt-1">
              Try searching by SKU, barcode, or product name
            </p>
          </div>
        </div>
      )}

      {/* Keyboard Hints */}
      {showDropdown && products.length > 0 && (
        <div className="mt-2 text-xs text-gray-500 dark:text-gray-400 flex items-center gap-4">
          <span>
            <kbd className="px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded border border-gray-300 dark:border-gray-600">
              ↑↓
            </kbd>{' '}
            Navigate
          </span>
          <span>
            <kbd className="px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded border border-gray-300 dark:border-gray-600">
              Enter
            </kbd>{' '}
            Select
          </span>
          <span>
            <kbd className="px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded border border-gray-300 dark:border-gray-600">
              Esc
            </kbd>{' '}
            Clear
          </span>
        </div>
      )}
    </div>
  )
}
