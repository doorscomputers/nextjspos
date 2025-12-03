'use client'

import { useState, useEffect, useCallback } from 'react'
import { usePermissions } from '@/hooks/usePermissions'
import { PERMISSIONS } from '@/lib/rbac'
import { toast } from 'sonner'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  BanknotesIcon,
  MagnifyingGlassIcon,
  UserIcon,
  DocumentTextIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  ArrowPathIcon,
  TableCellsIcon,
} from '@heroicons/react/24/outline'

interface Customer {
  id: number
  name: string
  email: string | null
  mobile: string | null
  arBalance: number
  hasUnpaidInvoices: boolean
}

interface OBInvoice {
  id: number
  invoiceNumber: string
  totalAmount: number
  paidAmount: number
  remainingBalance: number
  notes: string | null
  createdAt: string
}

interface OBInvoiceListItem {
  id: number
  invoiceNumber: string
  customerId: number
  customerName: string
  customerMobile: string
  totalAmount: number
  paidAmount: number
  remainingBalance: number
  notes: string | null
  saleDate: string
  createdAt: string
}

export default function OpeningBalancePage() {
  const { can } = usePermissions()
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  // Customer search
  const [searchQuery, setSearchQuery] = useState('')
  const [customers, setCustomers] = useState<Customer[]>([])
  const [filteredCustomers, setFilteredCustomers] = useState<Customer[]>([])
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null)
  const [showDropdown, setShowDropdown] = useState(false)

  // OB Invoice info
  const [existingOB, setExistingOB] = useState<OBInvoice | null>(null)
  const [loadingOB, setLoadingOB] = useState(false)

  // Form
  const [amount, setAmount] = useState('')
  const [notes, setNotes] = useState('')

  // Success state
  const [lastResult, setLastResult] = useState<{
    action: 'created' | 'updated'
    invoiceNumber: string
    totalAmount: number
    previousAmount: number
  } | null>(null)

  // OB Invoice List
  const [obInvoices, setObInvoices] = useState<OBInvoiceListItem[]>([])
  const [loadingList, setLoadingList] = useState(false)
  const [listSummary, setListSummary] = useState({
    total: 0,
    totalBalance: 0,
    totalPaid: 0,
    totalRemaining: 0,
  })

  // Check permission
  const hasPermission = can(PERMISSIONS.CUSTOMER_UPDATE)

  // Fetch all customers and OB invoices on mount
  useEffect(() => {
    fetchCustomers()
    fetchOBInvoices()
  }, [])

  const fetchCustomers = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/customers?activeOnly=true')
      if (res.ok) {
        const data = await res.json()
        setCustomers(Array.isArray(data) ? data : [])
      }
    } catch (error) {
      console.error('Error fetching customers:', error)
      toast.error('Failed to load customers')
    } finally {
      setLoading(false)
    }
  }

  const fetchOBInvoices = async () => {
    setLoadingList(true)
    try {
      const res = await fetch('/api/customers/opening-balance')
      if (res.ok) {
        const data = await res.json()
        setObInvoices(data.invoices || [])
        setListSummary({
          total: data.total || 0,
          totalBalance: data.totalBalance || 0,
          totalPaid: data.totalPaid || 0,
          totalRemaining: data.totalRemaining || 0,
        })
      }
    } catch (error) {
      console.error('Error fetching OB invoices:', error)
    } finally {
      setLoadingList(false)
    }
  }

  // Filter customers based on search
  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredCustomers([])
      setShowDropdown(false)
      return
    }

    const query = searchQuery.toLowerCase()
    const filtered = customers.filter(
      (c) =>
        c.name.toLowerCase().includes(query) ||
        c.mobile?.toLowerCase().includes(query) ||
        c.email?.toLowerCase().includes(query)
    )
    setFilteredCustomers(filtered.slice(0, 10)) // Limit to 10 results
    setShowDropdown(filtered.length > 0)
  }, [searchQuery, customers])

  // Fetch existing OB invoice when customer is selected
  const fetchExistingOB = useCallback(async (customerId: number) => {
    setLoadingOB(true)
    setExistingOB(null)
    try {
      const res = await fetch(`/api/customers/opening-balance?customerId=${customerId}`)
      if (res.ok) {
        const data = await res.json()
        if (data.exists) {
          setExistingOB(data.invoice)
        }
      }
    } catch (error) {
      console.error('Error fetching OB invoice:', error)
    } finally {
      setLoadingOB(false)
    }
  }, [])

  const handleSelectCustomer = (customer: Customer) => {
    setSelectedCustomer(customer)
    setSearchQuery(customer.name)
    setShowDropdown(false)
    setLastResult(null)
    fetchExistingOB(customer.id)
  }

  const handleClearCustomer = () => {
    setSelectedCustomer(null)
    setSearchQuery('')
    setExistingOB(null)
    setAmount('')
    setNotes('')
    setLastResult(null)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!selectedCustomer) {
      toast.error('Please select a customer')
      return
    }

    const amountNum = parseFloat(amount)
    if (isNaN(amountNum) || amountNum <= 0) {
      toast.error('Please enter a valid positive amount')
      return
    }

    setSubmitting(true)
    try {
      const res = await fetch('/api/customers/opening-balance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId: selectedCustomer.id,
          amount: amountNum,
          notes: notes.trim() || undefined,
        }),
      })

      const data = await res.json()

      if (res.ok && data.success) {
        setLastResult({
          action: data.action,
          invoiceNumber: data.invoice.invoiceNumber,
          totalAmount: data.invoice.totalAmount,
          previousAmount: data.invoice.previousAmount,
        })

        toast.success(
          data.action === 'created'
            ? `Opening balance invoice ${data.invoice.invoiceNumber} created for ₱${amountNum.toLocaleString()}`
            : `Opening balance updated. New total: ₱${data.invoice.totalAmount.toLocaleString()}`
        )

        // Clear form but keep customer selected
        setAmount('')
        setNotes('')

        // Refresh OB info
        fetchExistingOB(selectedCustomer.id)

        // Refresh customers to get updated AR balance
        fetchCustomers()

        // Refresh the OB invoice list
        fetchOBInvoices()
      } else {
        toast.error(data.error || 'Failed to process opening balance')
      }
    } catch (error) {
      console.error('Error submitting opening balance:', error)
      toast.error('Failed to process opening balance')
    } finally {
      setSubmitting(false)
    }
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency: 'PHP',
      minimumFractionDigits: 2,
    }).format(value)
  }

  if (!hasPermission) {
    return (
      <div className="p-6">
        <Card className="border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3 text-red-700 dark:text-red-400">
              <ExclamationTriangleIcon className="h-6 w-6" />
              <p>You do not have permission to manage customer opening balances.</p>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-4xl mx-auto">
      {/* Page Header */}
      <div className="flex items-center gap-3">
        <div className="p-2 bg-blue-100 dark:bg-blue-900 rounded-lg">
          <BanknotesIcon className="h-6 w-6 text-blue-600 dark:text-blue-400" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Customer Opening Balance
          </h1>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Enter previous outstanding balances for customers
          </p>
        </div>
      </div>

      {/* Main Form Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Add Opening Balance</CardTitle>
          <CardDescription>
            Search for a customer and enter their previous outstanding balance. This will create an
            AR invoice that can be collected via POS.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Customer Search */}
            <div className="space-y-2">
              <Label htmlFor="customer-search">
                Customer <span className="text-red-500">*</span>
              </Label>
              <div className="relative">
                <div className="relative">
                  <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    id="customer-search"
                    type="text"
                    placeholder="Search by name, mobile, or email..."
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value)
                      if (selectedCustomer && e.target.value !== selectedCustomer.name) {
                        setSelectedCustomer(null)
                        setExistingOB(null)
                      }
                    }}
                    onFocus={() => searchQuery && filteredCustomers.length > 0 && setShowDropdown(true)}
                    className="pl-10"
                    disabled={loading}
                  />
                </div>

                {/* Dropdown */}
                {showDropdown && (
                  <div className="absolute z-50 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg max-h-60 overflow-auto">
                    {filteredCustomers.map((customer) => (
                      <button
                        key={customer.id}
                        type="button"
                        onClick={() => handleSelectCustomer(customer)}
                        className="w-full px-4 py-3 text-left hover:bg-gray-100 dark:hover:bg-gray-700 border-b border-gray-100 dark:border-gray-700 last:border-0"
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-medium text-gray-900 dark:text-white">
                              {customer.name}
                            </p>
                            <p className="text-sm text-gray-500 dark:text-gray-400">
                              {customer.mobile || customer.email || 'No contact info'}
                            </p>
                          </div>
                          {customer.arBalance > 0 && (
                            <span className="text-sm font-medium text-orange-600 dark:text-orange-400">
                              AR: {formatCurrency(customer.arBalance)}
                            </span>
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {selectedCustomer && (
                <div className="flex items-center justify-between p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                  <div className="flex items-center gap-3">
                    <UserIcon className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                    <div>
                      <p className="font-medium text-blue-900 dark:text-blue-100">
                        {selectedCustomer.name}
                      </p>
                      <p className="text-sm text-blue-700 dark:text-blue-300">
                        Current AR Balance: {formatCurrency(selectedCustomer.arBalance)}
                      </p>
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={handleClearCustomer}
                    className="text-blue-600 hover:text-blue-800 dark:text-blue-400"
                  >
                    Change
                  </Button>
                </div>
              )}
            </div>

            {/* Existing OB Invoice Info */}
            {selectedCustomer && (
              <div className="space-y-2">
                {loadingOB ? (
                  <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg animate-pulse">
                    <p className="text-sm text-gray-500">Loading existing balance...</p>
                  </div>
                ) : existingOB ? (
                  <div className="p-4 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800">
                    <div className="flex items-start gap-3">
                      <DocumentTextIcon className="h-5 w-5 text-amber-600 dark:text-amber-400 mt-0.5" />
                      <div className="flex-1">
                        <p className="font-medium text-amber-900 dark:text-amber-100">
                          Existing Opening Balance Invoice
                        </p>
                        <p className="text-sm text-amber-700 dark:text-amber-300">
                          Invoice: {existingOB.invoiceNumber}
                        </p>
                        <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
                          <div>
                            <span className="text-amber-600 dark:text-amber-400">Total:</span>{' '}
                            <span className="font-medium text-amber-900 dark:text-amber-100">
                              {formatCurrency(existingOB.totalAmount)}
                            </span>
                          </div>
                          <div>
                            <span className="text-amber-600 dark:text-amber-400">Paid:</span>{' '}
                            <span className="font-medium text-amber-900 dark:text-amber-100">
                              {formatCurrency(existingOB.paidAmount)}
                            </span>
                          </div>
                          <div className="col-span-2">
                            <span className="text-amber-600 dark:text-amber-400">Remaining:</span>{' '}
                            <span className="font-bold text-amber-900 dark:text-amber-100">
                              {formatCurrency(existingOB.remainingBalance)}
                            </span>
                          </div>
                        </div>
                        {existingOB.notes && (
                          <p className="mt-2 text-xs text-amber-600 dark:text-amber-400">
                            History: {existingOB.notes}
                          </p>
                        )}
                        <p className="mt-2 text-sm text-amber-700 dark:text-amber-300">
                          Adding a new amount will update this existing invoice.
                        </p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
                    <p className="text-sm text-green-700 dark:text-green-300">
                      No existing opening balance invoice. A new one will be created.
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Amount Input */}
            <div className="space-y-2">
              <Label htmlFor="amount">
                Amount to Add <span className="text-red-500">*</span>
              </Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 font-medium">
                  ₱
                </span>
                <Input
                  id="amount"
                  type="number"
                  step="0.01"
                  min="0.01"
                  placeholder="0.00"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="pl-8 text-lg font-medium"
                  disabled={!selectedCustomer || submitting}
                />
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Enter the opening balance amount. This will be added to any existing balance.
              </p>
            </div>

            {/* Notes */}
            <div className="space-y-2">
              <Label htmlFor="notes">Notes (Optional)</Label>
              <Textarea
                id="notes"
                placeholder="e.g., Previous balance from old system, Invoice #12345"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                disabled={!selectedCustomer || submitting}
              />
            </div>

            {/* Submit Button */}
            <div className="pt-4">
              <Button
                type="submit"
                variant="success"
                size="lg"
                className="w-full"
                disabled={!selectedCustomer || !amount || submitting}
              >
                {submitting ? (
                  <>
                    <span className="animate-spin mr-2">&#9696;</span>
                    Processing...
                  </>
                ) : existingOB ? (
                  'Add to Existing Opening Balance'
                ) : (
                  'Create Opening Balance Invoice'
                )}
              </Button>
            </div>
          </form>

          {/* Success Result */}
          {lastResult && (
            <div className="mt-6 p-4 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
              <div className="flex items-start gap-3">
                <CheckCircleIcon className="h-6 w-6 text-green-600 dark:text-green-400" />
                <div>
                  <p className="font-medium text-green-900 dark:text-green-100">
                    {lastResult.action === 'created'
                      ? 'Opening Balance Invoice Created'
                      : 'Opening Balance Updated'}
                  </p>
                  <p className="text-sm text-green-700 dark:text-green-300">
                    Invoice: {lastResult.invoiceNumber}
                  </p>
                  {lastResult.action === 'updated' && (
                    <p className="text-sm text-green-700 dark:text-green-300">
                      Previous: {formatCurrency(lastResult.previousAmount)} &rarr; New Total:{' '}
                      {formatCurrency(lastResult.totalAmount)}
                    </p>
                  )}
                  {lastResult.action === 'created' && (
                    <p className="text-sm text-green-700 dark:text-green-300">
                      Amount: {formatCurrency(lastResult.totalAmount)}
                    </p>
                  )}
                  <p className="mt-2 text-xs text-green-600 dark:text-green-400">
                    This invoice will appear in AR reports and can be collected via POS &rarr; AR
                    Payment
                  </p>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Opening Balance List */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <TableCellsIcon className="h-5 w-5 text-gray-600 dark:text-gray-400" />
              <div>
                <CardTitle className="text-lg">Opening Balance Invoices</CardTitle>
                <CardDescription>
                  All encoded opening balances ({listSummary.total} records)
                </CardDescription>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={fetchOBInvoices}
              disabled={loadingList}
              className="gap-2"
            >
              <ArrowPathIcon className={`h-4 w-4 ${loadingList ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {/* Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
              <p className="text-xs text-blue-600 dark:text-blue-400">Total Records</p>
              <p className="text-xl font-bold text-blue-900 dark:text-blue-100">
                {listSummary.total}
              </p>
            </div>
            <div className="p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg">
              <p className="text-xs text-amber-600 dark:text-amber-400">Total Balance</p>
              <p className="text-xl font-bold text-amber-900 dark:text-amber-100">
                {formatCurrency(listSummary.totalBalance)}
              </p>
            </div>
            <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
              <p className="text-xs text-green-600 dark:text-green-400">Total Paid</p>
              <p className="text-xl font-bold text-green-900 dark:text-green-100">
                {formatCurrency(listSummary.totalPaid)}
              </p>
            </div>
            <div className="p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
              <p className="text-xs text-red-600 dark:text-red-400">Total Remaining</p>
              <p className="text-xl font-bold text-red-900 dark:text-red-100">
                {formatCurrency(listSummary.totalRemaining)}
              </p>
            </div>
          </div>

          {/* Table */}
          {loadingList ? (
            <div className="text-center py-8 text-gray-500">Loading...</div>
          ) : obInvoices.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No opening balance invoices found. Use the form above to add one.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-700">
                    <th className="text-left py-3 px-2 font-medium text-gray-600 dark:text-gray-400">
                      Invoice #
                    </th>
                    <th className="text-left py-3 px-2 font-medium text-gray-600 dark:text-gray-400">
                      Customer
                    </th>
                    <th className="text-right py-3 px-2 font-medium text-gray-600 dark:text-gray-400">
                      Total
                    </th>
                    <th className="text-right py-3 px-2 font-medium text-gray-600 dark:text-gray-400">
                      Paid
                    </th>
                    <th className="text-right py-3 px-2 font-medium text-gray-600 dark:text-gray-400">
                      Remaining
                    </th>
                    <th className="text-left py-3 px-2 font-medium text-gray-600 dark:text-gray-400">
                      Date
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {obInvoices.map((inv) => (
                    <tr
                      key={inv.id}
                      className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50"
                    >
                      <td className="py-3 px-2 font-mono text-blue-600 dark:text-blue-400">
                        {inv.invoiceNumber}
                      </td>
                      <td className="py-3 px-2">
                        <div>
                          <p className="font-medium text-gray-900 dark:text-white">
                            {inv.customerName}
                          </p>
                          {inv.customerMobile && (
                            <p className="text-xs text-gray-500">{inv.customerMobile}</p>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-2 text-right font-medium text-gray-900 dark:text-white">
                        {formatCurrency(inv.totalAmount)}
                      </td>
                      <td className="py-3 px-2 text-right text-green-600 dark:text-green-400">
                        {formatCurrency(inv.paidAmount)}
                      </td>
                      <td className="py-3 px-2 text-right font-bold text-red-600 dark:text-red-400">
                        {formatCurrency(inv.remainingBalance)}
                      </td>
                      <td className="py-3 px-2 text-gray-500 dark:text-gray-400">
                        {new Date(inv.createdAt).toLocaleDateString('en-PH', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Help Card */}
      <Card className="bg-gray-50 dark:bg-gray-800/50">
        <CardHeader>
          <CardTitle className="text-base">How It Works</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-gray-600 dark:text-gray-400">
          <div className="flex gap-3">
            <span className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-400 flex items-center justify-center text-xs font-bold">
              1
            </span>
            <p>Search and select a customer with a previous outstanding balance</p>
          </div>
          <div className="flex gap-3">
            <span className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-400 flex items-center justify-center text-xs font-bold">
              2
            </span>
            <p>Enter the opening balance amount (you can add multiple times)</p>
          </div>
          <div className="flex gap-3">
            <span className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-400 flex items-center justify-center text-xs font-bold">
              3
            </span>
            <p>The system creates an AR invoice with prefix &quot;OB-&quot;</p>
          </div>
          <div className="flex gap-3">
            <span className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-400 flex items-center justify-center text-xs font-bold">
              4
            </span>
            <p>Cashiers can collect payment via POS &rarr; AR Payment button</p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
