"use client"

import { useState, useEffect, useCallback } from 'react'
import { usePermissions } from '@/hooks/usePermissions'
import { PERMISSIONS } from '@/lib/rbac'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import DataGrid, {
  Column,
  Export,
  Summary,
  TotalItem,
  GroupPanel,
  Grouping,
  SearchPanel,
  FilterRow,
  Paging,
  Pager,
  MasterDetail
} from 'devextreme-react/data-grid'
import { formatCurrency } from '@/lib/currencyUtils'
import { toast } from 'sonner'
import {
  DocumentTextIcon,
  ArrowPathIcon,
  ArrowDownTrayIcon,
  CheckCircleIcon,
  XCircleIcon,
  CurrencyDollarIcon,
  CalculatorIcon,
  BanknotesIcon
} from '@heroicons/react/24/outline'

interface JournalEntryLine {
  account: string
  accountName: string
  debit: number
  credit: number
  description: string
}

interface JournalEntry {
  entryDate: string
  referenceType: string
  referenceId: string
  referenceNumber?: string
  description: string
  lines: JournalEntryLine[]
  totalDebit: number
  totalCredit: number
  balanced: boolean
}

interface AccountSummary {
  account: string
  accountName: string
  totalDebit: number
  totalCredit: number
  netAmount: number
}

interface GLEntriesData {
  success: boolean
  period: {
    startDate: string
    endDate: string
  }
  entries: JournalEntry[]
  accountSummary: AccountSummary[]
  summary: {
    totalEntries: number
    totalJournalLines: number
    totalDebits: number
    totalCredits: number
    allBalanced: boolean
    transactionTypes: {
      sales: number
      purchases: number
      adjustments: number
    }
  }
}

export default function GLEntriesReportPage() {
  const { can } = usePermissions()
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<GLEntriesData | null>(null)

  // Filters
  const defaultStartDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  const defaultEndDate = new Date().toISOString().split('T')[0]
  const [startDate, setStartDate] = useState(defaultStartDate)
  const [endDate, setEndDate] = useState(defaultEndDate)
  const [transactionTypes, setTransactionTypes] = useState<string>('all')

  // Permission check
  if (!can(PERMISSIONS.REPORT_VIEW)) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="p-6">
            <p className="text-red-600">You do not have permission to view this report.</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  useEffect(() => {
    fetchGLEntries()
  }, [])

  const fetchGLEntries = useCallback(async () => {
    try {
      setLoading(true)

      const params = new URLSearchParams()
      params.append('startDate', new Date(startDate).toISOString())
      params.append('endDate', new Date(endDate).toISOString())

      if (transactionTypes !== 'all') {
        params.append('transactionTypes', transactionTypes)
      }

      const response = await fetch(`/api/reports/gl-entries?${params.toString()}`)

      if (!response.ok) {
        throw new Error('Failed to fetch GL entries')
      }

      const result = await response.json()
      setData(result)

      toast.success('GL entries loaded successfully')
    } catch (error: any) {
      console.error('Error fetching GL entries:', error)
      toast.error(error.message || 'Failed to load GL entries')
    } finally {
      setLoading(false)
    }
  }, [startDate, endDate, transactionTypes])

  const exportToCSV = async () => {
    try {
      const params = new URLSearchParams()
      params.append('startDate', new Date(startDate).toISOString())
      params.append('endDate', new Date(endDate).toISOString())
      params.append('format', 'csv')

      if (transactionTypes !== 'all') {
        params.append('transactionTypes', transactionTypes)
      }

      window.open(`/api/reports/gl-entries?${params.toString()}`, '_blank')
      toast.success('CSV export started')
    } catch (error) {
      toast.error('Failed to export CSV')
    }
  }

  const exportToQuickBooks = async () => {
    try {
      const params = new URLSearchParams()
      params.append('startDate', new Date(startDate).toISOString())
      params.append('endDate', new Date(endDate).toISOString())
      params.append('format', 'quickbooks')

      if (transactionTypes !== 'all') {
        params.append('transactionTypes', transactionTypes)
      }

      window.open(`/api/reports/gl-entries?${params.toString()}`, '_blank')
      toast.success('QuickBooks IIF export started')
    } catch (error) {
      toast.error('Failed to export QuickBooks file')
    }
  }

  // Flatten entries for DataGrid display
  const flattenedEntries = data?.entries.flatMap(entry =>
    entry.lines.map(line => ({
      entryDate: new Date(entry.entryDate),
      referenceType: entry.referenceType,
      referenceId: entry.referenceId,
      referenceNumber: entry.referenceNumber || entry.referenceId,
      entryDescription: entry.description,
      account: line.account,
      accountName: line.accountName,
      debit: line.debit,
      credit: line.credit,
      lineDescription: line.description,
      balanced: entry.balanced
    }))
  ) || []

  return (
    <div className="space-y-6 p-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-gray-100">
            General Ledger Entries
          </h1>
          <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">
            Journal entries for accounting system integration
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={exportToCSV}
            disabled={loading || !data}
            variant="outline"
          >
            <ArrowDownTrayIcon className="w-4 h-4 mr-2" />
            Export CSV
          </Button>
          <Button
            onClick={exportToQuickBooks}
            disabled={loading || !data}
            variant="outline"
          >
            <ArrowDownTrayIcon className="w-4 h-4 mr-2" />
            QuickBooks IIF
          </Button>
          <Button
            onClick={fetchGLEntries}
            disabled={loading}
            variant="outline"
          >
            <ArrowPathIcon className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Report Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Start Date */}
            <div>
              <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
                Start Date
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
              />
            </div>

            {/* End Date */}
            <div>
              <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
                End Date
              </label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
              />
            </div>

            {/* Transaction Types */}
            <div>
              <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
                Transaction Type
              </label>
              <Select value={transactionTypes} onValueChange={setTransactionTypes}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Transactions</SelectItem>
                  <SelectItem value="Sale">Sales Only</SelectItem>
                  <SelectItem value="Purchase">Purchases Only</SelectItem>
                  <SelectItem value="Adjustment">Adjustments Only</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary Cards */}
      {data && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="bg-gradient-to-br from-blue-500 to-blue-600 text-white">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm opacity-90">Total Journal Entries</p>
                  <p className="text-3xl font-bold mt-2">
                    {data.summary.totalEntries}
                  </p>
                </div>
                <DocumentTextIcon className="w-12 h-12 opacity-50" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-green-500 to-green-600 text-white">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm opacity-90">Total Debits</p>
                  <p className="text-3xl font-bold mt-2">
                    {formatCurrency(data.summary.totalDebits)}
                  </p>
                </div>
                <CurrencyDollarIcon className="w-12 h-12 opacity-50" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-purple-500 to-purple-600 text-white">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm opacity-90">Total Credits</p>
                  <p className="text-3xl font-bold mt-2">
                    {formatCurrency(data.summary.totalCredits)}
                  </p>
                </div>
                <BanknotesIcon className="w-12 h-12 opacity-50" />
              </div>
            </CardContent>
          </Card>

          <Card className={`bg-gradient-to-br ${data.summary.allBalanced ? 'from-green-500 to-green-600' : 'from-red-500 to-red-600'} text-white`}>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm opacity-90">Entries Status</p>
                  <p className="text-3xl font-bold mt-2">
                    {data.summary.allBalanced ? 'Balanced' : 'Unbalanced'}
                  </p>
                </div>
                {data.summary.allBalanced ? (
                  <CheckCircleIcon className="w-12 h-12 opacity-50" />
                ) : (
                  <XCircleIcon className="w-12 h-12 opacity-50" />
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Journal Entries Grid */}
      <Card>
        <CardHeader>
          <CardTitle>Journal Entry Lines</CardTitle>
        </CardHeader>
        <CardContent>
          <DataGrid
            dataSource={flattenedEntries}
            showBorders={true}
            columnAutoWidth={true}
            allowColumnResizing={true}
            height={600}
            keyExpr={(row: any) => `${row.referenceId}-${row.account}-${row.debit}-${row.credit}`}
          >
            <GroupPanel visible={true} />
            <SearchPanel visible={true} width={240} placeholder="Search entries..." />
            <FilterRow visible={true} />
            <Paging enabled={true} defaultPageSize={50} />
            <Pager
              showPageSizeSelector={true}
              allowedPageSizes={[25, 50, 100, 200]}
              showNavigationButtons={true}
            />

            <Grouping autoExpandAll={false} />

            <Column
              dataField="entryDate"
              caption="Date"
              dataType="date"
              format="MM/dd/yyyy"
              width={100}
            />
            <Column
              dataField="referenceType"
              caption="Type"
              width={120}
              groupIndex={0}
            />
            <Column
              dataField="referenceNumber"
              caption="Reference #"
              width={120}
            />
            <Column
              dataField="account"
              caption="Account"
              width={80}
            />
            <Column
              dataField="accountName"
              caption="Account Name"
              width={180}
            />
            <Column
              dataField="debit"
              caption="Debit"
              dataType="number"
              format="₱#,##0.00"
              alignment="right"
              width={120}
            />
            <Column
              dataField="credit"
              caption="Credit"
              dataType="number"
              format="₱#,##0.00"
              alignment="right"
              width={120}
            />
            <Column
              dataField="lineDescription"
              caption="Description"
              width={250}
            />

            <Summary>
              <TotalItem column="debit" summaryType="sum" valueFormat="₱#,##0.00" />
              <TotalItem column="credit" summaryType="sum" valueFormat="₱#,##0.00" />
            </Summary>

            <Export enabled={true} allowExportSelectedData={false} />
          </DataGrid>
        </CardContent>
      </Card>

      {/* Account Summary */}
      {data && data.accountSummary.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Account Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <DataGrid
              dataSource={data.accountSummary}
              showBorders={true}
              columnAutoWidth={true}
              allowColumnResizing={true}
              height={400}
              keyExpr="account"
            >
              <SearchPanel visible={true} width={240} placeholder="Search accounts..." />
              <FilterRow visible={true} />

              <Column
                dataField="account"
                caption="Account Code"
                width={120}
              />
              <Column
                dataField="accountName"
                caption="Account Name"
                width={200}
              />
              <Column
                dataField="totalDebit"
                caption="Total Debits"
                dataType="number"
                format="₱#,##0.00"
                alignment="right"
                width={150}
              />
              <Column
                dataField="totalCredit"
                caption="Total Credits"
                dataType="number"
                format="₱#,##0.00"
                alignment="right"
                width={150}
              />
              <Column
                dataField="netAmount"
                caption="Net Amount"
                dataType="number"
                format="₱#,##0.00"
                alignment="right"
                width={150}
                cellRender={(cellData: any) => (
                  <span className={cellData.value >= 0 ? 'text-green-600' : 'text-red-600'}>
                    {formatCurrency(cellData.value)}
                  </span>
                )}
              />

              <Summary>
                <TotalItem column="totalDebit" summaryType="sum" valueFormat="₱#,##0.00" />
                <TotalItem column="totalCredit" summaryType="sum" valueFormat="₱#,##0.00" />
              </Summary>

              <Export enabled={true} />
            </DataGrid>
          </CardContent>
        </Card>
      )}

      {/* Info Card */}
      <Card className="bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800">
        <CardContent className="p-6">
          <h3 className="font-semibold text-blue-900 dark:text-blue-100 mb-2">
            About General Ledger Entries
          </h3>
          <div className="text-sm text-blue-800 dark:text-blue-200 space-y-2">
            <p>
              <strong>Journal entries</strong> are prepared following double-entry accounting principles.
              Every transaction has equal debits and credits.
            </p>
            <p>
              <strong>Export formats:</strong>
            </p>
            <ul className="list-disc list-inside ml-4">
              <li><strong>CSV</strong> - Universal format for Excel and other systems</li>
              <li><strong>QuickBooks IIF</strong> - Import directly into QuickBooks Desktop</li>
            </ul>
            <p className="mt-2">
              <strong>Transaction types:</strong> Sales record revenue and COGS, Purchases record inventory
              and payables, Adjustments record inventory corrections.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
