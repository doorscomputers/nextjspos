---
name: pos-report-builder
description: Creates standardized reports for UltimatePOS with proper formatting, export options, and BIR compliance
---

# POS Report Builder Skill

This skill provides templates and patterns for creating consistent, professional reports in the UltimatePOS Modern system with proper multi-tenant isolation, date filtering, and export capabilities.

## Report Types

### 1. Sales Reports
- Daily Sales Report
- Sales Journal (itemized transactions)
- Sales by Cashier
- Sales by Item/Product
- Sales History (date range)

### 2. Inventory Reports
- Stock Levels Report
- Stock Movement History
- Low Stock Alert
- Inventory Valuation
- Stock Transfer Report

### 3. Purchase Reports
- Purchase Orders Report
- Purchase Receipts Report
- Purchases by Supplier
- Purchase Items Report

### 4. Financial Reports
- Profit Report
- Profitability Analysis
- Accounts Payable
- Cash Flow Report

### 5. BIR-Compliant Reports (Philippines)
- X Reading (mid-shift)
- Z Reading (end-of-day)
- Sales Summary for BIR
- Discount/Void Transaction Report

## Standard Report Structure

### API Route Pattern

```typescript
// src/app/api/reports/[report-name]/route.ts
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { hasPermission, PERMISSIONS } from '@/lib/rbac'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (!hasPermission(session.user, PERMISSIONS.REPORT_VIEW)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const startDate = searchParams.get('startDate')
  const endDate = searchParams.get('endDate')
  const locationId = searchParams.get('locationId')

  // Build date filter
  const dateFilter = startDate && endDate ? {
    createdAt: {
      gte: new Date(startDate),
      lte: new Date(endDate),
    }
  } : {}

  // Build location filter
  const locationFilter = locationId ? {
    businessLocationId: locationId
  } : {}

  const data = await prisma.yourModel.findMany({
    where: {
      businessId: session.user.businessId,
      ...dateFilter,
      ...locationFilter,
    },
    include: {
      // ... relations
    },
    orderBy: { createdAt: 'desc' }
  })

  // Calculate totals and metrics
  const summary = {
    totalRecords: data.length,
    totalAmount: data.reduce((sum, item) => sum + item.amount, 0),
    // ... other metrics
  }

  return NextResponse.json({ data, summary })
}
```

### Page Component Pattern

```typescript
// src/app/dashboard/reports/[report-name]/page.tsx
'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { format } from 'date-fns'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'

export default function ReportPage() {
  const [startDate, setStartDate] = useState<Date>(new Date())
  const [endDate, setEndDate] = useState<Date>(new Date())
  const [locationId, setLocationId] = useState<string>('')

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['report', startDate, endDate, locationId],
    queryFn: async () => {
      const params = new URLSearchParams({
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        ...(locationId && { locationId }),
      })
      const res = await fetch(`/api/reports/report-name?${params}`)
      return res.json()
    },
  })

  const handleExportPDF = async () => {
    // PDF export logic
  }

  const handleExportExcel = async () => {
    // Excel export logic
  }

  return (
    <div className="container mx-auto p-6">
      <Card>
        <CardHeader>
          <CardTitle>Report Title</CardTitle>
        </CardHeader>
        <CardContent>
          {/* Filters */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div>
              <label>Start Date</label>
              {/* Date picker */}
            </div>
            <div>
              <label>End Date</label>
              {/* Date picker */}
            </div>
            <div>
              <label>Location</label>
              {/* Location select */}
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex gap-2 mb-4">
            <Button onClick={() => refetch()}>Generate Report</Button>
            <Button onClick={handleExportPDF} variant="outline">Export PDF</Button>
            <Button onClick={handleExportExcel} variant="outline">Export Excel</Button>
          </div>

          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <Card>
              <CardContent className="pt-6">
                <div className="text-2xl font-bold">{data?.summary?.totalAmount}</div>
                <div className="text-sm text-muted-foreground">Total Amount</div>
              </CardContent>
            </Card>
            {/* More summary cards */}
          </div>

          {/* Data Table */}
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Column 1</TableHead>
                <TableHead>Column 2</TableHead>
                {/* More columns */}
              </TableRow>
            </TableHeader>
            <TableBody>
              {data?.data?.map((item: any) => (
                <TableRow key={item.id}>
                  <TableCell>{item.field1}</TableCell>
                  <TableCell>{item.field2}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
```

## Date Range Filtering

Standard date range component:

```typescript
import { addDays, startOfDay, endOfDay } from 'date-fns'

// Quick filters
const dateRanges = {
  today: {
    start: startOfDay(new Date()),
    end: endOfDay(new Date()),
  },
  yesterday: {
    start: startOfDay(addDays(new Date(), -1)),
    end: endOfDay(addDays(new Date(), -1)),
  },
  last7Days: {
    start: startOfDay(addDays(new Date(), -7)),
    end: endOfDay(new Date()),
  },
  thisMonth: {
    start: startOfDay(new Date(new Date().getFullYear(), new Date().getMonth(), 1)),
    end: endOfDay(new Date()),
  },
  lastMonth: {
    start: startOfDay(new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1)),
    end: endOfDay(new Date(new Date().getFullYear(), new Date().getMonth(), 0)),
  },
}
```

## Export Functionality

### PDF Export (using jsPDF)

```typescript
import jsPDF from 'jspdf'
import 'jspdf-autotable'

const exportToPDF = (data: any[], summary: any) => {
  const doc = new jsPDF()

  // Header
  doc.setFontSize(18)
  doc.text('Report Title', 14, 20)
  doc.setFontSize(11)
  doc.text(`Generated: ${format(new Date(), 'PPpp')}`, 14, 28)
  doc.text(`Date Range: ${format(startDate, 'PP')} - ${format(endDate, 'PP')}`, 14, 34)

  // Summary
  doc.text(`Total Amount: ${summary.totalAmount}`, 14, 44)

  // Table
  doc.autoTable({
    startY: 50,
    head: [['Column 1', 'Column 2', 'Column 3']],
    body: data.map(item => [item.col1, item.col2, item.col3]),
  })

  doc.save('report.pdf')
}
```

### Excel Export (using xlsx)

```typescript
import * as XLSX from 'xlsx'

const exportToExcel = (data: any[]) => {
  const worksheet = XLSX.utils.json_to_sheet(data)
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Report')
  XLSX.writeFile(workbook, 'report.xlsx')
}
```

## BIR Compliance (Philippines)

### X Reading (Mid-Shift Report)

```typescript
const generateXReading = async (cashierId: string, shiftDate: Date) => {
  // Get all sales for current shift (not reset)
  const sales = await prisma.sale.findMany({
    where: {
      businessId: session.user.businessId,
      userId: cashierId,
      createdAt: {
        gte: startOfDay(shiftDate),
        lte: endOfDay(shiftDate),
      },
      void: false,
    }
  })

  return {
    title: 'X READING',
    shiftDate: format(shiftDate, 'PP'),
    cashier: cashierName,
    totalSales: sales.reduce((sum, s) => sum + s.total, 0),
    transactionCount: sales.length,
    // Include discounts, voids, etc.
  }
}
```

### Z Reading (End-of-Day with Reset)

```typescript
const generateZReading = async (locationId: string, date: Date) => {
  // Similar to X Reading but marks shift as closed
  // Includes running totals and resets counters

  return {
    title: 'Z READING',
    date: format(date, 'PP'),
    location: locationName,
    grossSales: totalGross,
    discounts: totalDiscounts,
    netSales: netSales,
    voids: voidCount,
    refunds: refundCount,
    runningTotal: cumulativeTotal,
  }
}
```

## Responsive Design

Ensure reports are mobile-friendly:

```typescript
<div className="overflow-x-auto">
  <Table className="min-w-full">
    {/* Table content */}
  </Table>
</div>

{/* Summary cards stack on mobile */}
<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
  {/* Cards */}
</div>
```

## When to Use This Skill

Invoke this skill when:

- Creating new report pages
- Adding export functionality
- Implementing BIR-compliant reports
- Building financial summaries
- Designing report filters and date ranges
- Formatting report tables and layouts
