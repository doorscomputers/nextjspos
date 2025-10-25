'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { CreditCardIcon } from '@heroicons/react/24/outline'

export default function UnpaidInvoicesReport() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [invoices, setInvoices] = useState<any[]>([])
  const [summary, setSummary] = useState<any>(null)
  const [locations, setLocations] = useState<any[]>([])
  const [customers, setCustomers] = useState<any[]>([])

  // Filters
  const [locationId, setLocationId] = useState('')
  const [customerId, setCustomerId] = useState('')
  const [status, setStatus] = useState('all')
  const [agingPeriod, setAgingPeriod] = useState('all')
  const [search, setSearch] = useState('')

  useEffect(() => {
    fetchLocations()
    fetchCustomers()
  }, [])

  const fetchLocations = async () => {
    try {
      const res = await fetch('/api/locations')
      if (res.ok) {
        const data = await res.json()
        setLocations(data.locations || [])
      }
    } catch (error) {
      console.error('Error:', error)
    }
  }

  const fetchCustomers = async () => {
    try {
      const res = await fetch('/api/customers')
      if (res.ok) {
        const data = await res.json()
        setCustomers(data.customers || [])
      }
    } catch (error) {
      console.error('Error:', error)
    }
  }

  const fetchInvoices = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (locationId && locationId !== 'all') params.set('locationId', locationId)
      if (customerId && customerId !== 'all') params.set('customerId', customerId)
      if (status && status !== 'all') params.set('status', status)
      if (agingPeriod && agingPeriod !== 'all') params.set('agingPeriod', agingPeriod)
      if (search) params.set('search', search)

      const res = await fetch(`/api/reports/unpaid-invoices?${params}`)
      if (res.ok) {
        const data = await res.json()
        setInvoices(data.invoices || [])
        setSummary(data.summary || {})
      }
    } catch (error) {
      console.error('Error:', error)
    } finally {
      setLoading(false)
    }
  }, [locationId, customerId, status, agingPeriod, search])

  useEffect(() => {
    fetchInvoices()
  }, [fetchInvoices])

  const exportToExcel = () => {
    const headers = ['Invoice #', 'Customer', 'Sale Date', 'Total', 'Paid', 'Balance Due', 'Days Out', 'Aging', 'Status']
    const rows = invoices.map(inv => [
      inv.invoiceNumber,
      inv.customer.name,
      inv.saleDate,
      inv.totalAmount.toFixed(2),
      inv.amountPaid.toFixed(2),
      inv.balanceDue.toFixed(2),
      inv.daysOutstanding,
      inv.agingPeriod,
      inv.status
    ])

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `unpaid-invoices-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
  }

  const exportToPDF = () => {
    const doc = new jsPDF('landscape')

    // Add title
    doc.setFontSize(18)
    doc.text('Unpaid Invoices Report', 14, 15)

    // Add date
    doc.setFontSize(11)
    doc.text(`Generated: ${new Date().toLocaleDateString()}`, 14, 25)

    // Add summary
    if (summary) {
      doc.setFontSize(10)
      doc.text(`Total Invoices: ${summary.totalInvoices} | Outstanding: ₱${summary.totalOutstanding?.toLocaleString()} | Overdue: ${summary.totalOverdue} (₱${summary.totalOverdueAmount?.toLocaleString()})`, 14, 32)
    }

    // Add table
    const tableData = invoices.map(inv => [
      inv.invoiceNumber,
      inv.customer.name,
      inv.saleDate,
      `₱${inv.totalAmount.toFixed(2)}`,
      `₱${inv.balanceDue.toFixed(2)}`,
      inv.daysOutstanding,
      inv.agingPeriod,
      inv.status
    ])

    autoTable(doc, {
      startY: 38,
      head: [['Invoice #', 'Customer', 'Date', 'Total', 'Balance', 'Days', 'Aging', 'Status']],
      body: tableData,
      styles: { fontSize: 8 },
      headStyles: { fillColor: [220, 38, 38] }
    })

    doc.save(`unpaid-invoices-${new Date().toISOString().split('T')[0]}.pdf`)
  }

  const getStatusBadge = (status: string) => {
    const badges: Record<string, { bg: string; text: string }> = {
      unpaid: { bg: 'bg-red-100 dark:bg-red-900/30', text: 'text-red-800 dark:text-red-300' },
      partially_paid: { bg: 'bg-yellow-100 dark:bg-yellow-900/30', text: 'text-yellow-800 dark:text-yellow-300' },
      overdue: { bg: 'bg-orange-100 dark:bg-orange-900/30', text: 'text-orange-800 dark:text-orange-300' },
      current: { bg: 'bg-green-100 dark:bg-green-900/30', text: 'text-green-800 dark:text-green-300' }
    }
    const badge = badges[status] || badges.unpaid
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-semibold ${badge.bg} ${badge.text}`}>
        {status.replace('_', ' ').toUpperCase()}
      </span>
    )
  }

  const getAgingBadge = (aging: string) => {
    const badges: Record<string, { bg: string; text: string }> = {
      current: { bg: 'bg-green-100 dark:bg-green-900/30', text: 'text-green-800 dark:text-green-300' },
      '30days': { bg: 'bg-blue-100 dark:bg-blue-900/30', text: 'text-blue-800 dark:text-blue-300' },
      '60days': { bg: 'bg-yellow-100 dark:bg-yellow-900/30', text: 'text-yellow-800 dark:text-yellow-300' },
      over90: { bg: 'bg-red-100 dark:bg-red-900/30', text: 'text-red-800 dark:text-red-300' }
    }
    const badge = badges[aging] || badges.current
    const label = aging === 'over90' ? '90+ days' : aging === 'current' ? '0-30 days' : aging.replace('days', ' days')
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-semibold ${badge.bg} ${badge.text}`}>
        {label}
      </span>
    )
  }

  return (
    <div className="p-6 space-y-6 bg-gray-50 dark:bg-gray-900 min-h-screen">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Unpaid Invoices Report</h1>
          <p className="text-gray-600 dark:text-gray-300 mt-1">Outstanding customer credit and aging analysis</p>
        </div>
        <Link href="/dashboard/reports" className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 font-semibold shadow-md hover:shadow-lg transition-all">
          Back to Reports
        </Link>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
        <h2 className="text-lg font-semibold mb-4 text-gray-900 dark:text-gray-100">Filters</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
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
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Status</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500"
            >
              <option value="all">All Status</option>
              <option value="unpaid">Unpaid</option>
              <option value="partially_paid">Partially Paid</option>
              <option value="overdue">Overdue</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Aging Period</label>
            <select
              value={agingPeriod}
              onChange={(e) => setAgingPeriod(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500"
            >
              <option value="all">All Periods</option>
              <option value="current">Current (0-30 days)</option>
              <option value="30days">31-60 days</option>
              <option value="60days">61-90 days</option>
              <option value="over90">90+ days</option>
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
            onClick={fetchInvoices}
            disabled={loading}
            className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg shadow-md hover:shadow-lg transition-all disabled:opacity-50"
          >
            {loading ? 'Loading...' : 'Generate Report'}
          </button>
          <button
            onClick={exportToExcel}
            disabled={invoices.length === 0}
            className="px-6 py-2.5 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-lg shadow-md hover:shadow-lg transition-all disabled:opacity-50"
          >
            Export to Excel
          </button>
          <button
            onClick={exportToPDF}
            disabled={invoices.length === 0}
            className="px-6 py-2.5 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-lg shadow-md hover:shadow-lg transition-all disabled:opacity-50"
          >
            Export to PDF
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-gradient-to-br from-red-500 to-red-600 p-6 rounded-lg shadow-lg text-white">
            <div className="text-sm opacity-90">Total Outstanding</div>
            <div className="text-3xl font-bold mt-2">₱{summary.totalOutstanding?.toLocaleString()}</div>
            <div className="text-xs mt-1 opacity-80">{summary.totalInvoices} invoices</div>
          </div>
          <div className="bg-gradient-to-br from-orange-500 to-orange-600 p-6 rounded-lg shadow-lg text-white">
            <div className="text-sm opacity-90">Overdue Invoices</div>
            <div className="text-3xl font-bold mt-2">{summary.totalOverdue}</div>
            <div className="text-xs mt-1 opacity-80">₱{summary.totalOverdueAmount?.toLocaleString()}</div>
          </div>
          <div className="bg-gradient-to-br from-green-500 to-green-600 p-6 rounded-lg shadow-lg text-white">
            <div className="text-sm opacity-90">Current (0-30 days)</div>
            <div className="text-3xl font-bold mt-2">{summary.agingBreakdown?.current?.count || 0}</div>
            <div className="text-xs mt-1 opacity-80">₱{summary.agingBreakdown?.current?.amount?.toLocaleString() || 0}</div>
          </div>
          <div className="bg-gradient-to-br from-purple-500 to-purple-600 p-6 rounded-lg shadow-lg text-white">
            <div className="text-sm opacity-90">90+ Days Overdue</div>
            <div className="text-3xl font-bold mt-2">{summary.agingBreakdown?.over90?.count || 0}</div>
            <div className="text-xs mt-1 opacity-80">₱{summary.agingBreakdown?.over90?.amount?.toLocaleString() || 0}</div>
          </div>
        </div>
      )}

      {/* Aging Breakdown Chart */}
      {summary && summary.agingBreakdown && (
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-gray-100">Aging Analysis</h3>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="border-l-4 border-green-500 pl-4">
              <div className="text-sm text-gray-600 dark:text-gray-400">0-30 Days</div>
              <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">{summary.agingBreakdown.current?.count || 0}</div>
              <div className="text-sm text-gray-500 dark:text-gray-400">₱{summary.agingBreakdown.current?.amount?.toLocaleString() || 0}</div>
            </div>
            <div className="border-l-4 border-blue-500 pl-4">
              <div className="text-sm text-gray-600 dark:text-gray-400">31-60 Days</div>
              <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">{summary.agingBreakdown['30days']?.count || 0}</div>
              <div className="text-sm text-gray-500 dark:text-gray-400">₱{summary.agingBreakdown['30days']?.amount?.toLocaleString() || 0}</div>
            </div>
            <div className="border-l-4 border-yellow-500 pl-4">
              <div className="text-sm text-gray-600 dark:text-gray-400">61-90 Days</div>
              <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">{summary.agingBreakdown['60days']?.count || 0}</div>
              <div className="text-sm text-gray-500 dark:text-gray-400">₱{summary.agingBreakdown['60days']?.amount?.toLocaleString() || 0}</div>
            </div>
            <div className="border-l-4 border-red-500 pl-4">
              <div className="text-sm text-gray-600 dark:text-gray-400">90+ Days</div>
              <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">{summary.agingBreakdown.over90?.count || 0}</div>
              <div className="text-sm text-gray-500 dark:text-gray-400">₱{summary.agingBreakdown.over90?.amount?.toLocaleString() || 0}</div>
            </div>
          </div>
        </div>
      )}

      {/* Top Debtors */}
      {summary && summary.topDebtors && summary.topDebtors.length > 0 && (
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-gray-100">Top 10 Debtors</h3>
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase">Customer</th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-gray-700 dark:text-gray-300 uppercase">Invoices</th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-gray-700 dark:text-gray-300 uppercase">Total Due</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {summary.topDebtors.map((debtor: any, idx: number) => (
                  <tr key={idx}>
                    <td className="px-4 py-2 text-sm text-gray-900 dark:text-gray-100">{debtor.customerName}</td>
                    <td className="px-4 py-2 text-sm text-right text-gray-600 dark:text-gray-400">{debtor.invoiceCount}</td>
                    <td className="px-4 py-2 text-sm text-right font-semibold text-red-600 dark:text-red-400">₱{debtor.totalDue?.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Invoices Table */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-700">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase">Invoice #</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase">Customer</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase">Sale Date</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-700 dark:text-gray-300 uppercase">Total</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-700 dark:text-gray-300 uppercase">Paid</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-700 dark:text-gray-300 uppercase">Balance Due</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-700 dark:text-gray-300 uppercase">Days Out</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-700 dark:text-gray-300 uppercase">Aging</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-700 dark:text-gray-300 uppercase">Status</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-700 dark:text-gray-300 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {loading ? (
                <tr><td colSpan={10} className="px-4 py-8 text-center text-gray-500 dark:text-gray-400">Loading...</td></tr>
              ) : invoices.length === 0 ? (
                <tr><td colSpan={10} className="px-4 py-8 text-center text-gray-500 dark:text-gray-400">No unpaid invoices found.</td></tr>
              ) : (
                invoices.map((inv, idx) => (
                  <tr key={idx} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                    <td className="px-4 py-3 text-sm font-medium text-blue-600 dark:text-blue-400">{inv.invoiceNumber}</td>
                    <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">
                      <div>{inv.customer.name}</div>
                      {inv.customer.mobile && (
                        <div className="text-xs text-gray-500 dark:text-gray-400">{inv.customer.mobile}</div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-300">{inv.saleDate}</td>
                    <td className="px-4 py-3 text-sm text-right text-gray-900 dark:text-gray-100">₱{inv.totalAmount.toFixed(2)}</td>
                    <td className="px-4 py-3 text-sm text-right text-green-600 dark:text-green-400">₱{inv.amountPaid.toFixed(2)}</td>
                    <td className="px-4 py-3 text-sm text-right font-bold text-red-600 dark:text-red-400">₱{inv.balanceDue.toFixed(2)}</td>
                    <td className="px-4 py-3 text-sm text-center">
                      <span className={`font-semibold ${inv.daysOutstanding > 30 ? 'text-red-600 dark:text-red-400' : 'text-gray-900 dark:text-gray-100'}`}>
                        {inv.daysOutstanding}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-center">{getAgingBadge(inv.agingPeriod)}</td>
                    <td className="px-4 py-3 text-sm text-center">{getStatusBadge(inv.status)}</td>
                    <td className="px-4 py-3 text-sm text-center">
                      <button
                        onClick={() => router.push(`/dashboard/sales/${inv.id}/payment`)}
                        className="inline-flex items-center px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1"
                        title="Record Payment"
                      >
                        <CreditCardIcon className="h-4 w-4 mr-1" />
                        Pay
                      </button>
                    </td>
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
