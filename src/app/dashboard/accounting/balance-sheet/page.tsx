'use client'

/**
 * Balance Sheet Report Page
 *
 * FOR NON-ACCOUNTANTS:
 * This page shows what your business owns (assets), owes (liabilities),
 * and the owner's stake (equity) at a specific point in time.
 *
 * Think of it as a financial snapshot - like checking your bank balance,
 * but for your entire business!
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
} from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { ACCOUNTING_GLOSSARY, HELP_MESSAGES, getGlossaryTerm } from '@/lib/accountingGlossary'
import type { BalanceSheet } from '@/lib/financialStatements'

export default function BalanceSheetPage() {
  const { data: session } = useSession()
  const { can } = usePermissions()

  const [balanceSheet, setBalanceSheet] = useState<BalanceSheet | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [asOfDate, setAsOfDate] = useState(new Date().toISOString().split('T')[0])
  const [showHelp, setShowHelp] = useState(false)

  // Check permissions
  if (!can(PERMISSIONS.ACCOUNTING_ACCESS) || !can(PERMISSIONS.ACCOUNTING_BALANCE_SHEET_VIEW)) {
    return (
      <div className="container mx-auto p-6">
        <Alert variant="destructive">
          <XCircle className="h-4 w-4" />
          <AlertTitle>Access Denied</AlertTitle>
          <AlertDescription>
            You do not have permission to view the Balance Sheet.
            Contact your administrator to request access.
          </AlertDescription>
        </Alert>
      </div>
    )
  }

  const fetchBalanceSheet = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const response = await fetch(`/api/accounting/balance-sheet?asOfDate=${asOfDate}`)
      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Failed to load balance sheet')
      }

      setBalanceSheet(result.data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
      console.error('Balance Sheet Error:', err)
    } finally {
      setLoading(false)
    }
  }, [asOfDate])

  useEffect(() => {
    fetchBalanceSheet()
  }, [fetchBalanceSheet])

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount)
  }

  const exportToExcel = () => {
    // TODO: Implement Excel export
    alert('Excel export feature coming soon!')
  }

  const exportToPDF = () => {
    // TODO: Implement PDF export
    alert('PDF export feature coming soon!')
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
            Balance Sheet
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Financial snapshot of your business
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
                  {HELP_MESSAGES.balanceSheet.title}
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4 text-sm text-gray-700 dark:text-gray-300">
                <p className="whitespace-pre-line">{HELP_MESSAGES.balanceSheet.content}</p>

                <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg border border-blue-200 dark:border-blue-800">
                  <h4 className="font-semibold mb-2 text-blue-900 dark:text-blue-100">
                    Quick Glossary:
                  </h4>
                  <div className="space-y-2">
                    <div>
                      <strong className="text-blue-800 dark:text-blue-200">Assets:</strong>{' '}
                      {ACCOUNTING_GLOSSARY.assets.simple}
                    </div>
                    <div>
                      <strong className="text-blue-800 dark:text-blue-200">Liabilities:</strong>{' '}
                      {ACCOUNTING_GLOSSARY.liabilities.simple}
                    </div>
                    <div>
                      <strong className="text-blue-800 dark:text-blue-200">Equity:</strong>{' '}
                      {ACCOUNTING_GLOSSARY.equity.simple}
                    </div>
                  </div>
                </div>
              </div>
            </DialogContent>
          </Dialog>

          {/* Export Buttons */}
          <Button onClick={exportToExcel} variant="outline" size="sm" disabled={!balanceSheet}>
            <FileDown className="h-4 w-4 mr-2" />
            Excel
          </Button>
          <Button onClick={exportToPDF} variant="outline" size="sm" disabled={!balanceSheet}>
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
            View your balance sheet as of a specific date
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
            <Button onClick={fetchBalanceSheet} disabled={loading}>
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
              Generating your balance sheet...
            </p>
          </CardContent>
        </Card>
      )}

      {/* Balance Sheet Display */}
      {!loading && balanceSheet && (
        <>
          {/* Validation Status */}
          <Alert variant={balanceSheet.balanced ? 'default' : 'destructive'}>
            {balanceSheet.balanced ? (
              <CheckCircle2 className="h-4 w-4 text-green-600" />
            ) : (
              <XCircle className="h-4 w-4" />
            )}
            <AlertTitle>
              {balanceSheet.balanced ? 'Balance Sheet is BALANCED ✓' : 'Balance Sheet is UNBALANCED'}
            </AlertTitle>
            <AlertDescription>
              {balanceSheet.balanced ? (
                'Assets equal Liabilities + Equity. Your books are in good shape!'
              ) : (
                <>
                  There is a difference of {formatCurrency(balanceSheet.difference)}.
                  This indicates an error in your accounting records that needs to be corrected.
                </>
              )}
            </AlertDescription>
          </Alert>

          {/* ASSETS Section */}
          <Card>
            <CardHeader className="bg-blue-50 dark:bg-blue-900/20">
              <CardTitle className="flex items-center justify-between text-xl">
                <div className="flex items-center gap-2">
                  <span>ASSETS</span>
                  <TooltipInfo term={ACCOUNTING_GLOSSARY.assets} />
                </div>
                <span className="text-2xl font-bold text-blue-700 dark:text-blue-400">
                  {formatCurrency(balanceSheet.assets.totalAssets)}
                </span>
              </CardTitle>
              <CardDescription className="text-gray-700 dark:text-gray-300">
                What your business owns
              </CardDescription>
            </CardHeader>
            <CardContent className="p-6">
              {/* Current Assets */}
              <div className="mb-6">
                <div className="flex items-center justify-between mb-3 pb-2 border-b">
                  <h3 className="font-semibold text-lg flex items-center gap-2">
                    Current Assets
                    <TooltipInfo term={ACCOUNTING_GLOSSARY.currentAssets} />
                  </h3>
                  <span className="font-semibold">
                    {formatCurrency(balanceSheet.assets.totalCurrentAssets)}
                  </span>
                </div>
                <div className="space-y-2 ml-4">
                  {balanceSheet.assets.currentAssets.map((account) => (
                    <AccountLine key={account.accountCode} account={account} />
                  ))}
                </div>
              </div>

              {/* Fixed Assets */}
              <div>
                <div className="flex items-center justify-between mb-3 pb-2 border-b">
                  <h3 className="font-semibold text-lg flex items-center gap-2">
                    Fixed Assets
                    <TooltipInfo term={ACCOUNTING_GLOSSARY.fixedAssets} />
                  </h3>
                  <span className="font-semibold">
                    {formatCurrency(balanceSheet.assets.totalFixedAssets)}
                  </span>
                </div>
                <div className="space-y-2 ml-4">
                  {balanceSheet.assets.fixedAssets.map((account) => (
                    <AccountLine key={account.accountCode} account={account} />
                  ))}
                </div>
              </div>

              {/* Total Assets */}
              <div className="mt-6 pt-4 border-t-2 border-blue-600 dark:border-blue-400">
                <div className="flex items-center justify-between text-xl font-bold text-blue-700 dark:text-blue-400">
                  <span>TOTAL ASSETS</span>
                  <span>{formatCurrency(balanceSheet.assets.totalAssets)}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* LIABILITIES Section */}
          <Card>
            <CardHeader className="bg-orange-50 dark:bg-orange-900/20">
              <CardTitle className="flex items-center justify-between text-xl">
                <div className="flex items-center gap-2">
                  <span>LIABILITIES</span>
                  <TooltipInfo term={ACCOUNTING_GLOSSARY.liabilities} />
                </div>
                <span className="text-2xl font-bold text-orange-700 dark:text-orange-400">
                  {formatCurrency(balanceSheet.liabilities.totalLiabilities)}
                </span>
              </CardTitle>
              <CardDescription className="text-gray-700 dark:text-gray-300">
                What your business owes
              </CardDescription>
            </CardHeader>
            <CardContent className="p-6">
              {/* Current Liabilities */}
              <div className="mb-6">
                <div className="flex items-center justify-between mb-3 pb-2 border-b">
                  <h3 className="font-semibold text-lg">Current Liabilities</h3>
                  <span className="font-semibold">
                    {formatCurrency(balanceSheet.liabilities.totalCurrentLiabilities)}
                  </span>
                </div>
                <div className="space-y-2 ml-4">
                  {balanceSheet.liabilities.currentLiabilities.map((account) => (
                    <AccountLine key={account.accountCode} account={account} />
                  ))}
                </div>
              </div>

              {/* Long-term Liabilities */}
              <div>
                <div className="flex items-center justify-between mb-3 pb-2 border-b">
                  <h3 className="font-semibold text-lg">Long-term Liabilities</h3>
                  <span className="font-semibold">
                    {formatCurrency(balanceSheet.liabilities.totalLongTermLiabilities)}
                  </span>
                </div>
                <div className="space-y-2 ml-4">
                  {balanceSheet.liabilities.longTermLiabilities.map((account) => (
                    <AccountLine key={account.accountCode} account={account} />
                  ))}
                </div>
              </div>

              {/* Total Liabilities */}
              <div className="mt-6 pt-4 border-t-2 border-orange-600 dark:border-orange-400">
                <div className="flex items-center justify-between text-xl font-bold text-orange-700 dark:text-orange-400">
                  <span>TOTAL LIABILITIES</span>
                  <span>{formatCurrency(balanceSheet.liabilities.totalLiabilities)}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* EQUITY Section */}
          <Card>
            <CardHeader className="bg-green-50 dark:bg-green-900/20">
              <CardTitle className="flex items-center justify-between text-xl">
                <div className="flex items-center gap-2">
                  <span>EQUITY</span>
                  <TooltipInfo term={ACCOUNTING_GLOSSARY.equity} />
                </div>
                <span className="text-2xl font-bold text-green-700 dark:text-green-400">
                  {formatCurrency(balanceSheet.equity.totalEquity)}
                </span>
              </CardTitle>
              <CardDescription className="text-gray-700 dark:text-gray-300">
                Owner's stake in the business
              </CardDescription>
            </CardHeader>
            <CardContent className="p-6">
              <div className="space-y-2">
                {balanceSheet.equity.accounts.map((account) => (
                  <AccountLine key={account.accountCode} account={account} />
                ))}
              </div>

              {/* Total Equity */}
              <div className="mt-6 pt-4 border-t-2 border-green-600 dark:border-green-400">
                <div className="flex items-center justify-between text-xl font-bold text-green-700 dark:text-green-400">
                  <span>TOTAL EQUITY</span>
                  <span>{formatCurrency(balanceSheet.equity.totalEquity)}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Key Metrics */}
          <Card>
            <CardHeader className="bg-purple-50 dark:bg-purple-900/20">
              <CardTitle className="flex items-center gap-2">
                <Info className="h-5 w-5 text-purple-600" />
                Key Financial Metrics
              </CardTitle>
              <CardDescription>
                Important ratios to understand your financial health
              </CardDescription>
            </CardHeader>
            <CardContent className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Working Capital */}
                <MetricCard
                  title="Working Capital"
                  value={formatCurrency(balanceSheet.metrics.workingCapital)}
                  explanation={ACCOUNTING_GLOSSARY.workingCapital}
                  status={balanceSheet.metrics.workingCapital > 0 ? 'good' : 'warning'}
                  interpretation={
                    balanceSheet.metrics.workingCapital > 0
                      ? 'Healthy! You have enough assets to cover short-term obligations.'
                      : 'Warning: You may struggle to pay bills due soon.'
                  }
                />

                {/* Current Ratio */}
                <MetricCard
                  title="Current Ratio"
                  value={balanceSheet.metrics.currentRatio.toFixed(2)}
                  explanation={ACCOUNTING_GLOSSARY.currentRatio}
                  status={
                    balanceSheet.metrics.currentRatio >= 1.5
                      ? 'good'
                      : balanceSheet.metrics.currentRatio >= 1.0
                      ? 'ok'
                      : 'warning'
                  }
                  interpretation={
                    balanceSheet.metrics.currentRatio >= 2.0
                      ? 'Excellent! Very healthy liquidity.'
                      : balanceSheet.metrics.currentRatio >= 1.5
                      ? 'Good. Comfortable ability to pay bills.'
                      : balanceSheet.metrics.currentRatio >= 1.0
                      ? 'Acceptable, but watch your cash flow.'
                      : 'Warning: May have difficulty paying bills.'
                  }
                />

                {/* Debt-to-Equity Ratio */}
                <MetricCard
                  title="Debt-to-Equity Ratio"
                  value={balanceSheet.metrics.debtToEquityRatio.toFixed(2)}
                  explanation={ACCOUNTING_GLOSSARY.debtToEquityRatio}
                  status={
                    balanceSheet.metrics.debtToEquityRatio <= 0.5
                      ? 'good'
                      : balanceSheet.metrics.debtToEquityRatio <= 1.0
                      ? 'ok'
                      : 'warning'
                  }
                  interpretation={
                    balanceSheet.metrics.debtToEquityRatio <= 0.5
                      ? 'Excellent! Low debt relative to equity.'
                      : balanceSheet.metrics.debtToEquityRatio <= 1.0
                      ? 'Moderate debt level.'
                      : 'High debt - consider reducing liabilities.'
                  }
                />
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}

/**
 * Account Line Component
 * Displays individual account with tooltip
 */
function AccountLine({
  account,
}: {
  account: { accountCode: string; accountName: string; balance: number; explanation: string }
}) {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount)
  }

  return (
    <div className="flex items-center justify-between py-1 text-sm hover:bg-gray-50 dark:hover:bg-gray-800 rounded px-2 -mx-2 group">
      <div className="flex items-center gap-2">
        <span className="text-gray-500 dark:text-gray-400 font-mono text-xs">
          {account.accountCode}
        </span>
        <span className="text-gray-900 dark:text-gray-100">{account.accountName}</span>
        <Dialog>
          <DialogTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-5 w-5 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <HelpCircle className="h-3 w-3 text-gray-400" />
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>{account.accountName}</DialogTitle>
            </DialogHeader>
            <p className="text-sm text-gray-700 dark:text-gray-300">{account.explanation}</p>
          </DialogContent>
        </Dialog>
      </div>
      <span className="font-medium text-gray-900 dark:text-gray-100">
        {formatCurrency(account.balance)}
      </span>
    </div>
  )
}

/**
 * Tooltip Info Component
 */
function TooltipInfo({ term }: { term: { term: string; simple: string; detailed: string; example?: string } }) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="h-5 w-5 p-0">
          <HelpCircle className="h-4 w-4 text-blue-500" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{term.term}</DialogTitle>
          <DialogDescription>{term.simple}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3 text-sm text-gray-700 dark:text-gray-300">
          <p>{term.detailed}</p>
          {term.example && (
            <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded border border-blue-200 dark:border-blue-800">
              <strong className="text-blue-800 dark:text-blue-200">Example:</strong>
              <p className="mt-1">{term.example}</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

/**
 * Metric Card Component
 */
function MetricCard({
  title,
  value,
  explanation,
  status,
  interpretation,
}: {
  title: string
  value: string
  explanation: { term: string; simple: string; detailed: string; formula?: string }
  status: 'good' | 'ok' | 'warning'
  interpretation: string
}) {
  const statusColors = {
    good: 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800',
    ok: 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800',
    warning: 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800',
  }

  const statusIcons = {
    good: <CheckCircle2 className="h-5 w-5 text-green-600" />,
    ok: <Info className="h-5 w-5 text-yellow-600" />,
    warning: <XCircle className="h-5 w-5 text-red-600" />,
  }

  return (
    <div className={`p-4 rounded-lg border ${statusColors[status]}`}>
      <div className="flex items-center justify-between mb-2">
        <h4 className="font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
          {title}
          <TooltipInfo term={explanation} />
        </h4>
        {statusIcons[status]}
      </div>
      <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">{value}</p>
      <p className="text-xs text-gray-600 dark:text-gray-400">{interpretation}</p>
    </div>
  )
}
