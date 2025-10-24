"use client"

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { usePermissions } from '@/hooks/usePermissions'
import { PERMISSIONS } from '@/lib/rbac'
import { ArrowLeft, Search, RefreshCw, BookOpen } from 'lucide-react'
import { StockHistoryEntry } from '@/types/product'
import { generateStockHistoryNarrative } from '@/utils/stockHistoryNarrative'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"

interface Product {
  id: number
  name: string
  sku: string
  variations: ProductVariation[]
}

interface ProductVariation {
  id: number
  name: string
  sku: string
}

interface Location {
  id: number
  name: string
}

export default function ProductStockHistoryPage() {
  const params = useParams()
  const router = useRouter()
  const { can, hasAnyRole, user } = usePermissions()
  const [product, setProduct] = useState<Product | null>(null)
  const [locations, setLocations] = useState<Location[]>([])
  const [history, setHistory] = useState<StockHistoryEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingHistory, setLoadingHistory] = useState(false)
  const [userAssignedLocationId, setUserAssignedLocationId] = useState<number | null>(null)

  // Filters
  const [selectedVariation, setSelectedVariation] = useState<number | null>(null)
  const [selectedLocation, setSelectedLocation] = useState<number | null>(null)
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [autoCorrect, setAutoCorrect] = useState(false)

  useEffect(() => {
    if (!can(PERMISSIONS.PRODUCT_VIEW)) {
      router.push('/dashboard/products')
      return
    }
    fetchProduct()
    fetchUserAssignedLocation()
    fetchLocations()
  }, [params.id])

  useEffect(() => {
    if (selectedVariation && selectedLocation) {
      fetchStockHistory()
    }
  }, [selectedVariation, selectedLocation, startDate, endDate, autoCorrect])

  // Effect to set default location when userAssignedLocationId and locations are available
  useEffect(() => {
    if (locations.length > 0 && selectedLocation === null) {
      // Check if user has admin roles
      const isAdmin = hasAnyRole([
        'Super Admin',
        'System Administrator',
        'Super Admin (Legacy)',
        'Admin (Legacy)'
      ])

      // Default location selection logic:
      // - For non-admin users: default to their assigned location if available
      // - For admin users: default to first location in the list
      if (!isAdmin && userAssignedLocationId) {
        // Check if the assigned location exists in the locations list
        const assignedLocationExists = locations.some(
          (loc: Location) => loc.id === userAssignedLocationId
        )
        if (assignedLocationExists) {
          setSelectedLocation(userAssignedLocationId)
        } else {
          // Fallback to first location if assigned location not found
          setSelectedLocation(locations[0].id)
        }
      } else {
        // For admin users or when no assigned location, use first location
        setSelectedLocation(locations[0].id)
      }
    }
  }, [locations, userAssignedLocationId])

  const fetchProduct = async () => {
    try {
      const response = await fetch(`/api/products/${params.id}`)
      const data = await response.json()
      if (response.ok) {
        setProduct(data.product)
        // Auto-select first variation if available
        if (data.product.variations && data.product.variations.length > 0) {
          setSelectedVariation(data.product.variations[0].id)
        }
      }
    } catch (error) {
      console.error('Error fetching product:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchUserAssignedLocation = async () => {
    try {
      const response = await fetch('/api/user-locations/my-location')
      const data = await response.json()
      if (response.ok && data.location) {
        setUserAssignedLocationId(data.location.id)
      }
    } catch (error) {
      console.error('Error fetching user assigned location:', error)
    }
  }

  const fetchLocations = async () => {
    try {
      const response = await fetch('/api/locations')
      const data = await response.json()
      if (response.ok && data.locations) {
        setLocations(data.locations)
        // Location will be auto-selected by the useEffect that watches locations and userAssignedLocationId
      }
    } catch (error) {
      console.error('Error fetching locations:', error)
    }
  }

  const fetchStockHistory = async () => {
    if (!selectedVariation || !selectedLocation) return

    setLoadingHistory(true)
    try {
      const queryParams = new URLSearchParams({
        variationId: selectedVariation.toString(),
        locationId: selectedLocation.toString(),
        autoCorrect: autoCorrect.toString()
      })

      if (startDate) queryParams.append('startDate', startDate)
      if (endDate) queryParams.append('endDate', endDate)

      const response = await fetch(
        `/api/products/${params.id}/stock-history?${queryParams.toString()}`
      )
      const data = await response.json()
      if (response.ok) {
        setHistory(data.history || [])
      }
    } catch (error) {
      console.error('Error fetching stock history:', error)
    } finally {
      setLoadingHistory(false)
    }
  }

  const handleRefresh = () => {
    fetchStockHistory()
  }

  if (loading) {
    return (
      <div className="p-6">
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading product...</p>
        </div>
      </div>
    )
  }

  if (!product) {
    return (
      <div className="p-6">
        <div className="text-center py-12">
          <p className="text-gray-600">Product not found</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header with White Background */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <h1 className="text-2xl font-bold text-gray-900">Product stock history</h1>
      </div>

      <div className="p-6">
        {/* Product Title */}
        <div className="mb-6">
          <h2 className="text-lg font-medium text-gray-900">{product.name}</h2>
        </div>

        {/* Product Info Card */}
        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-semibold text-gray-900">
                  Product:
                </label>
                <Select
                  value={selectedVariation?.toString() || ''}
                  onValueChange={(value) => setSelectedVariation(parseInt(value))}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select variation" />
                  </SelectTrigger>
                  <SelectContent>
                    {product.variations && product.variations.length > 0 ? (
                      product.variations.map(variation => (
                        <SelectItem key={variation.id} value={variation.id.toString()}>
                          {(variation.name === 'DUMMY' || variation.name === 'Default') ? product.name : variation.name} - {variation.sku}
                        </SelectItem>
                      ))
                    ) : (
                      <SelectItem value="none" disabled>No variations available</SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-semibold text-gray-900">
                  Business Location:
                </label>
                <Select
                  value={selectedLocation?.toString() || ''}
                  onValueChange={(value) => setSelectedLocation(parseInt(value))}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select location" />
                  </SelectTrigger>
                  <SelectContent>
                    {locations.map(location => (
                      <SelectItem key={location.id} value={location.id.toString()}>
                        {location.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Summary Section - Always Visible */}
        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Quantities In */}
            <div>
              <h3 className="text-base font-semibold text-gray-900 mb-4">Quantities In</h3>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-700">Total Purchase</span>
                  <span className="text-sm font-medium text-gray-900">
                    {selectedVariation && selectedLocation && history.length > 0
                      ? history.filter(h => h.transactionType === 'purchase').reduce((sum, h) => sum + h.quantityAdded, 0).toFixed(2)
                      : '0.00'}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-700">Opening Stock</span>
                  <span className="text-sm font-medium text-gray-900">
                    {selectedVariation && selectedLocation && history.length > 0
                      ? history.filter(h => h.transactionType === 'opening_stock').reduce((sum, h) => sum + h.quantityAdded, 0).toFixed(2)
                      : '0.00'}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-700">Total Sell Return</span>
                  <span className="text-sm font-medium text-gray-900">
                    {selectedVariation && selectedLocation && history.length > 0
                      ? history.filter(h => h.transactionType === 'sell_return').reduce((sum, h) => sum + h.quantityAdded, 0).toFixed(2)
                      : '0.00'}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-700">Stock Transfers (In)</span>
                  <span className="text-sm font-medium text-gray-900">
                    {selectedVariation && selectedLocation && history.length > 0
                      ? history.filter(h => h.transactionType === 'transfer_in').reduce((sum, h) => sum + h.quantityAdded, 0).toFixed(2)
                      : '0.00'}
                  </span>
                </div>
              </div>
            </div>

            {/* Quantities Out */}
            <div className="md:border-l md:border-r border-gray-200 md:px-8">
              <h3 className="text-base font-semibold text-gray-900 mb-4">Quantities Out</h3>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-700">Total Sold</span>
                  <span className="text-sm font-medium text-gray-900">
                    {selectedVariation && selectedLocation && history.length > 0
                      ? history.filter(h => h.transactionType === 'sale').reduce((sum, h) => sum + h.quantityRemoved, 0).toFixed(2)
                      : '0.00'}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-700">Total Stock Adjustment</span>
                  <span className="text-sm font-medium text-gray-900">
                    {selectedVariation && selectedLocation && history.length > 0
                      ? history.filter(h => h.transactionType === 'adjustment').reduce((sum, h) => sum + h.quantityRemoved, 0).toFixed(2)
                      : '0.00'}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-700">Total Purchase Return</span>
                  <span className="text-sm font-medium text-gray-900">
                    {selectedVariation && selectedLocation && history.length > 0
                      ? history.filter(h => h.transactionType === 'purchase_return').reduce((sum, h) => sum + h.quantityRemoved, 0).toFixed(2)
                      : '0.00'}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-700">Stock Transfers (Out)</span>
                  <span className="text-sm font-medium text-gray-900">
                    {selectedVariation && selectedLocation && history.length > 0
                      ? history.filter(h => h.transactionType === 'transfer_out').reduce((sum, h) => sum + h.quantityRemoved, 0).toFixed(2)
                      : '0.00'}
                  </span>
                </div>
              </div>
            </div>

            {/* Totals */}
            <div>
              <h3 className="text-base font-semibold text-gray-900 mb-4">Totals</h3>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-700">Current stock</span>
                  <span className="text-sm font-medium text-gray-900">
                    {selectedVariation && selectedLocation && history.length > 0
                      ? history[0].runningBalance.toFixed(2)
                      : '0.00'}
                  </span>
                </div>
              </div>
            </div>
          </div>
          </CardContent>
        </Card>

        {/* Stock Story Narrative */}
        {selectedVariation && selectedLocation && history.length > 0 && (
          <Card className="mb-6 bg-blue-50 border-blue-200">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-blue-900">
                <BookOpen className="w-5 h-5" />
                Understanding Your Stock Numbers
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="prose prose-sm max-w-none text-gray-700">
                {generateStockHistoryNarrative(
                  history,
                  product.name,
                  locations.find(loc => loc.id === selectedLocation)?.name || 'Unknown Location'
                ).split('\n').map((line, index) => {
                  if (line.startsWith('📊') || line.startsWith('✅') || line.startsWith('❌') || line.startsWith('🔢') || line.startsWith('⚠️') || line.startsWith('📝')) {
                    return <p key={index} className="font-semibold mb-2 text-gray-900">{line}</p>
                  } else if (line.startsWith('- ')) {
                    return <p key={index} className="ml-4 mb-1">{line}</p>
                  } else if (line.trim() === '') {
                    return <div key={index} className="h-2" />
                  } else {
                    return <p key={index} className="mb-2">{line}</p>
                  }
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Stock History Table */}
        <Card>
          <CardContent className="p-0">
            {loadingHistory ? (
              <div className="text-center py-12">
                <RefreshCw className="w-12 h-12 text-gray-400 mx-auto mb-4 animate-spin" />
                <p className="mt-4 text-gray-600">Loading stock history...</p>
              </div>
            ) : !selectedVariation || !selectedLocation ? (
              <div className="text-center py-12">
                <Search className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600">Please select a variation and location to view stock history</p>
              </div>
            ) : history.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-gray-600">No stock history found</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Type</TableHead>
                      <TableHead>Quantity change</TableHead>
                      <TableHead>New Quantity</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Reference No</TableHead>
                      <TableHead>Customer/Supplier information</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {history.map((entry, index) => (
                      <TableRow key={entry.id || index}>
                        <TableCell>
                          <Badge variant="outline">{entry.transactionTypeLabel}</Badge>
                        </TableCell>
                        <TableCell>
                          {entry.quantityAdded > 0 ? (
                            <span className="text-green-600 font-semibold">+{entry.quantityAdded.toFixed(2)}</span>
                          ) : entry.quantityRemoved > 0 ? (
                            <span className="text-red-600 font-semibold">-{entry.quantityRemoved.toFixed(2)}</span>
                          ) : (
                            <span className="text-gray-400">0.00</span>
                          )}
                        </TableCell>
                        <TableCell className="font-semibold">
                          {entry.runningBalance.toFixed(2)}
                        </TableCell>
                        <TableCell>
                          {new Date(entry.date).toLocaleDateString()}
                        </TableCell>
                        <TableCell>
                          {entry.referenceNumber || '-'}
                        </TableCell>
                        <TableCell>
                          {entry.createdBy || '-'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
