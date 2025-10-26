# accounting-integration

## Purpose
Automatically creates double-entry accounting journal entries for POS transactions. Connects operational activities (sales, purchases, payments) to the Chart of Accounts for financial reporting.

## When to Use
- After creating a sale (cash or credit)
- After receiving a purchase
- When collecting payment from customers (AR)
- When paying suppliers (AP)
- When you need to generate financial statements

## Core Concept

**Every business transaction affects TWO accounts** (double-entry bookkeeping):
- One account is **debited** (DR)
- One account is **credited** (CR)
- Total debits MUST equal total credits

## Chart of Accounts Structure

### Asset Accounts (1000-1999)
```typescript
1000 - Cash                     // Money in hand/bank
1100 - Accounts Receivable (AR) // Customers owe you
1200 - Inventory                // Products in stock
```

### Liability Accounts (2000-2999)
```typescript
2000 - Accounts Payable (AP)    // You owe suppliers
```

### Revenue Accounts (4000-4999)
```typescript
4000 - Sales Revenue            // Income from sales
```

### Expense Accounts (5000-5999)
```typescript
5000 - Cost of Goods Sold (COGS) // Cost of products sold
5100 - Purchases                  // Buying inventory
```

## Available Functions

### Import

```typescript
import {
  isAccountingEnabled,
  recordCashSale,
  recordCreditSale,
  recordPurchase,
  recordCustomerPayment,
  recordSupplierPayment
} from '@/lib/accountingIntegration'
```

### 1. Check if Accounting is Enabled

```typescript
const isEnabled = await isAccountingEnabled(businessId)

if (isEnabled) {
  // Create accounting entries
}
```

### 2. Record Cash Sale

**What Happens:**
- Cash increases (you received money)
- Sales Revenue increases (you made a sale)
- COGS increases (expense for products sold)
- Inventory decreases (products left)

```typescript
await recordCashSale({
  businessId: 1,
  userId: 5,
  saleId: 123,
  saleDate: new Date(),
  totalAmount: 1000,        // Sale price
  costOfGoodsSold: 600,     // What you paid for those products
  invoiceNumber: 'INV-001'
})

// Creates journal entry:
// DR: Cash                 $1000
// CR: Sales Revenue               $1000
// DR: COGS                 $600
// CR: Inventory                   $600
```

### 3. Record Credit Sale

**What Happens:**
- Accounts Receivable increases (customer owes you)
- Sales Revenue increases (you made a sale)
- COGS increases (expense for products sold)
- Inventory decreases (products left)

```typescript
await recordCreditSale({
  businessId: 1,
  userId: 5,
  saleId: 124,
  saleDate: new Date(),
  totalAmount: 2000,
  costOfGoodsSold: 1200,
  invoiceNumber: 'INV-002',
  customerId: 45  // Optional
})

// Creates journal entry:
// DR: Accounts Receivable  $2000
// CR: Sales Revenue               $2000
// DR: COGS                 $1200
// CR: Inventory                   $1200
```

### 4. Record Purchase

**What Happens:**
- Inventory increases (you received products)
- Accounts Payable increases (you owe supplier)

```typescript
await recordPurchase({
  businessId: 1,
  userId: 5,
  purchaseId: 789,
  receiptDate: new Date(),
  totalCost: 5000,          // What you paid
  grnNumber: 'GRN-001',
  supplierId: 12
})

// Creates journal entry:
// DR: Inventory            $5000
// CR: Accounts Payable            $5000
```

### 5. Record Customer Payment (AR Collection)

**What Happens:**
- Cash increases (you received money)
- Accounts Receivable decreases (customer no longer owes)

```typescript
await recordCustomerPayment({
  businessId: 1,
  userId: 5,
  paymentId: 456,
  paymentDate: new Date(),
  amount: 1500,
  referenceNumber: 'PAY-001',
  customerId: 45
})

// Creates journal entry:
// DR: Cash                 $1500
// CR: Accounts Receivable         $1500
```

### 6. Record Supplier Payment (AP Payment)

**What Happens:**
- Accounts Payable decreases (you no longer owe)
- Cash decreases (you paid money)

```typescript
await recordSupplierPayment({
  businessId: 1,
  userId: 5,
  paymentId: 789,
  paymentDate: new Date(),
  amount: 3000,
  referenceNumber: 'PAY-SUP-001',
  supplierId: 12
})

// Creates journal entry:
// DR: Accounts Payable     $3000
// CR: Cash                        $3000
```

## Implementation Pattern

### Pattern 1: Sales with Accounting

```typescript
import { prisma } from '@/lib/prisma'
import { isAccountingEnabled, recordCashSale, recordCreditSale } from '@/lib/accountingIntegration'

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions)
  const user = session.user as any
  const body = await request.json()

  // Create sale
  const sale = await prisma.$transaction(async (tx) => {
    const newSale = await tx.sale.create({
      data: {
        businessId: user.businessId,
        invoiceNumber: body.invoiceNumber,
        totalAmount: body.totalAmount,
        totalCost: body.totalCost,  // Important for COGS
        customerId: body.customerId,
        // ... other fields
      }
    })

    // Create sale items and deduct stock
    for (const item of body.items) {
      await tx.saleItem.create({ /* ... */ })
      await deductStock({ /* ... */ })
    }

    return newSale
  })

  // ACCOUNTING INTEGRATION: Create journal entries
  if (await isAccountingEnabled(user.businessId)) {
    try {
      if (sale.customerId) {
        // Credit sale (customer will pay later)
        await recordCreditSale({
          businessId: user.businessId,
          userId: user.id,
          saleId: sale.id,
          saleDate: sale.saleDate,
          totalAmount: parseFloat(sale.totalAmount.toString()),
          costOfGoodsSold: parseFloat(sale.totalCost.toString()),
          invoiceNumber: sale.invoiceNumber,
          customerId: sale.customerId
        })
      } else {
        // Cash sale (paid immediately)
        await recordCashSale({
          businessId: user.businessId,
          userId: user.id,
          saleId: sale.id,
          saleDate: sale.saleDate,
          totalAmount: parseFloat(sale.totalAmount.toString()),
          costOfGoodsSold: parseFloat(sale.totalCost.toString()),
          invoiceNumber: sale.invoiceNumber
        })
      }

      console.log(`[Accounting] Journal entry created for sale ${sale.invoiceNumber}`)
    } catch (accountingError) {
      // Log error but don't fail the sale
      console.error('[Accounting] Failed to create journal entry:', accountingError)
      // Sale still succeeds even if accounting integration fails
    }
  }

  return NextResponse.json(sale, { status: 201 })
}
```

### Pattern 2: Purchase with Accounting

```typescript
import { recordPurchase } from '@/lib/accountingIntegration'

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions)
  const user = session.user as any
  const body = await request.json()

  // Approve/receive purchase
  const receipt = await prisma.$transaction(async (tx) => {
    const newReceipt = await tx.purchaseReceipt.create({
      data: {
        businessId: user.businessId,
        purchaseId: body.purchaseId,
        grnNumber: body.grnNumber,
        totalCost: body.totalCost,
        supplierId: body.supplierId,
        // ... other fields
      }
    })

    // Create receipt items and add stock
    for (const item of body.items) {
      await tx.purchaseReceiptItem.create({ /* ... */ })
      await addStock({ /* ... */ })
    }

    return newReceipt
  })

  // ACCOUNTING INTEGRATION: Create journal entry
  if (await isAccountingEnabled(user.businessId)) {
    try {
      await recordPurchase({
        businessId: user.businessId,
        userId: user.id,
        purchaseId: receipt.purchaseId,
        receiptDate: receipt.receivedAt,
        totalCost: parseFloat(receipt.totalCost.toString()),
        grnNumber: receipt.grnNumber,
        supplierId: receipt.supplierId
      })

      console.log(`[Accounting] Journal entry created for purchase ${receipt.grnNumber}`)
    } catch (accountingError) {
      console.error('[Accounting] Failed to create journal entry:', accountingError)
    }
  }

  return NextResponse.json(receipt, { status: 201 })
}
```

### Pattern 3: AR Payment Collection

```typescript
import { recordCustomerPayment } from '@/lib/accountingIntegration'

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions)
  const user = session.user as any
  const body = await request.json()

  // Record customer payment
  const payment = await prisma.salePayment.create({
    data: {
      saleId: body.saleId,
      amount: body.amount,
      paymentMethod: 'cash',
      shiftId: body.shiftId,
      collectedBy: user.id,
      // ... other fields
    }
  })

  // Update sale balance
  await prisma.sale.update({
    where: { id: body.saleId },
    data: {
      paidAmount: { increment: body.amount },
      balanceDue: { decrement: body.amount },
    }
  })

  // ACCOUNTING INTEGRATION: Create journal entry
  if (await isAccountingEnabled(user.businessId)) {
    try {
      await recordCustomerPayment({
        businessId: user.businessId,
        userId: user.id,
        paymentId: payment.id,
        paymentDate: payment.paidAt,
        amount: parseFloat(payment.amount.toString()),
        referenceNumber: `PAY-${payment.id}`,
        customerId: body.customerId
      })

      console.log(`[Accounting] Journal entry created for customer payment ${payment.id}`)
    } catch (accountingError) {
      console.error('[Accounting] Failed to create journal entry:', accountingError)
    }
  }

  return NextResponse.json(payment, { status: 201 })
}
```

### Pattern 4: Supplier Payment

```typescript
import { recordSupplierPayment } from '@/lib/accountingIntegration'

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions)
  const user = session.user as any
  const body = await request.json()

  // Create supplier payment
  const payment = await prisma.payment.create({
    data: {
      businessId: user.businessId,
      supplierId: body.supplierId,
      amount: body.amount,
      paymentMethod: body.paymentMethod,
      paymentNumber: body.paymentNumber,
      // ... other fields
    }
  })

  // Update accounts payable
  await prisma.accountsPayable.update({
    where: { id: body.accountsPayableId },
    data: {
      paidAmount: { increment: body.amount },
      balanceAmount: { decrement: body.amount },
    }
  })

  // ACCOUNTING INTEGRATION: Create journal entry
  if (await isAccountingEnabled(user.businessId)) {
    try {
      await recordSupplierPayment({
        businessId: user.businessId,
        userId: user.id,
        paymentId: payment.id,
        paymentDate: payment.paymentDate,
        amount: parseFloat(payment.amount.toString()),
        referenceNumber: payment.paymentNumber,
        supplierId: payment.supplierId
      })

      console.log(`[Accounting] Journal entry created for supplier payment ${payment.paymentNumber}`)
    } catch (accountingError) {
      console.error('[Accounting] Failed to create journal entry:', accountingError)
    }
  }

  return NextResponse.json(payment, { status: 201 })
}
```

## Journal Entry Structure

Each journal entry creates a record in the database:

```typescript
{
  id: number
  businessId: number
  entryDate: Date
  description: string              // "Cash Sale - Invoice INV-001"
  referenceNumber: string          // "INV-001"
  sourceType: string               // "sale", "purchase", "payment"
  sourceId: number                 // ID of source document
  status: "posted" | "draft"
  balanced: boolean                // Always true (DR = CR)
  createdBy: number
  lines: [
    {
      accountId: number            // Links to Chart of Accounts
      debit: number                // Debit amount (or 0)
      credit: number               // Credit amount (or 0)
      description: string          // Line description
    },
    // ... more lines
  ]
}
```

## Error Handling

**Important:** Accounting integration errors should **NOT** block business operations:

```typescript
try {
  await recordCashSale({ /* ... */ })
  console.log('[Accounting] Journal entry created successfully')
} catch (accountingError) {
  // Log the error
  console.error('[Accounting] Failed to create journal entry:', accountingError)

  // Optionally notify admin
  // await notifyAdmin('Accounting integration failed', accountingError)

  // DON'T throw error - let the sale succeed
  // Sale still completes even if accounting fails
}
```

## Financial Reports

With journal entries in place, you can generate:

### 1. Trial Balance
Sum of all debits and credits per account

### 2. Income Statement (P&L)
- Revenue: Sales Revenue (4000)
- Cost of Goods Sold: COGS (5000)
- Gross Profit = Revenue - COGS
- Net Profit = Gross Profit - Expenses

### 3. Balance Sheet
**Assets:**
- Cash (1000)
- Accounts Receivable (1100)
- Inventory (1200)

**Liabilities:**
- Accounts Payable (2000)

**Equity:**
- Total Assets - Total Liabilities

## Best Practices

### ✅ DO:

- **Always check if accounting is enabled** before creating entries
- **Wrap in try-catch** to prevent blocking operations
- **Log success and failures** for debugging
- **Ensure COGS is calculated** for all sales
- **Use correct account codes** (1000, 1100, 1200, etc.)
- **Verify entries balance** (total DR = total CR)
- **Link to source documents** (saleId, purchaseId, etc.)

### ❌ DON'T:

- **Don't block operations** if accounting fails
- **Don't create entries** if accounting is disabled
- **Don't forget COGS** in sale entries
- **Don't modify posted entries** (create reversal instead)
- **Don't skip validation** (ensure accounts exist)

## Common Mistakes

### ❌ Mistake 1: Forgetting to Check if Enabled

```typescript
// ❌ WRONG: Always creates entries
await recordCashSale({ /* ... */ })
```

```typescript
// ✅ CORRECT: Check first
if (await isAccountingEnabled(businessId)) {
  await recordCashSale({ /* ... */ })
}
```

### ❌ Mistake 2: Blocking Operations on Error

```typescript
// ❌ WRONG: Sale fails if accounting fails
const sale = await createSale()
await recordCashSale({ /* ... */ })  // If this throws, sale is lost!
```

```typescript
// ✅ CORRECT: Catch accounting errors
const sale = await createSale()

try {
  await recordCashSale({ /* ... */ })
} catch (accountingError) {
  console.error('Accounting failed:', accountingError)
  // Sale still succeeded
}
```

### ❌ Mistake 3: Missing COGS

```typescript
// ❌ WRONG: Sale without COGS tracking
const sale = await prisma.sale.create({
  data: {
    totalAmount: 1000,
    // Missing: totalCost
  }
})

await recordCashSale({
  totalAmount: 1000,
  costOfGoodsSold: 0  // ❌ Wrong!
})
```

```typescript
// ✅ CORRECT: Calculate and store COGS
const totalCost = saleItems.reduce((sum, item) =>
  sum + (item.quantity * item.costPrice), 0
)

const sale = await prisma.sale.create({
  data: {
    totalAmount: 1000,
    totalCost: totalCost  // ✅ Store COGS
  }
})

await recordCashSale({
  totalAmount: 1000,
  costOfGoodsSold: totalCost  // ✅ Correct
})
```

## File Locations

- **Integration Library:** `/src/lib/accountingIntegration.ts`
- **Chart of Accounts:** `/src/lib/chartOfAccounts.ts`
- **Accounting Glossary:** `/src/lib/accountingGlossary.ts`
- **Example Usage:** `/src/app/api/sales/route.ts` (lines 402-420)
- **Example Usage:** `/src/app/api/payments/route.ts` (lines 402-420)

## Database Models

```prisma
model JournalEntry {
  id              Int              @id @default(autoincrement())
  businessId      Int
  entryDate       DateTime
  description     String
  referenceNumber String?
  sourceType      String?          // "sale", "purchase", "payment"
  sourceId        Int?
  status          String           // "posted", "draft"
  balanced        Boolean
  createdBy       Int
  lines           JournalEntryLine[]
}

model JournalEntryLine {
  id              Int           @id @default(autoincrement())
  entryId         Int
  accountId       Int
  debit           Decimal       @db.Decimal(22, 4)
  credit          Decimal       @db.Decimal(22, 4)
  description     String?
}
```

## Summary

This skill ensures:
1. ✅ Automatic journal entries for all transactions
2. ✅ Proper double-entry bookkeeping
3. ✅ Financial reports can be generated
4. ✅ Accounting errors don't block operations
5. ✅ COGS tracking for profitability analysis
6. ✅ Integration with Chart of Accounts

**Remember:** Always wrap accounting calls in try-catch and check if enabled first!
