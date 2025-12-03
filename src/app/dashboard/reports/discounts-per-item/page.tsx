'use client'

import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  DocumentArrowDownIcon,
  PrinterIcon,
  ChevronDownIcon,
  ChevronRightIcon,
} from '@heroicons/react/24/outline'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import * as XLSX from 'xlsx'

interface Transaction {
  invoiceNumber: string
  saleDate: string
  locationName: string
  quantity: number
  unitPrice: number
  discountAmount: number
  totalPrice: number
  serialNumbers: string
  remarks: string
}

interface ProductDiscount {
  productId: number
  productName: string
  sku: string | null
  totalQuantity: number
  totalDiscount: number
  totalSalesValue: number
  transactionCount: number
  averageDiscountPerUnit: number
  discountPercentage: number
  transactions: Transaction[]
}

interface Summary {
  totalProducts: number
  totalQuantityDiscounted: number
  totalDiscountAmount: number
  totalTransactions: number
  averageDiscountPerTransaction: number
}

export default function DiscountsPerItemReport() {
  const [loading, setLoading] = useState(false)
  const [summary, setSummary] = useState<Summary | null>(null)
  const [products, setProducts] = useState<ProductDiscount[]>([])
  const [locations, setLocations] = useState<any[]>([])
  const [hasAccessToAll, setHasAccessToAll] = useState(false)
  const [expandedProducts, setExpandedProducts] = useState<Set<number>>(new Set())

  const [startDate, setStartDate] = useState(() => {
    const date = new Date()
    date.setDate(date.getDate() - 30)
    return date.toISOString().split('T')[0]
  })
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split('T')[0])
  const [locationId, setLocationId] = useState('')
  const [datePreset, setDatePreset] = useState<string>('last_30_days')

  useEffect(() => {
    fetchLocations()
  }, [])

  const fetchLocations = async () => {
    try {
      let list: any[] = []
      let accessAll = false
      let primaryLocationId: string | null = null

      try {
        const ulRes = await fetch('/api/user-locations')
        if (ulRes.ok) {
          const ul = await ulRes.json()
          list = Array.isArray(ul.locations) ? ul.locations : []
          list = list.filter((l: any) => l?.name && !l.name.toLowerCase().includes('warehouse'))
          accessAll = Boolean(ul.hasAccessToAll)
          primaryLocationId = ul.primaryLocationId ? String(ul.primaryLocationId) : null
        }
      } catch (e) {
        console.warn('Failed /api/user-locations, fallback to /api/locations', e)
      }

      if (!list.length) {
        const res = await fetch('/api/locations')
        if (res.ok) {
          const data = await res.json()
          const raw = Array.isArray(data)
            ? data
            : Array.isArray(data.locations)
              ? data.locations
              : Array.isArray(data.data)
                ? data.data
                : []
          list = raw.filter((l: any) => l?.name && !l.name.toLowerCase().includes('warehouse'))
          accessAll = true
        }
      }

      setLocations(list)
      setHasAccessToAll(accessAll)
      if (!accessAll) {
        const resolved = primaryLocationId || (list[0]?.id ? String(list[0].id) : '')
        setLocationId(resolved)
      }
    } catch (error) {
      console.error('Error:', error)
      setLocations([])
      setHasAccessToAll(false)
    }
  }

  const fetchReport = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (startDate) params.set('startDate', startDate)
      if (endDate) params.set('endDate', endDate)
      if (locationId) params.set('locationId', locationId)

      const res = await fetch(`/api/reports/discounts-per-item?${params}`)
      if (res.ok) {
        const data = await res.json()
        setSummary(data.summary || null)
        setProducts(data.products || [])
      }
    } catch (error) {
      console.error('Error:', error)
    } finally {
      setLoading(false)
    }
  }, [startDate, endDate, locationId])

  useEffect(() => {
    fetchReport()
  }, [fetchReport])

  const handleDatePreset = (preset: string) => {
    setDatePreset(preset)
    const today = new Date()
    let start = new Date()
    let end = new Date()

    switch (preset) {
      case 'today':
        start = today
        end = today
        break
      case 'yesterday':
        start = new Date(today.setDate(today.getDate() - 1))
        end = start
        break
      case 'last_7_days':
        start = new Date(today.setDate(today.getDate() - 7))
        end = new Date()
        break
      case 'last_30_days':
        start = new Date(today.setDate(today.getDate() - 30))
        end = new Date()
        break
      case 'this_month':
        start = new Date(today.getFullYear(), today.getMonth(), 1)
        end = new Date()
        break
      case 'last_month':
        start = new Date(today.getFullYear(), today.getMonth() - 1, 1)
        end = new Date(today.getFullYear(), today.getMonth(), 0)
        break
      case 'this_year':
        start = new Date(today.getFullYear(), 0, 1)
        end = new Date()
        break
      default:
        return
    }

    setStartDate(start.toISOString().split('T')[0])
    setEndDate(end.toISOString().split('T')[0])
  }

  const formatCurrency = (amount: number) => {
    return amount.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  }

  const toggleExpanded = (productId: number) => {
    setExpandedProducts((prev) => {
      const newSet = new Set(prev)
      if (newSet.has(productId)) {
        newSet.delete(productId)
      } else {
        newSet.add(productId)
      }
      return newSet
    })
  }

  const exportToPDF = () => {
    const doc = new jsPDF()
    const pageWidth = doc.internal.pageSize.getWidth()

    doc.setFontSize(18)
    doc.text('Discounts Per Item Report', pageWidth / 2, 15, { align: 'center' })

    doc.setFontSize(10)
    doc.text(`Period: ${startDate} to ${endDate}`, pageWidth / 2, 22, { align: 'center' })

    if (summary) {
      doc.setFontSize(12)
      doc.text('Summary', 14, 32)
      doc.setFontSize(10)
      doc.text(`Total Products with Discounts: ${summary.totalProducts}`, 14, 40)
      doc.text(`Total Quantity Discounted: ${summary.totalQuantityDiscounted}`, 14, 46)
      doc.text(`Total Discount Amount: ${formatCurrency(summary.totalDiscountAmount)}`, 14, 52)
      doc.text(`Total Transactions: ${summary.totalTransactions}`, 14, 58)
    }

    const tableData = products.map((p) => [
      p.productName,
      p.sku || '-',
      p.totalQuantity.toString(),
      formatCurrency(p.totalDiscount),
      formatCurrency(p.averageDiscountPerUnit),
      `${p.discountPercentage.toFixed(1)}%`,
      p.transactionCount.toString(),
    ])

    autoTable(doc, {
      startY: 65,
      head: [['Product', 'SKU', 'Qty', 'Total Discount', 'Avg/Unit', 'Disc %', 'Trans']],
      body: tableData,
      styles: { fontSize: 8 },
      headStyles: { fillColor: [59, 130, 246] },
    })

    doc.save(`discounts-per-item-${startDate}-to-${endDate}.pdf`)
  }

  const exportToExcel = () => {
    const data = products.map((p) => ({
      'Product Name': p.productName,
      'SKU': p.sku || '',
      'Total Quantity': p.totalQuantity,
      'Total Discount': p.totalDiscount,
      'Avg Discount/Unit': p.averageDiscountPerUnit,
      'Discount %': p.discountPercentage,
      'Transaction Count': p.transactionCount,
      'Total Sales Value': p.totalSalesValue,
    }))

    const ws = XLSX.utils.json_to_sheet(data)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Discounts Per Item')
    XLSX.writeFile(wb, `discounts-per-item-${startDate}-to-${endDate}.xlsx`)
  }

  const handlePrint = () => {
    window.print()
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Discounts Per Item Report
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            View discount amounts applied to each product
          </p>
        </div>
        <div className="flex flex-wrap gap-2 print:hidden">
          <Button
            variant="outline"
            size="sm"
            onClick={() => exportToPDF()}
            className="gap-2 hover:border-red-500 hover:text-red-700 dark:hover:text-red-400"
          >
            <DocumentArrowDownIcon className="h-4 w-4" />
            PDF
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => exportToExcel()}
            className="gap-2 hover:border-green-500 hover:text-green-700 dark:hover:text-green-400"
          >
            <DocumentArrowDownIcon className="h-4 w-4" />
            Excel
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handlePrint}
            className="gap-2 hover:border-blue-500 hover:text-blue-700 dark:hover:text-blue-400"
          >
            <PrinterIcon className="h-4 w-4" />
            Print
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card className="print:hidden">
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            {/* Date Preset */}
            <div>
              <label className="block text-sm font-medium mb-1">Quick Select</label>
              <select
                value={datePreset}
                onChange={(e) => handleDatePreset(e.target.value)}
                className="w-full px-3 py-2 border rounded-md dark:bg-gray-800 dark:border-gray-700"
              >
                <option value="today">Today</option>
                <option value="yesterday">Yesterday</option>
                <option value="last_7_days">Last 7 Days</option>
                <option value="last_30_days">Last 30 Days</option>
                <option value="this_month">This Month</option>
                <option value="last_month">Last Month</option>
                <option value="this_year">This Year</option>
                <option value="custom">Custom Range</option>
              </select>
            </div>

            {/* Start Date */}
            <div>
              <label className="block text-sm font-medium mb-1">Start Date</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value)
                  setDatePreset('custom')
                }}
                className="w-full px-3 py-2 border rounded-md dark:bg-gray-800 dark:border-gray-700"
              />
            </div>

            {/* End Date */}
            <div>
              <label className="block text-sm font-medium mb-1">End Date</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => {
                  setEndDate(e.target.value)
                  setDatePreset('custom')
                }}
                className="w-full px-3 py-2 border rounded-md dark:bg-gray-800 dark:border-gray-700"
              />
            </div>

            {/* Location */}
            <div>
              <label className="block text-sm font-medium mb-1">Location</label>
              <select
                value={locationId}
                onChange={(e) => setLocationId(e.target.value)}
                className="w-full px-3 py-2 border rounded-md dark:bg-gray-800 dark:border-gray-700"
                disabled={!hasAccessToAll && locations.length <= 1}
              >
                {hasAccessToAll && <option value="">All Locations</option>}
                {locations.map((loc) => (
                  <option key={loc.id} value={loc.id}>
                    {loc.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Refresh Button */}
            <div className="flex items-end">
              <Button onClick={fetchReport} disabled={loading} className="w-full">
                {loading ? 'Loading...' : 'Refresh'}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-gray-500 dark:text-gray-400">Products with Discounts</p>
              <p className="text-2xl font-bold">{summary.totalProducts}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-gray-500 dark:text-gray-400">Total Qty Discounted</p>
              <p className="text-2xl font-bold">{summary.totalQuantityDiscounted}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-gray-500 dark:text-gray-400">Total Discount Amount</p>
              <p className="text-2xl font-bold text-red-600">{formatCurrency(summary.totalDiscountAmount)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-gray-500 dark:text-gray-400">Total Transactions</p>
              <p className="text-2xl font-bold">{summary.totalTransactions}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-gray-500 dark:text-gray-400">Avg Discount/Trans</p>
              <p className="text-2xl font-bold">{formatCurrency(summary.averageDiscountPerTransaction)}</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Products Table */}
      <Card>
        <CardHeader>
          <CardTitle>Discounts by Product</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8 text-gray-500">Loading...</div>
          ) : products.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No discounted items found for the selected period
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b bg-gray-50 dark:bg-gray-800">
                    <th className="text-left py-3 px-4 font-semibold">Product</th>
                    <th className="text-left py-3 px-4 font-semibold">SKU</th>
                    <th className="text-right py-3 px-4 font-semibold">Qty</th>
                    <th className="text-right py-3 px-4 font-semibold">Total Discount</th>
                    <th className="text-right py-3 px-4 font-semibold">Avg/Unit</th>
                    <th className="text-right py-3 px-4 font-semibold">Disc %</th>
                    <th className="text-right py-3 px-4 font-semibold">Trans</th>
                    <th className="text-center py-3 px-4 font-semibold print:hidden">Details</th>
                  </tr>
                </thead>
                <tbody>
                  {products.map((product) => (
                    <>
                      <tr
                        key={product.productId}
                        className="border-b hover:bg-gray-50 dark:hover:bg-gray-800"
                      >
                        <td className="py-3 px-4 font-medium">{product.productName}</td>
                        <td className="py-3 px-4 text-gray-500">{product.sku || '-'}</td>
                        <td className="py-3 px-4 text-right">{product.totalQuantity}</td>
                        <td className="py-3 px-4 text-right font-semibold text-red-600">
                          {formatCurrency(product.totalDiscount)}
                        </td>
                        <td className="py-3 px-4 text-right">
                          {formatCurrency(product.averageDiscountPerUnit)}
                        </td>
                        <td className="py-3 px-4 text-right">
                          {product.discountPercentage.toFixed(1)}%
                        </td>
                        <td className="py-3 px-4 text-right">{product.transactionCount}</td>
                        <td className="py-3 px-4 text-center print:hidden">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => toggleExpanded(product.productId)}
                          >
                            {expandedProducts.has(product.productId) ? (
                              <ChevronDownIcon className="h-4 w-4" />
                            ) : (
                              <ChevronRightIcon className="h-4 w-4" />
                            )}
                          </Button>
                        </td>
                      </tr>
                      {expandedProducts.has(product.productId) && (
                        <tr key={`${product.productId}-details`}>
                          <td colSpan={8} className="bg-gray-50 dark:bg-gray-900 p-4">
                            <div className="text-sm font-medium mb-2">Transaction Details</div>
                            <table className="w-full text-sm">
                              <thead>
                                <tr className="border-b">
                                  <th className="text-left py-2 px-2">Invoice</th>
                                  <th className="text-left py-2 px-2">Date</th>
                                  <th className="text-left py-2 px-2">Location</th>
                                  <th className="text-right py-2 px-2">Qty</th>
                                  <th className="text-right py-2 px-2">Unit Price</th>
                                  <th className="text-right py-2 px-2">Discount</th>
                                  <th className="text-right py-2 px-2">Total</th>
                                  <th className="text-left py-2 px-2">Serial Numbers</th>
                                  <th className="text-left py-2 px-2">Remarks</th>
                                </tr>
                              </thead>
                              <tbody>
                                {product.transactions.map((trans, idx) => (
                                  <tr key={idx} className="border-b border-gray-200 dark:border-gray-700">
                                    <td className="py-2 px-2">{trans.invoiceNumber}</td>
                                    <td className="py-2 px-2">{formatDate(trans.saleDate)}</td>
                                    <td className="py-2 px-2">{trans.locationName}</td>
                                    <td className="py-2 px-2 text-right">{trans.quantity}</td>
                                    <td className="py-2 px-2 text-right">{formatCurrency(trans.unitPrice)}</td>
                                    <td className="py-2 px-2 text-right text-red-600">
                                      {formatCurrency(trans.discountAmount)}
                                    </td>
                                    <td className="py-2 px-2 text-right">{formatCurrency(trans.totalPrice)}</td>
                                    <td className="py-2 px-2">{trans.serialNumbers || '-'}</td>
                                    <td className="py-2 px-2">{trans.remarks || '-'}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </td>
                        </tr>
                      )}
                    </>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
