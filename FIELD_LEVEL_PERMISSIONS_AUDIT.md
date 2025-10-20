# 🔒 Field-Level Permissions - Security Audit

## What is Field-Level Security?

**Field-level security** means hiding or showing specific data fields based on user role/permissions, not just entire pages.

### Example:
- **Cashier** sees product page but **CANNOT see**:
  - ❌ Cost price (purchase price)
  - ❌ Profit margin
  - ❌ Supplier information
  - ❌ Stock quantities at other branches

- **Branch Manager** sees product page and **CAN see**:
  - ✅ Cost price
  - ✅ Profit margin
  - ✅ Supplier information
  - ✅ Stock at all branches

---

## 🚨 Sensitive Fields That Need Protection:

### 1. **Product Information** (CRITICAL)

| Field | Why Sensitive? | Who Should See? | Permission Needed |
|-------|---------------|----------------|-------------------|
| **Purchase Price** | Shows cost, reveals margins | Managers, Inventory Controllers | `product.view_purchase_price` |
| **Profit Margin** | Business intelligence | Managers only | `product.view_profit_margin` |
| **Supplier Name** | Competitive information | Managers, Purchasing staff | `product.view_supplier` |
| **Supplier Contact** | Business relationships | Managers, Purchasing staff | `supplier.view_contact_details` |
| **Stock at Other Branches** | Operational intelligence | Managers, Inventory Controllers | `product.view_all_branch_stock` (already exists!) |
| **Opening Stock** | Audit trail | Managers, Inventory Controllers | `product.view_opening_stock` |
| **Reorder Level** | Operational data | Managers, Inventory Controllers | `product.view_reorder_settings` |

### 2. **Sales Information** (CRITICAL)

| Field | Why Sensitive? | Who Should See? | Permission Needed |
|-------|---------------|----------------|-------------------|
| **Cost of Goods Sold (COGS)** | Shows profit | Managers only | `sales.view_cogs` |
| **Profit per Sale** | Business intelligence | Managers only | `sales.view_profit` |
| **Discount Given** | Pricing strategy | Managers, Supervisors | `sales.view_discount_details` |
| **Payment Method Details** | Financial data | Managers, Accountants | `sales.view_payment_details` |
| **Sales by Other Cashiers** | Privacy/competition | Managers only | `sales.view_all_cashiers` |

### 3. **Purchase Information** (CRITICAL)

| Field | Why Sensitive? | Who Should See? | Permission Needed |
|-------|---------------|----------------|-------------------|
| **Purchase Price** | Cost data | Managers, Purchasing staff | `purchase.view_cost` (already exists!) |
| **Supplier Payment Terms** | Business relationships | Managers, Accountants | `purchase.view_payment_terms` |
| **Supplier Contact Details** | Competitive information | Managers, Purchasing staff | `supplier.view_contact_details` |
| **Purchase History** | Pricing trends | Managers, Purchasing staff | `purchase.view_history` |
| **Accounts Payable Balance** | Financial data | Managers, Accountants | `accounts_payable.view` (already exists!) |

### 4. **Inventory Information** (MEDIUM SENSITIVITY)

| Field | Why Sensitive? | Who Should See? | Permission Needed |
|-------|---------------|----------------|-------------------|
| **Stock Value** | Financial data | Managers, Inventory Controllers | `inventory.view_stock_value` |
| **Inventory Turnover Rate** | Business intelligence | Managers only | `inventory.view_analytics` |
| **Dead Stock Report** | Operational metrics | Managers, Inventory Controllers | `inventory.view_dead_stock` |
| **Stock Transfer History** | Operational data | Managers, Transfer staff | `transfer.view_history` |

### 5. **Financial Reports** (CRITICAL)

| Report/Field | Why Sensitive? | Who Should See? | Permission Needed |
|-------------|---------------|----------------|-------------------|
| **Profit & Loss Report** | Core financial data | Managers, Owners only | `report.view_profit_loss` (already exists!) |
| **Profitability by Product** | Pricing strategy | Managers only | `report.view_profitability` (already exists!) |
| **Cost of Goods Sold (COGS)** | Financial data | Managers, Accountants | `report.view_cogs` |
| **Gross Margin** | Business intelligence | Managers only | `report.view_gross_margin` |
| **Sales vs Cost Analysis** | Strategic data | Managers, Owners only | `report.view_sales_cost_analysis` |

### 6. **Employee/User Information** (PRIVACY)

| Field | Why Sensitive? | Who Should See? | Permission Needed |
|-------|---------------|----------------|-------------------|
| **Salary/Wage** | Privacy | HR, Owners only | `user.view_salary` |
| **Contact Details** | Privacy | Managers, HR | `user.view_contact` |
| **Performance Metrics** | Privacy | Managers only | `user.view_performance` |
| **Sales Commissions** | Privacy | Managers, HR | `user.view_commission` |

---

## 🎯 Recommended Field-Level Permissions to Add:

### Add to `src/lib/rbac.ts`:

```typescript
export const PERMISSIONS = {
  // ... existing permissions ...

  // Product - Field Level
  PRODUCT_VIEW_PURCHASE_PRICE: 'product.view_purchase_price', // NEW
  PRODUCT_VIEW_PROFIT_MARGIN: 'product.view_profit_margin', // NEW
  PRODUCT_VIEW_SUPPLIER: 'product.view_supplier', // NEW
  PRODUCT_VIEW_REORDER_SETTINGS: 'product.view_reorder_settings', // NEW
  PRODUCT_VIEW_OPENING_STOCK: 'product.view_opening_stock', // NEW (already have product.opening_stock for editing)

  // Sales - Field Level
  SALES_VIEW_COGS: 'sales.view_cogs', // NEW
  SALES_VIEW_PROFIT: 'sales.view_profit', // NEW
  SALES_VIEW_DISCOUNT_DETAILS: 'sales.view_discount_details', // NEW
  SALES_VIEW_PAYMENT_DETAILS: 'sales.view_payment_details', // NEW
  SALES_VIEW_ALL_CASHIERS: 'sales.view_all_cashiers', // NEW

  // Supplier - Field Level
  SUPPLIER_VIEW_CONTACT_DETAILS: 'supplier.view_contact_details', // NEW
  SUPPLIER_VIEW_PAYMENT_TERMS: 'supplier.view_payment_terms', // NEW

  // Inventory - Field Level
  INVENTORY_VIEW_STOCK_VALUE: 'inventory.view_stock_value', // NEW
  INVENTORY_VIEW_ANALYTICS: 'inventory.view_analytics', // NEW
  INVENTORY_VIEW_DEAD_STOCK: 'inventory.view_dead_stock', // NEW

  // Reports - Field Level
  REPORT_VIEW_COGS: 'report.view_cogs', // NEW
  REPORT_VIEW_GROSS_MARGIN: 'report.view_gross_margin', // NEW
  REPORT_VIEW_SALES_COST_ANALYSIS: 'report.view_sales_cost_analysis', // NEW

  // User - Field Level (Privacy)
  USER_VIEW_SALARY: 'user.view_salary', // NEW
  USER_VIEW_CONTACT: 'user.view_contact', // NEW
  USER_VIEW_PERFORMANCE: 'user.view_performance', // NEW
  USER_VIEW_COMMISSION: 'user.view_commission', // NEW
}
```

---

## 💡 How to Implement Field-Level Security:

### Example 1: Hide Purchase Price from Cashiers

**Component**: Product List Page (`src/app/dashboard/products/page.tsx`)

```typescript
'use client'

import { usePermissions } from '@/hooks/usePermissions'

export default function ProductsPage() {
  const { can } = usePermissions()

  const canViewPurchasePrice = can('product.view_purchase_price')
  const canViewSupplier = can('product.view_supplier')
  const canViewAllBranchStock = can('product.view_all_branch_stock')

  return (
    <div>
      <table>
        <thead>
          <tr>
            <th>Product Name</th>
            <th>SKU</th>
            <th>Selling Price</th>

            {/* Only show if user has permission */}
            {canViewPurchasePrice && <th>Purchase Price</th>}
            {canViewPurchasePrice && <th>Profit Margin</th>}
            {canViewSupplier && <th>Supplier</th>}
            {canViewAllBranchStock && <th>Stock at All Branches</th>}
          </tr>
        </thead>
        <tbody>
          {products.map(product => (
            <tr key={product.id}>
              <td>{product.name}</td>
              <td>{product.sku}</td>
              <td>{product.sellingPrice}</td>

              {canViewPurchasePrice && <td>{product.purchasePrice}</td>}
              {canViewPurchasePrice && (
                <td>{((product.sellingPrice - product.purchasePrice) / product.purchasePrice * 100).toFixed(2)}%</td>
              )}
              {canViewSupplier && <td>{product.supplier?.name}</td>}
              {canViewAllBranchStock && <td>{product.totalStock}</td>}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
```

### Example 2: Hide Supplier Contact from Cashiers

**Component**: Supplier Page

```typescript
'use client'

import { usePermissions } from '@/hooks/usePermissions'

export default function SupplierDetailsPage() {
  const { can } = usePermissions()

  const canViewContactDetails = can('supplier.view_contact_details')
  const canViewPaymentTerms = can('supplier.view_payment_terms')

  return (
    <div>
      <h1>Supplier: {supplier.name}</h1>
      <p>Business: {supplier.businessName}</p>

      {/* Only show if user has permission */}
      {canViewContactDetails && (
        <div className="contact-section">
          <h2>Contact Information</h2>
          <p>Email: {supplier.email}</p>
          <p>Phone: {supplier.phone}</p>
          <p>Address: {supplier.address}</p>
        </div>
      )}

      {canViewPaymentTerms && (
        <div className="payment-section">
          <h2>Payment Terms</h2>
          <p>Terms: {supplier.paymentTerms}</p>
          <p>Credit Limit: {supplier.creditLimit}</p>
        </div>
      )}
    </div>
  )
}
```

### Example 3: Hide Cost in Sales Reports

**Component**: Sales Report

```typescript
'use client'

import { usePermissions } from '@/hooks/usePermissions'

export default function SalesReportPage() {
  const { can } = usePermissions()

  const canViewCOGS = can('sales.view_cogs')
  const canViewProfit = can('sales.view_profit')

  return (
    <table>
      <thead>
        <tr>
          <th>Date</th>
          <th>Invoice #</th>
          <th>Customer</th>
          <th>Total Sale</th>

          {/* Sensitive columns - only show to authorized users */}
          {canViewCOGS && <th>Cost of Goods</th>}
          {canViewProfit && <th>Profit</th>}
          {canViewProfit && <th>Margin %</th>}
        </tr>
      </thead>
      <tbody>
        {sales.map(sale => (
          <tr key={sale.id}>
            <td>{sale.date}</td>
            <td>{sale.invoiceNumber}</td>
            <td>{sale.customer}</td>
            <td>{sale.total}</td>

            {canViewCOGS && <td>{sale.cogs}</td>}
            {canViewProfit && <td>{sale.profit}</td>}
            {canViewProfit && <td>{sale.marginPercent}%</td>}
          </tr>
        ))}
      </tbody>
    </table>
  )
}
```

---

## 🎨 UI for Permission Management

### What You Need: Role Permission Assignment UI

**Recommended Approach**: Create a page at `/dashboard/roles` where Super Admin can:

1. **See all available permissions** organized by category
2. **Assign/remove permissions** from each role with checkboxes
3. **Preview** what each role can see

**Example UI Structure**:

```
┌─────────────────────────────────────────────────┐
│ Role: Branch Manager                   [Edit]   │
├─────────────────────────────────────────────────┤
│                                                  │
│ PRODUCT PERMISSIONS                              │
│ ☑ View Products                                  │
│ ☑ Create Products                                │
│ ☑ Update Products                                │
│ ☐ Delete Products                                │
│ ☑ View Purchase Price       ← Field-level       │
│ ☑ View Profit Margin        ← Field-level       │
│ ☑ View Supplier Info        ← Field-level       │
│ ☑ View All Branch Stock     ← Field-level       │
│                                                  │
│ SALES PERMISSIONS                                │
│ ☑ View Sales                                     │
│ ☐ Create Sales (POS Access) ← Menu-level        │
│ ☐ View Cost of Goods Sold   ← Field-level       │
│ ☑ View Profit Margins       ← Field-level       │
│                                                  │
│ INVENTORY PERMISSIONS                            │
│ ☑ View Inventory                                 │
│ ☑ Inventory Corrections     ← Menu-level        │
│ ☑ Physical Inventory        ← Menu-level        │
│ ☑ View Stock Value          ← Field-level       │
│                                                  │
│              [Save Changes]  [Cancel]            │
└─────────────────────────────────────────────────┘
```

---

## 📝 Recommended Role Permission Matrix

| Permission Type | Cashier | Sales Clerk | Branch Manager | Super Admin |
|----------------|---------|-------------|----------------|-------------|
| **Product - View Purchase Price** | ❌ | ❌ | ✅ | ✅ |
| **Product - View Profit Margin** | ❌ | ❌ | ✅ | ✅ |
| **Product - View Supplier** | ❌ | ❌ | ✅ | ✅ |
| **Sales - View COGS** | ❌ | ❌ | ✅ | ✅ |
| **Sales - View Profit** | ❌ | ❌ | ✅ | ✅ |
| **Supplier - View Contact** | ❌ | ❌ | ✅ | ✅ |
| **Reports - View Profit/Loss** | ❌ | ❌ | ✅ | ✅ |
| **Stock - View All Branches** | ❌ | ❌ | ✅ | ✅ |

---

## 🚀 Implementation Priority

### Phase 1: CRITICAL (Do First)
1. **Product purchase price** - Hide from cashiers/sales clerks
2. **Profit margins** - Hide from all non-managers
3. **Supplier information** - Hide from cashiers/sales clerks
4. **Financial reports** - Already protected by menu permissions

### Phase 2: IMPORTANT (Do Soon)
1. **COGS in sales** - Hide from cashiers
2. **Stock at other branches** - Hide from cashiers (already have permission for this!)
3. **Payment terms** - Hide from non-purchasing staff
4. **Accounts payable** - Hide from cashiers (already protected!)

### Phase 3: NICE TO HAVE (Do Later)
1. **Employee performance metrics** - Privacy protection
2. **Inventory analytics** - Business intelligence protection
3. **Discount details** - Pricing strategy protection

---

## 💻 Implementation Steps

### Step 1: Add New Permissions to RBAC
```typescript
// src/lib/rbac.ts
export const PERMISSIONS = {
  // ... existing ...

  // Add field-level permissions
  PRODUCT_VIEW_PURCHASE_PRICE: 'product.view_purchase_price',
  PRODUCT_VIEW_PROFIT_MARGIN: 'product.view_profit_margin',
  PRODUCT_VIEW_SUPPLIER: 'product.view_supplier',
  // ... etc
}
```

### Step 2: Assign to Roles
```typescript
// src/lib/rbac.ts
export const DEFAULT_ROLES = {
  BRANCH_MANAGER: {
    permissions: [
      // ... existing ...
      PERMISSIONS.PRODUCT_VIEW_PURCHASE_PRICE, // NEW
      PERMISSIONS.PRODUCT_VIEW_PROFIT_MARGIN, // NEW
      PERMISSIONS.PRODUCT_VIEW_SUPPLIER, // NEW
    ]
  },
  CASHIER: {
    permissions: [
      PERMISSIONS.PRODUCT_VIEW, // Can see products
      // ❌ NO purchase price visibility
      // ❌ NO profit margin visibility
      // ❌ NO supplier visibility
    ]
  }
}
```

### Step 3: Update Components
Apply permission checks in all components that show sensitive data (see examples above)

### Step 4: Update API Routes
Also protect API responses:
```typescript
// src/app/api/products/route.ts
export async function GET(request: Request) {
  const session = await getServerSession(authOptions)

  const products = await prisma.product.findMany({
    include: {
      supplier: can(session.user, 'product.view_supplier') // Only include if permitted
    }
  })

  // Remove sensitive fields if user doesn't have permission
  const sanitizedProducts = products.map(product => ({
    ...product,
    purchasePrice: can(session.user, 'product.view_purchase_price')
      ? product.purchasePrice
      : null,
    supplier: can(session.user, 'product.view_supplier')
      ? product.supplier
      : null
  }))

  return NextResponse.json({ products: sanitizedProducts })
}
```

---

## 🎯 Summary

### Your Intuition is 100% Correct!

**YES to All Three**:
1. ✅ **Menu-level permissions** - Every menu should be toggleable per role
2. ✅ **Field-level permissions** - Sensitive data should be hidden based on role
3. ✅ **UI management** - Super Admin should assign permissions via UI, not code

### What Needs to Be Done:
1. **Add field-level permissions** to `src/lib/rbac.ts`
2. **Update role definitions** to include/exclude field permissions
3. **Update components** to check permissions before showing fields
4. **Update API routes** to sanitize responses based on permissions
5. **Create UI** for permission management (Role assignment page)

### Most Critical Fields to Protect:
- Purchase price (cost)
- Profit margins
- Supplier information
- Financial reports (already protected!)
- Stock at other branches (already have permission!)

---

**Should I proceed with implementing field-level permissions?**
