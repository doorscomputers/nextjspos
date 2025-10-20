"use client"

import { useEffect, useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { FunnelIcon, MagnifyingGlassIcon, XMarkIcon } from "@heroicons/react/24/outline"

export interface StockLocationRange {
  min: string
  max: string
}

export interface StockFilters {
  search: string
  productName: string
  productSku: string
  variationName: string
  variationSku: string
  category: string
  brand: string
  unit: string
  minSellingPrice: string
  maxSellingPrice: string
  minTotalStock: string
  maxTotalStock: string
  locationFilters: Record<string, StockLocationRange>
}

interface StockFiltersPanelProps {
  filters: StockFilters
  onFiltersChange: (filters: StockFilters) => void
  locations: { id: number; name: string }[]
  isVisible: boolean
  onToggleVisibility: () => void
  activeFilterCount: number
}

const ensureLocationFilters = (
  base: StockFilters,
  locations: { id: number; name: string }[]
): StockFilters => {
  const normalized: Record<string, StockLocationRange> = {}
  locations.forEach((location) => {
    const key = location.id.toString()
    normalized[key] = base.locationFilters[key] || { min: "", max: "" }
  })

  const hasSameKeys =
    Object.keys(base.locationFilters).length === locations.length &&
    locations.every((loc) => base.locationFilters.hasOwnProperty(loc.id.toString()))

  if (hasSameKeys) {
    return base
  }

  return {
    ...base,
    locationFilters: normalized,
  }
}

const createEmptyFilters = (locations: { id: number; name: string }[]): StockFilters => {
  const locationFilters: Record<string, StockLocationRange> = {}
  locations.forEach((location) => {
    locationFilters[location.id.toString()] = { min: "", max: "" }
  })

  return {
    search: "",
    productName: "",
    productSku: "",
    variationName: "",
    variationSku: "",
    category: "",
    brand: "",
    unit: "",
    minSellingPrice: "",
    maxSellingPrice: "",
    minTotalStock: "",
    maxTotalStock: "",
    locationFilters,
  }
}

export default function StockFiltersPanel({
  filters,
  onFiltersChange,
  locations,
  isVisible,
  onToggleVisibility,
  activeFilterCount,
}: StockFiltersPanelProps) {
  const [localFilters, setLocalFilters] = useState<StockFilters>(() =>
    ensureLocationFilters(filters, locations)
  )

  useEffect(() => {
    setLocalFilters(ensureLocationFilters(filters, locations))
  }, [filters, locations])

  const handleFilterChange = (key: keyof StockFilters, value: string) => {
    const updated = ensureLocationFilters(
      {
        ...localFilters,
        [key]: value,
      },
      locations
    )
    setLocalFilters(updated)
    onFiltersChange(updated)
  }

  const handleLocationFilterChange = (locationId: number, field: "min" | "max", value: string) => {
    const locationKey = locationId.toString()
    const updated = ensureLocationFilters(
      {
        ...localFilters,
        locationFilters: {
          ...localFilters.locationFilters,
          [locationKey]: {
            ...(localFilters.locationFilters[locationKey] || { min: "", max: "" }),
            [field]: value,
          },
        },
      },
      locations
    )

    setLocalFilters(updated)
    onFiltersChange(updated)
  }

  const clearAllFilters = () => {
    const reset = createEmptyFilters(locations)
    setLocalFilters(reset)
    onFiltersChange(reset)
  }

  const hasActiveFilters = useMemo(() => activeFilterCount > 0, [activeFilterCount])

  return (
    <>
      <div className="mb-4">
        <Button
          onClick={onToggleVisibility}
          variant="outline"
          className="flex items-center gap-2 shadow-sm hover:shadow-md transition-all"
        >
          <FunnelIcon className="w-4 h-4" />
          <span>Advanced Filters</span>
          {hasActiveFilters && (
            <Badge variant="secondary" className="ml-2 bg-blue-100 text-blue-700 border-blue-200">
              {activeFilterCount}
            </Badge>
          )}
        </Button>
      </div>

      {isVisible && (
        <Card className="mb-6 border-blue-100 shadow-sm">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FunnelIcon className="w-5 h-5 text-blue-500" />
                <CardTitle className="text-lg">Advanced Filters</CardTitle>
              </div>
              {hasActiveFilters && (
                <Button
                  onClick={clearAllFilters}
                  variant="ghost"
                  size="sm"
                  className="text-slate-600 hover:text-slate-900"
                >
                  <XMarkIcon className="w-4 h-4 mr-1" />
                  Clear all
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">Global Search</label>
                <div className="relative">
                  <MagnifyingGlassIcon className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <Input
                    className="pl-9"
                    placeholder="Search product, SKU, category..."
                    value={localFilters.search}
                    onChange={(e) => handleFilterChange("search", e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">Product Name</label>
                <Input
                  placeholder="Filter by product name"
                  value={localFilters.productName}
                  onChange={(e) => handleFilterChange("productName", e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">Product SKU</label>
                <Input
                  placeholder="Filter by product SKU"
                  value={localFilters.productSku}
                  onChange={(e) => handleFilterChange("productSku", e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">Variation Name</label>
                <Input
                  placeholder="Filter by variation"
                  value={localFilters.variationName}
                  onChange={(e) => handleFilterChange("variationName", e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">Variation SKU</label>
                <Input
                  placeholder="Filter by variation SKU"
                  value={localFilters.variationSku}
                  onChange={(e) => handleFilterChange("variationSku", e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">Category</label>
                <Input
                  placeholder="Filter by category"
                  value={localFilters.category}
                  onChange={(e) => handleFilterChange("category", e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">Brand</label>
                <Input
                  placeholder="Filter by brand"
                  value={localFilters.brand}
                  onChange={(e) => handleFilterChange("brand", e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">Unit</label>
                <Input
                  placeholder="Filter by unit"
                  value={localFilters.unit}
                  onChange={(e) => handleFilterChange("unit", e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">Selling Price Range</label>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    placeholder="Min"
                    value={localFilters.minSellingPrice}
                    onChange={(e) => handleFilterChange("minSellingPrice", e.target.value)}
                  />
                  <span className="text-slate-500">to</span>
                  <Input
                    type="number"
                    placeholder="Max"
                    value={localFilters.maxSellingPrice}
                    onChange={(e) => handleFilterChange("maxSellingPrice", e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">Total Stock Range</label>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    placeholder="Min"
                    value={localFilters.minTotalStock}
                    onChange={(e) => handleFilterChange("minTotalStock", e.target.value)}
                  />
                  <span className="text-slate-500">to</span>
                  <Input
                    type="number"
                    placeholder="Max"
                    value={localFilters.maxTotalStock}
                    onChange={(e) => handleFilterChange("maxTotalStock", e.target.value)}
                  />
                </div>
              </div>
            </div>

            {locations.length > 0 && (
              <div className="space-y-4">
                <h4 className="text-sm font-semibold text-slate-700">Location Stock Filters</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {locations.map((location) => {
                    const locationKey = location.id.toString()
                    const range = localFilters.locationFilters[locationKey] || { min: "", max: "" }

                    return (
                      <div key={location.id} className="space-y-2">
                        <span className="text-sm font-medium text-slate-700">{location.name}</span>
                        <div className="flex items-center gap-2">
                          <Input
                            type="number"
                            placeholder="Min"
                            value={range.min}
                            onChange={(e) => handleLocationFilterChange(location.id, "min", e.target.value)}
                          />
                          <span className="text-slate-500">to</span>
                          <Input
                            type="number"
                            placeholder="Max"
                            value={range.max}
                            onChange={(e) => handleLocationFilterChange(location.id, "max", e.target.value)}
                          />
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </>
  )
}
