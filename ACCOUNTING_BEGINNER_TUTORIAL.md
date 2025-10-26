# 📚 ACCOUNTING MODULE - COMPLETE BEGINNER'S TUTORIAL

**For Users Who Know Nothing About Accounting**

This tutorial will walk you through **EVERY STEP** to set up and test your new accounting system. No accounting knowledge required!

---

## 🎯 What We'll Do in This Tutorial

1. ✅ Initialize the Chart of Accounts (create the account structure)
2. ✅ Enter beginning balances (your starting financial position)
3. ✅ Record sample transactions
4. ✅ View and understand each financial report
5. ✅ Verify everything is working correctly

**Time Required**: 20-30 minutes
**What You Need**: Super Admin login credentials

---

## 📝 STEP 1: Login and Access Accounting

### 1.1 Login to Your System

```
URL: http://localhost:3000/login
Username: superadmin
Password: password
```

### 1.2 Find the Accounting Menu

After login, look at the left sidebar. You should see:
- Dashboard
- Analytics Dashboard
- POS & Sales
- ... (other menus)
- **📊 Accounting** ← Look for this!

If you DON'T see "Accounting", it means:
- You don't have `ACCOUNTING_ACCESS` permission
- Only Super Admin has it by default
- Make sure you're logged in as Super Admin

### 1.3 Click on "Accounting"

You should see 4 sub-menus:
- Balance Sheet
- Income Statement
- Trial Balance
- General Ledger

---

## 🗄️ STEP 2: Initialize Chart of Accounts

**What is Chart of Accounts?**
Think of it as creating folders to organize your money. Each "account" is like a folder where specific types of transactions are stored.

### 2.1 Create the Initialization API Route

First, we need to create an API endpoint to initialize accounts. Create this file:

**File**: `src/app/api/accounting/chart-of-accounts/initialize/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { hasPermission, PERMISSIONS } from '@/lib/rbac'
import { initializeChartOfAccounts } from '@/lib/chartOfAccounts'

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!hasPermission(session.user, PERMISSIONS.ACCOUNTING_ACCESS)) {
      return NextResponse.json(
        { error: 'You do not have permission to access accounting features' },
        { status: 403 }
      )
    }

    // Check if already initialized
    const existingAccounts = await prisma.chartOfAccounts.count({
      where: { businessId: session.user.businessId }
    })

    if (existingAccounts > 0) {
      return NextResponse.json(
        {
          error: 'Chart of Accounts already initialized',
          message: `Found ${existingAccounts} existing accounts`
        },
        { status: 400 }
      )
    }

    // Initialize Chart of Accounts
    const accounts = await initializeChartOfAccounts(session.user.businessId)

    return NextResponse.json({
      success: true,
      message: `Successfully created ${accounts.length} accounts`,
      data: accounts
    })
  } catch (error) {
    console.error('Initialize COA Error:', error)
    return NextResponse.json(
      {
        error: 'Failed to initialize Chart of Accounts',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
```

### 2.2 Initialize Using API (Postman, Insomnia, or Browser Console)

**Using Browser Console** (easiest way):

1. Open your browser
2. Navigate to: `http://localhost:3000/dashboard`
3. Press F12 to open Developer Tools
4. Go to "Console" tab
5. Paste this code:

```javascript
fetch('/api/accounting/chart-of-accounts/initialize', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' }
})
.then(res => res.json())
.then(data => {
  console.log('✅ Chart of Accounts Initialized!');
  console.log(data);
})
.catch(err => {
  console.error('❌ Error:', err);
});
```

6. Press Enter
7. You should see: "✅ Chart of Accounts Initialized!"

**What Just Happened?**
You created 20+ standard accounting accounts:
- **Assets**: Cash, Accounts Receivable, Inventory, Equipment
- **Liabilities**: Accounts Payable, Sales Tax Payable
- **Equity**: Owner's Equity, Retained Earnings
- **Revenue**: Sales Revenue, Service Revenue
- **Expenses**: Cost of Goods Sold, Rent, Salaries, Utilities, etc.

---

## 💰 STEP 3: Enter Beginning Balances

**What are Beginning Balances?**
These are your starting numbers - what you already have before you start using the system.

### 3.1 Gather Your Current Financial Information

Before entering data, you need to know:

**What you OWN (Assets)**:
- 💵 How much cash do you have? (in bank and on hand)
- 🏪 What's your inventory worth? (total value of products)
- 👥 Does anyone owe you money? (customers who haven't paid)
- 🖥️ Do you own equipment? (computers, furniture, vehicles)

**What you OWE (Liabilities)**:
- 📋 Do you owe suppliers money? (unpaid bills)
- 💳 Do you have loans? (bank loans, credit lines)
- 🏛️ Do you owe taxes?

**Owner's Investment (Equity)**:
- 💼 How much did the owner put into the business?

### 3.2 Example Scenario - Let's Use Real Numbers

Let's say you're starting with:
- **Cash**: $10,000 (in your bank account)
- **Inventory**: $25,000 (value of products in stock)
- **Equipment**: $5,000 (computers, furniture)
- **Accounts Payable**: $8,000 (you owe suppliers)
- **Owner's Equity**: $32,000 (owner's investment)

**Quick Check**: Assets ($40,000) = Liabilities ($8,000) + Equity ($32,000) ✅

### 3.3 Create Journal Entry API for Beginning Balances

Create this file: `src/app/api/accounting/journal-entries/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { hasPermission, PERMISSIONS } from '@/lib/rbac'
import { prisma } from '@/lib/prisma'

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!hasPermission(session.user, PERMISSIONS.ACCOUNTING_ACCESS)) {
      return NextResponse.json(
        { error: 'No accounting access' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { entryDate, description, lines } = body

    // Validate lines balance
    const totalDebits = lines.reduce((sum: number, line: any) => sum + Number(line.debit), 0)
    const totalCredits = lines.reduce((sum: number, line: any) => sum + Number(line.credit), 0)

    if (Math.abs(totalDebits - totalCredits) > 0.01) {
      return NextResponse.json(
        { error: `Entry is not balanced. Debits: ${totalDebits}, Credits: ${totalCredits}` },
        { status: 400 }
      )
    }

    // Get accounts
    const accountCodes = lines.map((line: any) => line.accountCode)
    const accounts = await prisma.chartOfAccounts.findMany({
      where: {
        businessId: session.user.businessId,
        accountCode: { in: accountCodes }
      }
    })

    if (accounts.length !== accountCodes.length) {
      return NextResponse.json(
        { error: 'One or more account codes not found' },
        { status: 400 }
      )
    }

    // Create journal entry
    const entry = await prisma.journalEntry.create({
      data: {
        businessId: session.user.businessId,
        entryDate: new Date(entryDate),
        description,
        status: 'posted',
        balanced: true,
        createdBy: session.user.id,
        lines: {
          create: lines.map((line: any) => {
            const account = accounts.find(a => a.accountCode === line.accountCode)!
            return {
              accountId: account.id,
              debit: Number(line.debit),
              credit: Number(line.credit),
              description: line.description || description
            }
          })
        }
      },
      include: { lines: true }
    })

    return NextResponse.json({
      success: true,
      data: entry
    })
  } catch (error) {
    console.error('Journal Entry Error:', error)
    return NextResponse.json(
      { error: 'Failed to create journal entry', details: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 }
    )
  }
}
```

### 3.4 Enter Beginning Balances Using Browser Console

Open Developer Console (F12) again and run this:

```javascript
// Beginning Balances Entry
fetch('/api/accounting/journal-entries', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    entryDate: '2025-01-01', // Your starting date
    description: 'Beginning Balances - Opening Entry',
    lines: [
      // ASSETS (Debits)
      {
        accountCode: '1000', // Cash
        debit: 10000,
        credit: 0,
        description: 'Cash on hand and in bank'
      },
      {
        accountCode: '1200', // Inventory
        debit: 25000,
        credit: 0,
        description: 'Inventory at cost'
      },
      {
        accountCode: '1500', // Equipment
        debit: 5000,
        credit: 0,
        description: 'Office equipment and furniture'
      },
      // LIABILITIES (Credits)
      {
        accountCode: '2000', // Accounts Payable
        debit: 0,
        credit: 8000,
        description: 'Amount owed to suppliers'
      },
      // EQUITY (Credit)
      {
        accountCode: '3000', // Owner's Equity
        debit: 0,
        credit: 32000,
        description: 'Owner investment and retained earnings'
      }
    ]
  })
})
.then(res => res.json())
.then(data => {
  if (data.success) {
    console.log('✅ Beginning Balances Entered Successfully!');
    console.log(data);
  } else {
    console.error('❌ Error:', data.error);
  }
});
```

**What Just Happened?**
You recorded your starting financial position! The system now knows:
- You have $10,000 cash
- You have $25,000 in inventory
- You have $5,000 in equipment
- You owe suppliers $8,000
- The owner put in $32,000

---

## 📊 STEP 4: View Your First Balance Sheet

### 4.1 Navigate to Balance Sheet

1. Click **Accounting → Balance Sheet** in sidebar
2. Select today's date
3. Click "Generate Report"

### 4.2 What You Should See

**ASSETS Section (Green)**:
```
Current Assets:
  Cash                    $10,000
  Inventory               $25,000
Fixed Assets:
  Equipment                $5,000
------------------------
TOTAL ASSETS:           $40,000
```

**LIABILITIES Section (Orange)**:
```
Current Liabilities:
  Accounts Payable         $8,000
------------------------
TOTAL LIABILITIES:        $8,000
```

**EQUITY Section (Green)**:
```
Owner's Equity           $32,000
------------------------
TOTAL EQUITY:           $32,000
```

**Validation**:
✅ **BALANCED!** Assets ($40,000) = Liabilities ($8,000) + Equity ($32,000)

### 4.3 Explore Features

**Try This**:
- ❓ Click "What is this?" button → Read about Balance Sheets
- 🔍 Hover over "Cash" → See explanation tooltip
- 📊 Look at Key Metrics:
  - Working Capital: $27,000 (good!)
  - Current Ratio: Very healthy
  - Debt-to-Equity: Low debt

---

## 💸 STEP 5: Record Your First Sale

Let's record a sale to see how it affects your financial statements.

### 5.1 Record a Cash Sale

**Scenario**: You sold $1,000 worth of products for cash. The products cost you $600.

```javascript
// Sale Transaction (simplified)
fetch('/api/accounting/journal-entries', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    entryDate: '2025-10-26',
    description: 'Sale #001 - Cash sale',
    lines: [
      // Receive cash
      {
        accountCode: '1000', // Cash
        debit: 1000,
        credit: 0,
        description: 'Cash received from customer'
      },
      // Record revenue
      {
        accountCode: '4000', // Sales Revenue
        debit: 0,
        credit: 1000,
        description: 'Sales revenue'
      },
      // Record cost of goods sold
      {
        accountCode: '5000', // COGS
        debit: 600,
        credit: 0,
        description: 'Cost of products sold'
      },
      // Reduce inventory
      {
        accountCode: '1200', // Inventory
        debit: 0,
        credit: 600,
        description: 'Inventory reduction'
      }
    ]
  })
})
.then(res => res.json())
.then(data => {
  if (data.success) {
    console.log('✅ Sale Recorded!');
  }
});
```

**What Happened?**
- Your **Cash** increased by $1,000
- Your **Inventory** decreased by $600 (what it cost you)
- You earned **Revenue** of $1,000
- You had **COGS** (expense) of $600
- **Net Profit** on this sale: $400 ($1,000 - $600)

---

## 📈 STEP 6: View Your Income Statement

### 6.1 Navigate to Income Statement

1. Click **Accounting → Income Statement**
2. Select date range:
   - Start Date: 2025-01-01 (or your beginning date)
   - End Date: Today's date
3. Click "Generate Report"

### 6.2 What You Should See

```
🎉 PROFIT! $400

REVENUE (Green Section):
  Sales Revenue           $1,000
------------------------
TOTAL REVENUE:          $1,000

COST OF GOODS SOLD (Orange):
  COGS                      $600
------------------------
TOTAL COGS:               $600

GROSS PROFIT (Blue):
  Gross Profit              $400
  Margin: 40%

OPERATING EXPENSES:
  (None yet)                  $0

NET INCOME (Bottom Line):
  Profit:                   $400
  Net Margin: 40%
```

**Interpretation**:
✅ "Congratulations! You made a profit of $400. Your revenue exceeded expenses."

### 6.3 Explore Features

- 🔍 Hover over "Gross Profit" → See explanation
- 📊 Check metrics:
  - Gross Profit Margin: 40%
  - Net Profit Margin: 40%

---

## 🏦 STEP 7: Record an Expense

Let's pay rent to see how expenses affect your reports.

### 7.1 Record Rent Payment

**Scenario**: You paid $2,000 rent for the month.

```javascript
fetch('/api/accounting/journal-entries', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    entryDate: '2025-10-26',
    description: 'Rent payment for October',
    lines: [
      // Record expense
      {
        accountCode: '5100', // Rent Expense
        debit: 2000,
        credit: 0,
        description: 'Monthly rent'
      },
      // Pay cash
      {
        accountCode: '1000', // Cash
        debit: 0,
        credit: 2000,
        description: 'Cash paid for rent'
      }
    ]
  })
})
.then(res => res.json())
.then(data => {
  if (data.success) {
    console.log('✅ Rent Expense Recorded!');
  }
});
```

**What Happened?**
- **Cash** decreased by $2,000
- **Rent Expense** increased by $2,000
- This will reduce your profit

---

## 📊 STEP 8: Updated Financial Statements

### 8.1 View Updated Income Statement

Go back to Income Statement and regenerate. Now you should see:

```
⚠️ LOSS! ($1,600)

REVENUE:
  Sales Revenue           $1,000

COGS:
  Cost of Goods Sold        $600

GROSS PROFIT:              $400

OPERATING EXPENSES:
  Rent Expense            $2,000
------------------------
TOTAL EXPENSES:         $2,000

NET INCOME (Loss):      ($1,600)
```

**Interpretation**:
"You had a loss of $1,600. Expenses exceeded revenue. Review your costs and pricing."

**This is NORMAL!** With only one sale and $2,000 rent, you have a loss. As you make more sales, you'll become profitable.

### 8.2 View Updated Balance Sheet

Balance Sheet now shows:
- **Cash**: $9,000 ($10,000 - $2,000 rent + $1,000 sale)
- **Inventory**: $24,400 ($25,000 - $600 sold)
- **Retained Earnings**: Reflects the ($1,600) loss

---

## ✅ STEP 9: Verify with Trial Balance

### 9.1 Check Trial Balance

1. Click **Accounting → Trial Balance**
2. Select today's date
3. Click "Generate Report"

### 9.2 What You Should See

You'll see ALL accounts with their balances:

| Account | Type | Debit | Credit |
|---------|------|-------|--------|
| Cash | Asset | $9,000 | — |
| Inventory | Asset | $24,400 | — |
| Equipment | Asset | $5,000 | — |
| Accounts Payable | Liability | — | $8,000 |
| Owner's Equity | Equity | — | $32,000 |
| Sales Revenue | Revenue | — | $1,000 |
| COGS | Expense | $600 | — |
| Rent Expense | Expense | $2,000 | — |
| **TOTALS** | | **$41,000** | **$41,000** |

**Status**: ✅ **BALANCED!** Debits = Credits

**What This Means**:
Your books are correct! All transactions were recorded properly.

---

## 🔍 STEP 10: Drill Down with General Ledger

### 10.1 View Cash Account History

1. Click **Accounting → General Ledger**
2. Filter by Account Code: `1000` (Cash)
3. Click "Apply"

### 10.2 What You Should See

**Cash Account (1000)**

| Date | Description | Entry # | Debit | Credit | Balance |
|------|-------------|---------|-------|--------|---------|
| Opening | Opening Balance | — | — | — | $0 |
| 01/01 | Beginning Balances | JE-1 | $10,000 | — | $10,000 |
| 10/26 | Sale #001 - Cash sale | JE-2 | $1,000 | — | $11,000 |
| 10/26 | Rent payment | JE-3 | — | $2,000 | $9,000 |
| **Closing** | **Closing Balance** | | **$11,000** | **$2,000** | **$9,000** |

**This shows EVERY transaction that affected your cash!**

---

## 🎯 STEP 11: Add More Transactions (Practice)

Now that you understand the basics, try adding more transactions:

### Example 1: Pay a Supplier

```javascript
fetch('/api/accounting/journal-entries', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    entryDate: '2025-10-27',
    description: 'Payment to Supplier ABC',
    lines: [
      {
        accountCode: '2000', // Accounts Payable
        debit: 1000,
        credit: 0,
        description: 'Paid portion of supplier debt'
      },
      {
        accountCode: '1000', // Cash
        debit: 0,
        credit: 1000,
        description: 'Cash paid to supplier'
      }
    ]
  })
})
.then(res => res.json())
.then(data => console.log(data));
```

### Example 2: Another Sale

```javascript
fetch('/api/accounting/journal-entries', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    entryDate: '2025-10-27',
    description: 'Sale #002 - Credit sale',
    lines: [
      // Customer will pay later (Accounts Receivable)
      {
        accountCode: '1100', // Accounts Receivable
        debit: 2000,
        credit: 0,
        description: 'Customer owes us'
      },
      {
        accountCode: '4000', // Sales Revenue
        debit: 0,
        credit: 2000,
        description: 'Sales revenue'
      },
      {
        accountCode: '5000', // COGS
        debit: 1200,
        credit: 0,
        description: 'Cost of products sold'
      },
      {
        accountCode: '1200', // Inventory
        debit: 0,
        credit: 1200,
        description: 'Inventory reduction'
      }
    ]
  })
})
.then(res => res.json())
.then(data => console.log(data));
```

---

## ✅ Testing Checklist

After completing all steps, verify:

### Balance Sheet
- [ ] Shows all your assets (cash, inventory, equipment)
- [ ] Shows your liabilities (accounts payable)
- [ ] Shows owner's equity
- [ ] Status shows "✅ BALANCED"
- [ ] Assets = Liabilities + Equity
- [ ] Key metrics display correctly
- [ ] Tooltips work when hovering
- [ ] "What is this?" help button works

### Income Statement
- [ ] Shows all revenue
- [ ] Shows all expenses (COGS, rent)
- [ ] Calculates net income correctly
- [ ] Shows profit or loss status
- [ ] Gross profit calculated correctly
- [ ] Margins display as percentages
- [ ] Quick period buttons work
- [ ] Help content loads

### Trial Balance
- [ ] Lists all accounts
- [ ] Shows debit and credit columns
- [ ] Total debits = Total credits
- [ ] Status shows "✅ BALANCED"
- [ ] Account types are color-coded
- [ ] Summary statistics are correct

### General Ledger
- [ ] Shows transaction details
- [ ] Running balance calculates correctly
- [ ] Filters work (date, account, type)
- [ ] Opening and closing balances are correct
- [ ] Can drill down to specific accounts

### General Features
- [ ] Dark mode works correctly
- [ ] Mobile responsive (test on phone)
- [ ] No console errors (check F12 console)
- [ ] All tooltips display
- [ ] All help dialogs open
- [ ] Export buttons show (even if not functional yet)

---

## 🎓 Understanding Your Results

### What's Normal?

**First Month Often Shows Loss**:
- This is NORMAL when starting out
- You have full rent but limited sales
- As sales increase, you'll become profitable

**Balance Sheet Always Balances**:
- Assets ALWAYS equal Liabilities + Equity
- If not balanced, there's an entry error
- Use Trial Balance to find errors

**Cash vs. Profit Are Different**:
- You can have profit but low cash (if customers haven't paid)
- You can have cash but loss (if you took a loan)
- Both reports are important!

---

## ❓ Troubleshooting Common Issues

### "Chart of Accounts already initialized"
**Solution**: That's fine! It means Step 2 is complete. Skip to Step 3.

### "Entry is not balanced"
**Cause**: Total debits don't equal total credits.
**Solution**: Double-check your numbers. Debits must always equal credits.

### "Account code not found"
**Cause**: Using wrong account code or accounts not initialized.
**Solution**:
1. Verify Chart of Accounts is initialized
2. Check account codes (1000=Cash, 1200=Inventory, etc.)

### "Trial Balance shows UNBALANCED"
**Cause**: Error in journal entry.
**Solution**:
1. Review each journal entry
2. Verify debits = credits for each entry
3. Find and correct the error

### "Balance Sheet shows $0 everywhere"
**Cause**: No beginning balances or transactions recorded.
**Solution**: Complete Steps 3, 5, and 7 to add transactions.

---

## 🚀 Next Steps

### Once Comfortable with Basics:

1. **Use Your Real POS System**:
   - Make actual sales through POS
   - These automatically create accounting entries!
   - View them in Income Statement

2. **Monthly Process**:
   - Generate Income Statement for the month
   - Check if you made profit
   - Generate Balance Sheet to see financial position
   - Run Trial Balance to verify accuracy

3. **Grant Access to Others**:
   - When ready, grant `ACCOUNTING_ACCESS` to accountant
   - Or assign "Accountant" role
   - Share this tutorial with them

4. **Expand Knowledge**:
   - Use "What is this?" buttons to learn
   - Hover over terms for definitions
   - Read the accounting glossary
   - Watch your business grow!

---

## 📚 Additional Resources

**In Your System**:
- Every report has "What is this?" help button
- Hover over ANY field for explanation
- Check `ACCOUNTING_MODULE_COMPLETE_USER_GUIDE.md`
- Review `ACCOUNTING_MODULE_IMPLEMENTATION_COMPLETE.md`

**Key Account Codes Reference**:
```
ASSETS (1000-1999):
- 1000 = Cash
- 1100 = Accounts Receivable
- 1200 = Inventory
- 1500 = Equipment

LIABILITIES (2000-2999):
- 2000 = Accounts Payable
- 2100 = Sales Tax Payable

EQUITY (3000-3999):
- 3000 = Owner's Equity
- 3100 = Retained Earnings

REVENUE (4000-4999):
- 4000 = Sales Revenue
- 4100 = Service Revenue

EXPENSES (5000-5999):
- 5000 = Cost of Goods Sold (COGS)
- 5100 = Rent Expense
- 5200 = Salary Expense
- 5300 = Utilities Expense
- 5400 = Advertising Expense
- 5500 = Office Supplies Expense
```

---

## 🎉 Congratulations!

You've successfully:
- ✅ Set up your Chart of Accounts
- ✅ Entered beginning balances
- ✅ Recorded transactions
- ✅ Generated financial statements
- ✅ Verified everything is balanced

**You now have a working accounting system!**

Every sale you make through your POS automatically updates these reports. You can check your financial health anytime by viewing the reports.

---

## 💡 Remember

1. **You don't need to be an accountant** - The system explains everything
2. **Debits always equal credits** - This is the golden rule
3. **Assets = Liabilities + Equity** - This ALWAYS balances
4. **Profit ≠ Cash** - Both are important to track
5. **Trial Balance is your friend** - Run it to verify accuracy
6. **Use the help features** - Click "?" buttons, hover for tooltips

---

**Questions? Check the help buttons in the accounting reports!**

**Happy Accounting!** 📊💰🎉
