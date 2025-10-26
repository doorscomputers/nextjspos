"use client"

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { PencilIcon, CheckIcon, XMarkIcon } from '@heroicons/react/24/outline'
import { toast } from 'sonner'

interface Location {
  id: number
  name: string
}

interface LocationPrice {
  locationId: number
  locationName: string
  sellingPrice: number | null
  stock: number
  lastPriceUpdate?: Date | string | null
  lastPriceUpdatedBy?: string | null
}

interface LocationPriceManagerProps {
  productVariationId: number
  defaultSellingPrice: number
  locations: Location[]
  locationDetails: {
    locationId: number
    qtyAvailable: number
    sellingPrice: number | null
    lastPriceUpdate?: Date | string | null
    lastPriceUpdatedBy?: number | null
    lastPriceUpdatedByUser?: {
      username: string
      firstName?: string
      lastName?: string
    } | null
  }[]
  canEdit?: boolean
  onPriceUpdate?: () => void
}

export default function LocationPriceManager({
  productVariationId,
  defaultSellingPrice,
  locations,
  locationDetails,
  canEdit = true,
  onPriceUpdate
}: LocationPriceManagerProps) {
  const [editingLocationId, setEditingLocationId] = useState<number | null>(null)
  const [editPrice, setEditPrice] = useState<string>('')
  const [saving, setSaving] = useState(false)

  // Combine locations with their prices and audit info
  const locationPrices: LocationPrice[] = locations.map(location => {
    const detail = locationDetails.find(d => d.locationId === location.id)

    // Format user name for display
    let updatedByName = null
    if (detail?.lastPriceUpdatedByUser) {
      const user = detail.lastPriceUpdatedByUser
      updatedByName = user.firstName && user.lastName
        ? `${user.firstName} ${user.lastName}`
        : user.username
    }

    return {
      locationId: location.id,
      locationName: location.name,
      sellingPrice: detail?.sellingPrice || null,
      stock: detail?.qtyAvailable || 0,
      lastPriceUpdate: detail?.lastPriceUpdate || null,
      lastPriceUpdatedBy: updatedByName
    }
  })

  const handleEditClick = (locationId: number, currentPrice: number | null) => {
    setEditingLocationId(locationId)
    setEditPrice((currentPrice || defaultSellingPrice).toString())
  }

  const handleCancelEdit = () => {
    setEditingLocationId(null)
    setEditPrice('')
  }

  const handleSavePrice = async (locationId: number) => {
    const price = parseFloat(editPrice)

    if (isNaN(price) || price < 0) {
      toast.error('Please enter a valid price')
      return
    }

    setSaving(true)
    try {
      const response = await fetch(`/api/products/variations/${productVariationId}/inventory`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          locationId,
          sellingPrice: price
        })
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to update price')
      }

      toast.success('Location price updated successfully')
      setEditingLocationId(null)
      setEditPrice('')

      // Call parent callback to refresh data
      if (onPriceUpdate) {
        onPriceUpdate()
      }
    } catch (error: any) {
      console.error('Error updating price:', error)
      toast.error(error.message || 'Failed to update price')
    } finally {
      setSaving(false)
    }
  }

  const getEffectivePrice = (locationPrice: number | null): number => {
    return locationPrice !== null ? locationPrice : defaultSellingPrice
  }

  const isPriceCustomized = (locationPrice: number | null): boolean => {
    return locationPrice !== null
  }

  const formatDate = (date: Date | string | null | undefined): string => {
    if (!date) return ''
    const d = new Date(date)
    return d.toLocaleString('en-PH', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Per-Location Selling Prices</CardTitle>
        <CardDescription>
          Set different selling prices for each location. If not set, the default price of ₱{defaultSellingPrice.toFixed(2)} will be used.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Location</TableHead>
              <TableHead className="text-right">Stock</TableHead>
              <TableHead className="text-right">Selling Price</TableHead>
              <TableHead className="text-right">Status</TableHead>
              <TableHead className="text-left">Last Updated</TableHead>
              {canEdit && <TableHead className="text-right">Actions</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {locationPrices.map((locPrice) => {
              const isEditing = editingLocationId === locPrice.locationId
              const effectivePrice = getEffectivePrice(locPrice.sellingPrice)
              const isCustomized = isPriceCustomized(locPrice.sellingPrice)

              return (
                <TableRow key={locPrice.locationId}>
                  <TableCell className="font-medium">
                    {locPrice.locationName}
                  </TableCell>
                  <TableCell className="text-right">
                    {locPrice.stock.toFixed(2)}
                  </TableCell>
                  <TableCell className="text-right">
                    {isEditing ? (
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        value={editPrice}
                        onChange={(e) => setEditPrice(e.target.value)}
                        className="w-32 text-right"
                        autoFocus
                        disabled={saving}
                      />
                    ) : (
                      <span className={isCustomized ? 'font-semibold text-blue-600 dark:text-blue-400' : 'text-gray-600 dark:text-gray-400'}>
                        ₱{effectivePrice.toFixed(2)}
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    {isCustomized ? (
                      <span className="text-xs bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 px-2 py-1 rounded">
                        Custom
                      </span>
                    ) : (
                      <span className="text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 px-2 py-1 rounded">
                        Default
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-left">
                    {locPrice.lastPriceUpdate && locPrice.lastPriceUpdatedBy ? (
                      <div className="text-xs">
                        <div className="font-medium text-gray-700 dark:text-gray-300">
                          {locPrice.lastPriceUpdatedBy}
                        </div>
                        <div className="text-gray-500 dark:text-gray-500">
                          {formatDate(locPrice.lastPriceUpdate)}
                        </div>
                      </div>
                    ) : (
                      <span className="text-xs text-gray-400 dark:text-gray-600">—</span>
                    )}
                  </TableCell>
                  {canEdit && (
                    <TableCell className="text-right">
                      {isEditing ? (
                        <div className="flex justify-end gap-2">
                          <Button
                            size="sm"
                            variant="default"
                            onClick={() => handleSavePrice(locPrice.locationId)}
                            disabled={saving}
                          >
                            <CheckIcon className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={handleCancelEdit}
                            disabled={saving}
                          >
                            <XMarkIcon className="h-4 w-4" />
                          </Button>
                        </div>
                      ) : (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleEditClick(locPrice.locationId, locPrice.sellingPrice)}
                        >
                          <PencilIcon className="h-4 w-4" />
                        </Button>
                      )}
                    </TableCell>
                  )}
                </TableRow>
              )
            })}
          </TableBody>
        </Table>

        <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg">
          <h4 className="font-semibold text-blue-900 dark:text-blue-100 text-sm mb-2">
            How Per-Location Pricing Works:
          </h4>
          <ul className="text-sm text-blue-800 dark:text-blue-200 space-y-1 list-disc list-inside">
            <li><strong>Custom Price:</strong> Location uses its own specific selling price</li>
            <li><strong>Default Price:</strong> Location uses the product variation's default price (₱{defaultSellingPrice.toFixed(2)})</li>
            <li>Click the edit icon to set a custom price for any location</li>
            <li>POS and sales will use the location-specific price when available</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  )
}
