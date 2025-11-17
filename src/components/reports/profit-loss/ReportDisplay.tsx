"use client"

import { formatCurrency } from '@/lib/currencyUtils'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { PrinterIcon, InformationCircleIcon } from '@heroicons/react/24/outline'

interface ProfitLossData {
  // Left Column - Costs
  openingStockPurchase: number
  openingStockSale: number
  totalPurchase: number
  totalStockAdjustment: number
  totalExpense: number
  totalPurchaseShipping: number
  purchaseAdditionalExpenses: number
  totalTransferShipping: number
  totalSellDiscount: number
  totalCustomerReward: number
  totalSellReturn: number

  // Right Column - Revenue
  closingStockPurchase: number
  closingStockSale: number
  totalSales: number
  totalSellShipping: number
  sellAdditionalExpenses: number
  totalStockRecovered: number
  totalPurchaseReturn: number
  totalPurchaseDiscount: number
  totalSellRoundOff: number

  // Calculated Fields
  cogs: number
  grossProfit: number
  netProfit: number
}

interface ReportDisplayProps {
  data: ProfitLossData
  startDate: string
  endDate: string
}

export function ReportDisplay({ data, startDate, endDate }: ReportDisplayProps) {
  // Use native Intl.DateTimeFormat instead of toLocaleDateString
  const dateFormatter = new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })

  const formatDate = (dateString: string) => {
    return dateFormatter.format(new Date(dateString))
  }

  const handlePrint = () => {
    window.print()
  }

  return (
    <>
      {/* Print Header */}
      <div className="hidden print:block mb-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-2">PROFIT / LOSS REPORT</h1>
          <div className="text-sm">
            <div>Period: {formatDate(startDate)} to {formatDate(endDate)}</div>
            <div className="mt-2">Generated: {new Intl.DateTimeFormat('en-US', {
              year: 'numeric',
              month: 'short',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            }).format(new Date())}</div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 mb-6">
        <CardHeader className="flex flex-row items-center justify-between print:hidden">
          <CardTitle className="text-gray-900 dark:text-white">Financial Statement</CardTitle>
          <Button
            onClick={handlePrint}
            size="sm"
            className="bg-purple-600 hover:bg-purple-700 text-white font-medium border-2 border-purple-700 hover:border-purple-800 shadow-md hover:shadow-lg transition-all"
          >
            <PrinterIcon className="w-4 h-4 mr-2" />
            Print Report
          </Button>
        </CardHeader>
        <CardContent>
          {/* Two Column Layout */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Left Column - Costs/Expenses */}
            <div className="space-y-4">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white border-b-2 border-orange-500 pb-2">
                Costs & Expenses
              </h3>

              <div className="space-y-3">
                <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      Opening Stock (by purchase price)
                    </span>
                    <span className="font-semibold text-gray-900 dark:text-white">
                      {formatCurrency(data.openingStockPurchase)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center mt-1">
                    <span className="text-xs text-gray-600 dark:text-gray-400">
                      Opening Stock (by sale price)
                    </span>
                    <span className="text-xs text-gray-600 dark:text-gray-400">
                      {formatCurrency(data.openingStockSale)}
                    </span>
                  </div>
                </div>

                <div className="flex justify-between items-center py-2 border-b border-gray-200 dark:border-gray-700">
                  <span className="text-sm text-gray-700 dark:text-gray-300">Total purchase</span>
                  <span className="font-medium text-gray-900 dark:text-white">
                    {formatCurrency(data.totalPurchase)}
                  </span>
                </div>

                <div className="flex justify-between items-center py-2 border-b border-gray-200 dark:border-gray-700">
                  <span className="text-sm text-gray-700 dark:text-gray-300">Total Stock Adjustment</span>
                  <span className="font-medium text-gray-900 dark:text-white">
                    {formatCurrency(data.totalStockAdjustment)}
                  </span>
                </div>

                <div className="flex justify-between items-center py-2 border-b border-gray-200 dark:border-gray-700">
                  <span className="text-sm text-gray-700 dark:text-gray-300">Total Expense</span>
                  <span className="font-medium text-red-600 dark:text-red-400">
                    {formatCurrency(data.totalExpense)}
                  </span>
                </div>

                <div className="flex justify-between items-center py-2 border-b border-gray-200 dark:border-gray-700">
                  <span className="text-sm text-gray-700 dark:text-gray-300">Total purchase shipping charge</span>
                  <span className="font-medium text-gray-900 dark:text-white">
                    {formatCurrency(data.totalPurchaseShipping)}
                  </span>
                </div>

                <div className="flex justify-between items-center py-2 border-b border-gray-200 dark:border-gray-700">
                  <span className="text-sm text-gray-700 dark:text-gray-300">Purchase additional expenses</span>
                  <span className="font-medium text-gray-900 dark:text-white">
                    {formatCurrency(data.purchaseAdditionalExpenses)}
                  </span>
                </div>

                <div className="flex justify-between items-center py-2 border-b border-gray-200 dark:border-gray-700">
                  <span className="text-sm text-gray-700 dark:text-gray-300">Total transfer shipping charge</span>
                  <span className="font-medium text-gray-900 dark:text-white">
                    {formatCurrency(data.totalTransferShipping)}
                  </span>
                </div>

                <div className="flex justify-between items-center py-2 border-b border-gray-200 dark:border-gray-700">
                  <span className="text-sm text-gray-700 dark:text-gray-300">Total Sell discount</span>
                  <span className="font-medium text-orange-600 dark:text-orange-400">
                    {formatCurrency(data.totalSellDiscount)}
                  </span>
                </div>

                <div className="flex justify-between items-center py-2 border-b border-gray-200 dark:border-gray-700">
                  <span className="text-sm text-gray-700 dark:text-gray-300">Total customer reward</span>
                  <span className="font-medium text-gray-900 dark:text-white">
                    {formatCurrency(data.totalCustomerReward)}
                  </span>
                </div>

                <div className="flex justify-between items-center py-2 border-b border-gray-200 dark:border-gray-700">
                  <span className="text-sm text-gray-700 dark:text-gray-300">Total Sell Return</span>
                  <span className="font-medium text-red-600 dark:text-red-400">
                    {formatCurrency(data.totalSellReturn)}
                  </span>
                </div>
              </div>
            </div>

            {/* Right Column - Revenue/Income */}
            <div className="space-y-4">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white border-b-2 border-green-500 pb-2">
                Revenue & Income
              </h3>

              <div className="space-y-3">
                <div className="bg-green-50 dark:bg-green-900/20 p-3 rounded-lg">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      Closing stock (by purchase price)
                    </span>
                    <span className="font-semibold text-gray-900 dark:text-white">
                      {formatCurrency(data.closingStockPurchase)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center mt-1">
                    <span className="text-xs text-gray-600 dark:text-gray-400">
                      Closing stock (by sale price)
                    </span>
                    <span className="text-xs text-gray-600 dark:text-gray-400">
                      {formatCurrency(data.closingStockSale)}
                    </span>
                  </div>
                </div>

                <div className="flex justify-between items-center py-2 border-b border-gray-200 dark:border-gray-700">
                  <span className="text-sm text-gray-700 dark:text-gray-300">Total Sales</span>
                  <span className="font-medium text-green-600 dark:text-green-400">
                    {formatCurrency(data.totalSales)}
                  </span>
                </div>

                <div className="flex justify-between items-center py-2 border-b border-gray-200 dark:border-gray-700">
                  <span className="text-sm text-gray-700 dark:text-gray-300">Total sell shipping charge</span>
                  <span className="font-medium text-gray-900 dark:text-white">
                    {formatCurrency(data.totalSellShipping)}
                  </span>
                </div>

                <div className="flex justify-between items-center py-2 border-b border-gray-200 dark:border-gray-700">
                  <span className="text-sm text-gray-700 dark:text-gray-300">Sell additional expenses</span>
                  <span className="font-medium text-gray-900 dark:text-white">
                    {formatCurrency(data.sellAdditionalExpenses)}
                  </span>
                </div>

                <div className="flex justify-between items-center py-2 border-b border-gray-200 dark:border-gray-700">
                  <span className="text-sm text-gray-700 dark:text-gray-300">Total Stock Recovered</span>
                  <span className="font-medium text-green-600 dark:text-green-400">
                    {formatCurrency(data.totalStockRecovered)}
                  </span>
                </div>

                <div className="flex justify-between items-center py-2 border-b border-gray-200 dark:border-gray-700">
                  <span className="text-sm text-gray-700 dark:text-gray-300">Total Purchase Return</span>
                  <span className="font-medium text-gray-900 dark:text-white">
                    {formatCurrency(data.totalPurchaseReturn)}
                  </span>
                </div>

                <div className="flex justify-between items-center py-2 border-b border-gray-200 dark:border-gray-700">
                  <span className="text-sm text-gray-700 dark:text-gray-300">Total Purchase discount</span>
                  <span className="font-medium text-green-600 dark:text-green-400">
                    {formatCurrency(data.totalPurchaseDiscount)}
                  </span>
                </div>

                <div className="flex justify-between items-center py-2 border-b border-gray-200 dark:border-gray-700">
                  <span className="text-sm text-gray-700 dark:text-gray-300">Total sell round off</span>
                  <span className="font-medium text-gray-900 dark:text-white">
                    {formatCurrency(data.totalSellRoundOff)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Calculations Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* COGS Card */}
        <Card className="bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-900 dark:to-orange-800 border-orange-200 dark:border-orange-700">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-gray-900 dark:text-white">
              COGS (Cost of Goods Sold)
              <div className="relative group">
                <InformationCircleIcon className="w-5 h-5 text-gray-500 dark:text-gray-400 cursor-help" />
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block w-64 p-2 bg-gray-900 text-white text-xs rounded shadow-lg z-10">
                  Opening Stock + Purchases - Closing Stock
                </div>
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-orange-700 dark:text-orange-300 mb-2">
              {formatCurrency(data.cogs)}
            </div>
            <div className="text-xs text-gray-700 dark:text-gray-300 space-y-1">
              <div>= Opening Stock + Total Purchase</div>
              <div className="pl-4">- Closing Stock</div>
            </div>
          </CardContent>
        </Card>

        {/* Gross Profit Card */}
        <Card className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900 dark:to-blue-800 border-blue-200 dark:border-blue-700">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-gray-900 dark:text-white">
              Gross Profit
              <div className="relative group">
                <InformationCircleIcon className="w-5 h-5 text-gray-500 dark:text-gray-400 cursor-help" />
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block w-64 p-2 bg-gray-900 text-white text-xs rounded shadow-lg z-10">
                  Total Sales - COGS
                </div>
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-3xl font-bold mb-2 ${
              data.grossProfit >= 0
                ? 'text-blue-700 dark:text-blue-300'
                : 'text-red-700 dark:text-red-300'
            }`}>
              {formatCurrency(data.grossProfit)}
            </div>
            <div className="text-xs text-gray-700 dark:text-gray-300 space-y-1">
              <div>= Total Sales - COGS</div>
            </div>
          </CardContent>
        </Card>

        {/* Net Profit Card */}
        <Card className={`bg-gradient-to-br ${
          data.netProfit >= 0
            ? 'from-green-50 to-green-100 dark:from-green-900 dark:to-green-800 border-green-200 dark:border-green-700'
            : 'from-red-50 to-red-100 dark:from-red-900 dark:to-red-800 border-red-200 dark:border-red-700'
        }`}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-gray-900 dark:text-white">
              Net Profit
              <div className="relative group">
                <InformationCircleIcon className="w-5 h-5 text-gray-500 dark:text-gray-400 cursor-help" />
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block w-80 p-2 bg-gray-900 text-white text-xs rounded shadow-lg z-10">
                  Gross Profit - Expenses + Additional Income - Discounts - Returns
                </div>
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-3xl font-bold mb-2 ${
              data.netProfit >= 0
                ? 'text-green-700 dark:text-green-300'
                : 'text-red-700 dark:text-red-300'
            }`}>
              {formatCurrency(data.netProfit)}
            </div>
            <div className="text-xs text-gray-700 dark:text-gray-300 space-y-1">
              <div>= Gross Profit - Total Expenses</div>
              <div className="pl-4">+ Additional Income</div>
              <div className="pl-4">- Discounts & Returns</div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Info Box */}
      <Card className="mt-6 bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800">
        <CardContent className="pt-6">
          <p className="text-sm text-blue-900 dark:text-blue-200">
            <strong>Note:</strong> This report provides a comprehensive view of your business profitability.
            COGS includes opening stock, purchases, and adjustments. Gross Profit reflects revenue minus direct costs.
            Net Profit accounts for all operating expenses, shipping, discounts, and returns.
          </p>
        </CardContent>
      </Card>

      {/* Print Styles */}
      <style jsx global>{`
        @media print {
          body {
            print-color-adjust: exact;
            -webkit-print-color-adjust: exact;
          }
          .print\\:hidden {
            display: none !important;
          }
          .print\\:block {
            display: block !important;
          }
          @page {
            margin: 1.5cm;
            size: portrait;
          }
        }
      `}</style>
    </>
  )
}
