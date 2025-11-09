"use client"

import { useState, useEffect } from "react"
import { useSession } from "next-auth/react"
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
  ArrowDownTrayIcon,
  MapPinIcon,
} from "@heroicons/react/24/outline"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
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

export default function CashierSalesTodayPage() {
  const { can } = usePermissions()
  const { data: session } = useSession()

  if (!can(PERMISSIONS.REPORT_SALES_TODAY)) {
    return (
      <div className="text-center py-12">
        <p className="text-red-600 dark:text-red-400">You do not have permission to view this report</p>
      </div>
    )
  }

  const [reportData, setReportData] = useState<SalesTodayData | null>(null)
  const [loading, setLoading] = useState(true)
  const [userLocationName, setUserLocationName] = useState<string>("Loading...")
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set())

  useEffect(() => {
    fetchUserLocationAndReport()
  }, [])

  const fetchUserLocationAndReport = async () => {
    try {
      setLoading(true)

      // Get user's assigned location
      const locationResponse = await fetch("/api/user-locations")
      if (!locationResponse.ok) {
        throw new Error("Failed to fetch user location")
      }

      const locationData = await locationResponse.json()
      const userLocations = locationData.locations || []

      if (userLocations.length === 0) {
        setUserLocationName("No Location Assigned")
        setReportData(null)
        setLoading(false)
        return
      }

      // Use first assigned location (cashiers typically have one location)
      const userLocation = userLocations[0]
      setUserLocationName(userLocation.name)

      // Fetch sales report for this location
      const reportResponse = await fetch(
        `/api/reports/sales-today?locationId=${userLocation.id}`
      )

      if (!reportResponse.ok) {
        throw new Error("Failed to fetch sales report")
      }

      const data = await reportResponse.json()
      setReportData(data)
    } catch (error) {
      console.error("Error fetching cashier sales report:", error)
      setReportData(null)
    } finally {
      setLoading(false)
    }
  }

  const toggleRowExpansion = (saleId: number) => {
    setExpandedRows((prev) => {
      const next = new Set(prev)
      if (next.has(saleId)) {
        next.delete(saleId)
      } else {
        next.add(saleId)
      }
      return next
    })
  }

  const handlePrint = () => {
    window.print()
  }

  const handleExportExcel = async () => {
    if (!reportData) return

    try {
      const response = await fetch("/api/reports/sales-today/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          data: reportData,
          format: "excel",
          locationName: userLocationName,
        }),
      })

      if (!response.ok) throw new Error("Export failed")

      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `cashier-sales-today-${new Date().toISOString().split("T")[0]}.xlsx`
      a.click()
      window.URL.revokeObjectURL(url)
    } catch (error) {
      console.error("Export error:", error)
      alert("Failed to export report")
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 dark:border-blue-400 mx-auto"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-400">Loading report...</p>
        </div>
      </div>
    )
  }

  if (!reportData) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-600 dark:text-gray-400">No sales data available for today</p>
      </div>
    )
  }

  const { summary, paymentMethods, paymentBreakdown, discountBreakdown, sales } = reportData

  return (
    <div className="space-y-6 p-6 bg-gray-50 dark:bg-gray-900 min-h-screen">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white dark:bg-gray-800 p-4 rounded-lg shadow">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Cashier Sales Report - Today</h1>
          <div className="flex items-center gap-2 mt-1">
            <MapPinIcon className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Location: <span className="font-semibold text-gray-900 dark:text-white">{userLocationName}</span>
            </p>
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-500 mt-1">{summary.date}</p>
        </div>

        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportExcel}
            className="gap-2 hover:border-green-500 hover:text-green-700 dark:hover:text-green-400"
          >
            <ArrowDownTrayIcon className="h-4 w-4" />
            Excel
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handlePrint}
            className="gap-2 hover:border-blue-500 hover:text-blue-700 dark:hover:text-blue-400"
          >
            <PrinterIcon className="h-4 w-4" />
            Print
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Sales</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-900 dark:text-white">{summary.totalSales}</div>
            <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">Transactions completed</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Revenue</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600 dark:text-green-400">
              {formatCurrency(summary.totalAmount)}
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
              Subtotal: {formatCurrency(summary.totalSubtotal)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400">Gross Profit</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
              {formatCurrency(summary.grossProfit)}
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
              Margin: {summary.grossMargin.toFixed(1)}%
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400">Discounts Given</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600 dark:text-orange-400">
              {formatCurrency(summary.totalDiscount)}
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
              COGS: {formatCurrency(summary.totalCOGS)}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Payment Methods */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BanknotesIcon className="h-5 w-5" />
            Payment Methods Breakdown
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {paymentBreakdown.map((payment) => (
              <div
                key={payment.method}
                className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{payment.method}</span>
                  <Badge variant="outline">{payment.count}</Badge>
                </div>
                <div className="text-xl font-bold text-gray-900 dark:text-white">
                  {formatCurrency(payment.amount)}
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                  {payment.percentage.toFixed(1)}% of total
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Discount Breakdown */}
      {discountBreakdown.total > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Discount Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                <p className="text-sm text-gray-600 dark:text-gray-400">Senior Citizen</p>
                <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                  {formatCurrency(discountBreakdown.senior)}
                </p>
              </div>
              <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
                <p className="text-sm text-gray-600 dark:text-gray-400">PWD</p>
                <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                  {formatCurrency(discountBreakdown.pwd)}
                </p>
              </div>
              <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <p className="text-sm text-gray-600 dark:text-gray-400">Regular Discount</p>
                <p className="text-2xl font-bold text-gray-600 dark:text-gray-400">
                  {formatCurrency(discountBreakdown.regular)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Sales Transactions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DocumentTextIcon className="h-5 w-5" />
            Sales Transactions ({sales.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Invoice #</TableHead>
                  <TableHead>Time</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead className="text-right">Discount</TableHead>
                  <TableHead>Payment</TableHead>
                  <TableHead className="text-center">Items</TableHead>
                  <TableHead className="text-center">Details</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sales.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-gray-500 dark:text-gray-500 py-8">
                      No sales transactions for today
                    </TableCell>
                  </TableRow>
                ) : (
                  sales.map((sale) => (
                    <>
                      <TableRow key={sale.id} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                        <TableCell className="font-medium">{sale.invoiceNumber}</TableCell>
                        <TableCell>{new Date(sale.saleDate).toLocaleTimeString()}</TableCell>
                        <TableCell>{sale.customer}</TableCell>
                        <TableCell className="text-right font-semibold">
                          {formatCurrency(sale.totalAmount)}
                        </TableCell>
                        <TableCell className="text-right">
                          {sale.discountAmount > 0 ? (
                            <span className="text-orange-600 dark:text-orange-400">
                              -{formatCurrency(sale.discountAmount)}
                              {sale.discountType && (
                                <Badge variant="outline" className="ml-1 text-xs">
                                  {sale.discountType}
                                </Badge>
                              )}
                            </span>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {sale.payments.map((payment, idx) => (
                              <Badge key={idx} variant="secondary" className="text-xs">
                                {payment.method}
                              </Badge>
                            ))}
                          </div>
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge variant="outline">{sale.itemCount}</Badge>
                        </TableCell>
                        <TableCell className="text-center">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => toggleRowExpansion(sale.id)}
                            className="hover:bg-blue-50 dark:hover:bg-blue-900/20"
                          >
                            {expandedRows.has(sale.id) ? "Hide" : "View"}
                          </Button>
                        </TableCell>
                      </TableRow>
                      {expandedRows.has(sale.id) && (
                        <TableRow>
                          <TableCell colSpan={8} className="bg-gray-50 dark:bg-gray-800/50">
                            <div className="p-4">
                              <h4 className="font-semibold mb-2 text-gray-900 dark:text-white">Sale Items:</h4>
                              <Table>
                                <TableHeader>
                                  <TableRow>
                                    <TableHead>Product</TableHead>
                                    <TableHead>SKU</TableHead>
                                    <TableHead className="text-right">Qty</TableHead>
                                    <TableHead className="text-right">Unit Price</TableHead>
                                    <TableHead className="text-right">Total</TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {sale.items.map((item, idx) => (
                                    <TableRow key={idx}>
                                      <TableCell>
                                        {item.productName}
                                        {item.variationName && (
                                          <span className="text-sm text-gray-500 dark:text-gray-500">
                                            {" "}
                                            ({item.variationName})
                                          </span>
                                        )}
                                      </TableCell>
                                      <TableCell className="text-sm text-gray-600 dark:text-gray-400">
                                        {item.sku}
                                      </TableCell>
                                      <TableCell className="text-right">{item.quantity}</TableCell>
                                      <TableCell className="text-right">{formatCurrency(item.unitPrice)}</TableCell>
                                      <TableCell className="text-right font-semibold">
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
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
