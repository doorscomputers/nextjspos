"use client"

import { useState, useEffect } from "react"
import { usePermissions } from "@/hooks/usePermissions"
import { PERMISSIONS } from "@/lib/rbac"
import { formatCurrency } from "@/lib/currencyUtils"
import {
  CurrencyDollarIcon,
  ShoppingCartIcon,
  ArrowTrendingUpIcon,
  ArrowTrendingDownIcon,
  BanknotesIcon,
  ReceiptRefundIcon,
  ExclamationTriangleIcon,
  TruckIcon,
} from "@heroicons/react/24/outline"
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"

interface DashboardStats {
  metrics: {
    totalSales: number
    netAmount: number
    invoiceDue: number
    totalSellReturn: number
    totalPurchase: number
    purchaseDue: number
    totalPurchaseReturn: number
    expense: number
    salesCount: number
    purchaseCount: number
  }
  charts: {
    salesLast30Days: Array<{ date: string; amount: number }>
    salesCurrentYear: Array<{ date: string; amount: number }>
  }
  tables: {
    stockAlerts: Array<{
      id: number
      productName: string
      variationName: string
      sku: string
      currentQty: number
      alertQty: number
    }>
    pendingShipments: Array<{
      id: number
      transferNumber: string
      from: string
      to: string
      status: string
      date: string
    }>
    salesPaymentDue: Array<{
      id: number
      invoiceNumber: string
      customer: string
      date: string
      amount: number
    }>
    purchasePaymentDue: Array<{
      id: number
      purchaseOrderNumber: string
      supplier: string
      date: string
      amount: number
    }>
  }
}

export default function DashboardPage() {
  const { can, user } = usePermissions()
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [locationFilter, setLocationFilter] = useState("all")
  const [locations, setLocations] = useState<Array<{ id: number; name: string }>>([])
  const [showAllLocationsOption, setShowAllLocationsOption] = useState(false)

  useEffect(() => {
    fetchLocations()
  }, [])

  useEffect(() => {
    fetchDashboardStats()
  }, [locationFilter])

  const fetchLocations = async () => {
    try {
      const response = await fetch("/api/locations")
      if (response.ok) {
        const data = await response.json()
        const fetchedLocations = Array.isArray(data.locations) ? data.locations : (Array.isArray(data) ? data : [])
        setLocations(fetchedLocations)

        // Only show "All Locations" option if user has access to multiple locations
        // If user has only 1 location, auto-select it and hide the "All" option
        if (fetchedLocations.length > 1) {
          setShowAllLocationsOption(true)
          setLocationFilter("all")
        } else if (fetchedLocations.length === 1) {
          // User has only one location - auto-select it
          setShowAllLocationsOption(false)
          setLocationFilter(fetchedLocations[0].id.toString())
        } else {
          // User has no locations
          setShowAllLocationsOption(false)
          setLocations([])
        }
      } else {
        console.error("Failed to fetch locations, status:", response.status)
        setLocations([])
      }
    } catch (error) {
      console.error("Failed to fetch locations:", error)
      setLocations([])
    }
  }

  const fetchDashboardStats = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams()
      if (locationFilter !== "all") {
        params.append("locationId", locationFilter)
      }

      const response = await fetch(`/api/dashboard/stats?${params.toString()}`)
      if (response.ok) {
        const data = await response.json()
        console.log('Dashboard stats received:', data)
        console.log('Stock alerts count:', data.tables?.stockAlerts?.length)
        console.log('Stock alerts data:', data.tables?.stockAlerts)
        setStats(data)
      }
    } catch (error) {
      console.error("Failed to fetch dashboard stats:", error)
    } finally {
      setLoading(false)
    }
  }

  const formatAmount = (amount: number) => {
    return formatCurrency(amount)
  }

  const metricCards = [
    {
      name: "Total Sales",
      value: stats?.metrics.totalSales || 0,
      icon: CurrencyDollarIcon,
      color: "bg-blue-50 text-blue-600",
      permission: PERMISSIONS.SELL_VIEW,
    },
    {
      name: "Net Amount",
      value: stats?.metrics.netAmount || 0,
      icon: BanknotesIcon,
      color: "bg-green-50 text-green-600",
      permission: PERMISSIONS.SELL_VIEW,
    },
    {
      name: "Invoice Due",
      value: stats?.metrics.invoiceDue || 0,
      icon: ArrowTrendingUpIcon,
      color: "bg-orange-50 text-orange-600",
      permission: PERMISSIONS.SELL_VIEW,
    },
    {
      name: "Total Sell Return",
      value: stats?.metrics.totalSellReturn || 0,
      icon: ReceiptRefundIcon,
      color: "bg-red-50 text-red-600",
      permission: PERMISSIONS.CUSTOMER_RETURN_VIEW,
    },
    {
      name: "Total Purchase",
      value: stats?.metrics.totalPurchase || 0,
      icon: ShoppingCartIcon,
      color: "bg-purple-50 text-purple-600",
      permission: PERMISSIONS.PURCHASE_VIEW,
    },
    {
      name: "Purchase Due",
      value: stats?.metrics.purchaseDue || 0,
      icon: ArrowTrendingDownIcon,
      color: "bg-yellow-50 text-yellow-600",
      permission: PERMISSIONS.PURCHASE_VIEW,
    },
    {
      name: "Total Purchase Return",
      value: stats?.metrics.totalPurchaseReturn || 0,
      icon: ReceiptRefundIcon,
      color: "bg-pink-50 text-pink-600",
      permission: PERMISSIONS.SUPPLIER_RETURN_VIEW,
    },
    {
      name: "Expense",
      value: stats?.metrics.expense || 0,
      icon: BanknotesIcon,
      color: "bg-gray-50 text-gray-600",
      permission: PERMISSIONS.EXPENSE_VIEW,
    },
  ]

  const filteredMetrics = metricCards.filter(
    (metric) => !metric.permission || can(metric.permission)
  )

  if (loading && !stats) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header with Location Filter */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-gray-100">
            Dashboard Overview
          </h1>
          <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-300 mt-1">
            Welcome back, {user?.name}
          </p>
        </div>

        {locations.length > 0 && (
          <div className="flex items-center gap-3">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-200">Location:</label>
            <Select value={locationFilter} onValueChange={setLocationFilter}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Select location" />
              </SelectTrigger>
              <SelectContent>
                {showAllLocationsOption && (
                  <SelectItem value="all">All Locations</SelectItem>
                )}
                {locations.map((location) => (
                  <SelectItem key={location.id} value={location.id.toString()}>
                    {location.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      {/* Metric Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {filteredMetrics.map((metric) => {
          const Icon = metric.icon
          return (
            <Card key={metric.name} className="hover:shadow-lg transition-shadow">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600 dark:text-gray-300">{metric.name}</p>
                    <p className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-gray-100 mt-2">
                      {formatAmount(metric.value)}
                    </p>
                  </div>
                  <div className={`p-3 rounded-full ${metric.color}`}>
                    <Icon className="h-6 w-6" />
                  </div>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Charts Section */}
      {can(PERMISSIONS.SELL_VIEW) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Sales Last 30 Days */}
          <Card>
            <CardHeader>
              <CardTitle>Sales Last 30 Days</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={stats?.charts.salesLast30Days || []}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" fontSize={12} />
                  <YAxis fontSize={12} />
                  <Tooltip
                    formatter={(value: number) => formatAmount(value)}
                  />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="amount"
                    stroke="#3b82f6"
                    strokeWidth={2}
                    name="Sales"
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Sales Current Financial Year */}
          <Card>
            <CardHeader>
              <CardTitle>Sales Current Financial Year</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={stats?.charts.salesCurrentYear || []}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" fontSize={12} />
                  <YAxis fontSize={12} />
                  <Tooltip
                    formatter={(value: number) => formatAmount(value)}
                  />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="amount"
                    stroke="#10b981"
                    strokeWidth={2}
                    name="Sales"
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Tables Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Sales Payment Due */}
        {can(PERMISSIONS.SELL_VIEW) && (
          <Card>
            <CardHeader>
              <CardTitle>Sales Payment Due</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Invoice</TableHead>
                      <TableHead>Customer</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {stats?.tables.salesPaymentDue.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center text-gray-500 dark:text-gray-400">
                          No payment due
                        </TableCell>
                      </TableRow>
                    ) : (
                      stats?.tables.salesPaymentDue.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell className="font-medium">{item.invoiceNumber}</TableCell>
                          <TableCell>{item.customer}</TableCell>
                          <TableCell>{item.date}</TableCell>
                          <TableCell className="text-right">
                            {formatAmount(item.amount)}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Purchase Payment Due */}
        {can(PERMISSIONS.PURCHASE_VIEW) && (
          <Card>
            <CardHeader>
              <CardTitle>Purchase Payment Due</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>PO Number</TableHead>
                      <TableHead>Supplier</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {stats?.tables.purchasePaymentDue.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center text-gray-500 dark:text-gray-400">
                          No payment due
                        </TableCell>
                      </TableRow>
                    ) : (
                      stats?.tables.purchasePaymentDue.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell className="font-medium">{item.purchaseOrderNumber}</TableCell>
                          <TableCell>{item.supplier}</TableCell>
                          <TableCell>{item.date}</TableCell>
                          <TableCell className="text-right">
                            {formatAmount(item.amount)}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Product Stock Alert Summary */}
        {can(PERMISSIONS.PRODUCT_VIEW) && (
          <Card className="hover:shadow-lg transition-shadow cursor-pointer" onClick={() => window.location.href = '/dashboard/reports/stock-alert'}>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ExclamationTriangleIcon className="h-5 w-5 text-orange-600" />
                  Low Stock Alert
                </div>
                <Badge variant="destructive" className="text-lg px-3 py-1">
                  {stats?.tables.stockAlerts.length || 0}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <p className="text-sm text-gray-600 dark:text-gray-300">
                  {stats?.tables.stockAlerts.length === 0
                    ? "All products are well stocked"
                    : `${stats?.tables.stockAlerts.length} product(s) below alert level`}
                </p>
                <button
                  className="w-full mt-4 px-6 py-2.5 bg-gradient-to-r from-orange-600 to-orange-500 hover:from-orange-700 hover:to-orange-600 dark:from-orange-500 dark:to-orange-400 dark:hover:from-orange-600 dark:hover:to-orange-500 text-white rounded-lg transition-all duration-200 flex items-center justify-center gap-2 font-semibold shadow-lg hover:shadow-xl hover:scale-105"
                  onClick={(e) => {
                    e.stopPropagation()
                    window.location.href = '/dashboard/reports/stock-alert'
                  }}
                >
                  <ExclamationTriangleIcon className="h-5 w-5" />
                  View Detailed Report
                </button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Pending Shipments */}
        {can(PERMISSIONS.STOCK_TRANSFER_VIEW) && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TruckIcon className="h-5 w-5 text-blue-600" />
                Pending Shipments
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Transfer #</TableHead>
                      <TableHead>Route</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {stats?.tables.pendingShipments.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center text-gray-500 dark:text-gray-400">
                          No pending shipments
                        </TableCell>
                      </TableRow>
                    ) : (
                      stats?.tables.pendingShipments.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell className="font-medium">{item.transferNumber}</TableCell>
                          <TableCell>
                            <div className="text-sm">
                              <span className="text-gray-600 dark:text-gray-400">{item.from}</span>
                              {" → "}
                              <span className="text-gray-900 dark:text-gray-100">{item.to}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="capitalize">
                              {item.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm">{item.date}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
