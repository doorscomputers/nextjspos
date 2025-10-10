"use client"

import { useState, useEffect } from "react"
import { usePermissions } from "@/hooks/usePermissions"
import { PERMISSIONS } from "@/lib/rbac"
import {
  ExclamationTriangleIcon,
  PrinterIcon,
  ArrowLeftIcon,
  FunnelIcon,
} from "@heroicons/react/24/outline"
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
import { useRouter } from "next/navigation"

interface StockAlert {
  id: number
  productId: number
  productName: string
  variationName: string
  sku: string
  category: string
  locationId: number
  locationName: string
  currentQty: number
  alertQty: number
  difference: number
  percentageOfAlert: number
}

interface ReportData {
  locationId: string
  locationName: string
  totalProducts: number
  lowStockCount: number
  alerts: StockAlert[]
}

export default function StockAlertReportPage() {
  const { can, user } = usePermissions()
  const router = useRouter()
  const [reportData, setReportData] = useState<ReportData | null>(null)
  const [loading, setLoading] = useState(true)
  const [locationFilter, setLocationFilter] = useState("all")
  const [locations, setLocations] = useState<Array<{ id: number; name: string }>>([])

  useEffect(() => {
    if (!can(PERMISSIONS.PRODUCT_VIEW)) {
      router.push('/dashboard')
      return
    }
    fetchLocations()
  }, [])

  useEffect(() => {
    if (locations.length > 0) {
      fetchReportData()
    }
  }, [locationFilter, locations])

  const fetchLocations = async () => {
    try {
      const response = await fetch("/api/locations")
      if (response.ok) {
        const data = await response.json()
        if (Array.isArray(data.locations)) {
          setLocations(data.locations)
        } else if (Array.isArray(data)) {
          setLocations(data)
        }
      }
    } catch (error) {
      console.error("Failed to fetch locations:", error)
    }
  }

  const fetchReportData = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams()
      if (locationFilter !== "all") {
        params.append("locationId", locationFilter)
      }

      const response = await fetch(`/api/reports/stock-alert?${params.toString()}`)
      if (response.ok) {
        const result = await response.json()
        setReportData(result.data)
      }
    } catch (error) {
      console.error("Failed to fetch report data:", error)
    } finally {
      setLoading(false)
    }
  }

  const handlePrint = () => {
    window.print()
  }

  const getStatusColor = (percentage: number) => {
    if (percentage <= 25) return "bg-red-100 text-red-800"
    if (percentage <= 50) return "bg-orange-100 text-orange-800"
    if (percentage <= 75) return "bg-yellow-100 text-yellow-800"
    return "bg-blue-100 text-blue-800"
  }

  const getStatusLabel = (percentage: number) => {
    if (percentage <= 25) return "Critical"
    if (percentage <= 50) return "Low"
    if (percentage <= 75) return "Warning"
    return "Alert"
  }

  if (!can(PERMISSIONS.PRODUCT_VIEW)) {
    return null
  }

  if (loading && !reportData) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-600"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header - Hidden when printing */}
      <div className="print:hidden">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.back()}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <ArrowLeftIcon className="h-5 w-5 text-gray-600" />
            </button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                <ExclamationTriangleIcon className="h-7 w-7 text-orange-600" />
                Stock Alert Report
              </h1>
              <p className="text-sm text-gray-600 mt-1">
                Products below alert quantity levels
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <FunnelIcon className="h-5 w-5 text-gray-600" />
            <Select value={locationFilter} onValueChange={setLocationFilter}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="All Locations" />
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

            <button
              onClick={handlePrint}
              className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors flex items-center gap-2"
            >
              <PrinterIcon className="h-5 w-5" />
              Print Report
            </button>
          </div>
        </div>
      </div>

      {/* Print Header - Only visible when printing */}
      <div className="hidden print:block mb-6">
        <div className="text-center border-b-2 border-gray-300 pb-4">
          <h1 className="text-3xl font-bold text-gray-900">Stock Alert Report</h1>
          <p className="text-lg text-gray-600 mt-2">{user?.businessName || 'Business Name'}</p>
          <p className="text-sm text-gray-500 mt-1">
            Location: {reportData?.locationName || 'All Locations'}
          </p>
          <p className="text-sm text-gray-500">
            Generated on: {new Date().toLocaleDateString()} at {new Date().toLocaleTimeString()}
          </p>
          <p className="text-sm text-gray-500">
            Generated by: {user?.name || 'User'}
          </p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 print:grid-cols-3 print:gap-2">
        <Card className="print:shadow-none print:border">
          <CardContent className="p-6 print:p-3">
            <div className="text-center">
              <p className="text-sm font-medium text-gray-600">Total Products Monitored</p>
              <p className="text-3xl font-bold text-gray-900 mt-2 print:text-2xl">
                {reportData?.totalProducts || 0}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="print:shadow-none print:border">
          <CardContent className="p-6 print:p-3">
            <div className="text-center">
              <p className="text-sm font-medium text-gray-600">Low Stock Items</p>
              <p className="text-3xl font-bold text-orange-600 mt-2 print:text-2xl">
                {reportData?.lowStockCount || 0}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="print:shadow-none print:border">
          <CardContent className="p-6 print:p-3">
            <div className="text-center">
              <p className="text-sm font-medium text-gray-600">Stock Health</p>
              <p className="text-3xl font-bold text-green-600 mt-2 print:text-2xl">
                {reportData?.totalProducts && reportData?.lowStockCount
                  ? Math.round(((reportData.totalProducts - reportData.lowStockCount) / reportData.totalProducts) * 100)
                  : 100}%
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Report Table */}
      <Card className="print:shadow-none print:border">
        <CardHeader className="print:py-2">
          <CardTitle>Detailed Stock Alert List</CardTitle>
        </CardHeader>
        <CardContent className="print:p-2">
          {reportData?.alerts.length === 0 ? (
            <div className="text-center py-12">
              <ExclamationTriangleIcon className="h-16 w-16 text-gray-300 mx-auto mb-4" />
              <p className="text-lg font-medium text-gray-600">No Low Stock Alerts</p>
              <p className="text-sm text-gray-500 mt-2">
                All products are currently above their alert quantity levels
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="print:border-b-2">
                    <TableHead className="print:py-2">Product</TableHead>
                    <TableHead className="print:py-2">Category</TableHead>
                    <TableHead className="print:py-2">SKU</TableHead>
                    <TableHead className="print:py-2">Location</TableHead>
                    <TableHead className="text-right print:py-2">Current Qty</TableHead>
                    <TableHead className="text-right print:py-2">Alert Qty</TableHead>
                    <TableHead className="text-right print:py-2">Shortage</TableHead>
                    <TableHead className="text-center print:py-2">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {reportData?.alerts.map((item) => (
                    <TableRow key={item.id} className="print:break-inside-avoid">
                      <TableCell className="print:py-2">
                        <div>
                          <p className="font-medium text-sm">{item.productName}</p>
                          <p className="text-xs text-gray-500">{item.variationName}</p>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm print:py-2">{item.category}</TableCell>
                      <TableCell className="text-sm font-mono print:py-2">{item.sku}</TableCell>
                      <TableCell className="text-sm print:py-2">{item.locationName}</TableCell>
                      <TableCell className="text-right font-semibold print:py-2">
                        <Badge variant="destructive" className="print:border print:bg-transparent print:text-black">
                          {item.currentQty}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right text-sm print:py-2">{item.alertQty}</TableCell>
                      <TableCell className="text-right text-sm font-semibold text-red-600 print:py-2">
                        {item.difference > 0 ? item.difference.toFixed(0) : '0'}
                      </TableCell>
                      <TableCell className="text-center print:py-2">
                        <Badge
                          className={`${getStatusColor(item.percentageOfAlert)} print:border print:bg-transparent print:text-black`}
                        >
                          {getStatusLabel(item.percentageOfAlert)}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Print Footer */}
      <div className="hidden print:block mt-8 pt-4 border-t border-gray-300 text-center text-xs text-gray-500">
        <p>This is a computer-generated report. For any discrepancies, please contact the inventory manager.</p>
        <p className="mt-1">Report ID: {Date.now()} | Page 1 of 1</p>
      </div>
    </div>
  )
}
