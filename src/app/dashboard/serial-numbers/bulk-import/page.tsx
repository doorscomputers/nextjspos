"use client"

import { useState, useEffect } from 'react'
import { usePermissions } from '@/hooks/usePermissions'
import { useUserPrimaryLocation } from '@/hooks/useUserPrimaryLocation'
import { PERMISSIONS } from '@/lib/rbac'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { ArrowLeftIcon, PlusIcon, TrashIcon } from '@heroicons/react/24/outline'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'sonner'
import SKUBarcodeSearch from '@/components/SKUBarcodeSearch'
import ProductNameSearch from '@/components/ProductNameSearch'

interface Supplier {
  id: number
  name: string
  mobile: string | null
  email: string | null
}

interface Product {
  id: number
  name: string
  categoryName?: string | null
  variations: ProductVariation[]
  matchType?: 'exact' | 'fuzzy'
}

interface ProductVariation {
  id: number
  name: string
  sku: string | null
  barcode: string | null
  enableSerialNumber: boolean
  defaultPurchasePrice?: number | null
  defaultSellingPrice?: number | null
}

interface SerialNumberEntry {
  productId: number
  productVariationId: number
  productName: string
  variationName: string
  sku: string | null
  serialNumber: string
  imei?: string
}

export default function BulkSerialNumberImportPage() {
  const { can, user } = usePermissions()
  const { data: session } = useSession()
  const router = useRouter()

  // Location detection from session
  const { locationId, location, loading: locationLoading, noLocationAssigned } = useUserPrimaryLocation()

  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  // Form state
  const [supplierId, setSupplierId] = useState('')
  const [purchaseDate, setPurchaseDate] = useState(() => {
    const today = new Date()
    return today.toISOString().split('T')[0]
  })
  const currentLocationId = locationId?.toString() || ''
  const currentLocationName = location?.name || ''

  const [entries, setEntries] = useState<SerialNumberEntry[]>([])
  const [searchMethod, setSearchMethod] = useState<'beginsWith' | 'contains'>('beginsWith')

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      setLoading(true)
      const suppliersRes = await fetch('/api/suppliers')
      const suppliersData = await suppliersRes.json()

      if (suppliersRes.ok) {
        setSuppliers(suppliersData.suppliers || suppliersData || [])
      }
    } catch (error) {
      console.error('Error fetching data:', error)
      toast.error('Failed to load suppliers')
    } finally {
      setLoading(false)
    }
  }

  const handleProductSelect = (product: Product, variation: ProductVariation) => {
    if (!variation.enableSerialNumber) {
      toast.error(`${product.name} - ${variation.name} does not require serial numbers`)
      return
    }

    // Add a new blank entry for this product
    const newEntry: SerialNumberEntry = {
      productId: product.id,
      productVariationId: variation.id,
      productName: product.name,
      variationName: variation.name,
      sku: variation.sku,
      serialNumber: '',
      imei: undefined,
    }

    setEntries([...entries, newEntry])
    toast.success(`Added product: ${product.name} - ${variation.name}. Now enter serial number.`)
  }

  const handleSerialNumberChange = (index: number, field: 'serialNumber' | 'imei', value: string) => {
    const newEntries = [...entries]
    if (field === 'serialNumber') {
      newEntries[index].serialNumber = value
    } else {
      newEntries[index].imei = value
    }
    setEntries(newEntries)
  }

  const handleRemoveEntry = (index: number) => {
    setEntries(entries.filter((_, i) => i !== index))
  }

  const handleSubmit = async () => {
    // Validation
    if (!supplierId) {
      toast.error('Please select a supplier')
      return
    }

    if (!currentLocationId) {
      toast.error('Location is required')
      return
    }

    if (entries.length === 0) {
      toast.error('Please add at least one serial number entry')
      return
    }

    // Validate all serial numbers are filled
    const emptySerials = entries.filter(e => !e.serialNumber.trim())
    if (emptySerials.length > 0) {
      toast.error(`Please enter serial numbers for all products (${emptySerials.length} missing)`)
      return
    }

    // Check for duplicate serial numbers in this batch
    const serialNumbers = entries.map(e => e.serialNumber.trim().toLowerCase())
    const duplicates = serialNumbers.filter((item, index) => serialNumbers.indexOf(item) !== index)
    if (duplicates.length > 0) {
      toast.error(`Duplicate serial numbers found: ${duplicates.join(', ')}`)
      return
    }

    try {
      setSubmitting(true)

      const response = await fetch('/api/serial-numbers/bulk-import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          supplierId: parseInt(supplierId),
          locationId: parseInt(currentLocationId),
          purchaseDate: new Date(purchaseDate).toISOString(),
          entries: entries.map(e => ({
            productId: e.productId,
            productVariationId: e.productVariationId,
            serialNumber: e.serialNumber.trim(),
            imei: e.imei?.trim() || null,
          })),
        }),
      })

      const data = await response.json()

      if (response.ok) {
        toast.success(`Successfully imported ${entries.length} serial number(s)`)

        // Reset form
        setEntries([])
        setSupplierId('')

        // Optionally redirect or stay on page
        // router.push('/dashboard/serial-numbers')
      } else {
        toast.error(data.error || 'Failed to import serial numbers')

        // If there are specific duplicate errors, show them
        if (data.duplicates && data.duplicates.length > 0) {
          toast.error(`Duplicate serial numbers already exist: ${data.duplicates.join(', ')}`)
        }
      }
    } catch (error) {
      console.error('Error importing serial numbers:', error)
      toast.error('Failed to import serial numbers')
    } finally {
      setSubmitting(false)
    }
  }

  if (!can(PERMISSIONS.PURCHASE_CREATE)) {
    return (
      <div className="p-8">
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-800 dark:text-red-200 px-4 py-3 rounded">
          You do not have permission to import serial numbers.
        </div>
      </div>
    )
  }

  if (loading || locationLoading) {
    return (
      <div className="p-6">
        <div className="text-center py-12">
          <div className="text-gray-500 dark:text-gray-400">Loading form data...</div>
        </div>
      </div>
    )
  }

  if (noLocationAssigned) {
    return (
      <div className="p-8">
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-800 dark:text-red-200 px-4 py-3 rounded">
          <strong className="font-semibold">No Location Assigned</strong>
          <p className="mt-2">You need to have a location assigned to import serial numbers.</p>
          <p className="mt-1">Please contact your administrator.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/dashboard/serial-numbers">
          <Button
            variant="outline"
            size="sm"
            className="group px-4 py-2.5 bg-gradient-to-r from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-700 hover:from-blue-50 hover:to-indigo-50 dark:hover:from-blue-900/30 dark:hover:to-indigo-900/30 border-2 border-gray-300 dark:border-gray-600 hover:border-blue-400 dark:hover:border-blue-500 shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105 rounded-lg font-semibold"
          >
            <ArrowLeftIcon className="w-4 h-4 mr-2 group-hover:-translate-x-1 transition-transform duration-300" />
            <span className="bg-gradient-to-r from-gray-700 to-gray-900 dark:from-gray-200 dark:to-gray-100 group-hover:from-blue-600 group-hover:to-indigo-600 dark:group-hover:from-blue-400 dark:group-hover:to-indigo-400 bg-clip-text text-transparent">
              Back
            </span>
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Historical Serial Number Import
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Import serial numbers for products purchased before system implementation
          </p>
        </div>
      </div>

      {/* Info Banner */}
      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
        <div className="flex gap-3">
          <div className="flex-shrink-0">
            <svg className="h-5 w-5 text-blue-600 dark:text-blue-400" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
            </svg>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-blue-900 dark:text-blue-200">
              Purpose: Warranty Tracking for Existing Inventory
            </h3>
            <p className="text-sm text-blue-800 dark:text-blue-300 mt-1">
              Use this page to record serial numbers for products purchased BEFORE this system was implemented.
              This allows warranty returns to be tracked back to the original supplier.
            </p>
            <p className="text-xs text-blue-700 dark:text-blue-400 mt-2">
              <strong>Workflow:</strong> Select Supplier → Search Product → Enter Serial Number(s) → Submit
            </p>
          </div>
        </div>
      </div>

      <form onSubmit={(e) => e.preventDefault()} className="space-y-6">
        {/* Header Information */}
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow border border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white">Import Information</h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Supplier */}
            <div className="space-y-2">
              <Label htmlFor="supplier" className="text-gray-900 dark:text-gray-200">
                Supplier <span className="text-red-500">*</span>
              </Label>
              <Select value={supplierId} onValueChange={setSupplierId}>
                <SelectTrigger id="supplier">
                  <SelectValue placeholder="Select supplier" />
                </SelectTrigger>
                <SelectContent>
                  {suppliers.map((supplier) => (
                    <SelectItem key={supplier.id} value={supplier.id.toString()}>
                      {supplier.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                All serial numbers will be linked to this supplier for warranty tracking
              </p>
            </div>

            {/* Purchase Date */}
            <div className="space-y-2">
              <Label htmlFor="purchaseDate" className="text-gray-900 dark:text-gray-200">
                Purchase Date <span className="text-red-500">*</span>
              </Label>
              <Input
                id="purchaseDate"
                type="date"
                value={purchaseDate}
                onChange={(e) => setPurchaseDate(e.target.value)}
                required
              />
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Approximate date when products were purchased
              </p>
            </div>

            {/* Current Location */}
            <div className="space-y-2">
              <Label htmlFor="location" className="text-gray-900 dark:text-gray-200">
                Current Location <span className="text-red-500">*</span>
              </Label>
              <input
                type="text"
                value={currentLocationName}
                disabled
                className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 dark:bg-gray-700 text-gray-700 dark:text-gray-300 cursor-not-allowed font-medium"
              />
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Where these products are currently stored
              </p>
            </div>
          </div>

          {/* Created By Info */}
          <div className="mt-4 bg-gray-50 dark:bg-gray-900/50 p-3 rounded-lg">
            <p className="text-sm text-gray-700 dark:text-gray-300">
              <strong>Created By:</strong> {session?.user?.username || 'Unknown'} (automatically recorded)
            </p>
          </div>
        </div>

        {/* Add Products Section */}
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow border border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white">Search Products</h2>

          {!supplierId ? (
            <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-300 dark:border-yellow-800 text-yellow-800 dark:text-yellow-200 px-4 py-3 rounded">
              Please select a supplier first before searching for products.
            </div>
          ) : (
            <div className="space-y-6">
              {/* Product Name Search */}
              <ProductNameSearch
                onProductSelect={handleProductSelect}
                searchMethod={searchMethod}
                onSearchMethodChange={setSearchMethod}
                placeholder="Search by product name..."
                autoFocus={true}
              />

              {/* Divider */}
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-300 dark:border-gray-600"></div>
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-2 bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400">OR</span>
                </div>
              </div>

              {/* SKU/Barcode Search */}
              <SKUBarcodeSearch
                onProductSelect={handleProductSelect}
                placeholder="Scan barcode or enter exact SKU..."
                autoFocus={false}
              />
            </div>
          )}
        </div>

        {/* Serial Number Entries */}
        {entries.length > 0 && (
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow border border-gray-200 dark:border-gray-700">
            <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white">
              Serial Number Entries ({entries.length})
            </h2>

            <div className="space-y-4">
              {entries.map((entry, index) => (
                <div key={index} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <h3 className="font-semibold text-gray-900 dark:text-white">{entry.productName}</h3>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        {entry.variationName} {entry.sku && `• SKU: ${entry.sku}`}
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRemoveEntry(index)}
                    >
                      <TrashIcon className="w-4 h-4 text-red-600" />
                    </Button>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-gray-900 dark:text-gray-200">
                        Serial Number <span className="text-red-500">*</span>
                      </Label>
                      <Input
                        type="text"
                        value={entry.serialNumber}
                        onChange={(e) => handleSerialNumberChange(index, 'serialNumber', e.target.value)}
                        placeholder="Enter serial number"
                        required
                        className="font-mono"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label className="text-gray-900 dark:text-gray-200">IMEI (Optional)</Label>
                      <Input
                        type="text"
                        value={entry.imei || ''}
                        onChange={(e) => handleSerialNumberChange(index, 'imei', e.target.value)}
                        placeholder="Enter IMEI (for mobile devices)"
                        className="font-mono"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Submit Button */}
        <div className="flex justify-end gap-3">
          <Link href="/dashboard/serial-numbers">
            <Button
              type="button"
              variant="outline"
              disabled={submitting}
              className="px-6 py-2.5 bg-gradient-to-r from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-700 hover:from-gray-100 hover:to-gray-200 dark:hover:from-gray-700 dark:hover:to-gray-600 border-2 border-gray-300 dark:border-gray-600 shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-105 font-medium text-gray-700 dark:text-gray-200"
            >
              Cancel
            </Button>
          </Link>
          <Button
            type="button"
            onClick={handleSubmit}
            disabled={submitting || entries.length === 0 || !supplierId}
            className="px-8 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-semibold shadow-lg hover:shadow-2xl transition-all duration-200 hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
          >
            {submitting ? 'Importing...' : `Import ${entries.length} Serial Number(s)`}
          </Button>
        </div>
      </form>
    </div>
  )
}
