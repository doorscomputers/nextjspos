"use client"

import { useState, useEffect } from "react"
import { useSession } from "next-auth/react"
import { usePermissions } from "@/hooks/usePermissions"
import { PERMISSIONS } from "@/lib/rbac"
import { formatCurrency } from "@/lib/currencyUtils"
import { MapPinIcon, CalendarIcon, ArrowDownTrayIcon, PrinterIcon } from "@heroicons/react/24/outline"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"

interface SalesHistoryData {
  sales: Array<{
    id: number
    invoiceNumber: string
    saleDate: string
    customer: string
    totalAmount: number
    discountAmount: number
    discountType: string | null
    paymentStatus: string
    itemCount: number
  }>
  summary: {
    totalSales: number
    totalRevenue: number
    totalDiscount: number
    averageSaleAmount: number
  }
}

export default function CashierSalesHistoryPage() {
  const { can } = usePermissions()
  const { data: session } = useSession()

  if (!can(PERMISSIONS.REPORT_SALES_HISTORY)) {
    return (
      <div className="text-center py-12">
        <p className="text-red-600 dark:text-red-400">You do not have permission to view this report</p>
      </div>
    )
  }

  const [reportData, setReportData] = useState<SalesHistoryData | null>(null)
  const [loading, setLoading] = useState(true)
  const [userLocationName, setUserLocationName] = useState<string>("Loading...")
  const [userLocationId, setUserLocationId] = useState<number | null>(null)

  // Default to last 7 days
  const getDefaultStartDate = () => {
    const date = new Date()
    date.setDate(date.getDate() - 7)
    return date.toISOString().split('T')[0]
  }

  const getDefaultEndDate = () => {
    return new Date().toISOString().split('T')[0]
  }

  const [startDate, setStartDate] = useState(getDefaultStartDate())
  const [endDate, setEndDate] = useState(getDefaultEndDate())

  useEffect(() => {
    fetchUserLocation()
  }, [])

  useEffect(() => {
    if (userLocationId) {
      fetchReport()
    }
  }, [userLocationId, startDate, endDate])

  const fetchUserLocation = async () => {
    try {
      const locationResponse = await fetch("/api/user-locations")
      if (!locationResponse.ok) {
        throw new Error("Failed to fetch user location")
      }

      const locationData = await locationResponse.json()
      const userLocations = locationData.locations || []

      if (userLocations.length === 0) {
        setUserLocationName("No Location Assigned")
        setLoading(false)
        return
      }

      const userLocation = userLocations[0]
      setUserLocationName(userLocation.name)
      setUserLocationId(userLocation.id)
    } catch (error) {
      console.error("Error fetching user location:", error)
      setLoading(false)
    }
  }

  const fetchReport = async () => {
    if (!userLocationId) return

    try {
      setLoading(true)
      const response = await fetch(
        `/api/reports/sales-history?locationId=${userLocationId}&startDate=${startDate}&endDate=${endDate}`
      )

      if (!response.ok) {
        throw new Error("Failed to fetch sales history")
      }

      const data = await response.json()
      setReportData(data)
    } catch (error) {
      console.error("Error fetching sales history:", error)
      setReportData(null)
    } finally {
      setLoading(false)
    }
  }

  const handlePrint = () => {
    window.print()
  }

  const handleExportExcel = async () => {
    if (!reportData) return

    try {
      const response = await fetch("/api/reports/sales-history/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          data: reportData,
          format: "excel",
          locationName: userLocationName,
          startDate,
          endDate,
        }),
      })

      if (!response.ok) throw new Error("Export failed")

      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `cashier-sales-history-${startDate}-to-${endDate}.xlsx`
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

  if (!userLocationId) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-600 dark:text-gray-400">No location assigned to your account</p>
      </div>
    )
  }

  const { sales, summary } = reportData || { sales: [], summary: { totalSales: 0, totalRevenue: 0, totalDiscount: 0, averageSaleAmount: 0 } }

  return (
    <div className="space-y-6 p-6 bg-gray-50 dark:bg-gray-900 min-h-screen">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow">
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Cashier Sales History</h1>
            <div className="flex items-center gap-2 mt-1">
              <MapPinIcon className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Location: <span className="font-semibold text-gray-900 dark:text-white">{userLocationName}</span>
              </p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-2 w-full lg:w-auto">
            <div className="flex gap-2">
              <div>
                <Label htmlFor="startDate" className="text-xs">From</Label>
                <Input
                  id="startDate"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="text-sm"
                />
              </div>
              <div>
                <Label htmlFor="endDate" className="text-xs">To</Label>
                <Input
                  id="endDate"
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="text-sm"
                />
              </div>
            </div>
            <div className="flex gap-2 items-end">
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
            <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">Transactions</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Revenue</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600 dark:text-green-400">
              {formatCurrency(summary.totalRevenue)}
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">Period total</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400">Average Sale</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
              {formatCurrency(summary.averageSaleAmount)}
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">Per transaction</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Discounts</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600 dark:text-orange-400">
              {formatCurrency(summary.totalDiscount)}
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">Discount given</p>
          </CardContent>
        </Card>
      </div>

      {/* Sales Table */}
      <Card>
        <CardHeader>
          <CardTitle>Sales Transactions ({sales.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Invoice #</TableHead>
                  <TableHead>Date & Time</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead className="text-right">Discount</TableHead>
                  <TableHead>Payment Status</TableHead>
                  <TableHead className="text-center">Items</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sales.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-gray-500 dark:text-gray-500 py-8">
                      No sales found for the selected period
                    </TableCell>
                  </TableRow>
                ) : (
                  sales.map((sale) => (
                    <TableRow key={sale.id} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                      <TableCell className="font-medium">{sale.invoiceNumber}</TableCell>
                      <TableCell>
                        <div>
                          <div className="font-medium">{new Date(sale.saleDate).toLocaleDateString()}</div>
                          <div className="text-xs text-gray-500 dark:text-gray-500">
                            {new Date(sale.saleDate).toLocaleTimeString()}
                          </div>
                        </div>
                      </TableCell>
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
                        <Badge
                          variant={sale.paymentStatus === "paid" ? "default" : "secondary"}
                          className={
                            sale.paymentStatus === "paid"
                              ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                              : "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200"
                          }
                        >
                          {sale.paymentStatus}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="outline">{sale.itemCount}</Badge>
                      </TableCell>
                    </TableRow>
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
