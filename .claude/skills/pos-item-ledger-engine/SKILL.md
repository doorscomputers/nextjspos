---
name: pos-item-ledger-engine
description: Generates comprehensive item-level transaction history reports (item ledgers) showing all inventory 
---

# pos-item-ledger-engine

## Purpose
Generates comprehensive item-level transaction history reports (item ledgers) showing all inventory movements with running balances, financial impacts, and variance detection. Essential for inventory auditing and reconciliation.

## When to Use
- Creating inventory ledger reports
- Auditing product movement history
- Reconciling physical counts with system records
- Investigating stock discrepancies
- Generating period-end inventory reports
- Compliance reporting and external audits

## Critical Requirements

### 1. Complete Transaction History
Item ledger MUST include:
- **Opening balance** (from opening stock or last correction)
- **All transactions** chronologically (purchases, sales, transfers, corrections, returns)
- **Running balance** after each transaction
- **Closing balance** with variance detection

### 2. Transaction Classification
Group transactions by type:
```typescript
enum LedgerTransactionType {
  OPENING_BALANCE = 'Opening Balance',
  PURCHASE = 'Purchase (IN)',
  SALE = 'Sale (OUT)',
  TRANSFER_IN = 'Transfer IN',
  TRANSFER_OUT = 'Transfer OUT',
  CORRECTION = 'Inventory Correction',
  CUSTOMER_RETURN = 'Customer Return (IN)',
  SUPPLIER_RETURN = 'Supplier Return (OUT)',
  ADJUSTMENT = 'Stock Adjustment'
}
```

### 3. Financial Tracking
Include cost basis for valuation:
```typescript
interface LedgerEntry {
  date: Date
  transactionType: string
  referenceNumber: string
  quantityIn: number | null
  quantityOut: number | null
  runningBalance: number
  unitCost: number
  totalValue: number  // runningBalance * unitCost
  user: string
  notes: string
}
```

## Implementation Pattern

### Core Ledger Generation

```typescript
import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'

interface GenerateLedgerParams {
  businessId: number
  productId?: number
  variationId?: number
  locationId?: number
  startDate?: Date
  endDate?: Date
  includeOpeningBalance?: boolean
}

interface LedgerEntry {
  date: Date
  transactionId: number
  transactionType: string
  referenceType: string | null
  referenceId: string | null
  referenceNumber: string | null
  quantityIn: number | null
  quantityOut: number | null
  runningBalance: number
  unitCost: number
  totalValue: number
  user: string
  userId: number
  notes: string | null
}

interface LedgerResult {
  product: {
    id: number
    name: string
    sku: string
  }
  variation: {
    id: number
    name: string
  } | null
  location: {
    id: number
    name: string
  } | null
  period: {
    startDate: Date
    endDate: Date
  }
  summary: {
    openingBalance: number
    totalIn: number
    totalOut: number
    closingBalance: number
    systemBalance: number
    variance: number
    hasVariance: boolean
  }
  entries: LedgerEntry[]
}

async function generateItemLedger(
  params: GenerateLedgerParams
): Promise<LedgerResult[]> {

  const where: any = {
    businessId: params.businessId
  }

  if (params.productId) {
    where.productId = params.productId
  }

  if (params.variationId) {
    where.variationId = params.variationId
  }

  if (params.locationId) {
    where.locationId = params.locationId
  }

  if (params.startDate || params.endDate) {
    where.createdAt = {}
    if (params.startDate) where.createdAt.gte = params.startDate
    if (params.endDate) where.createdAt.lte = params.endDate
  }

  // Fetch all stock transactions
  const transactions = await prisma.stockTransaction.findMany({
    where,
    include: {
      product: { select: { id: true, name: true, sku: true } },
      variation: { select: { id: true, name: true } },
      location: { select: { id: true, name: true } },
      user: { select: { id: true, username: true } }
    },
    orderBy: { createdAt: 'asc' }
  })

  if (transactions.length === 0) {
    return []
  }

  // Group by product-variation-location combination
  const grouped = new Map<string, typeof transactions>()

  transactions.forEach(txn => {
    const key = `${txn.productId}-${txn.variationId}-${txn.locationId}`
    if (!grouped.has(key)) {
      grouped.set(key, [])
    }
    grouped.get(key)!.push(txn)
  })

  // Generate ledger for each group
  const results: LedgerResult[] = []

  for (const [key, txns] of grouped.entries()) {
    const firstTxn = txns[0]

    // Calculate opening balance
    let openingBalance = 0
    if (params.includeOpeningBalance && params.startDate) {
      // Find last transaction before start date
      const lastBeforeStart = await prisma.stockTransaction.findFirst({
        where: {
          businessId: params.businessId,
          productId: firstTxn.productId,
          variationId: firstTxn.variationId,
          locationId: firstTxn.locationId,
          createdAt: { lt: params.startDate }
        },
        orderBy: { createdAt: 'desc' }
      })
      openingBalance = lastBeforeStart?.balance || 0
    }

    // Build ledger entries
    const entries: LedgerEntry[] = []
    let runningBalance = openingBalance
    let totalIn = 0
    let totalOut = 0

    // Add opening balance entry
    if (params.includeOpeningBalance) {
      entries.push({
        date: params.startDate || txns[0].createdAt,
        transactionId: 0,
        transactionType: 'OPENING_BALANCE',
        referenceType: null,
        referenceId: null,
        referenceNumber: null,
        quantityIn: null,
        quantityOut: null,
        runningBalance: openingBalance,
        unitCost: 0,
        totalValue: 0,
        user: 'System',
        userId: 0,
        notes: 'Opening balance'
      })
    }

    // Process each transaction
    for (const txn of txns) {
      const quantityIn = txn.quantity > 0 ? txn.quantity : null
      const quantityOut = txn.quantity < 0 ? Math.abs(txn.quantity) : null

      if (quantityIn) totalIn += quantityIn
      if (quantityOut) totalOut += quantityOut

      runningBalance = txn.balance

      // Get reference number based on type
      let referenceNumber = null
      if (txn.referenceType && txn.referenceId) {
        referenceNumber = await getReferenceName(
          txn.referenceType,
          txn.referenceId,
          params.businessId
        )
      }

      entries.push({
        date: txn.createdAt,
        transactionId: txn.id,
        transactionType: formatTransactionType(txn.transactionType),
        referenceType: txn.referenceType,
        referenceId: txn.referenceId,
        referenceNumber,
        quantityIn,
        quantityOut,
        runningBalance: txn.balance,
        unitCost: parseFloat(txn.unitCost.toString()),
        totalValue: txn.balance * parseFloat(txn.unitCost.toString()),
        user: txn.user.username,
        userId: txn.user.id,
        notes: txn.notes
      })
    }

    // Get current system balance
    const currentStock = await prisma.variationLocationDetails.findUnique({
      where: {
        variationId_locationId: {
          variationId: firstTxn.variationId,
          locationId: firstTxn.locationId
        }
      }
    })

    const systemBalance = currentStock?.currentQty || 0
    const closingBalance = runningBalance
    const variance = systemBalance - closingBalance

    results.push({
      product: firstTxn.product,
      variation: firstTxn.variation,
      location: firstTxn.location,
      period: {
        startDate: params.startDate || txns[0].createdAt,
        endDate: params.endDate || txns[txns.length - 1].createdAt
      },
      summary: {
        openingBalance,
        totalIn,
        totalOut,
        closingBalance,
        systemBalance,
        variance,
        hasVariance: variance !== 0
      },
      entries
    })
  }

  return results
}

// Helper: Get reference document number
async function getReferenceName(
  referenceType: string,
  referenceId: string,
  businessId: number
): Promise<string | null> {
  try {
    const id = parseInt(referenceId)

    switch (referenceType) {
      case 'Sale':
        const sale = await prisma.sale.findUnique({
          where: { id, businessId },
          select: { invoiceNumber: true }
        })
        return sale?.invoiceNumber || null

      case 'Purchase':
        const purchase = await prisma.purchase.findUnique({
          where: { id, businessId },
          select: { purchaseNumber: true }
        })
        return purchase?.purchaseNumber || null

      case 'PurchaseReceipt':
        const receipt = await prisma.purchaseReceipt.findUnique({
          where: { id, businessId },
          select: { grnNumber: true }
        })
        return receipt?.grnNumber || null

      case 'StockTransfer':
        const transfer = await prisma.stockTransfer.findUnique({
          where: { id, businessId },
          select: { transferNumber: true }
        })
        return transfer?.transferNumber || null

      case 'InventoryCorrection':
        return `IC-${referenceId}`

      default:
        return referenceId
    }
  } catch (error) {
    return referenceId
  }
}

// Helper: Format transaction type for display
function formatTransactionType(type: string): string {
  const map: Record<string, string> = {
    'opening_stock': 'Opening Stock',
    'purchase': 'Purchase (IN)',
    'sale': 'Sale (OUT)',
    'transfer_in': 'Transfer IN',
    'transfer_out': 'Transfer OUT',
    'adjustment': 'Adjustment',
    'customer_return': 'Customer Return (IN)',
    'supplier_return': 'Supplier Return (OUT)',
    'correction': 'Inventory Correction'
  }
  return map[type] || type
}

export { generateItemLedger, type LedgerEntry, type LedgerResult }
```

## API Route Implementation

```typescript
// /src/app/api/reports/item-ledger/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { generateItemLedger } from '@/lib/itemLedger'
import { PERMISSIONS } from '@/lib/rbac'

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (!session.user.permissions?.includes(PERMISSIONS.INVENTORY_LEDGER_VIEW)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)

  const params = {
    businessId: session.user.businessId,
    productId: searchParams.get('productId') ? parseInt(searchParams.get('productId')!) : undefined,
    variationId: searchParams.get('variationId') ? parseInt(searchParams.get('variationId')!) : undefined,
    locationId: searchParams.get('locationId') ? parseInt(searchParams.get('locationId')!) : undefined,
    startDate: searchParams.get('startDate') ? new Date(searchParams.get('startDate')!) : undefined,
    endDate: searchParams.get('endDate') ? new Date(searchParams.get('endDate')!) : undefined,
    includeOpeningBalance: searchParams.get('includeOpeningBalance') === 'true'
  }

  try {
    const ledger = await generateItemLedger(params)

    return NextResponse.json({
      success: true,
      ledger,
      generatedAt: new Date().toISOString()
    })
  } catch (error: any) {
    console.error('Ledger generation error:', error)
    return NextResponse.json({
      error: error.message || 'Failed to generate ledger'
    }, { status: 500 })
  }
}
```

## Frontend Component

```typescript
// /src/app/dashboard/reports/inventory-ledger/page.tsx
'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { exportToPDF, exportToExcel } from '@/lib/exportUtils'

export default function InventoryLedgerPage() {
  const { data: session } = useSession()
  const [ledger, setLedger] = useState([])
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState({
    productId: '',
    variationId: '',
    locationId: '',
    startDate: '',
    endDate: '',
    includeOpeningBalance: true
  })

  useEffect(() => {
    fetchLedger()
  }, [filters])

  async function fetchLedger() {
    setLoading(true)
    const params = new URLSearchParams()
    if (filters.productId) params.set('productId', filters.productId)
    if (filters.variationId) params.set('variationId', filters.variationId)
    if (filters.locationId) params.set('locationId', filters.locationId)
    if (filters.startDate) params.set('startDate', filters.startDate)
    if (filters.endDate) params.set('endDate', filters.endDate)
    params.set('includeOpeningBalance', filters.includeOpeningBalance.toString())

    const res = await fetch(`/api/reports/item-ledger?${params}`)
    const data = await res.json()
    setLedger(data.ledger || [])
    setLoading(false)
  }

  function handleExportPDF() {
    exportToPDF('inventory-ledger-table', 'Inventory-Ledger-Report')
  }

  function handleExportExcel() {
    const data = ledger.flatMap(item =>
      item.entries.map(entry => ({
        'Product': item.product.name,
        'SKU': item.product.sku,
        'Variation': item.variation?.name || 'N/A',
        'Location': item.location?.name || 'N/A',
        'Date': new Date(entry.date).toLocaleDateString(),
        'Type': entry.transactionType,
        'Reference': entry.referenceNumber || '-',
        'Quantity IN': entry.quantityIn || '',
        'Quantity OUT': entry.quantityOut || '',
        'Balance': entry.runningBalance,
        'Unit Cost': entry.unitCost.toFixed(2),
        'Total Value': entry.totalValue.toFixed(2),
        'User': entry.user,
        'Notes': entry.notes || ''
      }))
    )
    exportToExcel(data, 'Inventory-Ledger-Report')
  }

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Inventory Ledger Report</h1>
        <div className="flex gap-2">
          <Button onClick={handleExportPDF} variant="outline">Export PDF</Button>
          <Button onClick={handleExportExcel} variant="outline">Export Excel</Button>
          <Button onClick={() => window.print()}>Print</Button>
        </div>
      </div>

      {/* Filters */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent>
          {/* Filter inputs here */}
        </CardContent>
      </Card>

      {/* Ledger Display */}
      {ledger.map((item, idx) => (
        <Card key={idx} className="mb-6">
          <CardHeader>
            <div className="flex justify-between items-start">
              <div>
                <CardTitle>{item.product.name}</CardTitle>
                <p className="text-sm text-muted-foreground">
                  SKU: {item.product.sku} |
                  {item.variation && ` Variation: ${item.variation.name} |`}
                  {item.location && ` Location: ${item.location.name}`}
                </p>
              </div>
              {item.summary.hasVariance && (
                <Badge variant="destructive">
                  Variance: {item.summary.variance}
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {/* Summary */}
            <div className="grid grid-cols-6 gap-4 mb-4 p-4 bg-muted rounded">
              <div>
                <p className="text-sm font-medium">Opening</p>
                <p className="text-2xl font-bold">{item.summary.openingBalance}</p>
              </div>
              <div>
                <p className="text-sm font-medium">Total IN</p>
                <p className="text-2xl font-bold text-green-600">{item.summary.totalIn}</p>
              </div>
              <div>
                <p className="text-sm font-medium">Total OUT</p>
                <p className="text-2xl font-bold text-red-600">{item.summary.totalOut}</p>
              </div>
              <div>
                <p className="text-sm font-medium">Closing (Ledger)</p>
                <p className="text-2xl font-bold">{item.summary.closingBalance}</p>
              </div>
              <div>
                <p className="text-sm font-medium">System Balance</p>
                <p className="text-2xl font-bold">{item.summary.systemBalance}</p>
              </div>
              <div>
                <p className="text-sm font-medium">Variance</p>
                <p className={`text-2xl font-bold ${item.summary.variance !== 0 ? 'text-red-600' : 'text-green-600'}`}>
                  {item.summary.variance}
                </p>
              </div>
            </div>

            {/* Transactions Table */}
            <Table id="inventory-ledger-table">
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Reference</TableHead>
                  <TableHead className="text-right">Qty IN</TableHead>
                  <TableHead className="text-right">Qty OUT</TableHead>
                  <TableHead className="text-right">Balance</TableHead>
                  <TableHead className="text-right">Unit Cost</TableHead>
                  <TableHead className="text-right">Total Value</TableHead>
                  <TableHead>User</TableHead>
                  <TableHead>Notes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {item.entries.map((entry, entryIdx) => (
                  <TableRow key={entryIdx}>
                    <TableCell>{new Date(entry.date).toLocaleDateString()}</TableCell>
                    <TableCell>
                      <Badge variant={entry.quantityIn ? 'default' : 'destructive'}>
                        {entry.transactionType}
                      </Badge>
                    </TableCell>
                    <TableCell>{entry.referenceNumber || '-'}</TableCell>
                    <TableCell className="text-right text-green-600 font-medium">
                      {entry.quantityIn || ''}
                    </TableCell>
                    <TableCell className="text-right text-red-600 font-medium">
                      {entry.quantityOut || ''}
                    </TableCell>
                    <TableCell className="text-right font-bold">{entry.runningBalance}</TableCell>
                    <TableCell className="text-right">{entry.unitCost.toFixed(2)}</TableCell>
                    <TableCell className="text-right font-medium">{entry.totalValue.toFixed(2)}</TableCell>
                    <TableCell>{entry.user}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{entry.notes || '-'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
```

## Best Practices

### ✅ DO:
- **Include opening balance** for accurate period reporting
- **Show running balance** after each transaction
- **Highlight variances** between ledger and system
- **Group by product-variation-location**
- **Sort chronologically** for audit trail
- **Include reference numbers** for traceability
- **Calculate financial values** with cost basis
- **Support multiple export formats** (PDF, Excel, CSV)
- **Apply multi-tenant filtering** always

### ❌ DON'T:
- **Don't skip opening balance** calculation
- **Don't ignore variances** - investigate immediately
- **Don't forget businessId** in queries
- **Don't mix different variations** in same ledger
- **Don't omit user information** from transactions
- **Don't forget to format costs** with proper decimals

## Related Skills
- `pos-inventory-transaction-logger` - Creates transactions displayed in ledger
- `pos-stock-reconciliation-detective` - Investigates ledger variances
- `pos-devextreme-report-builder` - Creates advanced ledger reports with DevExtreme

## References
- Schema: `/prisma/schema.prisma` lines 766-804 (StockTransaction)
- Example: `/src/app/dashboard/reports/inventory-ledger/page.tsx`
- Library: `/src/lib/stockOperations.ts`
