"use client"

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { XMarkIcon, FunnelIcon, MagnifyingGlassIcon } from '@heroicons/react/24/outline'
import { Switch } from '@/components/ui/switch'

export interface ProductFilters {
  search: string
  sku: string
  categoryName: string
  brandName: string
  unitName: string
  productType: string
  stockMin: string
  stockMax: string
  taxName: string
}

interface ProductFiltersPanelProps {
  filters: ProductFilters
  onFiltersChange: (filters: ProductFilters) => void
  isVisible: boolean
  onToggleVisibility: () => void
  activeFilterCount: number
}

const PRODUCT_TYPES = [
  { value: 'all', label: 'All Types' },
  { value: 'single', label: 'Single' },
  { value: 'variable', label: 'Variable' },
  { value: 'combo', label: 'Combo' }
]

const STOCK_RANGES = [
  { value: 'all', label: 'Any Stock' },
  { value: '0-10', label: '0-10 units' },
  { value: '10-50', label: '10-50 units' },
  { value: '50-100', label: '50-100 units' },
  { value: '100-500', label: '100-500 units' },
  { value: '500+', label: '500+ units' }
]


export default function ProductFiltersPanel({
  filters,
  onFiltersChange,
  isVisible,
  onToggleVisibility,
  activeFilterCount
}: ProductFiltersPanelProps) {
  const [localFilters, setLocalFilters] = useState<ProductFilters>(filters)

  useEffect(() => {
    setLocalFilters(filters)
  }, [filters])

  const normalizeValue = (key: keyof ProductFilters, value: string) => {
    if (value === 'all') {
      return ''
    }

    return value
  }

  const handleFilterChange = (key: keyof ProductFilters, value: string) => {
    const normalizedValue = normalizeValue(key, value)
    const newFilters = { ...localFilters, [key]: normalizedValue }
    setLocalFilters(newFilters)
    onFiltersChange(newFilters)
  }

  const handleStockRangeChange = (value: string) => {
    if (value === 'all') {
      handleFilterChange('stockMin', '')
      handleFilterChange('stockMax', '')
      return
    }

    if (value === '500+') {
      handleFilterChange('stockMin', '500')
      handleFilterChange('stockMax', '')
    } else {
      const [min, max] = value.split('-')
      handleFilterChange('stockMin', min)
      handleFilterChange('stockMax', max)
    }
  }

  
  const clearAllFilters = () => {
    const emptyFilters: ProductFilters = {
      search: '',
      sku: '',
      categoryName: '',
      brandName: '',
      unitName: '',
      productType: '',
      stockMin: '',
      stockMax: '',
      taxName: ''
    }
    setLocalFilters(emptyFilters)
    onFiltersChange(emptyFilters)
  }

  const getActiveFiltersCount = () => {
    return Object.values(localFilters).filter(value => value !== '').length
  }

  const getStockRangeValue = () => {
    if (!localFilters.stockMin && !localFilters.stockMax) return 'all'
    if (localFilters.stockMin === '500' && !localFilters.stockMax) return '500+'
    return `${localFilters.stockMin}-${localFilters.stockMax}`
  }

  
  return (
    <>
      {/* Toggle Button */}
      <div className="mb-4">
        <Button
          onClick={onToggleVisibility}
          variant="outline"
          className="flex items-center gap-2 shadow-sm hover:shadow-md transition-all"
        >
          <FunnelIcon className="w-4 h-4" />
          <span>Advanced Filters</span>
          {activeFilterCount > 0 && (
            <Badge className="bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-700 ml-1">
              {activeFilterCount}
            </Badge>
          )}
        </Button>
      </div>

      {/* Filters Panel */}
      {isVisible && (
        <Card className="mb-6 border-slate-200 dark:border-gray-700 shadow-md">
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg font-semibold text-slate-800 dark:text-gray-100">
                Advanced Product Filters
              </CardTitle>
              <div className="flex items-center gap-2">
                <Button
                  onClick={clearAllFilters}
                  variant="ghost"
                  size="sm"
                  className="text-slate-600 dark:text-gray-300 hover:text-slate-900 dark:hover:text-gray-100"
                >
                  <XMarkIcon className="w-4 h-4 mr-1" />
                  Clear All
                </Button>
                <Button
                  onClick={onToggleVisibility}
                  variant="ghost"
                  size="sm"
                  className="text-slate-600 dark:text-gray-300 hover:text-slate-900 dark:hover:text-gray-100"
                >
                  <XMarkIcon className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {/* Product Name/Description Search */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700 dark:text-gray-300">
                  <MagnifyingGlassIcon className="w-4 h-4 inline mr-1" />
                  Product Search
                </label>
                <Input
                  placeholder="Search products..."
                  value={localFilters.search}
                  onChange={(e) => handleFilterChange('search', e.target.value)}
                  className="bg-white"
                />
              </div>

              {/* SKU Filter */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700 dark:text-gray-300">SKU</label>
                <Input
                  placeholder="Filter by SKU..."
                  value={localFilters.sku}
                  onChange={(e) => handleFilterChange('sku', e.target.value)}
                  className="bg-white"
                />
              </div>

              {/* Category Filter */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700 dark:text-gray-300">Category</label>
                <Input
                  placeholder="Filter by category..."
                  value={localFilters.categoryName}
                  onChange={(e) => handleFilterChange('categoryName', e.target.value)}
                  className="bg-white"
                />
              </div>

              {/* Brand Filter */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700 dark:text-gray-300">Brand</label>
                <Input
                  placeholder="Filter by brand..."
                  value={localFilters.brandName}
                  onChange={(e) => handleFilterChange('brandName', e.target.value)}
                  className="bg-white"
                />
              </div>

              {/* Unit Filter */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700 dark:text-gray-300">Unit</label>
                <Input
                  placeholder="Filter by unit..."
                  value={localFilters.unitName}
                  onChange={(e) => handleFilterChange('unitName', e.target.value)}
                  className="bg-white"
                />
              </div>

              {/* Product Type Filter */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700 dark:text-gray-300">Product Type</label>
                <Select value={localFilters.productType || 'all'} onValueChange={(value) => handleFilterChange('productType', value)}>
                  <SelectTrigger className="bg-white">
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    {PRODUCT_TYPES.map(type => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Stock Range Filter */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700 dark:text-gray-300">Stock Range</label>
                <Select value={getStockRangeValue()} onValueChange={handleStockRangeChange}>
                  <SelectTrigger className="bg-white">
                    <SelectValue placeholder="Select stock range" />
                  </SelectTrigger>
                  <SelectContent>
                    {STOCK_RANGES.map(range => (
                      <SelectItem key={range.value} value={range.value}>
                        {range.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Custom Stock Range */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700 dark:text-gray-300">Custom Stock Range</label>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    placeholder="Min"
                    value={localFilters.stockMin}
                    onChange={(e) => handleFilterChange('stockMin', e.target.value)}
                    className="bg-white"
                  />
                  <span className="text-slate-500 dark:text-gray-400">to</span>
                  <Input
                    type="number"
                    placeholder="Max"
                    value={localFilters.stockMax}
                    onChange={(e) => handleFilterChange('stockMax', e.target.value)}
                    className="bg-white"
                  />
                </div>
              </div>

              
              {/* Tax Filter */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700 dark:text-gray-300">Tax</label>
                <Input
                  placeholder="Filter by tax..."
                  value={localFilters.taxName}
                  onChange={(e) => handleFilterChange('taxName', e.target.value)}
                  className="bg-white"
                />
              </div>
            </div>

            {/* Active Filters Summary */}
            {getActiveFiltersCount() > 0 && (
              <div className="mt-6 pt-4 border-t border-slate-200 dark:border-gray-700">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-600 dark:text-gray-300">
                    {getActiveFiltersCount()} active filter{getActiveFiltersCount() !== 1 ? 's' : ''}
                  </span>
                  <Button
                    onClick={clearAllFilters}
                    variant="ghost"
                    size="sm"
                    className="text-slate-600 dark:text-gray-300 hover:text-slate-900 dark:hover:text-gray-100"
                  >
                    Clear all filters
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </>
  )
}
