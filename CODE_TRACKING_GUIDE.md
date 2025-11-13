# Code Tracking Guide
# From Login to Features - Complete Code Journey

> **Follow the exact path code takes from login through to every feature**

---

## Purpose

This guide shows you **exactly which files to read** and **in what order** to understand how the application works from start to finish.

Every file listed has **extensive comments** explaining what it does and why.

---

## 🚀 THE COMPLETE USER JOURNEY

### STEP 1: User Visits Application
```
Browser: http://localhost:3000
  ↓
Next.js Route: / (root)
  ↓
AUTOMATICALLY REDIRECTS TO: /login
```

**Why?** The root route (`/`) redirects unauthenticated users to login page.

---

### STEP 2: Login Page Loads

**FILE TO READ**: `src/app/login/page.tsx` (FULLY COMMENTED - START HERE!)

**What you'll learn**:
- How the login form works
- RFID location scanning for non-admins
- Form validation
- Error handling
- NextAuth signIn() call

**Key sections**:
1. **State Management** (lines 79-95) - All form fields
2. **RFID Scanning** (lines 97-159) - Location verification
3. **Form Submission** (lines 179-275) - Main login logic

**What happens when user clicks "LOGIN"**:
```typescript
// Line 218: handleSubmit function
1. Calls: signIn("credentials", { username, password, locationId })
2. NextAuth sends data to: src/lib/auth.ts
3. auth.ts validates and creates session
4. If successful, redirects to /dashboard
```

---

### STEP 3: Authentication (The Security Check)

**FILE TO READ**: `src/lib/auth.ts` (FULLY COMMENTED - READ SECOND!)

**What you'll learn**:
- How passwords are verified (bcrypt)
- RFID location validation
- Shift conflict detection
- Schedule-based login restrictions
- Permission loading from database
- JWT token creation

**Critical function**: `authorize()` (starts line 167)

**Step-by-step flow**:
1. **Lines 168-175**: Validate credentials exist
2. **Lines 177-222**: Query database for user + roles + permissions
3. **Lines 224-253**: Verify password with bcrypt
4. **Lines 255-325**: RFID location validation
5. **Lines 327-369**: Shift conflict check
6. **Lines 371-408**: Schedule-based restrictions
7. **Lines 410-458**: Login monitoring & alerts
8. **Lines 460-473**: Return user object to NextAuth

**After successful authentication**:
```
auth.ts returns user object
  ↓
NextAuth creates JWT token
  ↓
JWT stored in HTTP-only cookie
  ↓
Browser redirects to /dashboard
```

---

### STEP 4: Middleware (Route Protection)

**FILE TO READ**: `middleware.ts` (FULLY COMMENTED - READ THIRD!)

**What you'll learn**:
- How routes are protected
- JWT token verification
- Automatic redirects
- Performance monitoring

**Location**: Root directory (`middleware.ts`)

**What happens**:
```
User requests /dashboard
  ↓
Middleware intercepts (line 46)
  ↓
Checks if JWT token exists (line 73-92)
  ↓
If no token: Redirect to /login
  ↓
If valid token: Allow access
  ↓
Dashboard loads
```

---

### STEP 5: Dashboard Layout Loads

**FILE TO READ**: `src/app/dashboard/layout.tsx`

**What you'll learn**:
- How dashboard wrapper works
- Session Provider setup
- Sidebar integration
- Layout structure

**Structure**:
```tsx
<SessionProvider>  {/* Provides auth context */}
  <div className="flex">
    <Sidebar />  {/* Navigation menu */}
    <main>
      {children}  {/* Individual pages render here */}
    </main>
  </div>
</SessionProvider>
```

---

### STEP 6: Sidebar Navigation Renders

**FILE TO READ**: `src/components/Sidebar.tsx`

**What you'll learn**:
- How menu items are filtered by permissions
- Permission-based visibility
- Active route highlighting
- Menu structure

**Key logic**:
```typescript
const { can } = usePermissions();

// Only show menu item if user has permission
{can(PERMISSIONS.PRODUCT_VIEW) && (
  <Link href="/dashboard/products">Products</Link>
)}
```

**Related file**: `src/hooks/usePermissions.ts` (permission checking hook)

---

### STEP 7: Dashboard Home Page

**FILE TO READ**: `src/app/dashboard/page.tsx`

**What you'll learn**:
- Dashboard statistics display
- Data fetching from API
- Card layouts
- Charts and widgets

**API calls made**:
- `GET /api/dashboard/stats` - Statistics
- `GET /api/dashboard/analytics` - Charts data

---

## 📂 FEATURE-BY-FEATURE CODE TRACKING

### FEATURE: Product Management

#### 1. Products List Page
**FILE**: `src/app/dashboard/products/page.tsx`

**Flow**:
```
User clicks "Products" in sidebar
  ↓
Loads: /dashboard/products
  ↓
Component fetches: GET /api/products
  ↓
API returns product list
  ↓
Displays in DevExtreme DataGrid
```

#### 2. Products API
**FILE**: `src/app/api/products/route.ts`

**What it does**:
```typescript
export async function GET(request: Request) {
  // 1. Get session (authentication)
  const session = await getServerSession(authOptions);

  // 2. Check permission
  if (!hasPermission(session.user, PERMISSIONS.PRODUCT_VIEW)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // 3. Query database (filtered by businessId)
  const products = await prisma.product.findMany({
    where: { businessId: session.user.businessId }
  });

  // 4. Return data
  return NextResponse.json({ data: products });
}
```

#### 3. Create Product
**FILES**:
- Page: `src/app/dashboard/products/add/page.tsx`
- API: `src/app/api/products/route.ts` (POST method)

**Flow**:
```
User clicks "Add Product"
  ↓
Form loads with fields
  ↓
User fills form
  ↓
Clicks "Save"
  ↓
POST /api/products
  ↓
API validates data
  ↓
Creates product in database
  ↓
Returns success
  ↓
Redirects to products list
```

---

### FEATURE: Sales (POS)

#### 1. POS Page
**FILE**: `src/app/dashboard/pos/page.tsx`

**What you'll learn**:
- Product search and selection
- Cart management
- Payment processing
- Receipt generation

#### 2. Create Sale API
**FILE**: `src/app/api/sales/route.ts`

**Business Logic**:
```typescript
1. Validate customer credit limit
2. Check product stock availability
3. Create sale record
4. Deduct inventory from stock
5. Record payment
6. Update shift running totals
7. Generate invoice number
8. Create audit log
9. Return sale data
```

#### 3. Sales List
**FILE**: `src/app/dashboard/sales/page.tsx`

**Flow**:
```
User clicks "Sales" in sidebar
  ↓
Loads: /dashboard/sales
  ↓
Fetches: GET /api/sales
  ↓
Displays list with filters
```

---

### FEATURE: Purchases

#### 1. Purchase Orders List
**FILE**: `src/app/dashboard/purchases/page.tsx`

#### 2. Create Purchase Order
**FILES**:
- Page: `src/app/dashboard/purchases/create/page.tsx`
- API: `src/app/api/purchases/route.ts`

#### 3. Receive Purchase
**FILES**:
- Page: `src/app/dashboard/purchases/[id]/receive/page.tsx`
- API: `src/app/api/purchases/[id]/receive/route.ts`

**Business Logic**:
```typescript
1. Validate PO status
2. Record received quantities
3. Add inventory to stock
4. Update product costs
5. Create accounts payable entry
6. Update PO status
```

---

### FEATURE: Inventory Transfers

#### 1. Transfers List
**FILE**: `src/app/dashboard/transfers/page.tsx`

#### 2. Create Transfer
**FILES**:
- Page: `src/app/dashboard/transfers/create/page.tsx`
- API: `src/app/api/transfers/route.ts`

#### 3. Send Transfer
**API**: `src/app/api/transfers/[id]/send/route.ts`

**Business Logic**:
```typescript
1. Validate items and quantities
2. Deduct from source location
3. Mark transfer as "sent"
4. Create audit log
```

#### 4. Receive Transfer
**API**: `src/app/api/transfers/[id]/receive/route.ts`

**Business Logic**:
```typescript
1. Verify items received
2. Add to destination location
3. Mark transfer as "received"
4. Update product history
```

---

### FEATURE: Reports

#### 1. Sales Report
**FILES**:
- Page: `src/app/dashboard/reports/sales-report/page.tsx`
- API: `src/app/api/reports/sales/route.ts`

**What it does**:
```typescript
1. Accept date range filters
2. Query sales transactions
3. Calculate totals and summaries
4. Group by date/location/cashier
5. Return formatted data
6. Export to Excel/PDF
```

#### 2. Profit & Loss
**FILES**:
- Page: `src/app/dashboard/reports/profit-loss/page.tsx`
- API: `src/app/api/reports/profit-loss/route.ts`

**Calculations**:
```typescript
Revenue = Total Sales
COGS = Cost of Goods Sold
Gross Profit = Revenue - COGS
Operating Expenses = Sum of Expenses
Net Profit = Gross Profit - Operating Expenses
```

#### 3. Inventory Valuation
**FILES**:
- Page: `src/app/dashboard/reports/inventory-valuation/page.tsx`
- API: `src/app/api/reports/inventory-valuation/route.ts`

**Calculation**:
```typescript
For each product:
  Quantity on hand × Cost price = Value

Total inventory value = Sum of all values
```

---

### FEATURE: Users & Roles

#### 1. Users List
**FILES**:
- Page: `src/app/dashboard/users/page.tsx`
- API: `src/app/api/users/route.ts`

#### 2. Roles Management
**FILES**:
- Page: `src/app/dashboard/roles/page.tsx`
- API: `src/app/api/roles/route.ts`

**What it manages**:
```typescript
1. Role name
2. Role description
3. Assigned permissions
4. Assigned locations
5. Users with this role
```

---

## 🔐 PERMISSION SYSTEM DEEP DIVE

### Understanding Permissions

**FILE TO READ**: `src/lib/rbac.ts` (FULLY COMMENTED!)

**Permission Structure**:
```typescript
PERMISSIONS = {
  PRODUCT_VIEW: "product.view",
  PRODUCT_CREATE: "product.create",
  SALE_VIEW: "sale.view",
  // ... 200+ more permissions
}
```

### How Permissions Are Checked

#### In API Routes:
```typescript
// src/app/api/products/route.ts
const session = await getServerSession(authOptions);

if (!hasPermission(session.user, PERMISSIONS.PRODUCT_CREATE)) {
  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}
```

#### In React Components:
```typescript
// src/app/dashboard/products/page.tsx
const { can } = usePermissions();

{can(PERMISSIONS.PRODUCT_CREATE) && (
  <Button onClick={handleCreate}>Create Product</Button>
)}
```

#### In Sidebar Menu:
```typescript
// src/components/Sidebar.tsx
{can(PERMISSIONS.PRODUCT_VIEW) && (
  <Link href="/dashboard/products">Products</Link>
)}
```

---

## 🗺️ COMPLETE FILE MAP

### Authentication Flow
1. `src/app/login/page.tsx` - Login form
2. `src/lib/auth.ts` - Authentication logic
3. `middleware.ts` - Route protection
4. `src/app/dashboard/layout.tsx` - Dashboard wrapper

### Permission System
1. `src/lib/rbac.ts` - Permission definitions
2. `src/hooks/usePermissions.ts` - Permission checking hook
3. `src/components/Sidebar.tsx` - Menu with permissions

### Product Feature
1. **List**: `src/app/dashboard/products/page.tsx`
2. **API GET**: `src/app/api/products/route.ts`
3. **Create Page**: `src/app/dashboard/products/add/page.tsx`
4. **API POST**: `src/app/api/products/route.ts`
5. **Edit Page**: `src/app/dashboard/products/[id]/edit/page.tsx`
6. **API PUT**: `src/app/api/products/[id]/route.ts`

### Sales Feature
1. **POS**: `src/app/dashboard/pos/page.tsx`
2. **Create Sale API**: `src/app/api/sales/route.ts`
3. **Sales List**: `src/app/dashboard/sales/page.tsx`
4. **Sale Details**: `src/app/dashboard/sales/[id]/page.tsx`

### Purchase Feature
1. **PO List**: `src/app/dashboard/purchases/page.tsx`
2. **Create PO**: `src/app/dashboard/purchases/create/page.tsx`
3. **Receive**: `src/app/dashboard/purchases/[id]/receive/page.tsx`

### Reports Feature
1. **Sales Report**: `src/app/dashboard/reports/sales-report/page.tsx`
2. **P&L**: `src/app/dashboard/reports/profit-loss/page.tsx`
3. **Inventory**: `src/app/dashboard/reports/inventory-valuation/page.tsx`

---

## 📖 READING ORDER FOR BEGINNERS

### Day 1: Authentication (2 hours)
1. Read `src/app/login/page.tsx` (30 min)
2. Read `src/lib/auth.ts` (1 hour)
3. Read `middleware.ts` (30 min)

### Day 2: Navigation & Permissions (2 hours)
1. Read `src/lib/rbac.ts` (1 hour)
2. Read `src/hooks/usePermissions.ts` (30 min)
3. Read `src/components/Sidebar.tsx` (30 min)

### Day 3: First Feature - Products (3 hours)
1. Read `src/app/dashboard/products/page.tsx` (1 hour)
2. Read `src/app/api/products/route.ts` (1 hour)
3. Read `src/app/dashboard/products/add/page.tsx` (1 hour)

### Day 4: Second Feature - Sales (3 hours)
1. Read `src/app/dashboard/pos/page.tsx` (1.5 hours)
2. Read `src/app/api/sales/route.ts` (1.5 hours)

### Day 5: Reports & Business Logic (2 hours)
1. Read any report page (1 hour)
2. Read corresponding API route (1 hour)

---

## 🎯 QUICK REFERENCE

### "I want to understand authentication"
1. `src/app/login/page.tsx`
2. `src/lib/auth.ts`
3. `middleware.ts`

### "I want to understand permissions"
1. `src/lib/rbac.ts`
2. `src/hooks/usePermissions.ts`
3. Check any API route for permission checks

### "I want to build a new feature"
1. Study `src/app/dashboard/products/` (complete example)
2. Study `src/app/api/products/` (API example)
3. Follow the same pattern

### "I want to add a new API endpoint"
1. Look at `src/app/api/products/route.ts` (example)
2. Copy the structure
3. Add authentication check
4. Add permission check
5. Add business logic

### "I want to add a new page"
1. Look at `src/app/dashboard/products/page.tsx`
2. Copy the structure
3. Add to `src/components/Sidebar.tsx` with permission
4. Fetch data from API route

---

## ✅ CHECKLIST: Understanding the Codebase

### Authentication ✓
- [ ] I understand how login works
- [ ] I understand JWT tokens
- [ ] I understand session management
- [ ] I understand route protection

### Permissions ✓
- [ ] I understand the PERMISSIONS object
- [ ] I can check permissions in API routes
- [ ] I can check permissions in components
- [ ] I understand roles vs permissions

### Database ✓
- [ ] I understand Prisma schema
- [ ] I understand multi-tenancy (businessId filtering)
- [ ] I can write queries safely

### Features ✓
- [ ] I understand how products work
- [ ] I understand how sales work
- [ ] I understand how inventory works
- [ ] I can build a new feature following patterns

---

## 🚀 START READING NOW!

**Your journey starts here**:

1. Open `src/app/login/page.tsx`
2. Read all comments from top to bottom
3. Follow the flow to `src/lib/auth.ts`
4. Continue to `middleware.ts`
5. Then `src/lib/rbac.ts`
6. Then pick any feature and trace it through

**Every file listed above has detailed comments explaining**:
- What it does
- Why it exists
- How it works
- What happens next
- Related files

---

**Generated**: 2025-11-12
**Version**: 1.0
**Project**: Igoro Tech(IT) Inventory Management System
**Fully Commented Files**: 4 core files
