'use client'

import { useState, useEffect } from 'react'
import { usePermissions } from '@/hooks/usePermissions'
import { PERMISSIONS } from '@/lib/rbac'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { toast } from 'sonner'
import { DocumentArrowDownIcon, MagnifyingGlassIcon } from '@heroicons/react/24/outline'

interface ProductPurchaseHistory {
  productId: number
  sku: string
  productName: string
  categoryName: string
  variations: number
  currentStock: number
  lastCost: number
  lastSupplier: {
    id: number
    name: string
  } | null
  lastPurchaseDate: string | null
  totalQuantityPurchased: number
  totalAmountSpent: number
  purchaseCount: number
}

interface Category {
  id: number
  name: string
}

export default function ProductPurchaseHistoryPage() {
  const { can } = usePermissions()
  const [loading, setLoading] = useState(false)
  const [reportData, setReportData] = useState<ProductPurchaseHistory[]>([])
  const [categories, setCategories] = useState<Category[]>([])

  // Filters
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [searchTerm, setSearchTerm] = useState('')

  // Pagination
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)

  // Fetch categories for filter
  const fetchCategories = async () => {
    try {
      const res = await fetch('/api/categories')
      if (res.ok) {
        const data = await res.json()
        setCategories(data.data || [])
      }
    } catch (error) {
      console.error('Error fetching categories:', error)
    }
  }

  // Fetch report data
  const fetchReport = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '20',
      })

      if (categoryFilter !== 'all') {
        params.append('categoryId', categoryFilter)
      }

      if (startDate) {
        params.append('startDate', startDate)
      }

      if (endDate) {
        params.append('endDate', endDate)
      }

      const res = await fetch(`/api/reports/product-purchase-history?${params.toString()}`)

      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Failed to fetch report')
      }

      const data = await res.json()
      setReportData(data.data)
      setTotalPages(data.pagination.totalPages)
    } catch (error: any) {
      console.error('Error fetching report:', error)
      toast.error(error.message || 'Failed to load report')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (can(PERMISSIONS.REPORT_VIEW)) {
      fetchCategories()
      fetchReport()
    }
  }, [page, categoryFilter, startDate, endDate])

  const formatDate = (dateString: string | null) => {
    if (!dateString) return '-'
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount)
  }

  const handleExportCSV = () => {
    if (reportData.length === 0) {
      toast.error('No data to export')
      return
    }

    // Create CSV content
    const headers = ['SKU', 'Product Name', 'Category', 'Current Stock', 'Last Cost', 'Last Supplier', 'Last Purchase Date', 'Total Qty Purchased', 'Total Amount Spent', 'Purchase Count']
    const rows = reportData.map(item => [
      item.sku || '',
      item.productName,
      item.categoryName,
      item.currentStock.toString(),
      item.lastCost.toFixed(2),
      item.lastSupplier?.name || 'N/A',
      formatDate(item.lastPurchaseDate),
      item.totalQuantityPurchased.toString(),
      item.totalAmountSpent.toFixed(2),
      item.purchaseCount.toString(),
    ])

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n')

    // Download CSV
    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `product-purchase-history-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    window.URL.revokeObjectURL(url)

    toast.success('Report exported successfully')
  }

  // Filter data by search term (client-side)
  const filteredData = reportData.filter(item =>
    item.productName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.sku?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.categoryName.toLowerCase().includes(searchTerm.toLowerCase())
  )

  if (!can(PERMISSIONS.REPORT_VIEW)) {
    return (
      <div className="p-8">
        <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded">
          You do not have permission to view reports.
        </div>
      </div>
    )
  }

  return (
    <div className="p-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Product Purchase History</h1>
          <p className="text-gray-600 mt-1">
            View purchase history, last cost, and supplier information for all products
          </p>
        </div>
        <Button onClick={handleExportCSV} disabled={loading || reportData.length === 0}>
          <DocumentArrowDownIcon className="w-5 h-5 mr-2" />
          Export CSV
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Search */}
            <div className="relative">
              <MagnifyingGlassIcon className="w-5 h-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <Input
                type="text"
                placeholder="Search products..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>

            {/* Category Filter */}
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger>
                <SelectValue placeholder="All Categories" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {categories.map((category) => (
                  <SelectItem key={category.id} value={category.id.toString()}>
                    {category.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Start Date */}
            <Input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              placeholder="Start Date"
            />

            {/* End Date */}
            <Input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              placeholder="End Date"
            />
          </div>

          {/* Clear Filters */}
          {(categoryFilter !== 'all' || startDate || endDate || searchTerm) && (
            <div className="mt-4">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setCategoryFilter('all')
                  setStartDate('')
                  setEndDate('')
                  setSearchTerm('')
                }}
              >
                Clear Filters
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Report Table */}
      <Card>
        <CardHeader>
          <CardTitle>Purchase History Report</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8">Loading...</div>
          ) : filteredData.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No products found matching your filters
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-3 px-4">SKU</th>
                      <th className="text-left py-3 px-4">Product Name</th>
                      <th className="text-left py-3 px-4">Category</th>
                      <th className="text-right py-3 px-4">Current Stock</th>
                      <th className="text-right py-3 px-4">Last Cost</th>
                      <th className="text-left py-3 px-4">Last Supplier</th>
                      <th className="text-left py-3 px-4">Last Purchase</th>
                      <th className="text-right py-3 px-4">Qty Purchased</th>
                      <th className="text-right py-3 px-4">Amount Spent</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredData.map((item) => (
                      <tr key={item.productId} className="border-b hover:bg-gray-50">
                        <td className="py-3 px-4 font-mono text-sm">
                          {item.sku || '-'}
                        </td>
                        <td className="py-3 px-4 font-medium">
                          {item.productName}
                          {item.variations > 1 && (
                            <span className="ml-2 text-xs text-gray-500">
                              ({item.variations} variations)
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-sm text-gray-600">
                          {item.categoryName}
                        </td>
                        <td className="py-3 px-4 text-right">
                          {item.currentStock.toFixed(2)}
                        </td>
                        <td className="py-3 px-4 text-right font-medium">
                          {item.lastCost > 0 ? formatCurrency(item.lastCost) : '-'}
                        </td>
                        <td className="py-3 px-4">
                          {item.lastSupplier ? (
                            <div>
                              <div className="font-medium text-sm">
                                {item.lastSupplier.name}
                              </div>
                            </div>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-sm">
                          {formatDate(item.lastPurchaseDate)}
                        </td>
                        <td className="py-3 px-4 text-right">
                          {item.totalQuantityPurchased.toFixed(2)}
                        </td>
                        <td className="py-3 px-4 text-right font-medium text-green-600">
                          {formatCurrency(item.totalAmountSpent)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 font-bold">
                      <td colSpan={7} className="py-3 px-4 text-right">
                        TOTALS:
                      </td>
                      <td className="py-3 px-4 text-right">
                        {filteredData
                          .reduce((sum, item) => sum + item.totalQuantityPurchased, 0)
                          .toFixed(2)}
                      </td>
                      <td className="py-3 px-4 text-right text-green-600">
                        {formatCurrency(
                          filteredData.reduce((sum, item) => sum + item.totalAmountSpent, 0)
                        )}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between mt-4">
                  <Button
                    variant="outline"
                    disabled={page === 1}
                    onClick={() => setPage(page - 1)}
                  >
                    Previous
                  </Button>
                  <span className="text-sm text-gray-600">
                    Page {page} of {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    disabled={page === totalPages}
                    onClick={() => setPage(page + 1)}
                  >
                    Next
                  </Button>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
