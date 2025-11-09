"use client"

import { useState, useEffect } from "react"
import { usePermissions } from "@/hooks/usePermissions"
import { PERMISSIONS } from "@/lib/rbac"
import { formatCurrency } from "@/lib/currencyUtils"
import { MapPinIcon, CalendarIcon, ArrowDownTrayIcon, PrinterIcon } from "@heroicons/react/24/outline"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

export default function CashierSalesPerItemPage() {
  const { can } = usePermissions()

  if (!can(PERMISSIONS.SALES_REPORT_PER_ITEM)) {
    return <div className="text-center py-12"><p className="text-red-600 dark:text-red-400">Access denied</p></div>
  }

  const [loading, setLoading] = useState(false)
  const [userLocationName, setUserLocationName] = useState("Loading...")
  const [userLocationId, setUserLocationId] = useState<number | null>(null)
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0])
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0])
  const [items, setItems] = useState<any[]>([])
  const [summary, setSummary] = useState({ totalQuantity: 0, totalRevenue: 0 })

  useEffect(() => {
    fetchUserLocation()
  }, [])

  const fetchUserLocation = async () => {
    const res = await fetch("/api/user-locations")
    if (res.ok) {
      const data = await res.json()
      if (data.locations?.length > 0) {
        setUserLocationName(data.locations[0].name)
        setUserLocationId(data.locations[0].id)
      }
    }
  }

  const fetchReport = async () => {
    if (!userLocationId) return
    setLoading(true)
    try {
      const res = await fetch(`/api/reports/sales-per-item?locationId=${userLocationId}&startDate=${startDate}&endDate=${endDate}`)
      const data = await res.json()
      setItems(data.items || [])
      setSummary(data.summary || { totalQuantity: 0, totalRevenue: 0 })
    } catch (error) {
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (userLocationId) fetchReport()
  }, [userLocationId, startDate, endDate])

  const handleExport = () => {
    const csv = [
      ['Product', 'SKU', 'Quantity Sold', 'Unit Price', 'Total Revenue'],
      ...items.map(item => [
        item.productName,
        item.sku,
        item.quantitySold,
        item.averagePrice,
        item.totalRevenue
      ])
    ].map(row => row.join(',')).join('\n')

    const blob = new Blob([csv], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `sales-per-item-${startDate}-to-${endDate}.csv`
    a.click()
    window.URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-6 p-6 bg-gray-50 dark:bg-gray-900 min-h-screen">
      <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow">
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Sales Per Item (Cashier)</h1>
            <div className="flex items-center gap-2 mt-1">
              <MapPinIcon className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              <span className="text-sm text-gray-600 dark:text-gray-400">Location: <strong>{userLocationName}</strong></span>
            </div>
          </div>
          <div className="flex gap-2">
            <div>
              <Label className="text-xs">From</Label>
              <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">To</Label>
              <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </div>
            <div className="flex items-end">
              <Button variant="outline" size="sm" onClick={handleExport} className="gap-2">
                <ArrowDownTrayIcon className="h-4 w-4" />
                Export CSV
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Quantity Sold</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-900 dark:text-white">{summary.totalQuantity}</div>
            <p className="text-xs text-gray-500 mt-1">Units sold</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Revenue</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600 dark:text-green-400">{formatCurrency(summary.totalRevenue)}</div>
            <p className="text-xs text-gray-500 mt-1">From item sales</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Items Sold ({items.length})</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Product Name</TableHead>
                <TableHead>SKU</TableHead>
                <TableHead className="text-right">Qty Sold</TableHead>
                <TableHead className="text-right">Avg Price</TableHead>
                <TableHead className="text-right">Total Revenue</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={5} className="text-center py-8">Loading...</TableCell></TableRow>
              ) : items.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="text-center py-8 text-gray-500">No items sold</TableCell></TableRow>
              ) : (
                items.map((item, idx) => (
                  <TableRow key={idx} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                    <TableCell className="font-medium">{item.productName}</TableCell>
                    <TableCell className="text-sm text-gray-600 dark:text-gray-400">{item.sku}</TableCell>
                    <TableCell className="text-right">{item.quantitySold}</TableCell>
                    <TableCell className="text-right">{formatCurrency(item.averagePrice)}</TableCell>
                    <TableCell className="text-right font-semibold text-green-600 dark:text-green-400">
                      {formatCurrency(item.totalRevenue)}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
