'use client'

/**
 * General Ledger Report Page
 *
 * FOR NON-ACCOUNTANTS:
 * The General Ledger is a detailed list of ALL transactions for each account.
 * It's like your bank statement, but for every account in your business.
 *
 * Use this report to:
 * - See what transactions affected a specific account
 * - Verify that transactions were recorded correctly
 * - Drill down into account activity
 * - Audit your records
 */

import { useState, useEffect, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { usePermissions } from '@/hooks/usePermissions'
import { PERMISSIONS } from '@/lib/rbac'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  HelpCircle,
  FileDown,
  Calendar,
  XCircle,
  Info,
  Loader2,
  Search,
  Filter,
} from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { ACCOUNTING_GLOSSARY } from '@/lib/accountingGlossary'
import type { GeneralLedger } from '@/lib/financialStatements'

export default function GeneralLedgerPage() {
  const { data: session } = useSession()
  const { can } = usePermissions()

  const [generalLedger, setGeneralLedger] = useState<GeneralLedger | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Default to current month
  const today = new Date()
  const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1)
  const [startDate, setStartDate] = useState(firstDayOfMonth.toISOString().split('T')[0])
  const [endDate, setEndDate] = useState(today.toISOString().split('T')[0])
  const [accountCode, setAccountCode] = useState<string>('')
  const [accountType, setAccountType] = useState<string>('')

  // Check permissions
  if (!can(PERMISSIONS.ACCOUNTING_ACCESS) || !can(PERMISSIONS.ACCOUNTING_GENERAL_LEDGER_VIEW)) {
    return (
      <div className="container mx-auto p-6">
        <Alert variant="destructive">
          <XCircle className="h-4 w-4" />
          <AlertTitle>Access Denied</AlertTitle>
          <AlertDescription>
            You do not have permission to view the General Ledger.
            Contact your administrator to request access.
          </AlertDescription>
        </Alert>
      </div>
    )
  }

  const fetchGeneralLedger = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const params = new URLSearchParams({
        startDate,
        endDate,
      })

      if (accountCode) params.append('accountCode', accountCode)
      if (accountType) params.append('accountType', accountType)

      const response = await fetch(`/api/accounting/general-ledger?${params.toString()}`)
      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Failed to load general ledger')
      }

      setGeneralLedger(result.data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
      console.error('General Ledger Error:', err)
    } finally {
      setLoading(false)
    }
  }, [startDate, endDate, accountCode, accountType])

  useEffect(() => {
    fetchGeneralLedger()
  }, [fetchGeneralLedger])

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount)
  }

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString()
  }

  const exportToExcel = () => {
    alert('Excel export feature coming soon!')
  }

  const exportToPDF = () => {
    alert('PDF export feature coming soon!')
  }

  const clearFilters = () => {
    setAccountCode('')
    setAccountType('')
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
            General Ledger
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Detailed transaction history by account
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Help Dialog */}
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm">
                <HelpCircle className="h-4 w-4 mr-2" />
                What is this?
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Info className="h-5 w-5 text-blue-500" />
                  Understanding the General Ledger
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4 text-sm text-gray-700 dark:text-gray-300">
                <p>
                  The General Ledger is a complete record of all financial transactions in your business,
                  organized by account.
                </p>
                <p>
                  Think of it like a detailed bank statement for EVERY account (not just your bank account).
                </p>
                <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg border border-blue-200 dark:border-blue-800">
                  <h4 className="font-semibold mb-2 text-blue-900 dark:text-blue-100">
                    What you can do:
                  </h4>
                  <ul className="list-disc list-inside space-y-1">
                    <li>View all transactions for a specific account</li>
                    <li>Filter by account type (assets, liabilities, etc.)</li>
                    <li>See running balances as transactions occur</li>
                    <li>Verify that transactions were recorded correctly</li>
                    <li>Drill down to source documents (invoices, receipts)</li>
                  </ul>
                </div>
              </div>
            </DialogContent>
          </Dialog>

          {/* Export Buttons */}
          <Button onClick={exportToExcel} variant="outline" size="sm" disabled={!generalLedger}>
            <FileDown className="h-4 w-4 mr-2" />
            Excel
          </Button>
          <Button onClick={exportToPDF} variant="outline" size="sm" disabled={!generalLedger}>
            <FileDown className="h-4 w-4 mr-2" />
            PDF
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filters
          </CardTitle>
          <CardDescription>
            Filter transactions by date range, account, or type
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            {/* Start Date */}
            <div>
              <Label htmlFor="startDate" className="flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Start Date
              </Label>
              <Input
                id="startDate"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="mt-1"
              />
            </div>

            {/* End Date */}
            <div>
              <Label htmlFor="endDate">End Date</Label>
              <Input
                id="endDate"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="mt-1"
              />
            </div>

            {/* Account Code */}
            <div>
              <Label htmlFor="accountCode" className="flex items-center gap-2">
                <Search className="h-4 w-4" />
                Account Code
              </Label>
              <Input
                id="accountCode"
                type="text"
                placeholder="e.g., 1000"
                value={accountCode}
                onChange={(e) => setAccountCode(e.target.value)}
                className="mt-1"
              />
            </div>

            {/* Account Type */}
            <div>
              <Label htmlFor="accountType">Account Type</Label>
              <Select value={accountType} onValueChange={setAccountType}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="All types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All types</SelectItem>
                  <SelectItem value="asset">Asset</SelectItem>
                  <SelectItem value="liability">Liability</SelectItem>
                  <SelectItem value="equity">Equity</SelectItem>
                  <SelectItem value="revenue">Revenue</SelectItem>
                  <SelectItem value="expense">Expense</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Actions */}
            <div className="flex items-end gap-2">
              <Button onClick={fetchGeneralLedger} disabled={loading} className="flex-1">
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Loading...
                  </>
                ) : (
                  'Apply'
                )}
              </Button>
              <Button onClick={clearFilters} variant="outline" disabled={loading}>
                Clear
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Error Display */}
      {error && (
        <Alert variant="destructive">
          <XCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Loading State */}
      {loading && (
        <Card>
          <CardContent className="p-12 text-center">
            <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-gray-400" />
            <p className="text-gray-600 dark:text-gray-400">
              Loading transaction history...
            </p>
          </CardContent>
        </Card>
      )}

      {/* General Ledger Display */}
      {!loading && generalLedger && (
        <>
          {/* Summary */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-4">
                <p className="text-sm text-gray-600 dark:text-gray-400">Total Accounts</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                  {generalLedger.accounts.length}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <p className="text-sm text-gray-600 dark:text-gray-400">Total Transactions</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                  {generalLedger.accounts.reduce((sum, acc) => sum + acc.transactions.length, 0)}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <p className="text-sm text-gray-600 dark:text-gray-400">Total Debits</p>
                <p className="text-2xl font-bold text-blue-700 dark:text-blue-400">
                  {formatCurrency(
                    generalLedger.accounts.reduce((sum, acc) => sum + acc.totalDebits, 0)
                  )}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <p className="text-sm text-gray-600 dark:text-gray-400">Total Credits</p>
                <p className="text-2xl font-bold text-green-700 dark:text-green-400">
                  {formatCurrency(
                    generalLedger.accounts.reduce((sum, acc) => sum + acc.totalCredits, 0)
                  )}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Account Ledgers */}
          {generalLedger.accounts.length === 0 ? (
            <Card>
              <CardContent className="p-12 text-center">
                <Info className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600 dark:text-gray-400">
                  No transactions found for the selected period and filters.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-6">
              {generalLedger.accounts.map((account) => (
                <Card key={account.accountCode}>
                  <CardHeader className="bg-gray-50 dark:bg-gray-800">
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="flex items-center gap-3">
                          <span className="font-mono text-sm text-gray-600 dark:text-gray-400">
                            {account.accountCode}
                          </span>
                          <span>{account.accountName}</span>
                          <span className={`px-2 py-1 rounded text-xs ${
                            account.accountType === 'asset' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300' :
                            account.accountType === 'liability' ? 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300' :
                            account.accountType === 'equity' ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300' :
                            account.accountType === 'revenue' ? 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300' :
                            'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'
                          }`}>
                            {account.accountType}
                          </span>
                        </CardTitle>
                        <CardDescription className="mt-1">
                          {account.transactions.length} transaction(s) | Opening Balance:{' '}
                          {formatCurrency(account.openingBalance)} | Closing Balance:{' '}
                          {formatCurrency(account.closingBalance)}
                        </CardDescription>
                      </div>
                      <div className="text-right">
                        <div className="text-sm text-gray-600 dark:text-gray-400">Net Change</div>
                        <div className="text-xl font-bold text-gray-900 dark:text-gray-100">
                          {formatCurrency(account.closingBalance - account.openingBalance)}
                        </div>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="p-0">
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead className="bg-gray-100 dark:bg-gray-800 border-b">
                          <tr>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-700 dark:text-gray-300">
                              Date
                            </th>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-700 dark:text-gray-300">
                              Description
                            </th>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-700 dark:text-gray-300">
                              Entry #
                            </th>
                            <th className="px-4 py-2 text-right text-xs font-medium text-gray-700 dark:text-gray-300">
                              Debit
                            </th>
                            <th className="px-4 py-2 text-right text-xs font-medium text-gray-700 dark:text-gray-300">
                              Credit
                            </th>
                            <th className="px-4 py-2 text-right text-xs font-medium text-gray-700 dark:text-gray-300">
                              Balance
                            </th>
                          </tr>
                        </thead>
                        <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
                          {/* Opening Balance */}
                          <tr className="bg-gray-50 dark:bg-gray-800">
                            <td colSpan={3} className="px-4 py-2 text-sm font-semibold text-gray-900 dark:text-gray-100">
                              Opening Balance
                            </td>
                            <td className="px-4 py-2 text-right text-sm">—</td>
                            <td className="px-4 py-2 text-right text-sm">—</td>
                            <td className="px-4 py-2 text-right text-sm font-semibold text-gray-900 dark:text-gray-100">
                              {formatCurrency(account.openingBalance)}
                            </td>
                          </tr>

                          {/* Transactions */}
                          {account.transactions.map((txn) => (
                            <tr key={txn.id} className="hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                              <td className="px-4 py-2 text-sm text-gray-900 dark:text-gray-100 whitespace-nowrap">
                                {formatDate(txn.date)}
                              </td>
                              <td className="px-4 py-2 text-sm text-gray-900 dark:text-gray-100">
                                {txn.description}
                              </td>
                              <td className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400 font-mono">
                                JE-{txn.journalEntryId}
                              </td>
                              <td className="px-4 py-2 text-sm text-right font-medium text-gray-900 dark:text-gray-100">
                                {txn.debit > 0 ? formatCurrency(txn.debit) : '—'}
                              </td>
                              <td className="px-4 py-2 text-sm text-right font-medium text-gray-900 dark:text-gray-100">
                                {txn.credit > 0 ? formatCurrency(txn.credit) : '—'}
                              </td>
                              <td className="px-4 py-2 text-sm text-right font-semibold text-gray-900 dark:text-gray-100">
                                {formatCurrency(txn.runningBalance)}
                              </td>
                            </tr>
                          ))}

                          {/* Closing Balance */}
                          <tr className="bg-gray-100 dark:bg-gray-800 font-bold">
                            <td colSpan={3} className="px-4 py-2 text-sm text-gray-900 dark:text-gray-100">
                              Closing Balance
                            </td>
                            <td className="px-4 py-2 text-right text-sm text-blue-700 dark:text-blue-400">
                              {formatCurrency(account.totalDebits)}
                            </td>
                            <td className="px-4 py-2 text-right text-sm text-green-700 dark:text-green-400">
                              {formatCurrency(account.totalCredits)}
                            </td>
                            <td className="px-4 py-2 text-right text-sm text-gray-900 dark:text-gray-100">
                              {formatCurrency(account.closingBalance)}
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}
