'use client'

import { useState, useEffect, useRef } from 'react'
import { useSession } from 'next-auth/react'
import Link from 'next/link'
import * as XLSX from 'xlsx'

interface BirInfo {
  businessName: string
  businessTIN: string
  tinLabel: string
  startInvoice: string
  endInvoice: string
}

interface Summary {
  totalSales: number
  totalAmount: number
  totalTax: number
  totalDiscount: number
  netSales: number
  totalGrossSales: number
  totalVatExemptSales: number
  totalVatZeroRatedSales: number
  totalVatableSales: number
  totalVatAmount: number
  totalDiscountAmount: number
  seniorCitizenDiscounts: number
  pwdDiscounts: number
  seniorPwdDiscountAmount: number
}

export default function SalesJournalReport() {
  const { data: session } = useSession()
  const [loading, setLoading] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [sales, setSales] = useState<any[]>([])
  const [summary, setSummary] = useState<Summary | null>(null)
  const [birInfo, setBirInfo] = useState<BirInfo | null>(null)
  const [pagination, setPagination] = useState<any>(null)
  const [locations, setLocations] = useState<any[]>([])
  const printRef = useRef<HTMLDivElement>(null)

  // Filters
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [locationId, setLocationId] = useState('')
  const [paymentMethod, setPaymentMethod] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [sortBy, setSortBy] = useState('createdAt')
  const [sortOrder, setSortOrder] = useState('desc')
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(100)
  const [datePreset, setDatePreset] = useState('all')

  // Expanded rows
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set())

  useEffect(() => {
    fetchLocations()
  }, [])

  const fetchLocations = async () => {
    try {
      const res = await fetch('/api/locations')
      if (res.ok) {
        const data = await res.json()
        setLocations(data.locations || [])
      }
    } catch (error) {
      console.error('Error fetching locations:', error)
    }
  }

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
      case 'week':
        start = new Date(today.setDate(today.getDate() - today.getDay()))
        end = new Date()
        break
      case 'month':
        start = new Date(today.getFullYear(), today.getMonth(), 1)
        end = new Date()
        break
      case 'quarter':
        const quarter = Math.floor(today.getMonth() / 3)
        start = new Date(today.getFullYear(), quarter * 3, 1)
        end = new Date()
        break
      case 'year':
        start = new Date(today.getFullYear(), 0, 1)
        end = new Date()
        break
      case 'all':
        setStartDate('')
        setEndDate('')
        return
    }

    setStartDate(start.toISOString().split('T')[0])
    setEndDate(end.toISOString().split('T')[0])
  }

  const handleGenerateReport = async () => {
    setGenerating(true)
    setPage(1) // Reset to first page
    await fetchSales()
    setGenerating(false)
  }

  const fetchSales = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (startDate) params.set('startDate', startDate)
      if (endDate) params.set('endDate', endDate)
      if (locationId) params.set('locationId', locationId)
      if (paymentMethod !== 'all') params.set('paymentMethod', paymentMethod)
      if (statusFilter !== 'all') params.set('status', statusFilter)
      if (search) params.set('search', search)
      params.set('sortBy', sortBy)
      params.set('sortOrder', sortOrder)
      params.set('page', page.toString())
      params.set('limit', limit.toString())

      const res = await fetch(`/api/reports/sales-journal?${params}`)
      if (res.ok) {
        const data = await res.json()
        setSales(data.sales || [])
        setSummary(data.summary || null)
        setBirInfo(data.birInfo || null)
        setPagination(data.pagination || {})
      } else {
        const errorData = await res.json().catch(() => ({ error: 'Unknown error' }))
        console.error('Failed to fetch sales:', res.status, errorData)
      }
    } catch (error) {
      console.error('Error fetching sales:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!generating) {
      fetchSales()
    }
  }, [page, limit, sortBy, sortOrder])

  const handleSort = (field: string) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
    } else {
      setSortBy(field)
      setSortOrder('desc')
    }
  }

  const toggleRow = (id: number) => {
    const newExpanded = new Set(expandedRows)
    if (newExpanded.has(id)) {
      newExpanded.delete(id)
    } else {
      newExpanded.add(id)
    }
    setExpandedRows(newExpanded)
  }

  const exportToExcel = () => {
    if (sales.length === 0) {
      alert('No data to export')
      return
    }

    // Create workbook
    const wb = XLSX.utils.book_new()

    // Report Header
    const headerData = [
      ['SALES JOURNAL REPORT'],
      [''],
      [`Business Name: ${birInfo?.businessName || ''}`],
      [`${birInfo?.tinLabel || 'TIN'}: ${birInfo?.businessTIN || ''}`],
      [`Report Period: ${startDate || 'All'} to ${endDate || 'All'}`],
      [`Beginning Invoice #: ${birInfo?.startInvoice || ''}`],
      [`Ending Invoice #: ${birInfo?.endInvoice || ''}`],
      [`Generated: ${new Date().toLocaleString()}`],
      [''],
    ]

    // Column headers
    const headers = [
      'Date',
      'Invoice #',
      'Customer Name',
      'TIN',
      'Address',
      'Description',
      'Gross Sales',
      'VAT Exempt Sales',
      'VAT Zero-Rated',
      'VATable Sales',
      'VAT Amount (12%)',
      'Discount',
      'Total Amount',
      'Payment Method',
      'Status',
    ]

    // Data rows
    const dataRows = sales.map((sale) => [
      new Date(sale.date).toLocaleDateString(),
      sale.invoiceNumber,
      sale.customer,
      sale.customerTIN || '',
      sale.customerAddress || '',
      `${sale.items} item(s)`,
      sale.grossSales.toFixed(2),
      sale.vatExemptSales.toFixed(2),
      sale.vatZeroRatedSales.toFixed(2),
      sale.vatableSales.toFixed(2),
      sale.vatAmount.toFixed(2),
      sale.discount.toFixed(2),
      sale.totalAmount.toFixed(2),
      sale.paymentMethod,
      sale.status,
    ])

    // Summary section
    const summaryData = [
      [''],
      ['SUMMARY TOTALS'],
      ['Total Transactions', summary?.totalSales || 0],
      [''],
      ['Total Gross Sales', `₱${summary?.totalGrossSales.toFixed(2) || '0.00'}`],
      ['Less: VAT Exempt Sales', `₱${summary?.totalVatExemptSales.toFixed(2) || '0.00'}`],
      ['Less: VAT Zero-Rated Sales', `₱${summary?.totalVatZeroRatedSales.toFixed(2) || '0.00'}`],
      ['VATable Sales', `₱${summary?.totalVatableSales.toFixed(2) || '0.00'}`],
      ['VAT Amount (12%)', `₱${summary?.totalVatAmount.toFixed(2) || '0.00'}`],
      ['Total Discount', `₱${summary?.totalDiscountAmount.toFixed(2) || '0.00'}`],
      [''],
      ['SPECIAL DISCOUNTS'],
      ['Senior Citizen Discounts', summary?.seniorCitizenDiscounts || 0],
      ['PWD Discounts', summary?.pwdDiscounts || 0],
      ['Senior/PWD Discount Amount', `₱${summary?.seniorPwdDiscountAmount?.toFixed(2) || '0.00'}`],
      [''],
      ['Grand Total', `₱${summary?.totalGrossSales.toFixed(2) || '0.00'}`],
    ]

    // Combine all data
    const worksheetData = [...headerData, headers, ...dataRows, ...summaryData]

    // Create worksheet
    const ws = XLSX.utils.aoa_to_sheet(worksheetData)

    // Set column widths
    ws['!cols'] = [
      { wch: 12 }, // Date
      { wch: 15 }, // Invoice #
      { wch: 25 }, // Customer
      { wch: 15 }, // TIN
      { wch: 30 }, // Address
      { wch: 20 }, // Description
      { wch: 15 }, // Gross Sales
      { wch: 15 }, // VAT Exempt
      { wch: 15 }, // VAT Zero-Rated
      { wch: 15 }, // VATable Sales
      { wch: 15 }, // VAT Amount
      { wch: 12 }, // Discount
      { wch: 15 }, // Total
      { wch: 12 }, // Payment
      { wch: 12 }, // Status
    ]

    // Add worksheet to workbook
    XLSX.utils.book_append_sheet(wb, ws, 'Sales Journal')

    // Save file
    XLSX.writeFile(wb, `Sales-Journal-${new Date().toISOString().split('T')[0]}.xlsx`)
  }

  const handlePrint = () => {
    window.print()
  }

  const SortIcon = ({ field }: { field: string }) => {
    if (sortBy !== field) return <span className="text-gray-400">⇅</span>
    return sortOrder === 'asc' ? <span>↑</span> : <span>↓</span>
  }

  return (
    <>
      <style jsx global>{`
        @media print {
          body * {
            visibility: hidden;
          }
          #printable-area,
          #printable-area * {
            visibility: visible;
          }
          #printable-area {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
          }
          .no-print {
            display: none !important;
          }
          table {
            page-break-inside: auto;
          }
          tr {
            page-break-inside: avoid;
            page-break-after: auto;
          }
        }
      `}</style>

      <div className="p-4 md:p-6 space-y-4 md:space-y-6 bg-gray-50 dark:bg-gray-900 min-h-screen">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 no-print">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-gray-100">
              Sales Journal Report
            </h1>
            <p className="text-gray-600 dark:text-gray-300 mt-1 text-sm md:text-base">
              Complete sales journal with VAT breakdown and detailed transaction records
            </p>
          </div>
          <Link
            href="/dashboard/reports"
            className="px-4 py-2 bg-gray-600 dark:bg-gray-700 text-white rounded-lg hover:bg-gray-700 dark:hover:bg-gray-600 transition-colors text-sm md:text-base"
          >
            Back to Reports
          </Link>
        </div>

        {/* Filters */}
        <div className="bg-white dark:bg-gray-800 p-4 md:p-6 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 no-print">
          <h2 className="text-lg font-semibold mb-4 text-gray-900 dark:text-gray-100">Report Filters</h2>

          {/* Date Presets */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Quick Date Range
            </label>
            <div className="flex flex-wrap gap-2">
              {[
                { value: 'today', label: 'Today' },
                { value: 'week', label: 'This Week' },
                { value: 'month', label: 'This Month' },
                { value: 'quarter', label: 'This Quarter' },
                { value: 'year', label: 'This Year' },
                { value: 'all', label: 'All Time' },
              ].map((preset) => (
                <button
                  key={preset.value}
                  onClick={() => handleDatePreset(preset.value)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    datePreset === preset.value
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600'
                  }`}
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Start Date
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value)
                  setDatePreset('custom')
                }}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-800"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">End Date</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => {
                  setEndDate(e.target.value)
                  setDatePreset('custom')
                }}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-800"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Location</label>
              <select
                value={locationId}
                onChange={(e) => setLocationId(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-800"
              >
                <option value="">All Locations</option>
                {locations.map((loc) => (
                  <option key={loc.id} value={loc.id}>
                    {loc.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Payment Method
              </label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-800"
              >
                <option value="all">All Methods</option>
                <option value="CASH">Cash</option>
                <option value="CARD">Card</option>
                <option value="CREDIT">Credit</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Status</label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-800"
              >
                <option value="all">All Status</option>
                <option value="completed">Completed</option>
                <option value="voided">Voided</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Search</label>
              <input
                type="text"
                placeholder="Invoice # or Customer"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-800 placeholder:text-gray-400 dark:placeholder:text-gray-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Per Page</label>
              <select
                value={limit}
                onChange={(e) => {
                  setLimit(parseInt(e.target.value))
                  setPage(1)
                }}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-800"
              >
                <option value="50">50</option>
                <option value="100">100</option>
                <option value="200">200</option>
                <option value="500">500</option>
              </select>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              onClick={handleGenerateReport}
              disabled={generating}
              className="px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {generating ? (
                <>
                  <svg
                    className="animate-spin h-5 w-5 text-white"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    ></circle>
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    ></path>
                  </svg>
                  Generating...
                </>
              ) : (
                <>
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-5 w-5"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                  >
                    <path
                      fillRule="evenodd"
                      d="M6 2a2 2 0 00-2 2v12a2 2 0 002 2h8a2 2 0 002-2V7.414A2 2 0 0015.414 6L12 2.586A2 2 0 0010.586 2H6zm5 6a1 1 0 10-2 0v3.586l-1.293-1.293a1 1 0 10-1.414 1.414l3 3a1 1 0 001.414 0l3-3a1 1 0 00-1.414-1.414L11 11.586V8z"
                      clipRule="evenodd"
                    />
                  </svg>
                  Generate Report
                </>
              )}
            </button>
            <button
              onClick={exportToExcel}
              disabled={sales.length === 0}
              className="px-4 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Export to Excel
            </button>
            <button
              onClick={handlePrint}
              disabled={sales.length === 0}
              className="px-4 py-2.5 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Print Report
            </button>
          </div>
        </div>

        {/* BIR Info Card */}
        {birInfo && (
          <div className="bg-gradient-to-r from-blue-500 to-blue-600 p-4 md:p-6 rounded-lg shadow-lg text-white">
            <h3 className="text-lg font-bold mb-3">Business Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
              <div>
                <div className="opacity-90 mb-1">Business Name</div>
                <div className="font-semibold">{birInfo.businessName}</div>
              </div>
              <div>
                <div className="opacity-90 mb-1">{birInfo.tinLabel}</div>
                <div className="font-semibold">{birInfo.businessTIN}</div>
              </div>
              <div>
                <div className="opacity-90 mb-1">Beginning Invoice #</div>
                <div className="font-semibold">{birInfo.startInvoice || 'N/A'}</div>
              </div>
              <div>
                <div className="opacity-90 mb-1">Ending Invoice #</div>
                <div className="font-semibold">{birInfo.endInvoice || 'N/A'}</div>
              </div>
            </div>
          </div>
        )}

        {/* Summary Cards - BIR Compliant */}
        {summary && (
          <div id="printable-area" ref={printRef}>
            <div className="print-header mb-4 hidden" style={{ display: 'none' }}>
              <h1 className="text-2xl font-bold text-center">{birInfo?.businessName}</h1>
              <p className="text-center">
                {birInfo?.tinLabel}: {birInfo?.businessTIN}
              </p>
              <p className="text-center">SALES JOURNAL REPORT</p>
              <p className="text-center">
                Period: {startDate || 'All'} to {endDate || 'All'}
              </p>
              <hr className="my-2" />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              <div className="bg-gradient-to-br from-blue-500 to-blue-600 p-4 md:p-6 rounded-lg shadow-lg text-white">
                <div className="text-xs md:text-sm opacity-90">Total Gross Sales</div>
                <div className="text-2xl md:text-3xl font-bold mt-2">
                  ₱{summary.totalGrossSales?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
                <div className="text-xs md:text-sm mt-1 opacity-75">
                  {summary.totalSales} transactions
                </div>
              </div>
              <div className="bg-gradient-to-br from-green-500 to-green-600 p-4 md:p-6 rounded-lg shadow-lg text-white">
                <div className="text-xs md:text-sm opacity-90">VATable Sales</div>
                <div className="text-2xl md:text-3xl font-bold mt-2">
                  ₱{summary.totalVatableSales?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
                <div className="text-xs md:text-sm mt-1 opacity-75">Before 12% VAT</div>
              </div>
              <div className="bg-gradient-to-br from-purple-500 to-purple-600 p-4 md:p-6 rounded-lg shadow-lg text-white">
                <div className="text-xs md:text-sm opacity-90">VAT Amount (12%)</div>
                <div className="text-2xl md:text-3xl font-bold mt-2">
                  ₱{summary.totalVatAmount?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
                <div className="text-xs md:text-sm mt-1 opacity-75">Output Tax</div>
              </div>
              <div className="bg-gradient-to-br from-orange-500 to-orange-600 p-4 md:p-6 rounded-lg shadow-lg text-white">
                <div className="text-xs md:text-sm opacity-90">VAT Exempt Sales</div>
                <div className="text-2xl md:text-3xl font-bold mt-2">
                  ₱{summary.totalVatExemptSales?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
                <div className="text-xs md:text-sm mt-1 opacity-75">Zero VAT</div>
              </div>
            </div>

            {/* Additional BIR Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <div className="bg-white dark:bg-gray-800 p-4 md:p-6 rounded-lg shadow-sm border-l-4 border-teal-500">
                <div className="text-sm text-gray-600 dark:text-gray-400">VAT Zero-Rated Sales</div>
                <div className="text-xl md:text-2xl font-bold text-gray-900 dark:text-gray-100 mt-1">
                  ₱{summary.totalVatZeroRatedSales?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
              </div>
              <div className="bg-white dark:bg-gray-800 p-4 md:p-6 rounded-lg shadow-sm border-l-4 border-red-500">
                <div className="text-sm text-gray-600 dark:text-gray-400">Total Discounts</div>
                <div className="text-xl md:text-2xl font-bold text-gray-900 dark:text-gray-100 mt-1">
                  ₱{summary.totalDiscountAmount?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  SC: {summary.seniorCitizenDiscounts || 0} | PWD: {summary.pwdDiscounts || 0}
                </div>
              </div>
              <div className="bg-white dark:bg-gray-800 p-4 md:p-6 rounded-lg shadow-sm border-l-4 border-indigo-500">
                <div className="text-sm text-gray-600 dark:text-gray-400">Senior/PWD Discounts</div>
                <div className="text-xl md:text-2xl font-bold text-gray-900 dark:text-gray-100 mt-1">
                  ₱{summary.seniorPwdDiscountAmount?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
              </div>
            </div>

            {/* Sales Table */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                  <thead className="bg-gray-50 dark:bg-gray-700">
                    <tr>
                      <th className="px-3 md:px-4 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                        <button
                          onClick={() => handleSort('createdAt')}
                          className="flex items-center space-x-1 hover:text-gray-900 dark:hover:text-gray-100"
                        >
                          <span>Date</span>
                          <SortIcon field="createdAt" />
                        </button>
                      </th>
                      <th className="px-3 md:px-4 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                        <button
                          onClick={() => handleSort('invoiceNumber')}
                          className="flex items-center space-x-1 hover:text-gray-900 dark:hover:text-gray-100"
                        >
                          <span>Invoice #</span>
                          <SortIcon field="invoiceNumber" />
                        </button>
                      </th>
                      <th className="px-3 md:px-4 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                        Customer
                      </th>
                      <th className="px-3 md:px-4 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider hidden lg:table-cell">
                        TIN
                      </th>
                      <th className="px-3 md:px-4 py-3 text-right text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                        Gross Sales
                      </th>
                      <th className="px-3 md:px-4 py-3 text-right text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider hidden md:table-cell">
                        VAT Exempt
                      </th>
                      <th className="px-3 md:px-4 py-3 text-right text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider hidden lg:table-cell">
                        VATable
                      </th>
                      <th className="px-3 md:px-4 py-3 text-right text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                        VAT
                      </th>
                      <th className="px-3 md:px-4 py-3 text-right text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider hidden md:table-cell">
                        Discount
                      </th>
                      <th className="px-3 md:px-4 py-3 text-right text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                        <button
                          onClick={() => handleSort('totalAmount')}
                          className="flex items-center justify-end space-x-1 hover:text-gray-900 dark:hover:text-gray-100 w-full"
                        >
                          <span>Total</span>
                          <SortIcon field="totalAmount" />
                        </button>
                      </th>
                      <th className="px-3 md:px-4 py-3 text-center text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider hidden lg:table-cell">
                        Status
                      </th>
                      <th className="px-3 md:px-4 py-3 text-center text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider no-print">
                        Details
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                    {loading ? (
                      <tr>
                        <td colSpan={12} className="px-4 py-8 text-center text-gray-500 dark:text-gray-400">
                          <div className="flex items-center justify-center">
                            <svg
                              className="animate-spin h-8 w-8 text-blue-600 mr-3"
                              xmlns="http://www.w3.org/2000/svg"
                              fill="none"
                              viewBox="0 0 24 24"
                            >
                              <circle
                                className="opacity-25"
                                cx="12"
                                cy="12"
                                r="10"
                                stroke="currentColor"
                                strokeWidth="4"
                              ></circle>
                              <path
                                className="opacity-75"
                                fill="currentColor"
                                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                              ></path>
                            </svg>
                            Loading sales data...
                          </div>
                        </td>
                      </tr>
                    ) : sales.length === 0 ? (
                      <tr>
                        <td colSpan={12} className="px-4 py-8 text-center text-gray-500 dark:text-gray-400">
                          No sales found. Click "Generate Report" to load data.
                        </td>
                      </tr>
                    ) : (
                      sales.map((sale) => (
                        <>
                          <tr
                            key={sale.id}
                            className={`hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors ${
                              sale.status === 'voided' || sale.status === 'cancelled'
                                ? 'bg-red-50 dark:bg-red-900/20'
                                : ''
                            }`}
                          >
                            <td className="px-3 md:px-4 py-3 whitespace-nowrap text-xs md:text-sm text-gray-900 dark:text-gray-100">
                              {new Date(sale.date).toLocaleDateString()}
                              <br />
                              <span className="text-xs text-gray-500 dark:text-gray-400">
                                {new Date(sale.date).toLocaleTimeString()}
                              </span>
                            </td>
                            <td className="px-3 md:px-4 py-3 whitespace-nowrap text-xs md:text-sm font-medium text-blue-600 dark:text-blue-400">
                              {sale.invoiceNumber}
                            </td>
                            <td className="px-3 md:px-4 py-3 text-xs md:text-sm text-gray-900 dark:text-gray-100">
                              {sale.customer}
                              {sale.discountType && (
                                <span
                                  className={`ml-2 px-2 py-0.5 rounded text-xs font-semibold ${
                                    sale.discountType === 'senior'
                                      ? 'bg-blue-100 text-blue-800'
                                      : sale.discountType === 'pwd'
                                      ? 'bg-purple-100 text-purple-800'
                                      : ''
                                  }`}
                                >
                                  {sale.discountType === 'senior'
                                    ? 'SC'
                                    : sale.discountType === 'pwd'
                                    ? 'PWD'
                                    : ''}
                                </span>
                              )}
                            </td>
                            <td className="px-3 md:px-4 py-3 whitespace-nowrap text-xs md:text-sm text-gray-600 dark:text-gray-400 hidden lg:table-cell">
                              {sale.customerTIN || '-'}
                            </td>
                            <td className="px-3 md:px-4 py-3 whitespace-nowrap text-xs md:text-sm text-right text-gray-900 dark:text-gray-100">
                              ₱{sale.grossSales.toFixed(2)}
                            </td>
                            <td className="px-3 md:px-4 py-3 whitespace-nowrap text-xs md:text-sm text-right text-gray-600 dark:text-gray-400 hidden md:table-cell">
                              ₱{sale.vatExemptSales.toFixed(2)}
                            </td>
                            <td className="px-3 md:px-4 py-3 whitespace-nowrap text-xs md:text-sm text-right text-gray-900 dark:text-gray-100 hidden lg:table-cell">
                              ₱{sale.vatableSales.toFixed(2)}
                            </td>
                            <td className="px-3 md:px-4 py-3 whitespace-nowrap text-xs md:text-sm text-right text-gray-900 dark:text-gray-100">
                              ₱{sale.vatAmount.toFixed(2)}
                            </td>
                            <td className="px-3 md:px-4 py-3 whitespace-nowrap text-xs md:text-sm text-right text-orange-600 dark:text-orange-400 hidden md:table-cell">
                              {sale.discount > 0 ? `-₱${sale.discount.toFixed(2)}` : '₱0.00'}
                            </td>
                            <td className="px-3 md:px-4 py-3 whitespace-nowrap text-xs md:text-sm text-right font-semibold text-gray-900 dark:text-gray-100">
                              ₱{sale.totalAmount.toFixed(2)}
                            </td>
                            <td className="px-3 md:px-4 py-3 text-center text-xs md:text-sm hidden lg:table-cell">
                              <span
                                className={`px-2 py-1 rounded-full text-xs font-semibold ${
                                  sale.status === 'completed'
                                    ? 'bg-green-100 text-green-800'
                                    : sale.status === 'voided'
                                    ? 'bg-red-100 text-red-800'
                                    : sale.status === 'cancelled'
                                    ? 'bg-gray-100 text-gray-800'
                                    : 'bg-yellow-100 text-yellow-800'
                                }`}
                              >
                                {sale.status.toUpperCase()}
                              </span>
                            </td>
                            <td className="px-3 md:px-4 py-3 text-center no-print">
                              <button
                                onClick={() => toggleRow(sale.id)}
                                className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 text-xs md:text-sm font-medium"
                              >
                                {expandedRows.has(sale.id) ? 'Hide' : 'View'}
                              </button>
                            </td>
                          </tr>
                          {expandedRows.has(sale.id) && (
                            <tr className="no-print">
                              <td colSpan={12} className="px-4 py-4 bg-gray-50 dark:bg-gray-700">
                                <div className="text-xs md:text-sm">
                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-3">
                                    <div>
                                      <h5 className="font-semibold text-gray-900 dark:text-gray-100 mb-1">
                                        Customer Details:
                                      </h5>
                                      <p className="text-gray-700 dark:text-gray-300">
                                        <strong>Name:</strong> {sale.customer}
                                      </p>
                                      {sale.customerTIN && (
                                        <p className="text-gray-700 dark:text-gray-300">
                                          <strong>TIN:</strong> {sale.customerTIN}
                                        </p>
                                      )}
                                      {sale.customerAddress && (
                                        <p className="text-gray-700 dark:text-gray-300">
                                          <strong>Address:</strong> {sale.customerAddress}
                                        </p>
                                      )}
                                      {sale.customerContact && (
                                        <p className="text-gray-700 dark:text-gray-300">
                                          <strong>Contact:</strong> {sale.customerContact}
                                        </p>
                                      )}
                                    </div>
                                    <div>
                                      <h5 className="font-semibold text-gray-900 dark:text-gray-100 mb-1">
                                        Transaction Details:
                                      </h5>
                                      <p className="text-gray-700 dark:text-gray-300">
                                        <strong>Location:</strong> {sale.location}
                                      </p>
                                      <p className="text-gray-700 dark:text-gray-300">
                                        <strong>Cashier:</strong> {sale.cashier}
                                      </p>
                                      <p className="text-gray-700 dark:text-gray-300">
                                        <strong>Payment:</strong> {sale.paymentMethod}
                                      </p>
                                      {sale.seniorCitizenId && (
                                        <p className="text-blue-700 dark:text-blue-400">
                                          <strong>Senior Citizen ID:</strong>{' '}
                                          {sale.seniorCitizenId}
                                        </p>
                                      )}
                                      {sale.pwdId && (
                                        <p className="text-purple-700 dark:text-purple-400">
                                          <strong>PWD ID:</strong> {sale.pwdId}
                                        </p>
                                      )}
                                    </div>
                                  </div>
                                  <h5 className="font-semibold text-gray-900 dark:text-gray-100 mb-2">
                                    Sale Items:
                                  </h5>
                                  <div className="overflow-x-auto">
                                    <table className="min-w-full border border-gray-200 dark:border-gray-600">
                                      <thead>
                                        <tr className="bg-gray-100 dark:bg-gray-800">
                                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-700 dark:text-gray-300 border-b border-gray-200 dark:border-gray-600">
                                            Product
                                          </th>
                                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-700 dark:text-gray-300 border-b border-gray-200 dark:border-gray-600">
                                            SKU
                                          </th>
                                          <th className="px-3 py-2 text-right text-xs font-medium text-gray-700 dark:text-gray-300 border-b border-gray-200 dark:border-gray-600">
                                            Qty
                                          </th>
                                          <th className="px-3 py-2 text-right text-xs font-medium text-gray-700 dark:text-gray-300 border-b border-gray-200 dark:border-gray-600">
                                            Unit Price
                                          </th>
                                          <th className="px-3 py-2 text-right text-xs font-medium text-gray-700 dark:text-gray-300 border-b border-gray-200 dark:border-gray-600">
                                            Subtotal
                                          </th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {sale.itemDetails?.map((item: any, idx: number) => (
                                          <tr key={idx} className="border-b border-gray-200 dark:border-gray-600">
                                            <td className="px-3 py-2 text-xs text-gray-900 dark:text-gray-100">
                                              {item.product}
                                            </td>
                                            <td className="px-3 py-2 text-xs text-gray-600 dark:text-gray-400">
                                              {item.sku}
                                            </td>
                                            <td className="px-3 py-2 text-xs text-right text-gray-900 dark:text-gray-100">
                                              {item.quantity}
                                            </td>
                                            <td className="px-3 py-2 text-xs text-right text-gray-900 dark:text-gray-100">
                                              ₱{item.price.toFixed(2)}
                                            </td>
                                            <td className="px-3 py-2 text-xs text-right font-medium text-gray-900 dark:text-gray-100">
                                              ₱{item.subtotal.toFixed(2)}
                                            </td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  </div>
                                </div>
                              </td>
                            </tr>
                          )}
                        </>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {pagination && pagination.totalPages > 1 && (
                <div className="px-4 py-3 bg-gray-50 dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 flex flex-col md:flex-row items-center justify-between gap-4 no-print">
                  <div className="text-xs md:text-sm text-gray-700 dark:text-gray-300">
                    Showing page {pagination.page} of {pagination.totalPages} (
                    {pagination.totalCount} total sales)
                  </div>
                  <div className="flex flex-wrap justify-center gap-2">
                    <button
                      onClick={() => setPage(Math.max(1, page - 1))}
                      disabled={page === 1}
                      className="px-3 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-xs md:text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Previous
                    </button>
                    {[...Array(Math.min(5, pagination.totalPages))].map((_, i) => {
                      const pageNum = i + 1
                      return (
                        <button
                          key={pageNum}
                          onClick={() => setPage(pageNum)}
                          className={`px-3 py-1 border rounded text-xs md:text-sm ${
                            page === pageNum
                              ? 'bg-blue-600 text-white border-blue-600'
                              : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700'
                          }`}
                        >
                          {pageNum}
                        </button>
                      )
                    })}
                    {pagination.totalPages > 5 && (
                      <span className="px-2 py-1 text-gray-500 dark:text-gray-400 text-xs md:text-sm">...</span>
                    )}
                    <button
                      onClick={() => setPage(Math.min(pagination.totalPages, page + 1))}
                      disabled={page === pagination.totalPages}
                      className="px-3 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-xs md:text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Footer Info */}
        <div className="bg-blue-50 dark:bg-blue-900/20 border-l-4 border-blue-500 p-4 rounded no-print">
          <h4 className="text-sm font-semibold text-blue-900 dark:text-blue-300 mb-2">
            Report Notes:
          </h4>
          <ul className="text-xs md:text-sm text-blue-800 dark:text-blue-200 space-y-1 list-disc list-inside">
            <li>Complete sales journal with detailed transaction records</li>
            <li>VAT calculations use the standard 12% rate</li>
            <li>Senior Citizen and PWD discounts are tracked separately</li>
            <li>Voided and cancelled transactions are shown for complete audit trail</li>
            <li>Export to Excel for archival and reporting purposes</li>
          </ul>
        </div>
      </div>
    </>
  )
}
