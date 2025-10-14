'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { MagnifyingGlassIcon, QrCodeIcon } from '@heroicons/react/24/outline'
import { toast } from 'sonner'

interface SerialLookupResult {
  serialNumber: string
  imei: string | null
  status: string
  condition: string
  product: {
    id: number
    name: string
    sku: string
    variation: string
  }
  supplier: {
    id: number
    name: string
    contactPerson: string | null
    email: string | null
    mobile: string | null
    address: string | null
    city: string | null
    state: string | null
    country: string | null
    paymentTerms: string | null
  } | null
  dateReceived: string | null
  receiptNumber: string
  receiptDate: string | null
  warranty: {
    isUnderWarranty: boolean
    warrantyExpired: boolean
    warrantyStartDate: string | null
    warrantyEndDate: string | null
  }
  currentLocation: {
    id: number
    name: string
  } | null
  saleInfo: {
    soldAt: string
    soldTo: string | null
    salePrice: number | null
  } | null
  purchaseCost: number | null
}

export default function SerialNumberLookupPage() {
  const [searchTerm, setSearchTerm] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<SerialLookupResult | null>(null)
  const [notFound, setNotFound] = useState(false)

  const handleSearch = async () => {
    if (!searchTerm.trim()) {
      toast.error('Please enter a serial number')
      return
    }

    try {
      setLoading(true)
      setNotFound(false)
      setResult(null)

      const res = await fetch(`/api/serial-numbers/lookup?serial=${encodeURIComponent(searchTerm.trim())}`)
      const data = await res.json()

      if (!res.ok) {
        if (res.status === 404) {
          setNotFound(true)
          toast.error('Serial number not found')
        } else {
          throw new Error(data.error || 'Failed to lookup serial number')
        }
        return
      }

      setResult(data.data)
      toast.success('Serial number found!')
    } catch (error: any) {
      console.error('Search error:', error)
      toast.error(error.message || 'Failed to search')
    } finally {
      setLoading(false)
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch()
    }
  }

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return 'N/A'
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
  }

  return (
    <div className="container mx-auto p-4 sm:p-6 max-w-6xl">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
          Serial Number Lookup
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mt-2">
          Quick search to find supplier and warranty information for any serial number
        </p>
      </div>

      {/* Search Box */}
      <Card className="mb-6">
        <CardContent className="pt-6">
          <div className="flex gap-3">
            <div className="flex-1">
              <Input
                type="text"
                placeholder="Enter serial number or scan barcode..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onKeyDown={handleKeyPress}
                className="text-lg h-12"
                autoFocus
              />
            </div>
            <Button
              onClick={handleSearch}
              disabled={loading || !searchTerm.trim()}
              size="lg"
              className="gap-2"
            >
              <MagnifyingGlassIcon className="w-5 h-5" />
              {loading ? 'Searching...' : 'Search'}
            </Button>
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
            💡 Tip: You can scan barcodes directly or type the serial number manually
          </p>
        </CardContent>
      </Card>

      {/* Not Found Message */}
      {notFound && (
        <Card className="border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/30">
          <CardContent className="pt-6">
            <div className="text-center py-8">
              <QrCodeIcon className="w-16 h-16 mx-auto mb-4 text-red-500" />
              <h3 className="text-xl font-semibold text-red-900 dark:text-red-100 mb-2">
                Serial Number Not Found
              </h3>
              <p className="text-red-700 dark:text-red-300">
                Serial number &quot;{searchTerm}&quot; does not exist in the system.
              </p>
              <p className="text-sm text-red-600 dark:text-red-400 mt-2">
                Please check the serial number and try again.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Results */}
      {result && (
        <div className="space-y-6">
          {/* Supplier Info Card (MOST IMPORTANT for warranty returns!) */}
          <Card className="border-2 border-blue-200 dark:border-blue-800">
            <CardHeader className="bg-blue-50 dark:bg-blue-950/30">
              <CardTitle className="text-blue-900 dark:text-blue-100 flex items-center gap-2">
                <span className="text-2xl">📦</span>
                Supplier Information (Return To)
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              {result.supplier ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-gray-600 dark:text-gray-400">Supplier Name</label>
                    <p className="text-lg font-bold text-gray-900 dark:text-white">{result.supplier.name}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-600 dark:text-gray-400">Contact Person</label>
                    <p className="text-lg text-gray-900 dark:text-white">{result.supplier.contactPerson || 'N/A'}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-600 dark:text-gray-400">Email</label>
                    <p className="text-lg text-gray-900 dark:text-white">{result.supplier.email || 'N/A'}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-600 dark:text-gray-400">Mobile</label>
                    <p className="text-lg text-gray-900 dark:text-white">{result.supplier.mobile || 'N/A'}</p>
                  </div>
                  <div className="md:col-span-2">
                    <label className="text-sm font-medium text-gray-600 dark:text-gray-400">Address</label>
                    <p className="text-lg text-gray-900 dark:text-white">
                      {result.supplier.address || 'N/A'}
                      {result.supplier.city && `, ${result.supplier.city}`}
                      {result.supplier.state && `, ${result.supplier.state}`}
                      {result.supplier.country && `, ${result.supplier.country}`}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="text-center py-4 text-yellow-700 dark:text-yellow-300 bg-yellow-50 dark:bg-yellow-950/30 rounded-lg">
                  ⚠️ No supplier information available for this serial number
                </div>
              )}
            </CardContent>
          </Card>

          {/* Date Received Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <span className="text-2xl">📅</span>
                Date Information
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-600 dark:text-gray-400">Date Received</label>
                  <p className="text-lg font-semibold text-gray-900 dark:text-white">
                    {formatDate(result.dateReceived)}
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-600 dark:text-gray-400">Receipt Number</label>
                  <p className="text-lg font-semibold text-gray-900 dark:text-white">{result.receiptNumber}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-600 dark:text-gray-400">Receipt Date</label>
                  <p className="text-lg font-semibold text-gray-900 dark:text-white">
                    {formatDate(result.receiptDate)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Product Info Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <span className="text-2xl">📱</span>
                Product Information
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-600 dark:text-gray-400">Product Name</label>
                  <p className="text-lg font-semibold text-gray-900 dark:text-white">{result.product.name}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-600 dark:text-gray-400">SKU</label>
                  <p className="text-lg text-gray-900 dark:text-white">{result.product.sku}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-600 dark:text-gray-400">Variation</label>
                  <p className="text-lg text-gray-900 dark:text-white">{result.product.variation}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-600 dark:text-gray-400">Serial Number</label>
                  <p className="text-lg font-mono font-bold text-blue-600 dark:text-blue-400">{result.serialNumber}</p>
                </div>
                {result.imei && (
                  <div>
                    <label className="text-sm font-medium text-gray-600 dark:text-gray-400">IMEI</label>
                    <p className="text-lg font-mono text-gray-900 dark:text-white">{result.imei}</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Status & Warranty Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <span className="text-2xl">🛡️</span>
                Status & Warranty
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-600 dark:text-gray-400">Current Status</label>
                  <div className="mt-1">
                    <Badge variant={result.status === 'in_stock' ? 'default' : 'secondary'}>
                      {result.status.replace('_', ' ').toUpperCase()}
                    </Badge>
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-600 dark:text-gray-400">Condition</label>
                  <div className="mt-1">
                    <Badge variant={result.condition === 'new' ? 'default' : 'secondary'}>
                      {result.condition.toUpperCase()}
                    </Badge>
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-600 dark:text-gray-400">Warranty Status</label>
                  <div className="mt-1">
                    {result.warranty.isUnderWarranty ? (
                      <Badge className="bg-green-500 text-white">✅ Under Warranty</Badge>
                    ) : result.warranty.warrantyExpired ? (
                      <Badge variant="destructive">⚠️ Warranty Expired</Badge>
                    ) : (
                      <Badge variant="secondary">No Warranty</Badge>
                    )}
                  </div>
                </div>
                {result.warranty.warrantyEndDate && (
                  <div>
                    <label className="text-sm font-medium text-gray-600 dark:text-gray-400">Warranty End Date</label>
                    <p className="text-lg text-gray-900 dark:text-white">
                      {formatDate(result.warranty.warrantyEndDate)}
                    </p>
                  </div>
                )}
                {result.currentLocation && (
                  <div>
                    <label className="text-sm font-medium text-gray-600 dark:text-gray-400">Current Location</label>
                    <p className="text-lg text-gray-900 dark:text-white">{result.currentLocation.name}</p>
                  </div>
                )}
                {result.purchaseCost && (
                  <div>
                    <label className="text-sm font-medium text-gray-600 dark:text-gray-400">Purchase Cost</label>
                    <p className="text-lg font-semibold text-gray-900 dark:text-white">
                      ₱{parseFloat(result.purchaseCost.toString()).toFixed(2)}
                    </p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Sale Info (if sold) */}
          {result.saleInfo && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <span className="text-2xl">💰</span>
                  Sale Information
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="text-sm font-medium text-gray-600 dark:text-gray-400">Sold Date</label>
                    <p className="text-lg text-gray-900 dark:text-white">{formatDate(result.saleInfo.soldAt)}</p>
                  </div>
                  {result.saleInfo.soldTo && (
                    <div>
                      <label className="text-sm font-medium text-gray-600 dark:text-gray-400">Sold To</label>
                      <p className="text-lg text-gray-900 dark:text-white">{result.saleInfo.soldTo}</p>
                    </div>
                  )}
                  {result.saleInfo.salePrice && (
                    <div>
                      <label className="text-sm font-medium text-gray-600 dark:text-gray-400">Sale Price</label>
                      <p className="text-lg font-semibold text-gray-900 dark:text-white">
                        ₱{parseFloat(result.saleInfo.salePrice.toString()).toFixed(2)}
                      </p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  )
}
