"use client"

import { useState, useEffect } from "react"
import { usePermissions } from "@/hooks/usePermissions"
import { PERMISSIONS } from "@/lib/rbac"
import { formatCurrency } from "@/lib/currencyUtils"
import {
  BanknotesIcon,
  CreditCardIcon,
  DevicePhoneMobileIcon,
  DocumentTextIcon,
  PrinterIcon,
  ArrowTrendingUpIcon,
} from "@heroicons/react/24/outline"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"

interface SalesTodayData {
  summary: {
    date: string
    totalSales: number
    totalAmount: number
    totalSubtotal: number
    totalTax: number
    totalDiscount: number
    totalCOGS: number
    grossProfit: number
    grossMargin: number
  }
  paymentMethods: {
    cash: { amount: number; percentage: number }
    credit: { amount: number; percentage: number }
    digital: {
      amount: number
      percentage: number
      breakdown: {
        card: number
        mobilePayment: number
        bankTransfer: number
      }
    }
    cheque: { amount: number; percentage: number }
    total: number
  }
  paymentBreakdown: Array<{
    method: string
    amount: number
    count: number
    percentage: number
  }>
  discountBreakdown: {
    senior: number
    pwd: number
    regular: number
    total: number
  }
  sales: Array<{
    id: number
    invoiceNumber: string
    saleDate: string
    customer: string
    customerId: number | null
    totalAmount: number
    discountAmount: number
    discountType: string | null
    payments: Array<{ method: string; amount: number }>
    itemCount: number
    items: Array<{
      productName: string
      variationName: string
      sku: string
      quantity: number
      unitPrice: number
      total: number
    }>
  }>
}

export default function SalesTodayPage() {
  const { can } = usePermissions()

  if (!can(PERMISSIONS.REPORT_SALES_TODAY)) {
    return (
      <div className="text-center py-12">
        <p className="text-red-600">You do not have permission to view reports</p>
      </div>
    )
  }

  const [reportData, setReportData] = useState<SalesTodayData | null>(null)
  const [loading, setLoading] = useState(true)
  const [locationId, setLocationId] = useState("all")
  const [locations, setLocations] = useState<Array<{ id: number; name: string }>>([])
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set())

  useEffect(() => {
    fetchLocations()
  }, [])

  useEffect(() => {
    fetchReport()
  }, [locationId])

  const fetchLocations = async () => {
    try {
      const response = await fetch("/api/locations")
      if (response.ok) {
        const data = await response.json()
        setLocations(data.locations || data)
      }
    } catch (error) {
      console.error("Failed to fetch locations:", error)
      setLocations([])
    }
  }

  const fetchReport = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (locationId !== "all") params.append("locationId", locationId)

      const response = await fetch(`/api/reports/sales-today?${params.toString()}`)
      if (response.ok) {
        const data = await response.json()
        setReportData(data)
      }
    } catch (error) {
      console.error("Failed to fetch report:", error)
    } finally {
      setLoading(false)
    }
  }

  const toggleRowExpansion = (saleId: number) => {
    const newExpanded = new Set(expandedRows)
    if (newExpanded.has(saleId)) {
      newExpanded.delete(saleId)
    } else {
      newExpanded.add(saleId)
    }
    setExpandedRows(newExpanded)
  }

  const handlePrint = () => {
    window.print()
  }

  if (loading && !reportData) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 print:hidden">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Sales Today</h1>
          <p className="text-sm text-gray-600 mt-1">
            {reportData?.summary.date && new Date(reportData.summary.date).toLocaleDateString('en-US', {
              weekday: 'long',
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            })}
          </p>
        </div>

        <div className="flex items-center gap-3">
          {locations.length > 0 && (
            <>
              <label className="text-sm font-medium text-gray-700">Location:</label>
              <Select value={locationId} onValueChange={setLocationId}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Select location" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Locations</SelectItem>
                  {locations.map((location) => (
                    <SelectItem key={location.id} value={location.id.toString()}>
                      {location.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </>
          )}
          <Button onClick={handlePrint}>
            <PrinterIcon className="h-4 w-4 mr-2" />
            Print Report
          </Button>
        </div>
      </div>

      {/* Summary Metrics */}
      {reportData && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="bg-gradient-to-br from-blue-50 to-blue-100">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm text-gray-600">Total Sales</div>
                  <div className="text-3xl font-bold text-gray-900">
                    {reportData.summary.totalSales}
                  </div>
                </div>
                <DocumentTextIcon className="h-10 w-10 text-blue-600" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-green-50 to-green-100">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm text-gray-600">Total Revenue</div>
                  <div className="text-3xl font-bold text-gray-900">
                    {formatCurrency(reportData.summary.totalAmount)}
                  </div>
                </div>
                <BanknotesIcon className="h-10 w-10 text-green-600" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-purple-50 to-purple-100">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm text-gray-600">Gross Profit</div>
                  <div className="text-3xl font-bold text-gray-900">
                    {formatCurrency(reportData.summary.grossProfit)}
                  </div>
                </div>
                <ArrowTrendingUpIcon className="h-10 w-10 text-purple-600" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-orange-50 to-orange-100">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm text-gray-600">Gross Margin</div>
                  <div className="text-3xl font-bold text-gray-900">
                    {reportData.summary.grossMargin.toFixed(2)}%
                  </div>
                </div>
                <ArrowTrendingUpIcon className="h-10 w-10 text-orange-600" />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Payment Method Breakdown */}
      {reportData && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Main Payment Categories */}
          <Card>
            <CardHeader>
              <CardTitle>Payment Method Summary</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {/* Cash */}
                <div className="flex items-center justify-between p-4 bg-green-50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <BanknotesIcon className="h-8 w-8 text-green-600" />
                    <div>
                      <div className="font-semibold text-gray-900">Cash</div>
                      <div className="text-sm text-gray-600">
                        {reportData.paymentMethods.cash.percentage.toFixed(1)}% of total
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-bold text-gray-900">
                      {formatCurrency(reportData.paymentMethods.cash.amount)}
                    </div>
                  </div>
                </div>

                {/* Credit */}
                {reportData.paymentMethods.credit.amount > 0 && (
                  <div className="flex items-center justify-between p-4 bg-orange-50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <DocumentTextIcon className="h-8 w-8 text-orange-600" />
                      <div>
                        <div className="font-semibold text-gray-900">Credit / Charge</div>
                        <div className="text-sm text-gray-600">
                          {reportData.paymentMethods.credit.percentage.toFixed(1)}% of total
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-bold text-gray-900">
                        {formatCurrency(reportData.paymentMethods.credit.amount)}
                      </div>
                    </div>
                  </div>
                )}

                {/* Digital */}
                {reportData.paymentMethods.digital.amount > 0 && (
                  <div className="flex items-center justify-between p-4 bg-blue-50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <CreditCardIcon className="h-8 w-8 text-blue-600" />
                      <div>
                        <div className="font-semibold text-gray-900">Digital Payments</div>
                        <div className="text-sm text-gray-600">
                          {reportData.paymentMethods.digital.percentage.toFixed(1)}% of total
                        </div>
                        <div className="text-xs text-gray-500 mt-1">
                          Card: {formatCurrency(reportData.paymentMethods.digital.breakdown.card)} |
                          Mobile: {formatCurrency(reportData.paymentMethods.digital.breakdown.mobilePayment)} |
                          Bank: {formatCurrency(reportData.paymentMethods.digital.breakdown.bankTransfer)}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-bold text-gray-900">
                        {formatCurrency(reportData.paymentMethods.digital.amount)}
                      </div>
                    </div>
                  </div>
                )}

                {/* Cheque */}
                {reportData.paymentMethods.cheque.amount > 0 && (
                  <div className="flex items-center justify-between p-4 bg-yellow-50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <DocumentTextIcon className="h-8 w-8 text-yellow-600" />
                      <div>
                        <div className="font-semibold text-gray-900">Cheque</div>
                        <div className="text-sm text-gray-600">
                          {reportData.paymentMethods.cheque.percentage.toFixed(1)}% of total
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-bold text-gray-900">
                        {formatCurrency(reportData.paymentMethods.cheque.amount)}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Detailed Payment Breakdown */}
          <Card>
            <CardHeader>
              <CardTitle>Payment Method Details</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Method</TableHead>
                    <TableHead className="text-right">Count</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead className="text-right">%</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {reportData.paymentBreakdown.map((payment, index) => (
                    <TableRow key={index}>
                      <TableCell className="font-medium">{payment.method}</TableCell>
                      <TableCell className="text-right">{payment.count}</TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(payment.amount)}
                      </TableCell>
                      <TableCell className="text-right">
                        {payment.percentage.toFixed(1)}%
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Discount Breakdown */}
      {reportData && reportData.discountBreakdown.total > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Discount Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="p-4 bg-gray-50 rounded-lg">
                <div className="text-sm text-gray-600">Total Discounts</div>
                <div className="text-2xl font-bold text-gray-900">
                  {formatCurrency(reportData.discountBreakdown.total)}
                </div>
              </div>
              {reportData.discountBreakdown.senior > 0 && (
                <div className="p-4 bg-blue-50 rounded-lg">
                  <div className="text-sm text-gray-600">Senior Citizen</div>
                  <div className="text-2xl font-bold text-blue-900">
                    {formatCurrency(reportData.discountBreakdown.senior)}
                  </div>
                </div>
              )}
              {reportData.discountBreakdown.pwd > 0 && (
                <div className="p-4 bg-purple-50 rounded-lg">
                  <div className="text-sm text-gray-600">PWD</div>
                  <div className="text-2xl font-bold text-purple-900">
                    {formatCurrency(reportData.discountBreakdown.pwd)}
                  </div>
                </div>
              )}
              {reportData.discountBreakdown.regular > 0 && (
                <div className="p-4 bg-green-50 rounded-lg">
                  <div className="text-sm text-gray-600">Regular</div>
                  <div className="text-2xl font-bold text-green-900">
                    {formatCurrency(reportData.discountBreakdown.regular)}
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Sales Transactions */}
      {reportData && (
        <Card>
          <CardHeader>
            <CardTitle>Today's Transactions ({reportData.sales.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {reportData.sales.length === 0 ? (
              <div className="text-center py-8 text-gray-500">No sales today</div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Invoice</TableHead>
                      <TableHead>Customer</TableHead>
                      <TableHead>Items</TableHead>
                      <TableHead>Payment Methods</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {reportData.sales.map((sale) => (
                      <>
                        <TableRow key={sale.id} className="hover:bg-gray-50">
                          <TableCell className="font-medium">{sale.invoiceNumber}</TableCell>
                          <TableCell>{sale.customer}</TableCell>
                          <TableCell>{sale.itemCount}</TableCell>
                          <TableCell>
                            <div className="flex flex-wrap gap-1">
                              {sale.payments.map((payment, idx) => (
                                <Badge key={idx} variant="outline" className="text-xs">
                                  {payment.method}: {formatCurrency(payment.amount)}
                                </Badge>
                              ))}
                            </div>
                          </TableCell>
                          <TableCell className="text-right font-semibold">
                            {formatCurrency(sale.totalAmount)}
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => toggleRowExpansion(sale.id)}
                            >
                              {expandedRows.has(sale.id) ? "Hide" : "Show"}
                            </Button>
                          </TableCell>
                        </TableRow>
                        {expandedRows.has(sale.id) && (
                          <TableRow>
                            <TableCell colSpan={6} className="bg-gray-50">
                              <div className="p-4">
                                <h4 className="font-semibold mb-2">Sale Items</h4>
                                <Table>
                                  <TableHeader>
                                    <TableRow>
                                      <TableHead>Product</TableHead>
                                      <TableHead>SKU</TableHead>
                                      <TableHead className="text-right">Qty</TableHead>
                                      <TableHead className="text-right">Price</TableHead>
                                      <TableHead className="text-right">Total</TableHead>
                                    </TableRow>
                                  </TableHeader>
                                  <TableBody>
                                    {sale.items.map((item, idx) => (
                                      <TableRow key={idx}>
                                        <TableCell>
                                          {item.productName} ({item.variationName})
                                        </TableCell>
                                        <TableCell>{item.sku}</TableCell>
                                        <TableCell className="text-right">{item.quantity}</TableCell>
                                        <TableCell className="text-right">
                                          {formatCurrency(item.unitPrice)}
                                        </TableCell>
                                        <TableCell className="text-right">
                                          {formatCurrency(item.total)}
                                        </TableCell>
                                      </TableRow>
                                    ))}
                                  </TableBody>
                                </Table>
                              </div>
                            </TableCell>
                          </TableRow>
                        )}
                      </>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

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
          @page {
            margin: 1cm;
          }
        }
      `}</style>
    </div>
  )
}
