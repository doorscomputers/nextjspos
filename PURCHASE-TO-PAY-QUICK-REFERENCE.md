# Purchase-to-Pay Workflow - Quick Reference Guide

## For Developers Building the UI

This quick reference provides all the essential information you need to build the UI pages for the complete purchase-to-pay workflow.

---

## The Complete Workflow in 5 Steps

```
1. CREATE PURCHASE ORDER
   └─ POST /api/purchases
   └─ Result: PO-202510-0001 (status: pending)

2. CREATE GOODS RECEIPT
   └─ POST /api/purchases/{id}/receive
   └─ Result: GRN-202510-0001 (status: pending, inventory NOT updated)

3. APPROVE RECEIPT → UPDATES INVENTORY
   └─ POST /api/purchases/receipts/{id}/approve
   └─ Result: Inventory added, AP entry auto-created

4. VIEW ACCOUNTS PAYABLE
   └─ GET /api/accounts-payable
   └─ Result: Shows what you owe suppliers

5. MAKE PAYMENT
   └─ POST /api/payments
   └─ Result: PAY-202510-0001, AP balance reduced
```

---

## API Endpoints Cheat Sheet

### Purchases

| Method | Endpoint | Permission | Purpose |
|--------|----------|------------|---------|
| GET | `/api/purchases` | PURCHASE_VIEW | List all POs |
| POST | `/api/purchases` | PURCHASE_CREATE | Create new PO |
| POST | `/api/purchases/{id}/receive` | PURCHASE_RECEIPT_CREATE | Create GRN |
| POST | `/api/purchases/receipts/{id}/approve` | PURCHASE_RECEIPT_APPROVE | Approve GRN & update inventory |

### Accounts Payable

| Method | Endpoint | Permission | Purpose |
|--------|----------|------------|---------|
| GET | `/api/accounts-payable` | ACCOUNTS_PAYABLE_VIEW | List all AP with aging |
| GET | `/api/accounts-payable/{id}` | ACCOUNTS_PAYABLE_VIEW | Get AP details |
| POST | `/api/accounts-payable` | ACCOUNTS_PAYABLE_CREATE | Create AP entry |
| PUT | `/api/accounts-payable/{id}` | ACCOUNTS_PAYABLE_UPDATE | Update AP entry |
| DELETE | `/api/accounts-payable/{id}` | ACCOUNTS_PAYABLE_DELETE | Delete AP entry |

### Payments

| Method | Endpoint | Permission | Purpose |
|--------|----------|------------|---------|
| GET | `/api/payments` | PAYMENT_VIEW | List all payments |
| POST | `/api/payments` | PAYMENT_CREATE | Create payment |

### Post-Dated Cheques

| Method | Endpoint | Permission | Purpose |
|--------|----------|------------|---------|
| GET | `/api/post-dated-cheques` | PAYMENT_VIEW | List PDCs |
| GET | `/api/post-dated-cheques?upcoming=true` | PAYMENT_VIEW | Get upcoming PDCs (next 7 days) |

---

## UI Pages to Build

### 1. Purchase List Page: `/dashboard/purchases`

**Features:**
- Data table with columns: PO Number, Date, Supplier, Location, Total Amount, Status, Actions
- Filters: Status, Supplier, Location, Date Range
- Status badges with colors:
  - `pending` - Yellow
  - `ordered` - Blue
  - `partially_received` - Orange
  - `received` - Green
  - `cancelled` - Red
- Actions: View, Receive (if not fully received), Cancel
- Pagination (50 items per page)
- Search by PO number or supplier name

**API Call:**
```typescript
GET /api/purchases?status=pending&page=1&limit=50
```

**Sample Code:**
```typescript
const { data } = await fetch('/api/purchases?page=1&limit=50')
// Returns: { purchases: [...], pagination: {...} }
```

---

### 2. Purchase Detail & Approval Page: `/dashboard/purchases/{id}`

**Features:**
- Purchase header info: PO Number, Supplier, Date, Location, Status
- Items table: Product, Quantity Ordered, Quantity Received, Unit Cost, Total
- Receipts (GRNs) section:
  - List all GRNs for this purchase
  - For pending GRNs, show "Approve" button
- Approval workflow UI:
  ```
  [ ] I have verified the products, quantities, and prices
  [Update Inventory Button] (disabled until checkbox ticked)
  ```
- After approval: Show success message, redirect to updated purchase

**Key Logic:**
```typescript
// Checkbox state
const [verified, setVerified] = useState(false)

// Approve handler
const handleApprove = async (receiptId) => {
  if (!verified) {
    alert('Please verify the receipt first')
    return
  }

  await fetch(`/api/purchases/receipts/${receiptId}/approve`, {
    method: 'POST'
  })

  // Reload purchase data
}
```

---

### 3. Accounts Payable Dashboard: `/dashboard/accounts-payable`

**Features:**
- Summary cards:
  - Total Outstanding
  - Overdue Amount
  - Due This Week
  - Due This Month
- Aging analysis bar chart:
  - Current
  - 1-30 days
  - 31-60 days
  - 61-90 days
  - 90+ days
- Data table: Invoice Number, Supplier, Invoice Date, Due Date, Total, Paid, Balance, Status, Actions
- Filters: Supplier, Payment Status, Overdue Only
- Status badges:
  - `unpaid` - Red
  - `partial` - Orange
  - `paid` - Green
  - `overdue` - Dark Red (if dueDate < today && status != paid)
- Actions: View, Make Payment, Edit

**API Call:**
```typescript
GET /api/accounts-payable?page=1&limit=50
// Returns: { accountsPayable: [...], pagination: {...}, aging: {...} }
```

**Aging Chart Data:**
```typescript
const aging = data.aging
// { current: 5000, days30: 2500, days60: 1200, days90: 800, over90: 500 }
```

---

### 4. Payment Form: `/dashboard/payments/new`

**Features:**
- Supplier selection (dropdown)
- Load outstanding AP entries for selected supplier
- Select AP entry to pay (or "None" for advance payment)
- Show: Invoice Number, Total Amount, Paid Amount, Balance
- Payment details:
  - Payment Date (date picker)
  - Payment Method (dropdown: Cash, Cheque, Bank Transfer, Credit Card, Debit Card)
  - Amount (number input, max = AP balance)
  - Conditional fields based on method:
    - **Cheque:** Cheque Number, Cheque Date, Bank Name
    - **Bank Transfer:** Transaction Reference, Bank Name
    - **Card:** Transaction Reference
  - Post-Dated Cheque checkbox (only for cheque method)
  - Notes (textarea)
- Submit button: "Create Payment"

**Form Validation:**
- Payment amount must not exceed balance
- Cheque payments require cheque number and date
- If cheque date > today, must check post-dated box
- All required fields must be filled

**API Call:**
```typescript
POST /api/payments
{
  "accountsPayableId": 5,
  "supplierId": 10,
  "paymentDate": "2025-10-09",
  "paymentMethod": "cheque",
  "amount": 1000.00,
  "chequeNumber": "CHQ-12345",
  "chequeDate": "2025-10-15",
  "bankName": "ABC Bank",
  "isPostDated": true,
  "notes": "Payment for October invoice"
}
```

---

### 5. Payment History Page: `/dashboard/payments`

**Features:**
- Data table: Payment Number, Date, Supplier, Method, Amount, Status, Actions
- Filters: Supplier, Payment Method, Date Range
- Payment method badges with icons:
  - Cash (💵)
  - Cheque (✓)
  - Bank Transfer (🏦)
  - Credit Card (💳)
  - Debit Card (💳)
- Status badges:
  - `completed` - Green
  - `pending` - Yellow
  - `bounced` - Red
  - `cancelled` - Gray
- Show PDC indicator for post-dated cheques
- Actions: View Details, Print Receipt

**API Call:**
```typescript
GET /api/payments?page=1&limit=50
// Returns: { payments: [...], pagination: {...} }
```

---

### 6. Post-Dated Cheques Page: `/dashboard/post-dated-cheques`

**Features:**
- Upcoming cheques alert (due within 7 days)
- Data table: Cheque Number, Supplier, Cheque Date, Amount, Bank, Status, Actions
- Filters: Supplier, Status, Date Range
- Upcoming filter toggle
- Status badges:
  - `pending` - Yellow
  - `cleared` - Green
  - `bounced` - Red
  - `cancelled` - Gray
- Actions: Mark as Cleared, Mark as Bounced, View Payment

**API Calls:**
```typescript
// All PDCs
GET /api/post-dated-cheques?page=1&limit=50

// Upcoming PDCs (next 7 days)
GET /api/post-dated-cheques?upcoming=true
```

---

### 7. Supplier Management Page: `/dashboard/suppliers`

**Features:**
- Data table: Name, Contact Person, Phone, Email, Payment Terms, Outstanding Balance, Actions
- Create/Edit supplier form:
  - Basic Info: Name, Contact Person, Email, Phone, Alternate Number
  - Address: Street, City, State, Country, Zip Code
  - Tax Info: Tax Number
  - Credit: Credit Limit, Payment Terms (in days)
  - Status: Active/Inactive toggle
- Show outstanding AP balance
- Quick link to view supplier's purchases
- Quick link to view supplier's payments
- Actions: Edit, View Details, Deactivate/Activate

**API Call:**
```typescript
GET /api/suppliers?page=1&limit=50
// Existing endpoint - already implemented
```

---

## Common UI Components Needed

### Status Badge Component
```typescript
interface StatusBadgeProps {
  status: 'pending' | 'approved' | 'completed' | 'unpaid' | 'paid' | 'partial' | 'overdue'
  variant?: 'default' | 'outline'
}

const StatusBadge = ({ status, variant = 'default' }: StatusBadgeProps) => {
  const colors = {
    pending: 'bg-yellow-100 text-yellow-800',
    approved: 'bg-green-100 text-green-800',
    completed: 'bg-green-100 text-green-800',
    unpaid: 'bg-red-100 text-red-800',
    partial: 'bg-orange-100 text-orange-800',
    paid: 'bg-green-100 text-green-800',
    overdue: 'bg-red-100 text-red-800'
  }

  return (
    <span className={`px-2 py-1 rounded-full text-xs font-medium ${colors[status]}`}>
      {status.toUpperCase()}
    </span>
  )
}
```

### Currency Display Component
```typescript
interface CurrencyProps {
  amount: number | string
  currency?: string
}

const Currency = ({ amount, currency = 'USD' }: CurrencyProps) => {
  const formatted = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency
  }).format(Number(amount))

  return <span className="font-medium">{formatted}</span>
}
```

### Aging Chart Component
```typescript
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'

const AgingChart = ({ aging }) => {
  const data = [
    { name: 'Current', amount: aging.current },
    { name: '1-30', amount: aging.days30 },
    { name: '31-60', amount: aging.days60 },
    { name: '61-90', amount: aging.days90 },
    { name: '90+', amount: aging.over90 }
  ]

  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={data}>
        <XAxis dataKey="name" />
        <YAxis />
        <Tooltip />
        <Bar dataKey="amount" fill="#3b82f6" />
      </BarChart>
    </ResponsiveContainer>
  )
}
```

---

## Permission Checking

Use the existing `usePermissions` hook:

```typescript
import { usePermissions } from '@/hooks/usePermissions'
import { PERMISSIONS } from '@/lib/rbac'

const PurchasesPage = () => {
  const { can } = usePermissions()

  // Check if user can create purchases
  if (!can(PERMISSIONS.PURCHASE_VIEW)) {
    return <div>Access Denied</div>
  }

  return (
    <div>
      {can(PERMISSIONS.PURCHASE_CREATE) && (
        <Button>Create Purchase</Button>
      )}

      {can(PERMISSIONS.PURCHASE_RECEIPT_APPROVE) && (
        <Button>Approve Receipt</Button>
      )}
    </div>
  )
}
```

---

## Data Fetching Patterns

### Using React Query (Recommended)
```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

// Fetch purchases
const { data, isLoading, error } = useQuery({
  queryKey: ['purchases', { page, status }],
  queryFn: async () => {
    const res = await fetch(`/api/purchases?page=${page}&status=${status}`)
    return res.json()
  }
})

// Create payment
const queryClient = useQueryClient()
const createPayment = useMutation({
  mutationFn: async (paymentData) => {
    const res = await fetch('/api/payments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(paymentData)
    })
    return res.json()
  },
  onSuccess: () => {
    // Invalidate AP and payments queries
    queryClient.invalidateQueries({ queryKey: ['accounts-payable'] })
    queryClient.invalidateQueries({ queryKey: ['payments'] })
  }
})
```

---

## Important Business Rules

### Purchase Approval
1. User must have `PURCHASE_RECEIPT_APPROVE` permission
2. Must tick verification checkbox before approving
3. Approval is IRREVERSIBLE - inventory is immediately updated
4. Once approved, creates StockTransaction, updates inventory, creates AP entry

### Payment Creation
1. Payment amount cannot exceed AP balance
2. For cheque payments:
   - Cheque number and date are required
   - If cheque date > today, must mark as post-dated
3. Post-dated cheques create separate PDC record
4. Payment updates AP:
   - Increments paidAmount
   - Decrements balanceAmount
   - Updates status: unpaid → partial → paid

### Accounts Payable
1. Auto-created when purchase is fully received and approved
2. Due date calculated from supplier payment terms
3. Cannot delete AP if payments exist
4. Balance must always equal totalAmount - paidAmount

### Post-Dated Cheques
1. Created automatically when isPostDated=true on payment
2. Status tracking: pending → cleared/bounced
3. Upcoming filter shows PDCs due within 7 days
4. Future: Email reminders before cheque date

---

## Error Handling

All API endpoints return consistent error format:

```json
{
  "error": "Short error message",
  "details": "Detailed error information"
}
```

Common errors:
- 401: Unauthorized (not logged in)
- 403: Forbidden (insufficient permissions)
- 404: Not found (entity doesn't exist or doesn't belong to your business)
- 400: Bad request (validation failed)
- 500: Server error

**UI Error Handling:**
```typescript
try {
  const res = await fetch('/api/payments', { method: 'POST', body: JSON.stringify(data) })

  if (!res.ok) {
    const error = await res.json()
    toast.error(error.error || 'Something went wrong')
    return
  }

  const payment = await res.json()
  toast.success(`Payment ${payment.paymentNumber} created successfully`)
  router.push('/dashboard/payments')
} catch (error) {
  toast.error('Network error. Please try again.')
}
```

---

## Testing Checklist

### Purchase Flow
- [ ] Create purchase order
- [ ] Verify PO number generated correctly
- [ ] Create partial receipt (less than ordered)
- [ ] Approve receipt - verify inventory updated
- [ ] Create second receipt for remaining items
- [ ] Approve second receipt - verify AP created
- [ ] Verify purchase status is "received"

### Payment Flow
- [ ] Create cash payment
- [ ] Create bank transfer payment
- [ ] Create regular cheque payment
- [ ] Create post-dated cheque payment
- [ ] Verify AP balance updates correctly
- [ ] Verify payment status changes (unpaid → partial → paid)
- [ ] Verify PDC created for post-dated cheque

### Permissions
- [ ] Test with encoder role (can create, not approve)
- [ ] Test with approver role (can approve)
- [ ] Test with accounting role (can manage AP/payments)
- [ ] Verify unauthorized users see proper error messages

### Edge Cases
- [ ] Try to pay more than balance (should error)
- [ ] Try to receive more than ordered (should error)
- [ ] Try to approve already approved receipt (should error)
- [ ] Try to delete AP with payments (should error)
- [ ] Try future-dated cheque without PDC flag (should warn/error)

---

## Quick Setup for Development

1. **Database is ready** - Schema already pushed to database
2. **API endpoints exist** - All backend logic implemented
3. **Permissions configured** - RBAC ready to use

**Your task:** Build the UI pages using the API endpoints documented above.

**Recommended Order:**
1. Start with Purchases List (simple read-only)
2. Then Purchase Detail & Approval (core workflow)
3. Then Accounts Payable Dashboard (read-only with aging chart)
4. Then Payment Form (critical functionality)
5. Then remaining pages

**Component Library:** Use ShadCN UI components (already in project)
- Button, Input, Select, Dialog, Table, Badge, Card, Tabs, etc.

**State Management:** Use React Query for server state (recommended)

**Routing:** Next.js App Router (already configured)

---

## Support & Resources

- **Full Documentation:** `PURCHASE-TO-PAY-IMPLEMENTATION.md`
- **API Testing:** Use API tools (Postman, Thunder Client) to test endpoints
- **Permission Constants:** `src/lib/rbac.ts`
- **Prisma Schema:** `prisma/schema.prisma`
- **Existing Examples:** Check `src/app/api/sales` and `src/app/dashboard/sales` for reference patterns

**Questions?** Review the full implementation doc or test the APIs directly.

**Ready to build!** You have everything you need to create a professional purchase-to-pay system.
