'use client'

import { useState, useCallback, useEffect } from 'react'

interface Product {
  id: number
  name: string
  sku: string
  variationName?: string
  currentPrice: number
  costPrice: number
  productVariationId: number
}

interface ProductSearchProps {
  onProductSelect: (product: Product) => void
}

export default function ProductSearch({ onProductSelect }: ProductSearchProps) {
  const [skuInput, setSkuInput] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<Product[]>([])
  const [searching, setSearching] = useState(false)
  const [searchMode, setSearchMode] = useState<'sku' | 'name'>('sku')

  // Search by SKU (exact match)
  const searchBySku = useCallback(async () => {
    if (!skuInput.trim()) return

    try {
      setSearching(true)
      console.log('🔍 Searching by SKU:', skuInput)

      const response = await fetch(`/api/products/search?q=${encodeURIComponent(skuInput.trim())}`)
      const result = await response.json()

      if (response.ok && result.products) {
        console.log('✅ Search results:', result.products)
        console.log('🔍 Raw API response structure:', JSON.stringify(result.products[0], null, 2))

        // Transform API response to our Product interface
        // The API returns { products: [{ id, name, variations: [...] }] }
        // We need to flatten this to an array of variations
        const products: Product[] = []

        result.products.forEach((product: any) => {
          if (product.variations && Array.isArray(product.variations)) {
            product.variations.forEach((variation: any) => {
              const transformedProduct = {
                id: variation.id,
                name: product.name || 'Unknown Product',
                sku: variation.sku || 'N/A',
                variationName: variation.name || 'Standard',
                currentPrice: variation.defaultSellingPrice || 0,
                costPrice: variation.defaultPurchasePrice || 0,
                productVariationId: variation.id,
              }
              console.log('✅ Transformed product:', transformedProduct)
              products.push(transformedProduct)
            })
          }
        })

        console.log('📦 Final products array:', products)
        setSearchResults(products)

        // If exactly one result, auto-select it
        if (products.length === 1) {
          onProductSelect(products[0])
          setSkuInput('')
          setSearchQuery('')
          setSearchResults([])
        }
      } else {
        console.error('❌ Search failed:', result)
        setSearchResults([])
      }
    } catch (error) {
      console.error('💥 SKU search error:', error)
      setSearchResults([])
    } finally {
      setSearching(false)
    }
  }, [skuInput, onProductSelect])

  // Search by product name (fuzzy search)
  const searchByName = useCallback(async () => {
    if (!searchQuery.trim() || searchQuery.length < 2) return

    try {
      setSearching(true)
      console.log('🔍 Searching by name:', searchQuery)

      const response = await fetch(`/api/products/search?q=${encodeURIComponent(searchQuery.trim())}`)
      const result = await response.json()

      if (response.ok && result.products) {
        console.log('✅ Name search results:', result.products)
        console.log('🔍 Raw API response structure:', JSON.stringify(result.products[0], null, 2))

        // Transform API response to our Product interface
        // The API returns { products: [{ id, name, variations: [...] }] }
        // We need to flatten this to an array of variations
        const products: Product[] = []

        result.products.forEach((product: any) => {
          if (product.variations && Array.isArray(product.variations)) {
            product.variations.forEach((variation: any) => {
              const transformedProduct = {
                id: variation.id,
                name: product.name || 'Unknown Product',
                sku: variation.sku || 'N/A',
                variationName: variation.name || 'Standard',
                currentPrice: variation.defaultSellingPrice || 0,
                costPrice: variation.defaultPurchasePrice || 0,
                productVariationId: variation.id,
              }
              console.log('✅ Transformed product:', transformedProduct)
              products.push(transformedProduct)
            })
          }
        })

        console.log('📦 Final products array:', products)
        setSearchResults(products)
      } else {
        console.error('❌ Name search failed:', result)
        setSearchResults([])
      }
    } catch (error) {
      console.error('💥 Name search error:', error)
      setSearchResults([])
    } finally {
      setSearching(false)
    }
  }, [searchQuery])

  // Handle SKU input change
  const handleSkuChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value || ''
    setSkuInput(value)

    // Clear name search when switching to SKU mode
    if (value) {
      setSearchQuery('')
      setSearchResults([])
    }
  }

  // Handle name search change
  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value || ''
    setSearchQuery(value)

    // Clear SKU search when switching to name mode
    if (value) {
      setSkuInput('')
      setSearchResults([])
    }
  }

  // Handle product selection from results
  const handleProductSelect = (product: Product) => {
    onProductSelect(product)
    setSkuInput('')
    setSearchQuery('')
    setSearchResults([])
  }

  const handleSkuSearch = () => {
    searchBySku()
  }

  const clearSearch = () => {
    setSkuInput('')
    setSearchQuery('')
    setSearchResults([])
  }

  return (
    <div className="space-y-4">
      {/* Search Mode Toggle */}
      <div className="flex gap-2 mb-4">
        <button
          onClick={() => setSearchMode('sku')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            searchMode === 'sku'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
          }`}
        >
          Search by SKU
        </button>
        <button
          onClick={() => setSearchMode('name')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            searchMode === 'name'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
          }`}
        >
          Search by Name
        </button>
        {searchResults.length > 0 && (
          <button
            onClick={clearSearch}
            className="px-4 py-2 rounded-lg font-medium bg-red-500 text-white hover:bg-red-600 transition-colors"
          >
            Clear
          </button>
        )}
      </div>

      {/* SKU Search */}
      {searchMode === 'sku' && (
        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Enter SKU (exact match)
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={skuInput}
              onChange={handleSkuChange}
              placeholder="Enter product SKU..."
              className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              disabled={searching}
            />
            <button
              onClick={handleSkuSearch}
              disabled={searching || !skuInput.trim()}
              className={`px-6 py-2 rounded-lg font-medium transition-colors ${
                searching || !skuInput.trim()
                  ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  : 'bg-blue-600 text-white hover:bg-blue-700'
              }`}
            >
              {searching ? 'Searching...' : 'Search'}
            </button>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            SKU search finds exact matches. Enter the full SKU and click Search.
          </p>
        </div>
      )}

      {/* Name Search */}
      {searchMode === 'name' && (
        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Enter Product Name
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={searchQuery}
              onChange={handleNameChange}
              placeholder="Enter product name and click Search..."
              className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              disabled={searching}
            />
            <button
              onClick={() => searchByName()}
              disabled={searching || !searchQuery.trim() || searchQuery.trim().length < 2}
              className={`px-6 py-2 rounded-lg font-medium transition-colors ${
                searching || !searchQuery.trim() || searchQuery.trim().length < 2
                  ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  : 'bg-blue-600 text-white hover:bg-blue-700'
              }`}
            >
              {searching ? 'Searching...' : 'Search'}
            </button>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Enter at least 2 characters and click Search to find products.
          </p>
        </div>
      )}

      {/* Loading State */}
      {searching && (
        <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400">
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
          <span className="text-sm">Searching...</span>
        </div>
      )}

      {/* Search Results */}
      {searchResults.length > 0 && !searching && (
        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Search Results ({searchResults.length})
          </label>
          <div className="border border-gray-200 dark:border-gray-700 rounded-lg max-h-64 overflow-y-auto">
            {searchResults.map((product) => (
              <div
                key={product.id}
                onClick={() => handleProductSelect(product)}
                className="p-3 border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer transition-colors last:border-b-0"
              >
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="font-medium text-gray-900 dark:text-gray-100">
                      {product.name}
                    </div>
                    {product.variationName && (
                      <div className="text-sm text-gray-600 dark:text-gray-400">
                        {product.variationName}
                      </div>
                    )}
                    <div className="text-sm text-gray-500 dark:text-gray-500 mt-1">
                      SKU: {product.sku}
                    </div>
                  </div>
                  <div className="text-right ml-4">
                    <div className="font-medium text-gray-900 dark:text-gray-100">
                      ₱{product.currentPrice.toFixed(2)}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-500">
                      Current price
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* No Results */}
      {!searching && (skuInput || searchQuery) && searchResults.length === 0 && (
        <div className="text-center py-4 text-gray-500 dark:text-gray-400">
          <div className="text-4xl mb-2">🔍</div>
          <p>No products found</p>
          <p className="text-sm">
            Try adjusting your search terms or check the SKU spelling.
          </p>
        </div>
      )}
    </div>
  )
}