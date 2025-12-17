'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

export default function CustomerPaymentsReport() {
  const [loading, setLoading] = useState(false)
  const [payments, setPayments] = useState<any[]>([])
  const [summary, setSummary] = useState<any>(null)
  const [locations, setLocations] = useState<any[]>([])
  const [customers, setCustomers] = useState<any[]>([])

  // Initialize with default date range (current month)
  const [startDate, setStartDate] = useState(() => {
    const date = new Date()
    date.setDate(1) // First day of month
    return date.toISOString().split('T')[0]
  })
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split('T')[0])
  const [locationId, setLocationId] = useState('')
  const [customerId, setCustomerId] = useState('')
  const [paymentMethod, setPaymentMethod] = useState('all')
  const [search, setSearch] = useState('')
  const [datePreset, setDatePreset] = useState<string>('this_month')

  useEffect(() => {
    fetchLocations()
    fetchCustomers()
  }, [])

  const fetchLocations = async () => {
    try {
      const res = await fetch('/api/locations/all-active')
      if (res.ok) {
        const data = await res.json()
        // API returns { success: true, data: locations }
        if (data.success && data.data) {
          setLocations(data.data)
        } else if (Array.isArray(data)) {
          setLocations(data)
        }
      }
    } catch (error) {
      console.error('Error fetching locations:', error)
    }
  }

  const fetchCustomers = async () => {
    try {
      const res = await fetch('/api/customers')
      if (res.ok) {
        const data = await res.json()
        // API returns array directly, not { customers: [...] }
        if (Array.isArray(data)) {
          setCustomers(data)
        } else if (data.customers) {
          setCustomers(data.customers)
        } else if (data.data) {
          setCustomers(data.data)
        }
      }
    } catch (error) {
      console.error('Error fetching customers:', error)
    }
  }

  const fetchPayments = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (startDate) params.set('startDate', startDate)
      if (endDate) params.set('endDate', endDate)
      if (locationId && locationId !== 'all') params.set('locationId', locationId)
      if (customerId && customerId !== 'all') params.set('customerId', customerId)
      if (paymentMethod && paymentMethod !== 'all') params.set('paymentMethod', paymentMethod)
      if (search) params.set('search', search)

      const res = await fetch(`/api/reports/customer-payments?${params}`)
      if (res.ok) {
        const data = await res.json()
        setPayments(data.payments || [])
        setSummary(data.summary || {})
      }
    } catch (error) {
      console.error('Error:', error)
    } finally {
      setLoading(false)
    }
  }, [startDate, endDate, locationId, customerId, paymentMethod, search])

  useEffect(() => {
    fetchPayments()
  }, [fetchPayments])

  const setDateRange = (range: string) => {
    const today = new Date()
    let start = new Date()
    let end = new Date()

    switch (range) {
      case 'today':
        start = new Date()
        end = new Date()
        break
      case 'yesterday':
        start = new Date(today.setDate(today.getDate() - 1))
        end = new Date(start)
        break
      case 'this_week':
        const dayOfWeek = today.getDay()
        start = new Date(today.setDate(today.getDate() - dayOfWeek))
        end = new Date()
        break
      case 'last_week':
        const lastWeekEnd = new Date(today.setDate(today.getDate() - today.getDay() - 1))
        start = new Date(lastWeekEnd)
        start.setDate(lastWeekEnd.getDate() - 6)
        end = lastWeekEnd
        break
      case 'this_month':
        start = new Date(today.getFullYear(), today.getMonth(), 1)
        end = new Date()
        break
      case 'last_month':
        start = new Date(today.getFullYear(), today.getMonth() - 1, 1)
        end = new Date(today.getFullYear(), today.getMonth(), 0)
        break
      case 'this_quarter':
        const currentQuarter = Math.floor(today.getMonth() / 3)
        start = new Date(today.getFullYear(), currentQuarter * 3, 1)
        end = new Date()
        break
      case 'last_quarter':
        const lastQuarter = Math.floor(today.getMonth() / 3) - 1
        const year = lastQuarter < 0 ? today.getFullYear() - 1 : today.getFullYear()
        const quarter = lastQuarter < 0 ? 3 : lastQuarter
        start = new Date(year, quarter * 3, 1)
        end = new Date(year, quarter * 3 + 3, 0)
        break
      case 'this_year':
        start = new Date(today.getFullYear(), 0, 1)
        end = new Date()
        break
      case 'last_30_days':
        start = new Date(today.setDate(today.getDate() - 30))
        end = new Date()
        break
      case 'custom':
        return // Don't change dates for custom selection
    }

    setStartDate(start.toISOString().split('T')[0])
    setEndDate(end.toISOString().split('T')[0])
    setDatePreset(range)
  }

  const exportToExcel = () => {
    const headers = ['Date', 'Invoice #', 'Customer', 'Payment Method', 'Amount', 'Balance Before', 'Balance After', 'Status', 'Cashier']
    const rows = payments.map(pmt => [
      new Date(pmt.paymentDate).toLocaleDateString(),
      pmt.invoice.invoiceNumber,
      pmt.customer.name,
      pmt.paymentMethod,
      pmt.paymentAmount.toFixed(2),
      pmt.balanceBeforePayment.toFixed(2),
      pmt.balanceAfterPayment.toFixed(2),
      pmt.isFullyPaid ? 'Fully Paid' : 'Partial',
      pmt.cashier
    ])

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `customer-payments-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
  }

  const exportToPDF = () => {
    const doc = new jsPDF('landscape')

    // Add title
    doc.setFontSize(18)
    doc.text('Customer Payment History Report', 14, 15)

    // Add date range
    doc.setFontSize(11)
    doc.text(`Period: ${startDate} to ${endDate}`, 14, 25)

    // Add summary
    if (summary) {
      doc.setFontSize(10)
      doc.text(`Total Payments: ${summary.totalPayments} | Amount Collected: ₱${summary.totalAmount?.toLocaleString()} | Fully Paid: ${summary.fullyPaidInvoices}`, 14, 32)
    }

    // Add table
    const tableData = payments.map(pmt => [
      new Date(pmt.paymentDate).toLocaleDateString(),
      pmt.invoice.invoiceNumber,
      pmt.customer.name,
      pmt.paymentMethod,
      `₱${pmt.paymentAmount.toFixed(2)}`,
      pmt.isFullyPaid ? 'Fully Paid' : 'Partial',
      pmt.cashier
    ])

    autoTable(doc, {
      startY: 38,
      head: [['Date', 'Invoice #', 'Customer', 'Method', 'Amount', 'Status', 'Cashier']],
      body: tableData,
      styles: { fontSize: 8 },
      headStyles: { fillColor: [34, 197, 94] }
    })

    doc.save(`customer-payments-${new Date().toISOString().split('T')[0]}.pdf`)
  }

  const getPaymentMethodBadge = (method: string) => {
    const badges: Record<string, { bg: string; text: string }> = {
      cash: { bg: 'bg-green-100 dark:bg-green-900/30', text: 'text-green-800 dark:text-green-300' },
      gcash: { bg: 'bg-blue-100 dark:bg-blue-900/30', text: 'text-blue-800 dark:text-blue-300' },
      paymaya: { bg: 'bg-purple-100 dark:bg-purple-900/30', text: 'text-purple-800 dark:text-purple-300' },
      bank_transfer: { bg: 'bg-indigo-100 dark:bg-indigo-900/30', text: 'text-indigo-800 dark:text-indigo-300' },
      card: { bg: 'bg-orange-100 dark:bg-orange-900/30', text: 'text-orange-800 dark:text-orange-300' }
    }
    const badge = badges[method] || badges.cash
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-semibold ${badge.bg} ${badge.text}`}>
        {method.replace('_', ' ').toUpperCase()}
      </span>
    )
  }

  return (
    <div className="p-6 space-y-6 bg-gray-50 dark:bg-gray-900 min-h-screen">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Customer Payment History</h1>
          <p className="text-gray-600 dark:text-gray-300 mt-1">Payment tracking and collection analysis for credit customers</p>
        </div>
        <Link href="/dashboard/reports" className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 font-semibold shadow-md hover:shadow-lg transition-all">
          Back to Reports
        </Link>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
        <h2 className="text-lg font-semibold mb-4 text-gray-900 dark:text-gray-100">Filters</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Date Preset Dropdown */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Date Range Preset</label>
            <select
              value={datePreset}
              onChange={(e) => setDateRange(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500"
            >
              <option value="today">Today</option>
              <option value="yesterday">Yesterday</option>
              <option value="this_week">This Week</option>
              <option value="last_week">Last Week</option>
              <option value="this_month">This Month</option>
              <option value="last_month">Last Month</option>
              <option value="this_quarter">This Quarter</option>
              <option value="last_quarter">Last Quarter</option>
              <option value="this_year">This Year</option>
              <option value="last_30_days">Last 30 Days</option>
              <option value="custom">Custom Range</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Start Date</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => {
                setStartDate(e.target.value)
                setDatePreset('custom')
              }}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">End Date</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => {
                setEndDate(e.target.value)
                setDatePreset('custom')
              }}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Location</label>
            <select
              value={locationId}
              onChange={(e) => setLocationId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500"
            >
              <option value="all">All Locations</option>
              {locations.map((loc) => (
                <option key={loc.id} value={loc.id}>{loc.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Customer</label>
            <select
              value={customerId}
              onChange={(e) => setCustomerId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500"
            >
              <option value="all">All Customers</option>
              {customers.map((cust) => (
                <option key={cust.id} value={cust.id}>{cust.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Payment Method</label>
            <select
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500"
            >
              <option value="all">All Methods</option>
              <option value="cash">Cash</option>
              <option value="gcash">GCash</option>
              <option value="paymaya">PayMaya</option>
              <option value="bank_transfer">Bank Transfer</option>
              <option value="card">Card</option>
            </select>
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Search</label>
            <input
              type="text"
              placeholder="Customer name or invoice number"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500"
            />
          </div>
        </div>

        {/* Action Buttons */}
        <div className="mt-6 flex flex-wrap gap-3">
          <button
            onClick={fetchPayments}
            disabled={loading}
            className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg shadow-md hover:shadow-lg transition-all disabled:opacity-50"
          >
            {loading ? 'Loading...' : 'Generate Report'}
          </button>
          <button
            onClick={exportToExcel}
            disabled={payments.length === 0}
            className="px-6 py-2.5 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-lg shadow-md hover:shadow-lg transition-all disabled:opacity-50"
          >
            Export to Excel
          </button>
          <button
            onClick={exportToPDF}
            disabled={payments.length === 0}
            className="px-6 py-2.5 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-lg shadow-md hover:shadow-lg transition-all disabled:opacity-50"
          >
            Export to PDF
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-gradient-to-br from-green-500 to-green-600 p-6 rounded-lg shadow-lg text-white">
            <div className="text-sm opacity-90">Total Collected</div>
            <div className="text-3xl font-bold mt-2">₱{summary.totalAmount?.toLocaleString()}</div>
            <div className="text-xs mt-1 opacity-80">{summary.totalPayments} payments</div>
          </div>
          <div className="bg-gradient-to-br from-blue-500 to-blue-600 p-6 rounded-lg shadow-lg text-white">
            <div className="text-sm opacity-90">Unique Customers</div>
            <div className="text-3xl font-bold mt-2">{summary.uniqueCustomers}</div>
            <div className="text-xs mt-1 opacity-80">{summary.uniqueInvoices} invoices</div>
          </div>
          <div className="bg-gradient-to-br from-purple-500 to-purple-600 p-6 rounded-lg shadow-lg text-white">
            <div className="text-sm opacity-90">Fully Paid Invoices</div>
            <div className="text-3xl font-bold mt-2">{summary.fullyPaidInvoices}</div>
            <div className="text-xs mt-1 opacity-80">Completed</div>
          </div>
          <div className="bg-gradient-to-br from-orange-500 to-orange-600 p-6 rounded-lg shadow-lg text-white">
            <div className="text-sm opacity-90">Date Range</div>
            <div className="text-lg font-bold mt-2">{summary.startDate}</div>
            <div className="text-sm opacity-80">to {summary.endDate}</div>
          </div>
        </div>
      )}

      {/* Payment Method Breakdown */}
      {summary && summary.paymentMethodBreakdown && summary.paymentMethodBreakdown.length > 0 && (
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-gray-100">Payment Method Breakdown</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {summary.paymentMethodBreakdown.map((method: any, idx: number) => (
              <div key={idx} className="border-l-4 border-blue-500 pl-4 bg-gray-50 dark:bg-gray-700/50 p-4 rounded-r-lg">
                <div className="text-sm text-gray-600 dark:text-gray-400">{method.method}</div>
                <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">₱{method.amount?.toLocaleString()}</div>
                <div className="text-sm text-gray-500 dark:text-gray-400">{method.count} payments ({method.percentage.toFixed(1)}%)</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Top Paying Customers */}
      {summary && summary.topPayingCustomers && summary.topPayingCustomers.length > 0 && (
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-gray-100">Top 10 Paying Customers</h3>
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase">Customer</th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-gray-700 dark:text-gray-300 uppercase">Payments</th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-gray-700 dark:text-gray-300 uppercase">Total Paid</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {summary.topPayingCustomers.map((customer: any, idx: number) => (
                  <tr key={idx}>
                    <td className="px-4 py-2 text-sm text-gray-900 dark:text-gray-100">{customer.customerName}</td>
                    <td className="px-4 py-2 text-sm text-right text-gray-600 dark:text-gray-400">{customer.paymentCount}</td>
                    <td className="px-4 py-2 text-sm text-right font-semibold text-green-600 dark:text-green-400">₱{customer.totalPaid?.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Payments Table */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-700">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase">Payment Date</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase">Invoice #</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase">Customer</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-700 dark:text-gray-300 uppercase">Method</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-700 dark:text-gray-300 uppercase">Amount</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-700 dark:text-gray-300 uppercase">Bal. Before</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-700 dark:text-gray-300 uppercase">Bal. After</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-700 dark:text-gray-300 uppercase">Status</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase">Cashier</th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {loading ? (
                <tr><td colSpan={9} className="px-4 py-8 text-center text-gray-500 dark:text-gray-400">Loading...</td></tr>
              ) : payments.length === 0 ? (
                <tr><td colSpan={9} className="px-4 py-8 text-center text-gray-500 dark:text-gray-400">No payments found for the selected period.</td></tr>
              ) : (
                payments.map((pmt, idx) => (
                  <tr key={idx} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                    <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">{new Date(pmt.paymentDate).toLocaleDateString()}</td>
                    <td className="px-4 py-3 text-sm font-medium text-blue-600 dark:text-blue-400">{pmt.invoice.invoiceNumber}</td>
                    <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">
                      <div>{pmt.customer.name}</div>
                      {pmt.customer.mobile && (
                        <div className="text-xs text-gray-500 dark:text-gray-400">{pmt.customer.mobile}</div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-center">{getPaymentMethodBadge(pmt.paymentMethod)}</td>
                    <td className="px-4 py-3 text-sm text-right font-bold text-green-600 dark:text-green-400">₱{pmt.paymentAmount.toFixed(2)}</td>
                    <td className="px-4 py-3 text-sm text-right text-gray-600 dark:text-gray-400">₱{pmt.balanceBeforePayment.toFixed(2)}</td>
                    <td className="px-4 py-3 text-sm text-right text-gray-900 dark:text-gray-100">₱{pmt.balanceAfterPayment.toFixed(2)}</td>
                    <td className="px-4 py-3 text-sm text-center">
                      <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                        pmt.isFullyPaid
                          ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300'
                          : 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300'
                      }`}>
                        {pmt.isFullyPaid ? 'FULLY PAID' : 'PARTIAL'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">{pmt.cashier}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
