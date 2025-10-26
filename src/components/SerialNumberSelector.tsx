'use client'

import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { CheckCircle2, XCircle, AlertCircle, Loader2 } from 'lucide-react'

interface SerialNumber {
  id: number
  serialNumber: string
  imei: string | null
  condition: string
  purchaseCost: number
  warrantyMonths: number
  purchasedAt: string
}

interface SerialNumberSelectorProps {
  open: boolean
  onClose: () => void
  productId: number
  variationId: number
  locationId: number
  productName: string
  quantityRequired: number
  onConfirm: (selectedIds: number[], selectedSerials: SerialNumber[]) => void
  preselectedIds?: number[]
}

export default function SerialNumberSelector({
  open,
  onClose,
  productId,
  variationId,
  locationId,
  productName,
  quantityRequired,
  onConfirm,
  preselectedIds = [],
}: SerialNumberSelectorProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [availableSerials, setAvailableSerials] = useState<SerialNumber[]>([])
  const [selectedSerialIds, setSelectedSerialIds] = useState<number[]>(preselectedIds)
  const [searchQuery, setSearchQuery] = useState('')

  // Fetch available serial numbers when dialog opens
  useEffect(() => {
    if (open && productId && variationId && locationId) {
      fetchAvailableSerials()
    }
  }, [open, productId, variationId, locationId])

  const fetchAvailableSerials = async () => {
    setLoading(true)
    setError('')
    try {
      const response = await fetch(
        `/api/serial-numbers/available?productId=${productId}&variationId=${variationId}&locationId=${locationId}`
      )
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch serial numbers')
      }

      setAvailableSerials(data.data || [])
    } catch (err: any) {
      setError(err.message || 'Failed to load serial numbers')
    } finally {
      setLoading(false)
    }
  }

  const handleToggleSerial = (serialId: number) => {
    setSelectedSerialIds((prev) => {
      if (prev.includes(serialId)) {
        return prev.filter((id) => id !== serialId)
      } else {
        // Check if we've reached the required quantity
        if (prev.length >= quantityRequired) {
          setError(`You can only select ${quantityRequired} serial number(s) for this item`)
          setTimeout(() => setError(''), 3000)
          return prev
        }
        return [...prev, serialId]
      }
    })
  }

  const handleConfirm = () => {
    if (selectedSerialIds.length !== quantityRequired) {
      setError(`Please select exactly ${quantityRequired} serial number(s)`)
      return
    }

    const selectedSerials = availableSerials.filter((s) => selectedSerialIds.includes(s.id))
    onConfirm(selectedSerialIds, selectedSerials)
    onClose()
  }

  const filteredSerials = availableSerials.filter((serial) =>
    serial.serialNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (serial.imei && serial.imei.toLowerCase().includes(searchQuery.toLowerCase()))
  )

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Select Serial Numbers</DialogTitle>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            {productName} - Select {quantityRequired} serial number(s)
          </p>
        </DialogHeader>

        <div className="flex-1 overflow-hidden flex flex-col gap-4">
          {/* Search */}
          <div>
            <Label>Search Serial Numbers or IMEI</Label>
            <Input
              placeholder="Type to search..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="mt-1"
            />
          </div>

          {/* Error Alert */}
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Selection Status */}
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600 dark:text-gray-400">
              Selected: {selectedSerialIds.length} / {quantityRequired}
            </span>
            <span className="text-gray-600 dark:text-gray-400">
              Available: {availableSerials.length} serial numbers
            </span>
          </div>

          {/* Serial Numbers List */}
          <div className="flex-1 overflow-y-auto border rounded-md">
            {loading ? (
              <div className="flex items-center justify-center h-32">
                <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
              </div>
            ) : availableSerials.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-32 text-gray-500">
                <XCircle className="h-12 w-12 mb-2" />
                <p className="text-sm">No serial numbers available in stock</p>
                <p className="text-xs text-gray-400 mt-1">Product may not track serial numbers</p>
              </div>
            ) : filteredSerials.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-32 text-gray-500">
                <AlertCircle className="h-12 w-12 mb-2" />
                <p className="text-sm">No serial numbers match your search</p>
              </div>
            ) : (
              <div className="divide-y">
                {filteredSerials.map((serial) => {
                  const isSelected = selectedSerialIds.includes(serial.id)
                  return (
                    <div
                      key={serial.id}
                      className={`p-3 cursor-pointer transition-colors ${
                        isSelected
                          ? 'bg-blue-50 dark:bg-blue-900/20 border-l-4 border-blue-600'
                          : 'hover:bg-gray-50 dark:hover:bg-gray-800'
                      }`}
                      onClick={() => handleToggleSerial(serial.id)}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-gray-900 dark:text-gray-100">
                              {serial.serialNumber}
                            </span>
                            {isSelected && (
                              <CheckCircle2 className="h-5 w-5 text-green-600" />
                            )}
                          </div>
                          {serial.imei && (
                            <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                              IMEI: {serial.imei}
                            </p>
                          )}
                          <div className="flex items-center gap-2 mt-2">
                            <Badge variant="outline" className="text-xs">
                              {serial.condition}
                            </Badge>
                            {serial.warrantyMonths > 0 && (
                              <Badge variant="secondary" className="text-xs">
                                {serial.warrantyMonths} months warranty
                              </Badge>
                            )}
                          </div>
                        </div>
                        <div className="text-right text-xs text-gray-600 dark:text-gray-400">
                          <p>Cost: ₱{Number(serial.purchaseCost).toLocaleString()}</p>
                          <p className="mt-1">
                            {new Date(serial.purchasedAt).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={selectedSerialIds.length !== quantityRequired || loading}
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            Confirm Selection ({selectedSerialIds.length}/{quantityRequired})
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
