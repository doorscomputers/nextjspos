# pos-philippine-accounting-system

## Purpose
Implements a complete BIR-compliant accounting system for Philippine businesses following PFRS (Philippine Financial Reporting Standards), with General Ledger, Chart of Accounts, Journal Entries, and Financial Statements.

## When to Use
- Setting up complete accounting module
- BIR compliance requirements
- Financial statement preparation
- Tax filing (VAT, Income Tax, Withholding Tax)
- Audit trail requirements
- GL posting from inventory/sales/purchases
- Multi-location consolidation

## Critical Requirements

### 1. Philippine Regulatory Framework

```typescript
// BIR (Bureau of Internal Revenue) Compliance
interface BIRRequirements {
  // VAT Registration
  vatRegistered: boolean
  tinNumber: string  // Tax Identification Number
  rdoCode: string    // Revenue District Office

  // VAT Rate (Philippines)
  standardVATRate: 12  // 12% VAT

  // Withholding Tax Rates
  expandedWT: 1  // 1% for goods
  expandedWTServices: 2  // 2% for services
  professionalWT: 10  // 10% for professional fees

  // Required BIR Forms
  forms: [
    '2307',  // Certificate of Creditable Tax Withheld at Source
    '2550M', // Monthly VAT Declaration
    '2550Q', // Quarterly VAT Return
    '1701',  // Annual Income Tax Return
    '1601C', // Monthly Remittance of Income Taxes Withheld
  ]
}

// PFRS (Philippine Financial Reporting Standards)
// Based on IFRS with local modifications
```

### 2. Chart of Accounts Structure (Philippine Standard)

```typescript
interface ChartOfAccounts {
  // Account Number Format: XXXX-XX-XXX
  // 1st digit: Account Type
  // 2nd-3rd: Main Account
  // 4th-5th: Sub Account
  // Last 3: Detail

  accountCode: string     // e.g., "1010-01-001"
  accountName: string
  accountType: AccountType
  parentAccountId: number | null
  isHeader: boolean       // Header accounts can't have transactions
  normalBalance: 'DEBIT' | 'CREDIT'
  isActive: boolean
  level: number          // 1, 2, 3, 4 (hierarchy depth)
}

enum AccountType {
  ASSET = 'ASSET',           // 1000-1999
  LIABILITY = 'LIABILITY',   // 2000-2999
  EQUITY = 'EQUITY',         // 3000-3999
  REVENUE = 'REVENUE',       // 4000-4999
  EXPENSE = 'EXPENSE',       // 5000-5999
  OTHER_INCOME = 'OTHER_INCOME',     // 6000-6999
  OTHER_EXPENSE = 'OTHER_EXPENSE'    // 7000-7999
}
```

### 3. Standard Philippine Chart of Accounts

```typescript
const PHILIPPINE_COA = {
  // ========================================
  // ASSETS (1000-1999)
  // ========================================
  ASSETS: {
    code: '1000',
    name: 'ASSETS',
    isHeader: true,
    children: {
      // CURRENT ASSETS (1100-1499)
      CURRENT_ASSETS: {
        code: '1100',
        name: 'Current Assets',
        isHeader: true,
        children: {
          CASH_AND_CASH_EQUIVALENTS: {
            code: '1110',
            name: 'Cash and Cash Equivalents',
            isHeader: true,
            children: {
              CASH_ON_HAND: { code: '1110-01', name: 'Cash on Hand' },
              PETTY_CASH: { code: '1110-02', name: 'Petty Cash Fund' },
              CASH_IN_BANK_BPI: { code: '1110-03', name: 'Cash in Bank - BPI' },
              CASH_IN_BANK_BDO: { code: '1110-04', name: 'Cash in Bank - BDO' },
              CASH_IN_BANK_GCASH: { code: '1110-05', name: 'Cash in Bank - GCash' },
            }
          },
          ACCOUNTS_RECEIVABLE: {
            code: '1120',
            name: 'Accounts Receivable',
            isHeader: true,
            children: {
              AR_TRADE: { code: '1120-01', name: 'Accounts Receivable - Trade' },
              AR_EMPLOYEES: { code: '1120-02', name: 'Accounts Receivable - Employees' },
              ALLOWANCE_DOUBTFUL: { code: '1120-99', name: 'Allowance for Doubtful Accounts', normalBalance: 'CREDIT' }
            }
          },
          INVENTORY: {
            code: '1130',
            name: 'Inventory',
            isHeader: true,
            children: {
              INVENTORY_MERCHANDISE: { code: '1130-01', name: 'Inventory - Merchandise' },
              INVENTORY_RAW_MATERIALS: { code: '1130-02', name: 'Inventory - Raw Materials' },
              INVENTORY_WIP: { code: '1130-03', name: 'Inventory - Work in Progress' },
              INVENTORY_FINISHED_GOODS: { code: '1130-04', name: 'Inventory - Finished Goods' },
            }
          },
          PREPAID_EXPENSES: {
            code: '1140',
            name: 'Prepaid Expenses',
            children: {
              PREPAID_RENT: { code: '1140-01', name: 'Prepaid Rent' },
              PREPAID_INSURANCE: { code: '1140-02', name: 'Prepaid Insurance' },
            }
          },
          OTHER_CURRENT_ASSETS: {
            code: '1150',
            name: 'Other Current Assets',
            children: {
              INPUT_VAT: { code: '1150-01', name: 'Input VAT' },
              CREDITABLE_WT: { code: '1150-02', name: 'Creditable Withholding Tax' },
            }
          }
        }
      },

      // NON-CURRENT ASSETS (1500-1999)
      NON_CURRENT_ASSETS: {
        code: '1500',
        name: 'Non-Current Assets',
        isHeader: true,
        children: {
          PROPERTY_PLANT_EQUIPMENT: {
            code: '1510',
            name: 'Property, Plant & Equipment',
            children: {
              LAND: { code: '1510-01', name: 'Land' },
              BUILDING: { code: '1510-02', name: 'Building' },
              MACHINERY: { code: '1510-03', name: 'Machinery & Equipment' },
              FURNITURE: { code: '1510-04', name: 'Furniture & Fixtures' },
              VEHICLES: { code: '1510-05', name: 'Vehicles' },
              ACCUM_DEPRECIATION: { code: '1510-99', name: 'Accumulated Depreciation', normalBalance: 'CREDIT' }
            }
          }
        }
      }
    }
  },

  // ========================================
  // LIABILITIES (2000-2999)
  // ========================================
  LIABILITIES: {
    code: '2000',
    name: 'LIABILITIES',
    isHeader: true,
    children: {
      // CURRENT LIABILITIES (2100-2499)
      CURRENT_LIABILITIES: {
        code: '2100',
        name: 'Current Liabilities',
        isHeader: true,
        children: {
          ACCOUNTS_PAYABLE: {
            code: '2110',
            name: 'Accounts Payable',
            children: {
              AP_TRADE: { code: '2110-01', name: 'Accounts Payable - Trade' },
              AP_NON_TRADE: { code: '2110-02', name: 'Accounts Payable - Non-Trade' },
            }
          },
          TAXES_PAYABLE: {
            code: '2120',
            name: 'Taxes Payable',
            children: {
              OUTPUT_VAT: { code: '2120-01', name: 'Output VAT' },
              VAT_PAYABLE: { code: '2120-02', name: 'VAT Payable' },
              INCOME_TAX_PAYABLE: { code: '2120-03', name: 'Income Tax Payable' },
              WT_PAYABLE: { code: '2120-04', name: 'Withholding Tax Payable' },
              SSS_PAYABLE: { code: '2120-05', name: 'SSS Contributions Payable' },
              PHILHEALTH_PAYABLE: { code: '2120-06', name: 'PhilHealth Contributions Payable' },
              PAGIBIG_PAYABLE: { code: '2120-07', name: 'Pag-IBIG Contributions Payable' },
            }
          },
          ACCRUED_EXPENSES: {
            code: '2130',
            name: 'Accrued Expenses',
            children: {
              ACCRUED_SALARIES: { code: '2130-01', name: 'Accrued Salaries' },
              ACCRUED_UTILITIES: { code: '2130-02', name: 'Accrued Utilities' },
            }
          }
        }
      },

      // NON-CURRENT LIABILITIES (2500-2999)
      NON_CURRENT_LIABILITIES: {
        code: '2500',
        name: 'Non-Current Liabilities',
        children: {
          LOANS_PAYABLE: { code: '2510-01', name: 'Loans Payable - Long Term' }
        }
      }
    }
  },

  // ========================================
  // EQUITY (3000-3999)
  // ========================================
  EQUITY: {
    code: '3000',
    name: 'EQUITY',
    isHeader: true,
    children: {
      CAPITAL: { code: '3100-01', name: 'Capital Stock' },
      ADDITIONAL_PAID_IN_CAPITAL: { code: '3100-02', name: 'Additional Paid-in Capital' },
      RETAINED_EARNINGS: { code: '3200-01', name: 'Retained Earnings' },
      DRAWINGS: { code: '3300-01', name: 'Drawings', normalBalance: 'DEBIT' },
      CURRENT_YEAR_EARNINGS: { code: '3900-01', name: 'Current Year Earnings' }
    }
  },

  // ========================================
  // REVENUE (4000-4999)
  // ========================================
  REVENUE: {
    code: '4000',
    name: 'REVENUE',
    isHeader: true,
    children: {
      SALES: {
        code: '4100',
        name: 'Sales',
        children: {
          SALES_REVENUE: { code: '4100-01', name: 'Sales Revenue' },
          SALES_DISCOUNTS: { code: '4100-02', name: 'Sales Discounts', normalBalance: 'DEBIT' },
          SALES_RETURNS: { code: '4100-03', name: 'Sales Returns and Allowances', normalBalance: 'DEBIT' },
        }
      },
      SERVICE_INCOME: { code: '4200-01', name: 'Service Income' }
    }
  },

  // ========================================
  // EXPENSES (5000-5999)
  // ========================================
  EXPENSES: {
    code: '5000',
    name: 'EXPENSES',
    isHeader: true,
    children: {
      COST_OF_SALES: { code: '5100-01', name: 'Cost of Goods Sold' },

      OPERATING_EXPENSES: {
        code: '5200',
        name: 'Operating Expenses',
        isHeader: true,
        children: {
          SALARIES_WAGES: { code: '5200-01', name: 'Salaries and Wages' },
          SSS_EXPENSE: { code: '5200-02', name: 'SSS Contributions' },
          PHILHEALTH_EXPENSE: { code: '5200-03', name: 'PhilHealth Contributions' },
          PAGIBIG_EXPENSE: { code: '5200-04', name: 'Pag-IBIG Contributions' },
          RENT_EXPENSE: { code: '5200-05', name: 'Rent Expense' },
          UTILITIES: { code: '5200-06', name: 'Utilities Expense' },
          REPAIRS_MAINTENANCE: { code: '5200-07', name: 'Repairs and Maintenance' },
          SUPPLIES: { code: '5200-08', name: 'Office Supplies' },
          DEPRECIATION: { code: '5200-09', name: 'Depreciation Expense' },
          TAXES_LICENSES: { code: '5200-10', name: 'Taxes and Licenses' },
          PROFESSIONAL_FEES: { code: '5200-11', name: 'Professional Fees' },
          DELIVERY_EXPENSE: { code: '5200-12', name: 'Freight and Delivery' },
          ADVERTISING: { code: '5200-13', name: 'Advertising and Promotions' },
        }
      }
    }
  },

  // ========================================
  // OTHER INCOME (6000-6999)
  // ========================================
  OTHER_INCOME: {
    code: '6000',
    name: 'OTHER INCOME',
    children: {
      INTEREST_INCOME: { code: '6100-01', name: 'Interest Income' },
      GAIN_ON_SALE: { code: '6100-02', name: 'Gain on Sale of Assets' },
      FOREX_GAIN: { code: '6100-03', name: 'Foreign Exchange Gain' },
    }
  },

  // ========================================
  // OTHER EXPENSES (7000-7999)
  // ========================================
  OTHER_EXPENSES: {
    code: '7000',
    name: 'OTHER EXPENSES',
    children: {
      INTEREST_EXPENSE: { code: '7100-01', name: 'Interest Expense' },
      BANK_CHARGES: { code: '7100-02', name: 'Bank Charges' },
      FOREX_LOSS: { code: '7100-03', name: 'Foreign Exchange Loss' },
    }
  }
}
```

### 4. Database Schema Extensions

```typescript
// Add to prisma/schema.prisma

// Chart of Accounts
model ChartOfAccount {
  id              Int      @id @default(autoincrement())
  businessId      Int
  business        Business @relation(fields: [businessId], references: [id])

  accountCode     String   // e.g., "1110-01"
  accountName     String   // e.g., "Cash in Bank - BPI"
  accountType     String   // ASSET, LIABILITY, EQUITY, REVENUE, EXPENSE

  parentId        Int?
  parent          ChartOfAccount? @relation("AccountHierarchy", fields: [parentId], references: [id])
  children        ChartOfAccount[] @relation("AccountHierarchy")

  isHeader        Boolean  @default(false)  // Header accounts can't have transactions
  normalBalance   String   // DEBIT or CREDIT
  level           Int      @default(1)      // Hierarchy level
  isActive        Boolean  @default(true)

  // Current balance (updated by GL postings)
  currentBalance  Decimal  @default(0) @db.Decimal(15, 2)

  // Audit trail
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  createdBy       Int

  // Relations
  journalEntryLines JournalEntryLine[]
  generalLedger     GeneralLedger[]

  @@unique([businessId, accountCode])
  @@index([businessId, accountType])
  @@index([businessId, parentId])
}

// Journal Entry (Main document)
model JournalEntry {
  id              Int      @id @default(autoincrement())
  businessId      Int
  business        Business @relation(fields: [businessId], references: [id])

  journalNumber   String   // JE-2025-0001
  entryDate       DateTime
  period          String   // "2025-01" (YYYY-MM)
  fiscalYear      Int      // 2025

  description     String
  referenceType   String?  // Sale, Purchase, Payment, Manual
  referenceId     String?

  status          String   @default("draft")  // draft, posted, reversed

  // Totals
  totalDebit      Decimal  @db.Decimal(15, 2)
  totalCredit     Decimal  @db.Decimal(15, 2)
  isBalanced      Boolean  // totalDebit == totalCredit

  // Approval workflow
  approvedBy      Int?
  approvedAt      DateTime?

  // Reversing entry
  reversedBy      Int?
  reversedAt      DateTime?
  reversalOf      Int?     // Links to original JE

  // Audit
  createdBy       Int
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  // Relations
  lines           JournalEntryLine[]
  glEntries       GeneralLedger[]

  @@index([businessId, period])
  @@index([businessId, journalNumber])
  @@index([businessId, status])
}

// Journal Entry Lines (Debit/Credit details)
model JournalEntryLine {
  id              Int      @id @default(autoincrement())
  journalEntryId  Int
  journalEntry    JournalEntry @relation(fields: [journalEntryId], references: [id], onDelete: Cascade)

  accountId       Int
  account         ChartOfAccount @relation(fields: [accountId], references: [id])

  lineNumber      Int      // 1, 2, 3...
  description     String?

  debit           Decimal  @db.Decimal(15, 2) @default(0)
  credit          Decimal  @db.Decimal(15, 2) @default(0)

  // Optional: Tagging for analytics
  locationId      Int?
  location        BusinessLocation? @relation(fields: [locationId], references: [id])

  costCenterId    Int?     // For cost center accounting

  @@index([journalEntryId])
  @@index([accountId])
}

// General Ledger (Posted transactions)
model GeneralLedger {
  id              Int      @id @default(autoincrement())
  businessId      Int
  business        Business @relation(fields: [businessId], references: [id])

  accountId       Int
  account         ChartOfAccount @relation(fields: [accountId], references: [id])

  journalEntryId  Int
  journalEntry    JournalEntry @relation(fields: [journalEntryId], references: [id])

  transactionDate DateTime
  period          String   // "2025-01"
  fiscalYear      Int

  description     String
  referenceType   String?
  referenceId     String?

  debit           Decimal  @db.Decimal(15, 2) @default(0)
  credit          Decimal  @db.Decimal(15, 2) @default(0)

  // Running balance (updated after each posting)
  balanceAfter    Decimal  @db.Decimal(15, 2)

  locationId      Int?
  location        BusinessLocation? @relation(fields: [locationId], references: [id])

  createdAt       DateTime @default(now())

  @@index([businessId, accountId, transactionDate])
  @@index([businessId, period])
  @@index([accountId, transactionDate])
}

// Accounting Period (for period closing)
model AccountingPeriod {
  id              Int      @id @default(autoincrement())
  businessId      Int
  business        Business @relation(fields: [businessId], references: [id])

  period          String   // "2025-01"
  fiscalYear      Int      // 2025

  startDate       DateTime
  endDate         DateTime

  status          String   @default("open")  // open, closed, locked

  closedBy        Int?
  closedAt        DateTime?

  @@unique([businessId, period])
  @@index([businessId, status])
}

// VAT Tracking (Philippines-specific)
model VATTransaction {
  id              Int      @id @default(autoincrement())
  businessId      Int
  business        Business @relation(fields: [businessId], references: [id])

  transactionDate DateTime
  transactionType String   // sale, purchase

  // Reference to source
  saleId          Int?
  sale            Sale? @relation(fields: [saleId], references: [id])

  purchaseId      Int?
  purchase        Purchase? @relation(fields: [purchaseId], references: [id])

  // Amounts
  grossAmount     Decimal  @db.Decimal(15, 2)  // Total including VAT
  vatableAmount   Decimal  @db.Decimal(15, 2)  // Subject to VAT
  vatExempt       Decimal  @db.Decimal(15, 2)  // Exempt from VAT
  zeroRated       Decimal  @db.Decimal(15, 2)  // 0% rated

  inputVAT        Decimal  @db.Decimal(15, 2) @default(0)  // From purchases
  outputVAT       Decimal  @db.Decimal(15, 2) @default(0)  // From sales

  // BIR Form reference
  birForm         String?  // 2550M, 2550Q
  filingPeriod    String?  // "2025-01"

  createdAt       DateTime @default(now())

  @@index([businessId, transactionDate])
  @@index([businessId, filingPeriod])
}
```

## Implementation Patterns

### 1. Initialize Chart of Accounts

```typescript
// /src/lib/accounting/initializeCOA.ts
import { prisma } from '@/lib/prisma'
import { PHILIPPINE_COA } from './philippineCOA'

async function initializeChartOfAccounts(businessId: number, userId: number) {
  await prisma.$transaction(async (tx) => {
    // Recursively create accounts
    async function createAccounts(accounts: any, parentId: number | null = null, level: number = 1) {
      for (const [key, account] of Object.entries(accounts)) {
        const created = await tx.chartOfAccount.create({
          data: {
            businessId,
            accountCode: account.code,
            accountName: account.name,
            accountType: determineAccountType(account.code),
            parentId,
            isHeader: account.isHeader || false,
            normalBalance: account.normalBalance || determineNormalBalance(account.code),
            level,
            isActive: true,
            currentBalance: 0,
            createdBy: userId
          }
        })

        // Create children
        if (account.children) {
          await createAccounts(account.children, created.id, level + 1)
        }
      }
    }

    await createAccounts(PHILIPPINE_COA)
  })
}

function determineAccountType(code: string): string {
  const firstDigit = parseInt(code[0])
  if (firstDigit === 1) return 'ASSET'
  if (firstDigit === 2) return 'LIABILITY'
  if (firstDigit === 3) return 'EQUITY'
  if (firstDigit === 4) return 'REVENUE'
  if (firstDigit === 5) return 'EXPENSE'
  if (firstDigit === 6) return 'OTHER_INCOME'
  if (firstDigit === 7) return 'OTHER_EXPENSE'
  return 'ASSET'
}

function determineNormalBalance(code: string): string {
  const accountType = determineAccountType(code)
  if (['ASSET', 'EXPENSE', 'OTHER_EXPENSE'].includes(accountType)) {
    return 'DEBIT'
  }
  return 'CREDIT'
}
```

### 2. GL Posting for Sales

```typescript
// Automatic GL posting when sale is created
async function postSaleToGL(saleId: number, businessId: number, userId: number) {
  const sale = await prisma.sale.findUnique({
    where: { id: saleId },
    include: { items: true, customer: true }
  })

  const accounts = {
    cashInBank: await getAccount(businessId, '1110-03'),  // Cash in Bank
    accountsReceivable: await getAccount(businessId, '1120-01'),  // AR
    salesRevenue: await getAccount(businessId, '4100-01'),  // Sales Revenue
    outputVAT: await getAccount(businessId, '2120-01'),  // Output VAT
    costOfSales: await getAccount(businessId, '5100-01'),  // COGS
    inventory: await getAccount(businessId, '1130-01')   // Inventory
  }

  await prisma.$transaction(async (tx) => {
    // Generate journal number
    const journalNumber = await generateJournalNumber(tx, businessId)

    // Calculate VAT (12%)
    const grossAmount = parseFloat(sale.totalAmount.toString())
    const vatableAmount = grossAmount / 1.12
    const outputVAT = grossAmount - vatableAmount

    // Entry 1: Record Revenue and VAT
    const je1 = await tx.journalEntry.create({
      data: {
        businessId,
        journalNumber,
        entryDate: sale.saleDate || sale.createdAt,
        period: format(sale.saleDate || sale.createdAt, 'yyyy-MM'),
        fiscalYear: new Date(sale.saleDate || sale.createdAt).getFullYear(),
        description: `Sale #${sale.invoiceNumber}${sale.customer ? ` - ${sale.customer.name}` : ''}`,
        referenceType: 'Sale',
        referenceId: sale.id.toString(),
        status: 'posted',
        totalDebit: grossAmount,
        totalCredit: grossAmount,
        isBalanced: true,
        createdBy: userId,
        approvedBy: userId,
        approvedAt: new Date()
      }
    })

    // DR Cash/AR (depending on payment method)
    const debitAccount = sale.customerId ? accounts.accountsReceivable : accounts.cashInBank
    await createJournalLine(tx, je1.id, debitAccount.id, grossAmount, 0, 1, sale.locationId)

    // CR Sales Revenue
    await createJournalLine(tx, je1.id, accounts.salesRevenue.id, 0, vatableAmount, 2, sale.locationId)

    // CR Output VAT
    await createJournalLine(tx, je1.id, accounts.outputVAT.id, 0, outputVAT, 3, sale.locationId)

    // Post to GL
    await postJournalToGL(tx, je1.id, businessId)

    // Entry 2: Record COGS
    const totalCOGS = sale.items.reduce((sum, item) =>
      sum + (parseFloat(item.costPrice.toString()) * item.quantity), 0
    )

    const je2 = await tx.journalEntry.create({
      data: {
        businessId,
        journalNumber: journalNumber + 'A',
        entryDate: sale.saleDate || sale.createdAt,
        period: format(sale.saleDate || sale.createdAt, 'yyyy-MM'),
        fiscalYear: new Date(sale.saleDate || sale.createdAt).getFullYear(),
        description: `COGS for Sale #${sale.invoiceNumber}`,
        referenceType: 'Sale',
        referenceId: sale.id.toString(),
        status: 'posted',
        totalDebit: totalCOGS,
        totalCredit: totalCOGS,
        isBalanced: true,
        createdBy: userId,
        approvedBy: userId,
        approvedAt: new Date()
      }
    })

    // DR Cost of Sales
    await createJournalLine(tx, je2.id, accounts.costOfSales.id, totalCOGS, 0, 1, sale.locationId)

    // CR Inventory
    await createJournalLine(tx, je2.id, accounts.inventory.id, 0, totalCOGS, 2, sale.locationId)

    // Post to GL
    await postJournalToGL(tx, je2.id, businessId)

    // Record VAT transaction
    await tx.vATTransaction.create({
      data: {
        businessId,
        transactionDate: sale.saleDate || sale.createdAt,
        transactionType: 'sale',
        saleId: sale.id,
        grossAmount,
        vatableAmount,
        vatExempt: 0,
        zeroRated: 0,
        outputVAT
      }
    })
  })
}
```

### 3. GL Posting for Purchases

```typescript
async function postPurchaseToGL(receiptId: number, businessId: number, userId: number) {
  const receipt = await prisma.purchaseReceipt.findUnique({
    where: { id: receiptId },
    include: { items: true, supplier: true }
  })

  const accounts = {
    inventory: await getAccount(businessId, '1130-01'),
    inputVAT: await getAccount(businessId, '1150-01'),
    accountsPayable: await getAccount(businessId, '2110-01')
  }

  await prisma.$transaction(async (tx) => {
    const journalNumber = await generateJournalNumber(tx, businessId)

    // Calculate amounts
    const totalCost = receipt.items.reduce((sum, item) =>
      sum + (parseFloat(item.unitCost.toString()) * item.acceptedQty), 0
    )
    const inputVAT = totalCost * 0.12
    const grossAmount = totalCost + inputVAT

    // Create journal entry
    const je = await tx.journalEntry.create({
      data: {
        businessId,
        journalNumber,
        entryDate: receipt.receivedAt,
        period: format(receipt.receivedAt, 'yyyy-MM'),
        fiscalYear: new Date(receipt.receivedAt).getFullYear(),
        description: `Purchase GRN #${receipt.grnNumber} - ${receipt.supplier.name}`,
        referenceType: 'PurchaseReceipt',
        referenceId: receipt.id.toString(),
        status: 'posted',
        totalDebit: grossAmount,
        totalCredit: grossAmount,
        isBalanced: true,
        createdBy: userId
      }
    })

    // DR Inventory
    await createJournalLine(tx, je.id, accounts.inventory.id, totalCost, 0, 1, receipt.locationId)

    // DR Input VAT
    await createJournalLine(tx, je.id, accounts.inputVAT.id, inputVAT, 0, 2, receipt.locationId)

    // CR Accounts Payable
    await createJournalLine(tx, je.id, accounts.accountsPayable.id, 0, grossAmount, 3, receipt.locationId)

    // Post to GL
    await postJournalToGL(tx, je.id, businessId)

    // Record VAT transaction
    await tx.vATTransaction.create({
      data: {
        businessId,
        transactionDate: receipt.receivedAt,
        transactionType: 'purchase',
        purchaseId: receipt.purchaseOrderId,
        grossAmount,
        vatableAmount: totalCost,
        vatExempt: 0,
        zeroRated: 0,
        inputVAT
      }
    })
  })
}
```

### 4. Post Journal to General Ledger

```typescript
async function postJournalToGL(
  tx: any,
  journalEntryId: number,
  businessId: number
) {
  const je = await tx.journalEntry.findUnique({
    where: { id: journalEntryId },
    include: { lines: { include: { account: true } } }
  })

  for (const line of je.lines) {
    // Get current account balance
    const lastGL = await tx.generalLedger.findFirst({
      where: {
        businessId,
        accountId: line.accountId
      },
      orderBy: { transactionDate: 'desc' }
    })

    const currentBalance = lastGL?.balanceAfter || 0
    const debit = parseFloat(line.debit.toString())
    const credit = parseFloat(line.credit.toString())

    // Calculate new balance based on normal balance
    let balanceAfter = currentBalance
    if (line.account.normalBalance === 'DEBIT') {
      balanceAfter = currentBalance + debit - credit
    } else {
      balanceAfter = currentBalance + credit - debit
    }

    // Create GL entry
    await tx.generalLedger.create({
      data: {
        businessId,
        accountId: line.accountId,
        journalEntryId: je.id,
        transactionDate: je.entryDate,
        period: je.period,
        fiscalYear: je.fiscalYear,
        description: line.description || je.description,
        referenceType: je.referenceType,
        referenceId: je.referenceId,
        debit,
        credit,
        balanceAfter,
        locationId: line.locationId
      }
    })

    // Update account current balance
    await tx.chartOfAccount.update({
      where: { id: line.accountId },
      data: { currentBalance: balanceAfter }
    })
  }
}
```

### 5. Financial Statements

#### Balance Sheet

```typescript
async function generateBalanceSheet(businessId: number, asOfDate: Date) {
  // Get all accounts with balances
  const accounts = await prisma.chartOfAccount.findMany({
    where: {
      businessId,
      isActive: true,
      isHeader: false  // Only detail accounts
    },
    orderBy: { accountCode: 'asc' }
  })

  // Group by account type
  const assets = accounts.filter(a => a.accountType === 'ASSET')
  const liabilities = accounts.filter(a => a.accountType === 'LIABILITY')
  const equity = accounts.filter(a => a.accountType === 'EQUITY')

  const totalAssets = assets.reduce((sum, a) => sum + parseFloat(a.currentBalance.toString()), 0)
  const totalLiabilities = liabilities.reduce((sum, a) => sum + parseFloat(a.currentBalance.toString()), 0)
  const totalEquity = equity.reduce((sum, a) => sum + parseFloat(a.currentBalance.toString()), 0)

  // Get current year earnings (from income statement)
  const currentYearEarnings = await calculateNetIncome(businessId, asOfDate)

  return {
    asOfDate,
    assets: {
      currentAssets: groupByParent(assets.filter(a => a.accountCode.startsWith('11'))),
      nonCurrentAssets: groupByParent(assets.filter(a => a.accountCode.startsWith('15'))),
      total: totalAssets
    },
    liabilities: {
      currentLiabilities: groupByParent(liabilities.filter(a => a.accountCode.startsWith('21'))),
      nonCurrentLiabilities: groupByParent(liabilities.filter(a => a.accountCode.startsWith('25'))),
      total: totalLiabilities
    },
    equity: {
      capital: equity,
      currentYearEarnings,
      total: totalEquity + currentYearEarnings
    },
    balanced: Math.abs(totalAssets - (totalLiabilities + totalEquity + currentYearEarnings)) < 0.01
  }
}
```

#### Income Statement

```typescript
async function generateIncomeStatement(
  businessId: number,
  startDate: Date,
  endDate: Date
) {
  // Get GL entries for the period
  const glEntries = await prisma.generalLedger.findMany({
    where: {
      businessId,
      transactionDate: {
        gte: startDate,
        lte: endDate
      },
      account: {
        accountType: { in: ['REVENUE', 'EXPENSE', 'OTHER_INCOME', 'OTHER_EXPENSE'] }
      }
    },
    include: { account: true }
  })

  // Calculate totals
  const revenue = calculateTotal(glEntries.filter(e => e.account.accountType === 'REVENUE'))
  const cogs = calculateTotal(glEntries.filter(e => e.account.accountCode.startsWith('5100')))
  const operatingExpenses = calculateTotal(glEntries.filter(e => e.account.accountCode.startsWith('5200')))
  const otherIncome = calculateTotal(glEntries.filter(e => e.account.accountType === 'OTHER_INCOME'))
  const otherExpenses = calculateTotal(glEntries.filter(e => e.account.accountType === 'OTHER_EXPENSE'))

  const grossProfit = revenue - cogs
  const operatingIncome = grossProfit - operatingExpenses
  const netIncome = operatingIncome + otherIncome - otherExpenses

  return {
    period: { startDate, endDate },
    revenue,
    costOfGoodsSold: cogs,
    grossProfit,
    grossProfitMargin: revenue > 0 ? (grossProfit / revenue) * 100 : 0,
    operatingExpenses,
    operatingIncome,
    otherIncome,
    otherExpenses,
    netIncome,
    netProfitMargin: revenue > 0 ? (netIncome / revenue) * 100 : 0
  }
}
```

### 6. BIR Form 2550M (Monthly VAT Declaration)

```typescript
async function generateBIRForm2550M(businessId: number, period: string) {
  // period format: "2025-01"
  const [year, month] = period.split('-')
  const startDate = new Date(parseInt(year), parseInt(month) - 1, 1)
  const endDate = new Date(parseInt(year), parseInt(month), 0)

  // Get all VAT transactions for the month
  const vatTransactions = await prisma.vATTransaction.findMany({
    where: {
      businessId,
      transactionDate: { gte: startDate, lte: endDate }
    }
  })

  // Sales (Output VAT)
  const sales = vatTransactions.filter(t => t.transactionType === 'sale')
  const totalSales = sales.reduce((sum, t) => sum + parseFloat(t.grossAmount.toString()), 0)
  const vatableSales = sales.reduce((sum, t) => sum + parseFloat(t.vatableAmount.toString()), 0)
  const outputVAT = sales.reduce((sum, t) => sum + parseFloat(t.outputVAT.toString()), 0)
  const vatExemptSales = sales.reduce((sum, t) => sum + parseFloat(t.vatExempt.toString()), 0)
  const zeroRatedSales = sales.reduce((sum, t) => sum + parseFloat(t.zeroRated.toString()), 0)

  // Purchases (Input VAT)
  const purchases = vatTransactions.filter(t => t.transactionType === 'purchase')
  const totalPurchases = purchases.reduce((sum, t) => sum + parseFloat(t.grossAmount.toString()), 0)
  const vatablePurchases = purchases.reduce((sum, t) => sum + parseFloat(t.vatableAmount.toString()), 0)
  const inputVAT = purchases.reduce((sum, t) => sum + parseFloat(t.inputVAT.toString()), 0)

  // VAT Payable/Excess
  const vatPayable = Math.max(0, outputVAT - inputVAT)
  const vatExcess = Math.max(0, inputVAT - outputVAT)

  return {
    birForm: '2550M',
    period,
    returnPeriod: `${getMonthName(parseInt(month))} ${year}`,

    // Part I: Tax on Sale
    vatableSales,
    vatExemptSales,
    zeroRatedSales,
    totalSales,
    outputVAT,

    // Part II: Tax on Purchases
    vatablePurchases,
    inputVAT,

    // Part III: Computation
    totalOutputVAT: outputVAT,
    lessInputVAT: inputVAT,
    vatPayable,
    vatExcess,

    // Payment details
    dueDate: new Date(parseInt(year), parseInt(month), 20),  // 20th of following month
    amountPayable: vatPayable
  }
}
```

## Best Practices

### ✅ DO:
- **Initialize COA** on business setup
- **Auto-post GL entries** from all financial transactions
- **Validate journal balance** before posting (DR = CR)
- **Use accounting periods** and period closing
- **Track VAT separately** for BIR compliance
- **Require approval** for manual journal entries
- **Support reversing entries** for corrections
- **Generate BIR forms** automatically from transactions
- **Maintain audit trail** for all GL postings
- **Use fiscal year** from business settings

### ❌ DON'T:
- **Don't allow unbalanced journals**
- **Don't post to header accounts**
- **Don't skip VAT recording**
- **Don't modify posted journals** (reverse instead)
- **Don't ignore period closing**
- **Don't forget multi-tenant isolation**

## BIR Compliance Checklist

- [ ] TIN Number configured in business settings
- [ ] VAT registration status set
- [ ] Chart of Accounts follows Philippine standard
- [ ] All sales record Output VAT (12%)
- [ ] All purchases record Input VAT
- [ ] Form 2550M can be generated monthly
- [ ] Form 2550Q can be generated quarterly
- [ ] Withholding tax tracked and recorded
- [ ] Sales invoices numbered sequentially
- [ ] Official receipts tracked
- [ ] Z-Reading for daily sales
- [ ] Books of accounts maintained

## Related Skills
- `pos-inventory-valuation-engine` - Provides inventory GL values
- `pos-cost-basis-tracker` - COGS for GL posting
- `pos-financial-impact-analyzer` - GL entry generation
- `pos-audit-trail-architect` - Audit logs for accounting changes

## References
- BIR: Bureau of Internal Revenue (www.bir.gov.ph)
- PFRS: Philippine Financial Reporting Standards
- Tax Code: National Internal Revenue Code (NIRC)
- Forms: BIR Forms 2550M, 2550Q, 1701, 2307, 1601C
