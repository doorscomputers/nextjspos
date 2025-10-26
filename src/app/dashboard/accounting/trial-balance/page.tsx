'use client'

/**
 * Trial Balance Report Page
 *
 * FOR NON-ACCOUNTANTS:
 * The Trial Balance is a "sanity check" for your accounting records.
 *
 * GOLDEN RULE: Total Debits MUST equal Total Credits
 *
 * If they don't match, there's an error somewhere in your journal entries.
 * This report helps you catch mistakes before generating financial statements.
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
  HelpCircle,
  FileDown,
  Calendar,
  CheckCircle2,
  XCircle,
  Info,
  Loader2,
  AlertTriangle,
} from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { ACCOUNTING_GLOSSARY, HELP_MESSAGES } from '@/lib/accountingGlossary'
import type { TrialBalance } from '@/lib/financialStatements'

export default function TrialBalancePage() {
  const { data: session } = useSession()
  const { can } = usePermissions()

  const [trialBalance, setTrialBalance] = useState<TrialBalance | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [asOfDate, setAsOfDate] = useState(new Date().toISOString().split('T')[0])
  const [showHelp, setShowHelp] = useState(false)

  // Check permissions
  if (!can(PERMISSIONS.ACCOUNTING_ACCESS) || !can(PERMISSIONS.ACCOUNTING_TRIAL_BALANCE_VIEW)) {
    return (
      <div className="container mx-auto p-6">
        <Alert variant="destructive">
          <XCircle className="h-4 w-4" />
          <AlertTitle>Access Denied</AlertTitle>
          <AlertDescription>
            You do not have permission to view the Trial Balance.
            Contact your administrator to request access.
          </AlertDescription>
        </Alert>
      </div>
    )
  }

  const fetchTrialBalance = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const response = await fetch(`/api/accounting/trial-balance?asOfDate=${asOfDate}`)
      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Failed to load trial balance')
      }

      setTrialBalance(result.data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
      console.error('Trial Balance Error:', err)
    } finally {
      setLoading(false)
    }
  }, [asOfDate])

  useEffect(() => {
    fetchTrialBalance()
  }, [fetchTrialBalance])

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount)
  }

  const exportToExcel = () => {
    alert('Excel export feature coming soon!')
  }

  const exportToPDF = () => {
    alert('PDF export feature coming soon!')
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
            Trial Balance
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Validation check - Are your books balanced?
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Help Dialog */}
          <Dialog open={showHelp} onOpenChange={setShowHelp}>
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
                  {HELP_MESSAGES.trialBalance.title}
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4 text-sm text-gray-700 dark:text-gray-300">
                <p className="whitespace-pre-line">{HELP_MESSAGES.trialBalance.content}</p>

                <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg border border-blue-200 dark:border-blue-800">
                  <h4 className="font-semibold mb-2 text-blue-900 dark:text-blue-100">
                    Understanding Debits & Credits:
                  </h4>
                  <div className="space-y-2">
                    <div>
                      <strong className="text-blue-800 dark:text-blue-200">Debit:</strong>{' '}
                      {ACCOUNTING_GLOSSARY.debit.simple}
                    </div>
                    <div>
                      <strong className="text-blue-800 dark:text-blue-200">Credit:</strong>{' '}
                      {ACCOUNTING_GLOSSARY.credit.simple}
                    </div>
                    <div className="mt-3 p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded border border-yellow-200 dark:border-yellow-800">
                      <strong className="text-yellow-800 dark:text-yellow-200">Important:</strong>
                      <p className="mt-1 text-xs">
                        In accounting, "debit" and "credit" are just left and right sides of an entry.
                        They don't mean "good" or "bad"! Every transaction has equal debits and credits.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </DialogContent>
          </Dialog>

          {/* Export Buttons */}
          <Button onClick={exportToExcel} variant="outline" size="sm" disabled={!trialBalance}>
            <FileDown className="h-4 w-4 mr-2" />
            Excel
          </Button>
          <Button onClick={exportToPDF} variant="outline" size="sm" disabled={!trialBalance}>
            <FileDown className="h-4 w-4 mr-2" />
            PDF
          </Button>
        </div>
      </div>

      {/* Date Selection */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Select Date</CardTitle>
          <CardDescription>
            View your trial balance as of a specific date
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row items-end gap-4">
            <div className="flex-1 max-w-xs">
              <Label htmlFor="asOfDate" className="flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                As of Date
              </Label>
              <Input
                id="asOfDate"
                type="date"
                value={asOfDate}
                onChange={(e) => setAsOfDate(e.target.value)}
                className="mt-1"
              />
            </div>
            <Button onClick={fetchTrialBalance} disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Loading...
                </>
              ) : (
                'Generate Report'
              )}
            </Button>
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
              Calculating your trial balance...
            </p>
          </CardContent>
        </Card>
      )}

      {/* Trial Balance Display */}
      {!loading && trialBalance && (
        <>
          {/* Balance Status */}
          <Alert variant={trialBalance.status === 'balanced' ? 'default' : 'destructive'}>
            {trialBalance.status === 'balanced' ? (
              <CheckCircle2 className="h-4 w-4 text-green-600" />
            ) : (
              <AlertTriangle className="h-4 w-4" />
            )}
            <AlertTitle className="text-lg font-bold">
              {trialBalance.status === 'balanced'
                ? '✅ TRIAL BALANCE IS BALANCED!'
                : '❌ TRIAL BALANCE IS UNBALANCED'}
            </AlertTitle>
            <AlertDescription>
              {trialBalance.status === 'balanced' ? (
                <div className="space-y-2">
                  <p>Your books are in good shape! Total debits equal total credits.</p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Total Debits: {formatCurrency(trialBalance.totalDebits)} | Total Credits:{' '}
                    {formatCurrency(trialBalance.totalCredits)}
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  <p>
                    There is a difference of {formatCurrency(trialBalance.difference)}. This indicates
                    an error in your journal entries that needs to be corrected.
                  </p>
                  <p className="text-sm">
                    Total Debits: {formatCurrency(trialBalance.totalDebits)} | Total Credits:{' '}
                    {formatCurrency(trialBalance.totalCredits)}
                  </p>
                  <p className="text-sm font-semibold mt-2">
                    ⚠️ Do not generate financial statements until this is resolved!
                  </p>
                </div>
              )}
            </AlertDescription>
          </Alert>

          {/* Trial Balance Table */}
          <Card>
            <CardHeader>
              <CardTitle>Account Balances</CardTitle>
              <CardDescription>
                All accounts with their debit and credit balances as of{' '}
                {new Date(asOfDate).toLocaleDateString()}
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 dark:bg-gray-800 border-b-2 border-gray-300 dark:border-gray-600">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                        Account Code
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                        Account Name
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                        Type
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                        Debit
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                        Credit
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
                    {trialBalance.accounts.map((account) => (
                      <tr
                        key={account.accountCode}
                        className="hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                      >
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-500 dark:text-gray-400">
                          {account.accountCode}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-gray-100">
                          <div className="flex items-center gap-2">
                            {account.accountName}
                            <Dialog>
                              <DialogTrigger asChild>
                                <Button variant="ghost" size="sm" className="h-5 w-5 p-0 opacity-0 hover:opacity-100">
                                  <HelpCircle className="h-3 w-3 text-gray-400" />
                                </Button>
                              </DialogTrigger>
                              <DialogContent className="max-w-md">
                                <DialogHeader>
                                  <DialogTitle>{account.accountName}</DialogTitle>
                                </DialogHeader>
                                <div className="space-y-2 text-sm text-gray-700 dark:text-gray-300">
                                  <p><strong>Type:</strong> {account.accountType}</p>
                                  <p><strong>Normal Balance:</strong> {account.normalBalance}</p>
                                  {account.debit > 0 && account.credit > 0 && (
                                    <div className="bg-yellow-50 dark:bg-yellow-900/20 p-3 rounded border border-yellow-200 dark:border-yellow-800">
                                      <p className="text-xs">
                                        ⚠️ This account has both debits and credits. This is normal
                                        if there have been multiple transactions affecting this account.
                                      </p>
                                    </div>
                                  )}
                                </div>
                              </DialogContent>
                            </Dialog>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400">
                          <span className={`px-2 py-1 rounded text-xs ${
                            account.accountType === 'asset' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300' :
                            account.accountType === 'liability' ? 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300' :
                            account.accountType === 'equity' ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300' :
                            account.accountType === 'revenue' ? 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300' :
                            'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'
                          }`}>
                            {account.accountType}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-medium text-gray-900 dark:text-gray-100">
                          {account.debit > 0 ? formatCurrency(account.debit) : '—'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-medium text-gray-900 dark:text-gray-100">
                          {account.credit > 0 ? formatCurrency(account.credit) : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-gray-100 dark:bg-gray-800 border-t-4 border-gray-900 dark:border-gray-100">
                    <tr className="font-bold">
                      <td colSpan={3} className="px-6 py-4 text-right text-lg text-gray-900 dark:text-gray-100">
                        TOTALS:
                      </td>
                      <td className="px-6 py-4 text-right text-lg text-gray-900 dark:text-gray-100">
                        {formatCurrency(trialBalance.totalDebits)}
                      </td>
                      <td className="px-6 py-4 text-right text-lg text-gray-900 dark:text-gray-100">
                        {formatCurrency(trialBalance.totalCredits)}
                      </td>
                    </tr>
                    {trialBalance.status !== 'balanced' && (
                      <tr className="bg-red-100 dark:bg-red-900/30">
                        <td colSpan={3} className="px-6 py-3 text-right text-sm font-semibold text-red-900 dark:text-red-100">
                          DIFFERENCE (Error):
                        </td>
                        <td colSpan={2} className="px-6 py-3 text-right text-sm font-semibold text-red-900 dark:text-red-100">
                          {formatCurrency(trialBalance.difference)}
                        </td>
                      </tr>
                    )}
                  </tfoot>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* Summary Statistics */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Total Accounts</p>
                    <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                      {trialBalance.accounts.length}
                    </p>
                  </div>
                  <Info className="h-8 w-8 text-gray-400" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Total Debits</p>
                    <p className="text-2xl font-bold text-blue-700 dark:text-blue-400">
                      {formatCurrency(trialBalance.totalDebits)}
                    </p>
                  </div>
                  <div className="h-8 w-8 bg-blue-100 dark:bg-blue-900/30 rounded flex items-center justify-center text-blue-700 dark:text-blue-400 font-bold">
                    DR
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Total Credits</p>
                    <p className="text-2xl font-bold text-green-700 dark:text-green-400">
                      {formatCurrency(trialBalance.totalCredits)}
                    </p>
                  </div>
                  <div className="h-8 w-8 bg-green-100 dark:bg-green-900/30 rounded flex items-center justify-center text-green-700 dark:text-green-400 font-bold">
                    CR
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Educational Note */}
          <Card className="bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800">
            <CardContent className="p-6">
              <div className="flex gap-4">
                <Info className="h-6 w-6 text-blue-600 flex-shrink-0 mt-1" />
                <div className="space-y-2 text-sm text-gray-700 dark:text-gray-300">
                  <h4 className="font-semibold text-blue-900 dark:text-blue-100">
                    Understanding Your Trial Balance
                  </h4>
                  <p>
                    The trial balance is used BEFORE generating financial statements to ensure all
                    your accounting entries are correct. If debits don't equal credits, there's an
                    error somewhere in your journal entries that needs to be fixed.
                  </p>
                  <p>
                    Common causes of unbalanced trial balances:
                  </p>
                  <ul className="list-disc list-inside space-y-1 ml-4">
                    <li>Manual journal entry with unequal debits and credits</li>
                    <li>Data entry error in transaction amounts</li>
                    <li>Missing half of a double-entry transaction</li>
                    <li>System error (rare, but possible)</li>
                  </ul>
                  {trialBalance.status === 'balanced' && (
                    <p className="font-semibold text-green-700 dark:text-green-400 mt-3">
                      ✅ Your trial balance is correct! You can confidently generate financial statements.
                    </p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
