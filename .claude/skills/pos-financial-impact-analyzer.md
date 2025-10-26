# pos-financial-impact-analyzer

## Purpose

Analyzes financial impact of inventory transactions and prepares General Ledger (GL) posting data for integration with accounting systems. Tracks inventory value changes and COGS.

## When to Use

- Preparing GL entries for accounting
- Month-end/quarter-end closing
- Inventory value reporting
- COGS journal entries
- Integration with QuickBooks/Xero
- Financial statement preparation

## Critical Requirements

### 1. GL Account Structure

```typescript
interface GLAccounts {
  INVENTORY_ASSET: string; // 1200 - Inventory (Balance Sheet)
  COGS: string; // 5000 - Cost of Goods Sold (P&L)
  PURCHASES: string; // 5100 - Purchases (P&L)
  SALES_REVENUE: string; // 4000 - Sales Revenue (P&L)
  ACCOUNTS_PAYABLE: string; // 2000 - Accounts Payable (Balance Sheet)
  INVENTORY_ADJUSTMENT: string; // 5200 - Inventory Adjustments (P&L)
}
```

### 2. Journal Entry Format

```typescript
interface JournalEntry {
  entryDate: Date;
  referenceType: string; // 'Sale', 'Purchase', 'Adjustment'
  referenceId: string;
  description: string;
  lines: Array<{
    account: string; // GL account code
    debit: number;
    credit: number;
    description: string;
  }>;
  totalDebit: number;
  totalCredit: number;
  balanced: boolean; // totalDebit === totalCredit
}
```

## Implementation Pattern

### Purchase GL Entry

```typescript
async function generatePurchaseGLEntry(
  receiptId: number,
  businessId: number
): Promise<JournalEntry> {
  const receipt = await prisma.purchaseReceipt.findUnique({
    where: { id: receiptId },
    include: {
      items: true,
      supplier: true,
    },
  });

  // Calculate total purchase value
  const totalValue = receipt.items.reduce(
    (sum, item) =>
      sum + item.acceptedQty * parseFloat(item.unitCost.toString()),
    0
  );

  // DR Inventory Asset
  // CR Accounts Payable
  return {
    entryDate: receipt.approvedAt || receipt.receivedAt,
    referenceType: "PurchaseReceipt",
    referenceId: receipt.id.toString(),
    description: `Purchase from ${receipt.supplier.name} - GRN #${receipt.grnNumber}`,
    lines: [
      {
        account: GLAccounts.INVENTORY_ASSET,
        debit: totalValue,
        credit: 0,
        description: "Inventory received",
      },
      {
        account: GLAccounts.ACCOUNTS_PAYABLE,
        debit: 0,
        credit: totalValue,
        description: `Payable to ${receipt.supplier.name}`,
      },
    ],
    totalDebit: totalValue,
    totalCredit: totalValue,
    balanced: true,
  };
}
```

### Sale GL Entry

```typescript
async function generateSaleGLEntry(
  saleId: number,
  businessId: number
): Promise<JournalEntry[]> {
  const sale = await prisma.sale.findUnique({
    where: { id: saleId },
    include: { items: true },
  });

  const totalRevenue = parseFloat(sale.totalAmount.toString());
  const totalCOGS = parseFloat(sale.totalCost?.toString() || "0");

  const entries = [];

  // Entry 1: Record Revenue
  // DR Cash/Accounts Receivable
  // CR Sales Revenue
  entries.push({
    entryDate: sale.saleDate || sale.createdAt,
    referenceType: "Sale",
    referenceId: sale.id.toString(),
    description: `Sale #${sale.invoiceNumber} - Revenue`,
    lines: [
      {
        account: sale.customerId
          ? GLAccounts.ACCOUNTS_RECEIVABLE
          : GLAccounts.CASH,
        debit: totalRevenue,
        credit: 0,
        description: sale.customerId
          ? "Receivable from customer"
          : "Cash received",
      },
      {
        account: GLAccounts.SALES_REVENUE,
        debit: 0,
        credit: totalRevenue,
        description: "Sales revenue",
      },
    ],
    totalDebit: totalRevenue,
    totalCredit: totalRevenue,
    balanced: true,
  });

  // Entry 2: Record COGS
  // DR COGS
  // CR Inventory Asset
  entries.push({
    entryDate: sale.saleDate || sale.createdAt,
    referenceType: "Sale",
    referenceId: sale.id.toString(),
    description: `Sale #${sale.invoiceNumber} - COGS`,
    lines: [
      {
        account: GLAccounts.COGS,
        debit: totalCOGS,
        credit: 0,
        description: "Cost of goods sold",
      },
      {
        account: GLAccounts.INVENTORY_ASSET,
        debit: 0,
        credit: totalCOGS,
        description: "Inventory reduction",
      },
    ],
    totalDebit: totalCOGS,
    totalCredit: totalCOGS,
    balanced: true,
  });

  return entries;
}
```

### Inventory Adjustment GL Entry

```typescript
async function generateAdjustmentGLEntry(
  correctionId: number,
  businessId: number
): Promise<JournalEntry> {
  const correction = await prisma.inventoryCorrection.findUnique({
    where: { id: correctionId },
    include: {
      product: true,
      variation: true,
    },
  });

  const adjustmentQty = correction.difference;
  const unitCost = parseFloat(correction.unitCost?.toString() || "0");
  const adjustmentValue = Math.abs(adjustmentQty * unitCost);

  // DR/CR depends on shortage vs overage
  const isShortage = adjustmentQty < 0;

  return {
    entryDate: correction.approvedAt,
    referenceType: "InventoryCorrection",
    referenceId: correction.id.toString(),
    description: `Inventory ${isShortage ? "shortage" : "overage"} - ${
      correction.product.name
    }`,
    lines: isShortage
      ? [
          // Shortage: DR Adjustment Expense, CR Inventory
          {
            account: GLAccounts.INVENTORY_ADJUSTMENT,
            debit: adjustmentValue,
            credit: 0,
            description: `Inventory shortage - ${correction.reason}`,
          },
          {
            account: GLAccounts.INVENTORY_ASSET,
            debit: 0,
            credit: adjustmentValue,
            description: "Inventory reduction",
          },
        ]
      : [
          // Overage: DR Inventory, CR Adjustment Income
          {
            account: GLAccounts.INVENTORY_ASSET,
            debit: adjustmentValue,
            credit: 0,
            description: "Inventory increase",
          },
          {
            account: GLAccounts.INVENTORY_ADJUSTMENT,
            debit: 0,
            credit: adjustmentValue,
            description: `Inventory overage - ${correction.reason}`,
          },
        ],
    totalDebit: adjustmentValue,
    totalCredit: adjustmentValue,
    balanced: true,
  };
}
```

## API Route: GL Journal Entries

```typescript
// /src/app/api/reports/gl-entries/route.ts
export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const startDate = searchParams.get("startDate");
  const endDate = searchParams.get("endDate");

  const entries = [];

  // Get all approved transactions in period
  const sales = await prisma.sale.findMany({
    where: {
      businessId: session.user.businessId,
      createdAt: {
        gte: startDate ? new Date(startDate) : undefined,
        lte: endDate ? new Date(endDate) : undefined,
      },
    },
  });

  for (const sale of sales) {
    const saleEntries = await generateSaleGLEntry(
      sale.id,
      session.user.businessId
    );
    entries.push(...saleEntries);
  }

  // Add purchases, adjustments, etc.

  return NextResponse.json({
    success: true,
    entries,
    summary: {
      totalEntries: entries.length,
      allBalanced: entries.every((e) => e.balanced),
    },
  });
}
```

## Export for Accounting Software

```typescript
// QuickBooks IIF format
function exportToQuickBooksIIF(entries: JournalEntry[]): string {
  let iif = "!TRNS\tTRNSID\tTRNSTYPE\tDATE\tACCNT\tNAME\tAMOUNT\tMEMO\n";
  iif += "!SPL\tSPLID\tTRNSTYPE\tDATE\tACCNT\tNAME\tAMOUNT\tMEMO\n";
  iif += "!ENDTRNS\n";

  for (const entry of entries) {
    for (const line of entry.lines) {
      const amount = line.debit > 0 ? line.debit : -line.credit;
      iif += `TRNS\t\tGENERAL JOURNAL\t${formatDate(entry.entryDate)}\t${
        line.account
      }\t\t${amount}\t${entry.description}\n`;
    }
    iif += "ENDTRNS\n";
  }

  return iif;
}

// CSV format for Excel/other systems
function exportToCSV(entries: JournalEntry[]): string {
  const rows = [
    ["Date", "Type", "Reference", "Account", "Debit", "Credit", "Description"],
  ];

  for (const entry of entries) {
    for (const line of entry.lines) {
      rows.push([
        entry.entryDate.toISOString().split("T")[0],
        entry.referenceType,
        entry.referenceId,
        line.account,
        line.debit.toString(),
        line.credit.toString(),
        line.description,
      ]);
    }
  }

  return rows.map((row) => row.join(",")).join("\n");
}
```

## Best Practices

### ✅ DO:

- **Ensure entries balance** (DR = CR)
- **Use standard GL accounts**
- **Generate entries on approval** (not creation)
- **Track GL posting status**
- **Support multiple export formats**
- **Validate all amounts**

### ❌ DON'T:

- **Don't post unbalanced entries**
- **Don't skip COGS entries** for sales
- **Don't forget inventory adjustments**
- **Don't modify posted entries** (reverse instead)

## Related Skills

- `pos-cost-basis-tracker` - Provides COGS values
- `pos-inventory-valuation-engine` - Inventory asset values
- `pos-audit-trail-architect` - Logs GL postings

## References

- Accounting: Generally Accepted Accounting Principles (GAAP)
- Integration: QuickBooks, Xero, NetSuite APIs
