'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { usePermissions } from '@/hooks/usePermissions'
import { PERMISSIONS } from '@/lib/rbac'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'sonner'
import { ArrowLeftIcon, ArrowPathIcon } from '@heroicons/react/24/outline'
import Link from 'next/link'
import SelectBox from 'devextreme-react/select-box'
import NumberBox from 'devextreme-react/number-box'
import SupplierProductAutocomplete from '@/components/SupplierProductAutocomplete'

interface Supplier {
  id: number
  name: string
  mobile: string | null
  email: string | null
}

interface Variation {
  id: number
  name: string
  sku: string | null
}

interface Location {
  id: number
  name: string
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

export default function CreateManualSupplierReturnPage() {
  const router = useRouter()
  const { can, user } = usePermissions()

  const [loading, setLoading] = useState(false)
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [variations, setVariations] = useState<Variation[]>([])
  const [locations, setLocations] = useState<Location[]>([])

  // Form state
  const [supplierId, setSupplierId] = useState('')
  const [productId, setProductId] = useState('')
  const [productName, setProductName] = useState('')
  const [productSku, setProductSku] = useState('')
  const [variationId, setVariationId] = useState('')
  const [locationId, setLocationId] = useState('1') // Main Warehouse (only authorized location)
  const [quantity, setQuantity] = useState(1)
  const [unitCost, setUnitCost] = useState(0)
  const [condition, setCondition] = useState('defective')
  const [returnReason, setReturnReason] = useState('defective')
  const [returnDate, setReturnDate] = useState(new Date().toISOString().split('T')[0])
  const [notes, setNotes] = useState('')

  const [loadingSuppliers, setLoadingSuppliers] = useState(true)
  const [loadingLocations, setLoadingLocations] = useState(true)

  useEffect(() => {
    fetchSuppliers()
    fetchLocations()
  }, [])

  useEffect(() => {
    // When supplier changes, clear product and variation selection
    if (!supplierId) {
      setProductId('')
      setProductName('')
      setProductSku('')
      setVariationId('')
      setUnitCost(0)
    }
  }, [supplierId])

  useEffect(() => {
    if (productId && supplierId) {
      fetchVariations(productId)
      fetchLastPurchaseCostFromSupplier(productId, supplierId)
    } else {
      setVariations([])
      setVariationId('')
      setUnitCost(0)
    }
  }, [productId, supplierId])

  const fetchSuppliers = async () => {
    try {
      setLoadingSuppliers(true)
      const response = await fetch('/api/suppliers?limit=1000')
      const data = await response.json()
      if (response.ok) {
        setSuppliers(data.suppliers || [])
      } else {
        toast.error('Failed to fetch suppliers')
      }
    } catch (error) {
      console.error('Error fetching suppliers:', error)
      toast.error('Failed to fetch suppliers')
    } finally {
      setLoadingSuppliers(false)
    }
  }

  const fetchLocations = async () => {
    try {
      setLoadingLocations(true)
      const response = await fetch('/api/locations')
      const data = await response.json()
      if (response.ok) {
        setLocations(data.locations || [])
        // Location is locked to Main Warehouse (id=2) - no auto-select needed
      } else {
        toast.error('Failed to fetch locations')
      }
    } catch (error) {
      console.error('Error fetching locations:', error)
      toast.error('Failed to fetch locations')
    } finally {
      setLoadingLocations(false)
    }
  }

  const fetchVariations = async (prodId: string) => {
    try {
      const response = await fetch(`/api/products/${prodId}/variations`)
      const data = await response.json()
      if (response.ok) {
        setVariations(data.variations || [])
        // Auto-select first variation if only one exists
        if (data.variations?.length === 1) {
          setVariationId(data.variations[0].id.toString())
        }
      } else {
        toast.error('Failed to fetch product variations')
      }
    } catch (error) {
      console.error('Error fetching variations:', error)
      toast.error('Failed to fetch product variations')
    }
  }

  const fetchLastPurchaseCostFromSupplier = async (prodId: string, suppId: string) => {
    try {
      const response = await fetch(`/api/suppliers/${suppId}/products/${prodId}/last-cost`)
      const data = await response.json()
      if (response.ok && data.lastCost) {
        setUnitCost(parseFloat(data.lastCost))
        toast.success(`Unit cost auto-filled: ${formatCurrency(parseFloat(data.lastCost))}`, {
          duration: 2000,
        })
      } else {
        // No previous purchase from this supplier
        setUnitCost(0)
        toast.info('No previous purchase from this supplier. Please enter unit cost manually.', {
          duration: 3000,
        })
      }
    } catch (error) {
      console.error('Error fetching last purchase cost from supplier:', error)
      setUnitCost(0)
      toast.warning('Could not fetch cost. Please enter unit cost manually.')
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    // Prevent double submission
    if (loading) {
      return
    }

    if (!supplierId || !productId || !variationId || !locationId) {
      toast.error('Please fill in all required fields')
      return
    }

    if (quantity <= 0) {
      toast.error('Quantity must be greater than 0')
      return
    }

    if (unitCost <= 0) {
      toast.error('Unit cost must be greater than 0')
      return
    }

    const totalAmount = unitCost * quantity

    try {
      setLoading(true)

      const payload = {
        supplierId: parseInt(supplierId),
        locationId: parseInt(locationId),
        returnDate,
        returnReason,
        items: [
          {
            productId: parseInt(productId),
            productVariationId: parseInt(variationId),
            quantity,
            unitCost,
            condition,
            notes: `Manual return - ${condition}`,
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
        router.push('/dashboard/supplier-returns')
      } else {
        toast.error(data.error || 'Failed to create supplier return')
      }
    } catch (error) {
      console.error('Error creating supplier return:', error)
      toast.error('Failed to create supplier return')
    } finally {
      setLoading(false)
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

  const totalAmount = unitCost * quantity

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
              Create Supplier Return (Manual)
            </h1>
          </div>
          <p className="text-gray-600 dark:text-gray-400">
            For items without serial numbers (bulk items, accessories, consumables)
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Return Information */}
        <Card>
          <CardHeader>
            <CardTitle>Return Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Supplier <span className="text-red-500">*</span>
                </label>
                <SelectBox
                  dataSource={suppliers}
                  displayExpr="name"
                  valueExpr="id"
                  value={supplierId ? parseInt(supplierId) : null}
                  onValueChanged={(e) => setSupplierId(e.value ? e.value.toString() : '')}
                  searchEnabled={true}
                  searchMode="contains"
                  searchExpr="name"
                  placeholder={loadingSuppliers ? "Loading..." : "Select supplier"}
                  disabled={loadingSuppliers}
                  showClearButton={true}
                  stylingMode="outlined"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Location <span className="text-red-500">*</span>
                </label>
                <SelectBox
                  dataSource={locations}
                  displayExpr="name"
                  valueExpr="id"
                  value={1}
                  searchEnabled={false}
                  placeholder="Main Warehouse"
                  disabled={true}
                  showClearButton={false}
                  stylingMode="outlined"
                  readOnly={true}
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Only Main Warehouse is authorized to process supplier returns
                </p>
              </div>

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
            </div>
          </CardContent>
        </Card>

        {/* Product Information */}
        <Card>
          <CardHeader>
            <CardTitle>Product Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Product <span className="text-red-500">*</span>
                </label>
                <SupplierProductAutocomplete
                  supplierId={supplierId}
                  onProductSelect={(prodId, prodName, prodSku) => {
                    setProductId(prodId)
                    setProductName(prodName)
                    setProductSku(prodSku)
                  }}
                  placeholder="Search products purchased from this supplier..."
                  disabled={!supplierId}
                />
                {productId && (
                  <p className="text-xs text-green-600 dark:text-green-400 mt-1">
                    ✓ Selected: {productName} ({productSku})
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Variation <span className="text-red-500">*</span>
                </label>
                <SelectBox
                  dataSource={variations}
                  displayExpr="name"
                  valueExpr="id"
                  value={variationId ? parseInt(variationId) : null}
                  onValueChanged={(e) => setVariationId(e.value ? e.value.toString() : '')}
                  searchEnabled={true}
                  searchMode="contains"
                  searchExpr="name"
                  placeholder={!productId ? "Select product first" : "Select variation"}
                  disabled={!productId || variations.length === 0}
                  showClearButton={true}
                  stylingMode="outlined"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Quantity <span className="text-red-500">*</span>
                </label>
                <NumberBox
                  value={quantity}
                  onValueChanged={(e) => setQuantity(e.value || 1)}
                  min={1}
                  showSpinButtons={true}
                  showClearButton={false}
                  format="#,##0"
                  stylingMode="outlined"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Unit Cost <span className="text-red-500">*</span>
                </label>
                <NumberBox
                  value={unitCost}
                  onValueChanged={(e) => setUnitCost(e.value || 0)}
                  min={0.01}
                  format="#,##0.00"
                  showSpinButtons={true}
                  showClearButton={false}
                  stylingMode="outlined"
                />
                {productId && supplierId && unitCost > 0 && (
                  <p className="text-xs text-green-600 dark:text-green-400 mt-1">
                    ✓ Auto-filled from last purchase from this supplier
                  </p>
                )}
                {productId && supplierId && unitCost === 0 && (
                  <p className="text-xs text-orange-600 dark:text-orange-400 mt-1">
                    ⚠ No previous purchase. Please enter cost manually
                  </p>
                )}
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
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Notes
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:text-white"
                placeholder="Describe the issue, reason for return, or additional details..."
              />
            </div>
          </CardContent>
        </Card>

        {/* Summary */}
        {productId && variationId && quantity > 0 && unitCost > 0 && (
          <Card className="border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/30">
            <CardContent className="pt-6">
              <div className="space-y-3">
                <h3 className="font-semibold text-blue-900 dark:text-blue-100">Return Summary</h3>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-blue-700 dark:text-blue-300">Quantity:</span>
                  <span className="font-semibold">{quantity} units</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-blue-700 dark:text-blue-300">Unit Cost:</span>
                  <span className="font-semibold">{formatCurrency(unitCost)}</span>
                </div>
                <div className="flex justify-between items-center text-lg font-bold pt-3 border-t border-blue-200">
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
            disabled={loading || !supplierId || !productId || !variationId || !locationId}
            className="bg-gradient-to-r from-orange-600 to-orange-500 hover:from-orange-700 hover:to-orange-600 text-white disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {loading && (
              <ArrowPathIcon className="w-5 h-5 mr-2 animate-spin" />
            )}
            {loading ? 'Creating Return...' : 'Create Return'}
          </Button>
        </div>
      </form>
    </div>
  )
}
