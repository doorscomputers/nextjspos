'use client'

/**
 * Inventory Transaction Ledger Report
 *
 * Purpose: Track complete inventory history of a product at a specific location,
 * showing all transactions since the last inventory correction to prove
 * current system inventory matches reality.
 */

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { usePermissions } from '@/hooks/usePermissions'
import { PERMISSIONS } from '@/lib/rbac'

interface Product {
  id: number
  name: string
  sku: string
  variations: ProductVariation[]
}

interface ProductVariation {
  id: number
  name: string
  sku?: string
}

interface Location {
  id: number
  name: string
}

interface TransactionRecord {
  date: string
  type: string
  referenceNumber: string
  description: string
  quantityIn: number
  quantityOut: number
  runningBalance: number
  user: string
  relatedLocation?: string
  referenceId?: number
  referenceType?: string
}

interface LedgerData {
  header: {
    product: {
      id: number
      name: string
      sku: string
      variation: ProductVariation
    }
    location: {
      id: number
      name: string
    }
    reportPeriod: {
      from: string
      to: string
      description: string
    }
    baseline: {
      quantity: number
      date: string | null
      description: string
    }
  }
  transactions: TransactionRecord[]
  summary: {
    totalStockIn: number
    totalStockOut: number
    netChange: number
    startingBalance: number
    calculatedFinalBalance: number
    currentSystemInventory: number
    variance: number
    isReconciled: boolean
    reconciliationStatus: string
    transactionCount: number
  }
}

export default function InventoryLedgerPage() {
  const { data: session } = useSession()
  const { can } = usePermissions()

  const [products, setProducts] = useState<Product[]>([])
  const [locations, setLocations] = useState<Location[]>([])
  const [hasAccessToAll, setHasAccessToAll] = useState<boolean>(false)
  const [selectedProduct, setSelectedProduct] = useState<number | null>(null)
  const [selectedVariation, setSelectedVariation] = useState<number | null>(null)
  const [selectedLocation, setSelectedLocation] = useState<number | null>(null)
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [loading, setLoading] = useState(false)
  const [loadingData, setLoadingData] = useState(true)
  const [ledgerData, setLedgerData] = useState<LedgerData | null>(null)
  const [error, setError] = useState('')
  const [searchQuery, setSearchQuery] = useState('')

  // Check permission
  if (!can('inventory_ledger.view')) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          <p className="font-medium">Access Denied</p>
          <p className="text-sm">You do not have permission to view the inventory ledger.</p>
        </div>
      </div>
    )
  }

  // Load products and locations on mount
  useEffect(() => {
    loadInitialData()
  }, [])

  const loadInitialData = async () => {
    try {
      setLoadingData(true)
      const productsRes = await fetch('/api/products')

      if (productsRes.ok) {
        const productsData = await productsRes.json()
        console.log('Products loaded:', productsData.products?.length || 0)
        setProducts(productsData.products || [])
      } else {
        console.error('Failed to load products:', productsRes.status)
      }

      // Load locations with role-aware filtering
      let locs: any[] = []
      let accessAll = false
      let primaryLocationId: string | null = null
      try {
        const ulRes = await fetch('/api/user-locations')
        if (ulRes.ok) {
          const ul = await ulRes.json()
          const list = Array.isArray(ul.locations) ? ul.locations : []
          // Inventory ledger should include warehouse locations
          locs = list
          accessAll = Boolean(ul.hasAccessToAll)
          primaryLocationId = ul.primaryLocationId ? String(ul.primaryLocationId) : null
        }
      } catch (e) {
        console.warn('Failed to fetch /api/user-locations, falling back to /api/locations', e)
      }

      if (!locs.length) {
        const lr = await fetch('/api/locations')
        if (lr.ok) {
          const data = await lr.json()
          const list = Array.isArray(data)
            ? data
            : Array.isArray(data.locations)
              ? data.locations
              : Array.isArray(data.data)
                ? data.data
                : []
          // Inventory ledger should include warehouse locations
          locs = list
          accessAll = true
        }
      }

      setLocations(locs)
      setHasAccessToAll(accessAll)
      // Auto-select for restricted users if none is chosen
      if (!accessAll) {
        const resolved = primaryLocationId || (locs[0]?.id ? Number(locs[0].id) : null)
        if (resolved !== null) setSelectedLocation(resolved)
      }
    } catch (err) {
      console.error('Error loading data:', err)
      setError('Failed to load initial data')
    } finally {
      setLoadingData(false)
    }
  }

  const generateReport = async () => {
    if (!selectedProduct || !selectedVariation || !selectedLocation) {
      setError('Please select product, variation, and location')
      return
    }

    setLoading(true)
    setError('')
    setLedgerData(null)

    try {
      const params = new URLSearchParams({
        productId: selectedProduct.toString(),
        variationId: selectedVariation.toString(),
        locationId: selectedLocation.toString()
      })

      if (startDate) params.append('startDate', startDate)
      if (endDate) params.append('endDate', endDate)

      const response = await fetch(`/api/reports/inventory-ledger-new?${params}`)
      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.message || 'Failed to generate report')
      }

      setLedgerData(result.data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate report')
    } finally {
      setLoading(false)
    }
  }

  const exportToExcel = () => {
    if (!ledgerData) return

    // Create CSV content
    let csv = 'Inventory Transaction Ledger\n\n'
    csv += `Product:,${ledgerData.header.product.name} (${ledgerData.header.product.sku})\n`
    csv += `Variation:,${ledgerData.header.product.variation.name}\n`
    csv += `Location:,${ledgerData.header.location.name}\n`
    csv += `Period:,${new Date(ledgerData.header.reportPeriod.from).toLocaleDateString()} to ${new Date(ledgerData.header.reportPeriod.to).toLocaleDateString()}\n`
    csv += `Starting Balance:,${ledgerData.summary.startingBalance}\n\n`

    csv += 'Date & Time,Transaction Type,Reference Number,Description,Quantity In (+),Quantity Out (-),Running Balance,User,Related Location\n'

    ledgerData.transactions.forEach(t => {
      csv += `${new Date(t.date).toLocaleString()},${t.type},${t.referenceNumber},"${t.description}",${t.quantityIn},${t.quantityOut},${t.runningBalance},${t.user},${t.relatedLocation || ''}\n`
    })

    csv += `\nSummary\n`
    csv += `Total Stock In,${ledgerData.summary.totalStockIn}\n`
    csv += `Total Stock Out,${ledgerData.summary.totalStockOut}\n`
    csv += `Net Change,${ledgerData.summary.netChange}\n`
    csv += `Calculated Final Balance,${ledgerData.summary.calculatedFinalBalance}\n`
    csv += `Current System Inventory,${ledgerData.summary.currentSystemInventory}\n`
    csv += `Variance,${ledgerData.summary.variance}\n`
    csv += `Reconciliation Status,${ledgerData.summary.reconciliationStatus}\n`

    // Download file
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `inventory-ledger-${ledgerData.header.product.sku}-${new Date().toISOString().slice(0, 10)}.csv`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    window.URL.revokeObjectURL(url)
  }

  const printReport = () => {
    window.print()
  }

  // Filter products based on search and selected location
  const filteredProducts = products.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.sku.toLowerCase().includes(searchQuery.toLowerCase())

    // If a location is selected, only show products that have variations at that location
    // (This will be validated when the report is generated)
    return matchesSearch
  })

  const selectedProductData = products.find(p => p.id === selectedProduct)

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-sm p-4 md:p-6 mb-6">
          <h1 className="text-2xl md:text-3xl font-bold text-gray-800 mb-2">
            Inventory Transaction Ledger
          </h1>
          <p className="text-sm md:text-base text-gray-600">
            Track complete inventory history proving current stock matches reality
          </p>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-lg shadow-sm p-4 md:p-6 mb-6 print:hidden">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">Report Parameters</h2>

          {loadingData ? (
            <div className="text-center py-8">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              <p className="mt-2 text-gray-600">Loading data...</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* Step 1: Location Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  1. Location <span className="text-red-500">*</span>
                </label>
                <select
                  value={selectedLocation || ''}
                  onChange={(e) => {
                    setSelectedLocation(parseInt(e.target.value))
                    // Reset product and variation when location changes
                    setSelectedProduct(null)
                    setSelectedVariation(null)
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                >
                  {hasAccessToAll ? (
                    <option value="">All Locations</option>
                  ) : (
                    <option value="">Select Location First</option>
                  )}
                  {locations.map((location) => (
                    <option key={location.id} value={location.id}>
                      {location.name}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-gray-500 mt-1">Select location to view its products</p>
              </div>

              {/* Step 2: Product Search */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  2. Search Product {selectedLocation && `(${filteredProducts.length} available)`}
                </label>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by name or SKU..."
                  disabled={!selectedLocation}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                />
                {!selectedLocation && (
                  <p className="text-xs text-amber-600 mt-1">Select a location first</p>
                )}
                {selectedLocation && searchQuery && (
                  <p className="text-xs text-gray-500 mt-1">
                    {filteredProducts.length === 0 ? 'No products found' : `Showing ${filteredProducts.length} product(s)`}
                  </p>
                )}
              </div>

              {/* Step 3: Product Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  3. Product <span className="text-red-500">*</span>
                </label>
                <select
                  value={selectedProduct || ''}
                  onChange={(e) => {
                    setSelectedProduct(parseInt(e.target.value))
                    setSelectedVariation(null)
                  }}
                  disabled={!selectedLocation}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white disabled:bg-gray-100 disabled:cursor-not-allowed"
                >
                  <option value="">
                    {filteredProducts.length === 0 ? 'No products available' : `Select Product (${filteredProducts.length} available)`}
                  </option>
                  {filteredProducts.map((product) => (
                    <option key={product.id} value={product.id}>
                      {product.name} ({product.sku})
                    </option>
                  ))}
                </select>
              </div>

              {/* Step 4: Variation Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  4. Variation <span className="text-red-500">*</span>
                </label>
                <select
                  value={selectedVariation || ''}
                  onChange={(e) => setSelectedVariation(parseInt(e.target.value))}
                  disabled={!selectedProduct}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white disabled:bg-gray-100 disabled:cursor-not-allowed"
                >
                  <option value="">Select Variation</option>
                  {selectedProductData?.variations.map((variation) => (
                    <option key={variation.id} value={variation.id}>
                      {variation.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Date Range (Advanced - Optional Override) */}
              <div className="col-span-1 md:col-span-2 lg:col-span-3">
                <div className="bg-blue-50 border border-blue-200 rounded-md p-3 mb-3">
                  <p className="text-xs text-blue-800">
                    <strong>ℹ️ Date Range:</strong> By default, the report automatically uses the <strong>Last Inventory Correction Date</strong> as the start and <strong>Current Date/Time</strong> as the end.
                    Leave these fields empty for normal operation. Only override for debugging or custom date ranges.
                  </p>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Override Start Date (Advanced)
                </label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  placeholder="Auto: Last Correction Date"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <p className="text-xs text-gray-500 mt-1">Leave empty to use last correction date</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Override End Date (Advanced)
                </label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  placeholder="Auto: Current Date/Time"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <p className="text-xs text-gray-500 mt-1">Leave empty to use current date/time</p>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="mt-6 flex flex-wrap gap-3">
            <button
              onClick={generateReport}
              disabled={loading || !selectedProduct || !selectedVariation || !selectedLocation}
              className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white shadow-sm rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
            >
              {loading ? 'Generating...' : 'Generate Report'}
            </button>

            {ledgerData && (
              <>
                <button
                  onClick={exportToExcel}
                  className="px-6 py-2 bg-green-600 hover:bg-green-700 text-white shadow-sm rounded-lg transition-colors font-medium"
                >
                  Export to Excel
                </button>
                <button
                  onClick={printReport}
                  className="px-6 py-2 bg-purple-600 hover:bg-purple-700 text-white shadow-sm rounded-lg transition-colors font-medium"
                >
                  Print Report
                </button>
              </>
            )}
          </div>

          {error && (
            <div className="mt-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
              {error}
            </div>
          )}
        </div>

        {/* Report Display */}
        {ledgerData && (
          <div className="bg-white rounded-lg shadow-sm p-4 md:p-6 print:shadow-none">
            {/* Report Header */}
            <div className="border-b pb-4 mb-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-gray-600">Product:</p>
                  <p className="font-semibold text-gray-800">
                    {ledgerData.header.product.name} ({ledgerData.header.product.sku})
                  </p>
                </div>
                <div>
                  <p className="text-gray-600">Variation:</p>
                  <p className="font-semibold text-gray-800">
                    {ledgerData.header.product.variation.name}
                  </p>
                </div>
                <div>
                  <p className="text-gray-600">Location:</p>
                  <p className="font-semibold text-gray-800">
                    {ledgerData.header.location.name}
                  </p>
                </div>
                <div>
                  <p className="text-gray-600">Report Period:</p>
                  <p className="font-semibold text-gray-800">
                    {new Date(ledgerData.header.reportPeriod.from).toLocaleDateString()} to{' '}
                    {new Date(ledgerData.header.reportPeriod.to).toLocaleDateString()}
                  </p>
                </div>
                <div>
                  <p className="text-gray-600">Starting Balance:</p>
                  <p className="font-semibold text-gray-800">
                    {ledgerData.summary.startingBalance.toFixed(2)} units
                  </p>
                </div>
                <div>
                  <p className="text-gray-600">Baseline:</p>
                  <p className="font-semibold text-gray-800 text-xs md:text-sm">
                    {ledgerData.header.baseline.description}
                  </p>
                </div>
              </div>
            </div>

            {/* Custom Date Range Notice */}
            {ledgerData.header.baseline.description.includes('Custom date range') && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                <div className="flex items-start gap-3">
                  <span className="text-2xl">ℹ️</span>
                  <div className="flex-1">
                    <p className="font-semibold text-blue-900 mb-2">Custom Date Range Detected</p>
                    <p className="text-sm text-blue-800">
                      You are using a custom date range. The <strong>Opening Balance</strong> has been automatically calculated
                      from all transactions that occurred <strong>before</strong> your selected start date ({new Date(ledgerData.header.reportPeriod.from).toLocaleDateString()}).
                    </p>
                    <p className="text-sm text-blue-800 mt-2">
                      This ensures accurate reconciliation even when viewing a specific time period. The closing balance
                      reflects transactions only within your selected range.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Reconciliation Status */}
            <div className={`p-4 rounded-lg mb-6 ${ledgerData.summary.isReconciled
              ? 'bg-green-50 border border-green-200'
              : 'bg-red-50 border border-red-200'
              }`}>
              <div className="flex items-center justify-between flex-wrap gap-4">
                <div>
                  <p className="font-semibold text-lg">
                    {ledgerData.summary.isReconciled ? '✅ Reconciliation Status: Matched' : '❌ Reconciliation Status: Discrepancy'}
                  </p>
                  <p className="text-sm mt-1">
                    Calculated Balance: <span className="font-semibold">{ledgerData.summary.calculatedFinalBalance.toFixed(2)}</span> |
                    System Inventory: <span className="font-semibold">{ledgerData.summary.currentSystemInventory.toFixed(2)}</span>
                    {!ledgerData.summary.isReconciled && (
                      <> | Variance: <span className="font-semibold text-red-600">{ledgerData.summary.variance.toFixed(2)}</span></>
                    )}
                  </p>
                </div>
              </div>
            </div>

            {/* Transactions Table */}
            <div className="overflow-x-auto">
              {ledgerData.transactions.length === 0 ? (
                <div className="bg-gray-50 border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
                  <p className="text-gray-600 text-lg mb-2">No transactions found in the selected period</p>
                  <p className="text-sm text-gray-500">
                    The opening balance of {ledgerData.summary.startingBalance.toFixed(2)} units represents
                    the stock level at the start of your selected date range.
                  </p>
                  {ledgerData.header.baseline.description.includes('Custom date range') && (
                    <p className="text-sm text-gray-500 mt-2">
                      This balance was calculated from all transactions before {new Date(ledgerData.header.reportPeriod.from).toLocaleDateString()}.
                    </p>
                  )}
                </div>
              ) : (
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Date & Time
                      </th>
                      <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Type
                      </th>
                      <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Reference
                      </th>
                      <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Description
                      </th>
                      <th className="px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Qty In (+)
                      </th>
                      <th className="px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Qty Out (-)
                      </th>
                      <th className="px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Balance
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {ledgerData.transactions.map((transaction, index) => (
                      <tr key={index} className="hover:bg-gray-50">
                        <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-900">
                          {new Date(transaction.date).toLocaleString()}
                        </td>
                        <td className="px-3 py-4 whitespace-nowrap text-sm">
                          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded ${transaction.type === 'Stock Received' || transaction.type === 'Transfer In' || transaction.type === 'Sales Return'
                            ? 'bg-green-100 text-green-800'
                            : transaction.type === 'Inventory Correction'
                              ? 'bg-blue-100 text-blue-800'
                              : 'bg-red-100 text-red-800'
                            }`}>
                            {transaction.type}
                          </span>
                        </td>
                        <td className="px-3 py-4 whitespace-nowrap text-sm font-medium text-blue-600">
                          {transaction.referenceNumber}
                        </td>
                        <td className="px-3 py-4 text-sm text-gray-700">
                          {transaction.description}
                        </td>
                        <td className="px-3 py-4 whitespace-nowrap text-sm text-right text-green-600 font-semibold">
                          {transaction.quantityIn > 0 ? transaction.quantityIn.toFixed(2) : '-'}
                        </td>
                        <td className="px-3 py-4 whitespace-nowrap text-sm text-right text-red-600 font-semibold">
                          {transaction.quantityOut > 0 ? transaction.quantityOut.toFixed(2) : '-'}
                        </td>
                        <td className="px-3 py-4 whitespace-nowrap text-sm text-right font-bold text-gray-900">
                          {transaction.runningBalance.toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {/* Summary Footer */}
            <div className="mt-6 border-t pt-6">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div className="bg-green-50 p-3 rounded">
                  <p className="text-gray-600 text-xs">Total Stock In</p>
                  <p className="font-bold text-lg text-green-700">
                    {ledgerData.summary.totalStockIn.toFixed(2)}
                  </p>
                </div>
                <div className="bg-red-50 p-3 rounded">
                  <p className="text-gray-600 text-xs">Total Stock Out</p>
                  <p className="font-bold text-lg text-red-700">
                    {ledgerData.summary.totalStockOut.toFixed(2)}
                  </p>
                </div>
                <div className="bg-blue-50 p-3 rounded">
                  <p className="text-gray-600 text-xs">Net Change</p>
                  <p className="font-bold text-lg text-blue-700">
                    {ledgerData.summary.netChange.toFixed(2)}
                  </p>
                </div>
                <div className="bg-gray-50 p-3 rounded">
                  <p className="text-gray-600 text-xs">Transaction Count</p>
                  <p className="font-bold text-lg text-gray-700">
                    {ledgerData.summary.transactionCount}
                  </p>
                </div>
              </div>
            </div>

            {/* Print Footer */}
            <div className="hidden print:block mt-6 text-xs text-gray-500 text-center">
              Generated on {new Date().toLocaleString()} | PciNet Computer Trading and Services
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
