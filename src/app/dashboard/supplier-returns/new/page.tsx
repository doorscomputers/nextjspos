'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { usePermissions } from '@/hooks/usePermissions'
import { PERMISSIONS } from '@/lib/rbac'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { ArrowLeftIcon } from '@heroicons/react/24/outline'
import Link from 'next/link'

interface PrefilledData {
  serialNumber?: string
  productId?: number
  productName?: string
  sku?: string
  variation?: string
  supplierId?: number
  supplierName?: string
  currentLocationId?: number
  currentLocationName?: string
  purchaseCost?: number
}

// Currency formatter with commas
const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount).replace('PHP', '₱')
}

export default function CreateSupplierReturnPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { can, user } = usePermissions()

  const [loading, setLoading] = useState(false)
  const [prefilledData, setPrefilledData] = useState<PrefilledData | null>(null)

  // Form state
  const [returnDate, setReturnDate] = useState(new Date().toISOString().split('T')[0])
  const [returnReason, setReturnReason] = useState('defective')
  const [condition, setCondition] = useState('defective')
  const [quantity, setQuantity] = useState(1)
  const [notes, setNotes] = useState('')

  useEffect(() => {
    // Check for pre-filled data from serial lookup
    const dataParam = searchParams.get('data')
    if (dataParam) {
      try {
        const decoded = JSON.parse(decodeURIComponent(dataParam))

        // Convert numeric fields to proper numbers (they might be strings from URL)
        const normalizedData = {
          ...decoded,
          productId: decoded.productId ? Number(decoded.productId) : undefined,
          supplierId: decoded.supplierId ? Number(decoded.supplierId) : undefined,
          currentLocationId: decoded.currentLocationId ? Number(decoded.currentLocationId) : undefined,
          purchaseCost: decoded.purchaseCost ? Number(decoded.purchaseCost) : 0,
        }

        setPrefilledData(normalizedData)

        // Auto-set notes based on warranty status
        if (decoded.warrantyExpired === false) {
          setNotes('Item is under warranty - warranty claim')
          setReturnReason('warranty')
          setCondition('warranty_claim')
        } else {
          setNotes('Defective item return to supplier')
        }
      } catch (error) {
        console.error('Failed to parse prefilled data:', error)
      }
    }
  }, [searchParams])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!prefilledData?.supplierId || !prefilledData?.currentLocationId || !prefilledData?.productId) {
      toast.error('Missing required information. Please use Serial Lookup to create returns.')
      return
    }

    if (quantity <= 0) {
      toast.error('Quantity must be greater than 0')
      return
    }

    const totalAmount = (Number(prefilledData.purchaseCost) || 0) * quantity

    try {
      setLoading(true)

      const payload = {
        supplierId: prefilledData.supplierId,
        locationId: prefilledData.currentLocationId,
        returnDate,
        returnReason,
        items: [
          {
            productId: prefilledData.productId,
            productVariationId: prefilledData.productId, // This should be variation ID
            quantity,
            unitCost: Number(prefilledData.purchaseCost) || 0,
            condition,
            serialNumberIds: prefilledData.serialNumber ? [prefilledData.serialNumber] : undefined,
            notes: `Serial: ${prefilledData.serialNumber}`,
          },
        ],
        notes,
      }

      const response = await fetch('/api/supplier-returns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const data = await response.json()

      if (response.ok) {
        toast.success(`Supplier return created: ${data.return.returnNumber}`)
        // Redirect to list page instead of detail page to avoid 404 error
        router.push('/dashboard/supplier-returns')
      } else {
        toast.error(data.error || 'Failed to create supplier return')
        setLoading(false) // Re-enable button on error
      }
    } catch (error) {
      console.error('Error creating supplier return:', error)
      toast.error('Failed to create supplier return')
      setLoading(false) // Re-enable button on error
    }
  }

  if (!can(PERMISSIONS.PURCHASE_RETURN_CREATE)) {
    return (
      <div className="p-8">
        <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded">
          You do not have permission to create supplier returns.
        </div>
      </div>
    )
  }

  const totalAmount = (Number(prefilledData?.purchaseCost) || 0) * quantity

  return (
    <div className="container mx-auto p-4 sm:p-6 max-w-5xl">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <div className="flex items-center gap-4 mb-2">
            <Link href="/dashboard/supplier-returns">
              <Button variant="outline" size="sm">
                <ArrowLeftIcon className="w-4 h-4 mr-2" />
                Back to Returns
              </Button>
            </Link>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
              Create Supplier Return
            </h1>
          </div>
          <p className="text-gray-600 dark:text-gray-400">
            Return defective or warranty items to supplier
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Pre-filled Info Alert */}
        {prefilledData && (
          <Card className="border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/30">
            <CardContent className="pt-6">
              <div className="flex items-start gap-3">
                <span className="text-3xl">✅</span>
                <div>
                  <h3 className="font-semibold text-blue-900 dark:text-blue-100 mb-2">
                    Pre-filled from Serial Lookup
                  </h3>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <span className="text-blue-700 dark:text-blue-300 font-medium">Serial Number:</span>
                      <span className="ml-2 font-mono font-bold">{prefilledData.serialNumber}</span>
                    </div>
                    <div>
                      <span className="text-blue-700 dark:text-blue-300 font-medium">Product:</span>
                      <span className="ml-2">{prefilledData.productName}</span>
                    </div>
                    <div>
                      <span className="text-blue-700 dark:text-blue-300 font-medium">Supplier:</span>
                      <span className="ml-2">{prefilledData.supplierName}</span>
                    </div>
                    <div>
                      <span className="text-blue-700 dark:text-blue-300 font-medium">Location:</span>
                      <span className="ml-2">{prefilledData.currentLocationName}</span>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Return Details */}
        <Card>
          <CardHeader>
            <CardTitle>Return Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Return Date <span className="text-red-500">*</span>
                </label>
                <Input
                  type="date"
                  value={returnDate}
                  onChange={(e) => setReturnDate(e.target.value)}
                  required
                  max={new Date().toISOString().split('T')[0]}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Return Reason <span className="text-red-500">*</span>
                </label>
                <Select value={returnReason} onValueChange={setReturnReason}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="warranty">Warranty Claim</SelectItem>
                    <SelectItem value="defective">Defective</SelectItem>
                    <SelectItem value="damaged">Damaged in Transit</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Item Condition <span className="text-red-500">*</span>
                </label>
                <Select value={condition} onValueChange={setCondition}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="warranty_claim">Warranty Claim</SelectItem>
                    <SelectItem value="defective">Defective</SelectItem>
                    <SelectItem value="damaged">Damaged</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Quantity <span className="text-red-500">*</span>
                </label>
                <Input
                  type="number"
                  min="1"
                  value={quantity}
                  onChange={(e) => setQuantity(parseInt(e.target.value) || 1)}
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Notes
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={4}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:text-white"
                placeholder="Describe the issue, reason for return, or warranty details..."
              />
            </div>
          </CardContent>
        </Card>

        {/* Item Details */}
        {prefilledData && (
          <Card>
            <CardHeader>
              <CardTitle>Item Details</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex justify-between items-center pb-3 border-b">
                  <div>
                    <p className="font-semibold text-gray-900 dark:text-white">
                      {prefilledData.productName}
                    </p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      SKU: {prefilledData.sku} • Variation: {prefilledData.variation}
                    </p>
                    <p className="text-sm text-gray-500 dark:text-gray-400 font-mono">
                      Serial: {prefilledData.serialNumber}
                    </p>
                  </div>
                  <Badge variant="secondary">{condition.replace('_', ' ').toUpperCase()}</Badge>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-gray-600 dark:text-gray-400">Unit Cost:</span>
                  <span className="font-semibold">{formatCurrency(Number(prefilledData.purchaseCost) || 0)}</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-gray-600 dark:text-gray-400">Quantity:</span>
                  <span className="font-semibold">{quantity}</span>
                </div>
                <div className="flex justify-between items-center text-lg font-bold pt-3 border-t">
                  <span>Total Amount:</span>
                  <span className="text-orange-600 dark:text-orange-400">{formatCurrency(totalAmount)}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Action Buttons */}
        <div className="flex gap-3 justify-end">
          <Link href="/dashboard/supplier-returns">
            <Button type="button" variant="outline" disabled={loading}>
              Cancel
            </Button>
          </Link>
          <Button
            type="submit"
            disabled={loading || !prefilledData}
            className="bg-gradient-to-r from-orange-600 to-orange-500 hover:from-orange-700 hover:to-orange-600 text-white"
          >
            {loading ? 'Creating...' : 'Create Return'}
          </Button>
        </div>
      </form>

      {/* Help Text */}
      {!prefilledData && (
        <Card className="mt-6 border-yellow-200 dark:border-yellow-800 bg-yellow-50 dark:bg-yellow-950/30">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <span className="text-2xl">💡</span>
              <div>
                <h3 className="font-semibold text-yellow-900 dark:text-yellow-100 mb-2">
                  How to Create a Supplier Return
                </h3>
                <ol className="list-decimal list-inside space-y-1 text-sm text-yellow-800 dark:text-yellow-200">
                  <li>Go to <Link href="/dashboard/serial-lookup" className="underline font-medium">Serial Number Lookup</Link></li>
                  <li>Search for the serial number of the defective item</li>
                  <li>Click &quot;Create Supplier Return&quot; button</li>
                  <li>The form will be pre-filled with all necessary information</li>
                </ol>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
