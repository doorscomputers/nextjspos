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
import { Badge } from "@/components/ui/badge"

export default function CashierSalesJournalPage() {
  const { can } = usePermissions()

  if (!can(PERMISSIONS.SALES_REPORT_JOURNAL)) {
    return <div className="text-center py-12"><p className="text-red-600 dark:text-red-400">Access denied</p></div>
  }

  const [loading, setLoading] = useState(false)
  const [userLocationName, setUserLocationName] = useState("Loading...")
  const [userLocationId, setUserLocationId] = useState<number | null>(null)
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0])
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0])
  const [journal, setJournal] = useState<any[]>([])

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

  const fetchJournal = async () => {
    if (!userLocationId) return
    setLoading(true)
    try {
      const res = await fetch(`/api/reports/sales-journal?locationId=${userLocationId}&startDate=${startDate}&endDate=${endDate}`)
      const data = await res.json()
      setJournal(data.journal || [])
    } catch (error) {
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (userLocationId) fetchJournal()
  }, [userLocationId, startDate, endDate])

  return (
    <div className="space-y-6 p-6 bg-gray-50 dark:bg-gray-900 min-h-screen">
      <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow">
        <div className="flex justify-between items-start gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Sales Journal (Cashier)</h1>
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
          </div>
        </div>
      </div>

      <Card>
        <CardHeader><CardTitle>Sales Journal Entries ({journal.length})</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Invoice #</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Account</TableHead>
                <TableHead className="text-right">Debit</TableHead>
                <TableHead className="text-right">Credit</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={6} className="text-center py-8">Loading...</TableCell></TableRow>
              ) : journal.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center py-8 text-gray-500">No journal entries</TableCell></TableRow>
              ) : (
                journal.map((entry, idx) => (
                  <TableRow key={idx}>
                    <TableCell>{new Date(entry.date).toLocaleDateString()}</TableCell>
                    <TableCell className="font-medium">{entry.invoiceNumber}</TableCell>
                    <TableCell>{entry.customer}</TableCell>
                    <TableCell>{entry.account}</TableCell>
                    <TableCell className="text-right">{entry.debit > 0 ? formatCurrency(entry.debit) : "-"}</TableCell>
                    <TableCell className="text-right">{entry.credit > 0 ? formatCurrency(entry.credit) : "-"}</TableCell>
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
