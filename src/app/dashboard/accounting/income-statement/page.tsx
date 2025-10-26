'use client'

/**
 * Income Statement (Profit & Loss) Report Page
 *
 * FOR NON-ACCOUNTANTS:
 * This page answers one simple question: "Did I make money?"
 *
 * It compares your revenue (money earned from sales) to your expenses
 * (money spent running the business) to show your profit or loss.
 *
 * SIMPLE FORMULA: Profit = Revenue - Expenses
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
  TrendingUp,
  TrendingDown,
  Minus,
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
import { ACCOUNTING_GLOSSARY, HELP_MESSAGES } from '@/lib/accountingGlossary'
import type { IncomeStatement } from '@/lib/financialStatements'

export default function IncomeStatementPage() {
  const { data: session } = useSession()
  const { can } = usePermissions()

  const [incomeStatement, setIncomeStatement] = useState<IncomeStatement | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Default to current month
  const today = new Date()
  const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1)
  const [startDate, setStartDate] = useState(firstDayOfMonth.toISOString().split('T')[0])
  const [endDate, setEndDate] = useState(today.toISOString().split('T')[0])
  const [showHelp, setShowHelp] = useState(false)

  // Check permissions
  if (!can(PERMISSIONS.ACCOUNTING_ACCESS) || !can(PERMISSIONS.ACCOUNTING_INCOME_STATEMENT_VIEW)) {
    return (
      <div className="container mx-auto p-6">
        <Alert variant="destructive">
          <XCircle className="h-4 w-4" />
          <AlertTitle>Access Denied</AlertTitle>
          <AlertDescription>
            You do not have permission to view the Income Statement.
            Contact your administrator to request access.
          </AlertDescription>
        </Alert>
      </div>
    )
  }

  const fetchIncomeStatement = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const response = await fetch(
        `/api/accounting/income-statement?startDate=${startDate}&endDate=${endDate}`
      )
      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Failed to load income statement')
      }

      setIncomeStatement(result.data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
      console.error('Income Statement Error:', err)
    } finally {
      setLoading(false)
    }
  }, [startDate, endDate])

  useEffect(() => {
    fetchIncomeStatement()
  }, [fetchIncomeStatement])

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount)
  }

  const formatPercent = (value: number) => {
    return `${value.toFixed(1)}%`
  }

  const exportToExcel = () => {
    alert('Excel export feature coming soon!')
  }

  const exportToPDF = () => {
    alert('PDF export feature coming soon!')
  }

  // Quick period selection
  const setQuickPeriod = (period: 'this-month' | 'last-month' | 'this-quarter' | 'this-year') => {
    const now = new Date()
    let start: Date
    let end: Date

    switch (period) {
      case 'this-month':
        start = new Date(now.getFullYear(), now.getMonth(), 1)
        end = now
        break
      case 'last-month':
        start = new Date(now.getFullYear(), now.getMonth() - 1, 1)
        end = new Date(now.getFullYear(), now.getMonth(), 0)
        break
      case 'this-quarter':
        const quarter = Math.floor(now.getMonth() / 3)
        start = new Date(now.getFullYear(), quarter * 3, 1)
        end = now
        break
      case 'this-year':
        start = new Date(now.getFullYear(), 0, 1)
        end = now
        break
    }

    setStartDate(start.toISOString().split('T')[0])
    setEndDate(end.toISOString().split('T')[0])
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
            Income Statement
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Profit & Loss Report - Did you make money?
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
                  {HELP_MESSAGES.incomeStatement.title}
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4 text-sm text-gray-700 dark:text-gray-300">
                <p className="whitespace-pre-line">{HELP_MESSAGES.incomeStatement.content}</p>

                <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg border border-blue-200 dark:border-blue-800">
                  <h4 className="font-semibold mb-2 text-blue-900 dark:text-blue-100">
                    Quick Glossary:
                  </h4>
                  <div className="space-y-2">
                    <div>
                      <strong className="text-blue-800 dark:text-blue-200">Revenue:</strong>{' '}
                      {ACCOUNTING_GLOSSARY.revenue.simple}
                    </div>
                    <div>
                      <strong className="text-blue-800 dark:text-blue-200">Expenses:</strong>{' '}
                      {ACCOUNTING_GLOSSARY.expenses.simple}
                    </div>
                    <div>
                      <strong className="text-blue-800 dark:text-blue-200">Net Income:</strong>{' '}
                      {ACCOUNTING_GLOSSARY.netIncome.simple}
                    </div>
                    <div>
                      <strong className="text-blue-800 dark:text-blue-200">Gross Profit:</strong>{' '}
                      {ACCOUNTING_GLOSSARY.grossProfit.simple}
                    </div>
                  </div>
                </div>
              </div>
            </DialogContent>
          </Dialog>

          {/* Export Buttons */}
          <Button onClick={exportToExcel} variant="outline" size="sm" disabled={!incomeStatement}>
            <FileDown className="h-4 w-4 mr-2" />
            Excel
          </Button>
          <Button onClick={exportToPDF} variant="outline" size="sm" disabled={!incomeStatement}>
            <FileDown className="h-4 w-4 mr-2" />
            PDF
          </Button>
        </div>
      </div>

      {/* Period Selection */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Select Period</CardTitle>
          <CardDescription>
            View profit & loss for a specific time period
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Quick Period Buttons */}
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setQuickPeriod('this-month')}
              >
                This Month
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setQuickPeriod('last-month')}
              >
                Last Month
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setQuickPeriod('this-quarter')}
              >
                This Quarter
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setQuickPeriod('this-year')}
              >
                This Year
              </Button>
            </div>

            {/* Custom Date Range */}
            <div className="flex flex-col sm:flex-row items-end gap-4">
              <div className="flex-1">
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
              <div className="flex-1">
                <Label htmlFor="endDate">End Date</Label>
                <Input
                  id="endDate"
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="mt-1"
                />
              </div>
              <Button onClick={fetchIncomeStatement} disabled={loading}>
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
              Calculating your profit & loss...
            </p>
          </CardContent>
        </Card>
      )}

      {/* Income Statement Display */}
      {!loading && incomeStatement && (
        <>
          {/* Profit/Loss Summary */}
          <ProfitLossSummary incomeStatement={incomeStatement} />

          {/* REVENUE Section */}
          <Card>
            <CardHeader className="bg-green-50 dark:bg-green-900/20">
              <CardTitle className="flex items-center justify-between text-xl">
                <div className="flex items-center gap-2">
                  <span>REVENUE</span>
                  <TooltipInfo term={ACCOUNTING_GLOSSARY.revenue} />
                </div>
                <span className="text-2xl font-bold text-green-700 dark:text-green-400">
                  {formatCurrency(incomeStatement.revenue.totalRevenue)}
                </span>
              </CardTitle>
              <CardDescription className="text-gray-700 dark:text-gray-300">
                Money earned from sales and services
              </CardDescription>
            </CardHeader>
            <CardContent className="p-6">
              <div className="space-y-2">
                {incomeStatement.revenue.accounts.map((account) => (
                  <AccountLine key={account.accountCode} account={account} />
                ))}
              </div>

              <div className="mt-6 pt-4 border-t-2 border-green-600 dark:border-green-400">
                <div className="flex items-center justify-between text-xl font-bold text-green-700 dark:text-green-400">
                  <span>TOTAL REVENUE</span>
                  <span>{formatCurrency(incomeStatement.revenue.totalRevenue)}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* COST OF GOODS SOLD Section */}
          {incomeStatement.cogs.totalCOGS > 0 && (
            <Card>
              <CardHeader className="bg-orange-50 dark:bg-orange-900/20">
                <CardTitle className="flex items-center justify-between text-xl">
                  <div className="flex items-center gap-2">
                    <span>COST OF GOODS SOLD</span>
                    <TooltipInfo term={ACCOUNTING_GLOSSARY.cogs} />
                  </div>
                  <span className="text-2xl font-bold text-orange-700 dark:text-orange-400">
                    {formatCurrency(incomeStatement.cogs.totalCOGS)}
                  </span>
                </CardTitle>
                <CardDescription className="text-gray-700 dark:text-gray-300">
                  Direct cost of products sold
                </CardDescription>
              </CardHeader>
              <CardContent className="p-6">
                <div className="space-y-2">
                  {incomeStatement.cogs.accounts.map((account) => (
                    <AccountLine key={account.accountCode} account={account} />
                  ))}
                </div>

                <div className="mt-6 pt-4 border-t-2 border-orange-600 dark:border-orange-400">
                  <div className="flex items-center justify-between text-xl font-bold text-orange-700 dark:text-orange-400">
                    <span>TOTAL COGS</span>
                    <span>{formatCurrency(incomeStatement.cogs.totalCOGS)}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* GROSS PROFIT Section */}
          <Card className="border-2 border-blue-300 dark:border-blue-700">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <h3 className="text-xl font-bold text-blue-900 dark:text-blue-100">
                    GROSS PROFIT
                  </h3>
                  <TooltipInfo term={ACCOUNTING_GLOSSARY.grossProfit} />
                  <span className="text-sm text-gray-600 dark:text-gray-400">
                    (Revenue - COGS)
                  </span>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold text-blue-700 dark:text-blue-400">
                    {formatCurrency(incomeStatement.grossProfit.amount)}
                  </div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">
                    Margin: {formatPercent(incomeStatement.grossProfit.margin)}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* OPERATING EXPENSES Section */}
          <Card>
            <CardHeader className="bg-red-50 dark:bg-red-900/20">
              <CardTitle className="flex items-center justify-between text-xl">
                <div className="flex items-center gap-2">
                  <span>OPERATING EXPENSES</span>
                  <TooltipInfo term={ACCOUNTING_GLOSSARY.operatingExpenses} />
                </div>
                <span className="text-2xl font-bold text-red-700 dark:text-red-400">
                  {formatCurrency(incomeStatement.operatingExpenses.total)}
                </span>
              </CardTitle>
              <CardDescription className="text-gray-700 dark:text-gray-300">
                Costs of running the business
              </CardDescription>
            </CardHeader>
            <CardContent className="p-6">
              <div className="space-y-2">
                {incomeStatement.operatingExpenses.accounts.map((account) => (
                  <AccountLine key={account.accountCode} account={account} />
                ))}
              </div>

              <div className="mt-6 pt-4 border-t-2 border-red-600 dark:border-red-400">
                <div className="flex items-center justify-between text-xl font-bold text-red-700 dark:text-red-400">
                  <span>TOTAL OPERATING EXPENSES</span>
                  <span>{formatCurrency(incomeStatement.operatingExpenses.total)}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* OPERATING INCOME Section */}
          <Card className="border-2 border-purple-300 dark:border-purple-700">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <h3 className="text-xl font-bold text-purple-900 dark:text-purple-100">
                    OPERATING INCOME
                  </h3>
                  <TooltipInfo term={ACCOUNTING_GLOSSARY.operatingIncome} />
                  <span className="text-sm text-gray-600 dark:text-gray-400">
                    (Gross Profit - Operating Expenses)
                  </span>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold text-purple-700 dark:text-purple-400">
                    {formatCurrency(incomeStatement.operatingIncome.amount)}
                  </div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">
                    Margin: {formatPercent(incomeStatement.operatingIncome.margin)}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* NET INCOME Section */}
          <Card className="border-4 border-gray-900 dark:border-gray-100">
            <CardContent className="p-8 bg-gradient-to-br from-gray-50 to-white dark:from-gray-900 dark:to-gray-800">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <h3 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                    NET INCOME
                  </h3>
                  <TooltipInfo term={ACCOUNTING_GLOSSARY.netIncome} />
                  <span className="text-sm text-gray-600 dark:text-gray-400">
                    (The Bottom Line)
                  </span>
                </div>
                <div className="text-right">
                  <div className="text-3xl font-bold text-gray-900 dark:text-gray-100">
                    {formatCurrency(incomeStatement.netIncome.amount)}
                  </div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">
                    Margin: {formatPercent(incomeStatement.netIncome.margin)}
                  </div>
                </div>
              </div>

              {/* Explanation */}
              <div className="mt-4 pt-4 border-t">
                <p className="text-sm text-gray-700 dark:text-gray-300">
                  {incomeStatement.netIncome.explanation}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Key Metrics */}
          <Card>
            <CardHeader className="bg-indigo-50 dark:bg-indigo-900/20">
              <CardTitle className="flex items-center gap-2">
                <Info className="h-5 w-5 text-indigo-600" />
                Profitability Metrics
              </CardTitle>
              <CardDescription>
                Key indicators of business performance
              </CardDescription>
            </CardHeader>
            <CardContent className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <MetricCard
                  title="Gross Profit Margin"
                  value={formatPercent(incomeStatement.grossProfit.margin)}
                  explanation={ACCOUNTING_GLOSSARY.grossMargin}
                  interpretation={`You keep ${formatPercent(incomeStatement.grossProfit.margin)} of each sale after covering product costs.`}
                />
                <MetricCard
                  title="Operating Margin"
                  value={formatPercent(incomeStatement.operatingIncome.margin)}
                  explanation={ACCOUNTING_GLOSSARY.operatingIncome}
                  interpretation={`${formatPercent(incomeStatement.operatingIncome.margin)} of revenue becomes operating profit.`}
                />
                <MetricCard
                  title="Net Profit Margin"
                  value={formatPercent(incomeStatement.netIncome.margin)}
                  explanation={ACCOUNTING_GLOSSARY.netProfitMargin}
                  interpretation={`You keep ${formatPercent(incomeStatement.netIncome.margin)} of every dollar in revenue as profit.`}
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
 * Profit/Loss Summary Component
 */
function ProfitLossSummary({ incomeStatement }: { incomeStatement: IncomeStatement }) {
  const { status, amount } = incomeStatement.netIncome

  const statusConfig = {
    profit: {
      bg: 'bg-green-50 dark:bg-green-900/20',
      border: 'border-green-500',
      icon: <TrendingUp className="h-12 w-12 text-green-600" />,
      title: 'PROFIT! 🎉',
      titleColor: 'text-green-700 dark:text-green-400',
    },
    loss: {
      bg: 'bg-red-50 dark:bg-red-900/20',
      border: 'border-red-500',
      icon: <TrendingDown className="h-12 w-12 text-red-600" />,
      title: 'Loss',
      titleColor: 'text-red-700 dark:text-red-400',
    },
    breakeven: {
      bg: 'bg-yellow-50 dark:bg-yellow-900/20',
      border: 'border-yellow-500',
      icon: <Minus className="h-12 w-12 text-yellow-600" />,
      title: 'Break Even',
      titleColor: 'text-yellow-700 dark:text-yellow-400',
    },
  }

  const config = statusConfig[status]

  return (
    <Card className={`${config.bg} border-2 ${config.border}`}>
      <CardContent className="p-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-6">
            {config.icon}
            <div>
              <h2 className={`text-3xl font-bold ${config.titleColor}`}>{config.title}</h2>
              <p className="text-gray-600 dark:text-gray-400 mt-1">
                {status === 'profit' ? 'You made money this period!' :
                 status === 'loss' ? 'Expenses exceeded revenue' :
                 'Revenue equals expenses'}
              </p>
            </div>
          </div>
          <div className="text-right">
            <div className={`text-4xl font-bold ${config.titleColor}`}>
              {new Intl.NumberFormat('en-US', {
                style: 'currency',
                currency: 'USD',
              }).format(Math.abs(amount))}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

/**
 * Account Line Component
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
function TooltipInfo({ term }: { term: { term: string; simple: string; detailed: string; example?: string; formula?: string } }) {
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
          {term.formula && (
            <div className="bg-purple-50 dark:bg-purple-900/20 p-3 rounded border border-purple-200 dark:border-purple-800">
              <strong className="text-purple-800 dark:text-purple-200">Formula:</strong>
              <p className="mt-1 font-mono text-xs">{term.formula}</p>
            </div>
          )}
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
  interpretation,
}: {
  title: string
  value: string
  explanation: { term: string; simple: string; detailed: string; formula?: string }
  interpretation: string
}) {
  return (
    <div className="p-4 rounded-lg border bg-white dark:bg-gray-800">
      <div className="flex items-center justify-between mb-2">
        <h4 className="font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
          {title}
          <TooltipInfo term={explanation} />
        </h4>
      </div>
      <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">{value}</p>
      <p className="text-xs text-gray-600 dark:text-gray-400">{interpretation}</p>
    </div>
  )
}
