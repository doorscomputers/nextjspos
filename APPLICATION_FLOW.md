# Application Flow Documentation
# Igoro Tech(IT) Inventory Management System

> **Comprehensive guide to understanding the application architecture, authentication flow, routing, and role-based access control system.**

---

## Table of Contents

1. [Application Entry Point](#application-entry-point)
2. [Authentication Flow](#authentication-flow)
3. [Authorization & RBAC System](#authorization--rbac-system)
4. [Dashboard Layout & Navigation](#dashboard-layout--navigation)
5. [Sidebar Menu Structure](#sidebar-menu-structure)
6. [API Routes Reference](#api-routes-reference)
7. [Dashboard Pages Reference](#dashboard-pages-reference)
8. [Database Schema Overview](#database-schema-overview)
9. [Multi-Tenant Architecture](#multi-tenant-architecture)
10. [Key Components & Utilities](#key-components--utilities)

---

## 1. Application Entry Point

### 1.1 Root Layout (`src/app/layout.tsx`)
**Purpose**: The root layout wrapper for the entire Next.js application.

**Flow**:
```
User visits application
  ↓
Root Layout renders
  ↓
Loads global styles (Tailwind CSS)
  ↓
Wraps all pages in HTML structure
  ↓
Applies font (Inter)
  ↓
Renders child pages/layouts
```

**Key Files**:
- `src/app/layout.tsx` - Root layout component
- `src/app/globals.css` - Global styles with Tailwind CSS
- `tailwind.config.js` - Tailwind configuration

---

### 1.2 Login Page (`src/app/login/page.tsx`)
**Purpose**: The entry point for unauthenticated users.

**File Location**: `src/app/login/page.tsx`

**Flow**:
```
User navigates to /login
  ↓
Login page renders with username/password form
  ↓
User enters credentials
  ↓
Form submits to NextAuth signIn()
  ↓
NextAuth calls Credentials provider in src/lib/auth.ts
  ↓
Credentials provider validates username/password
  ↓
If valid: Creates session with JWT token
  ↓
If invalid: Shows error message
  ↓
On success: Redirects to /dashboard
```

**Key Code Points**:
- **Form submission**: Uses NextAuth's `signIn()` function
- **Error handling**: Displays error messages for invalid credentials
- **Redirect**: Successful login redirects to `/dashboard`
- **Session storage**: JWT token stored in HTTP-only cookie

**Related Files**:
- `src/lib/auth.ts` - NextAuth configuration
- `src/app/api/auth/[...nextauth]/route.ts` - NextAuth API handler (auto-generated)

---

## 2. Authentication Flow

### 2.1 NextAuth Configuration (`src/lib/auth.ts`)
**Purpose**: Configures NextAuth for JWT-based authentication with custom credentials provider.

**Authentication Flow**:
```
1. User submits login form
   ↓
2. NextAuth signIn() called
   ↓
3. Credentials provider authorize() function executes
   ↓
4. Query database for user by username
   ↓
5. Verify password using bcrypt
   ↓
6. If valid: Return user object with permissions and roles
   ↓
7. JWT callback: Encode user data into JWT token
   ↓
8. Session callback: Decode JWT and populate session object
   ↓
9. Session available via getServerSession() or useSession()
```

**Session Object Structure**:
```typescript
{
  user: {
    id: string,              // User ID
    username: string,        // Username
    businessId: string,      // Business/tenant ID
    permissions: string[],   // Array of permission strings
    roles: string[],         // Array of role names
    name?: string,           // Display name
    email?: string,          // Email address
    locationId?: string,     // Assigned branch/location
    locationName?: string    // Location display name
  }
}
```

**Key Functions**:
- `authOptions` - NextAuth configuration object
- `authorize()` - Validates credentials
- `jwt()` callback - Encodes user data into JWT
- `session()` callback - Decodes JWT into session object

**Related Files**:
- `src/lib/auth.ts` - Main auth configuration
- `prisma/schema.prisma` - User model definition
- `src/middleware.ts` - Middleware for route protection

---

### 2.2 Middleware (`src/middleware.ts`)
**Purpose**: Protects routes and enforces authentication before accessing dashboard.

**Flow**:
```
User navigates to any route
  ↓
Middleware intercepts request
  ↓
Check if route matches /dashboard/*
  ↓
If dashboard route: Check for valid session
  ↓
If no session: Redirect to /login
  ↓
If valid session: Allow access
  ↓
Page renders
```

**Protected Routes**:
- `/dashboard/*` - All dashboard pages require authentication
- `/api/*` - Most API routes require authentication (checked individually)

**Public Routes**:
- `/` - Landing page (if exists)
- `/login` - Login page
- `/api/auth/*` - NextAuth API routes

**Related Files**:
- `src/middleware.ts` - Next.js middleware
- `src/lib/auth.ts` - Auth configuration

---

### 2.3 Session Management

**Server-Side Session**:
```typescript
// In Server Components or API routes
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

const session = await getServerSession(authOptions);
// session.user contains user data
```

**Client-Side Session**:
```typescript
// In Client Components
"use client";
import { useSession } from "next-auth/react";

const { data: session, status } = useSession();
// status: "loading" | "authenticated" | "unauthenticated"
```

**Session Provider** (`src/app/dashboard/layout.tsx`):
- Wraps all dashboard pages
- Provides session context to client components
- Enables `useSession()` hook

---

## 3. Authorization & RBAC System

### 3.1 RBAC Configuration (`src/lib/rbac.ts`)
**Purpose**: Defines all permissions, roles, and permission checking logic.

**Permission Categories**:

1. **Dashboard Permissions**:
   - `DASHBOARD_VIEW` - View main dashboard

2. **Product Permissions**:
   - `PRODUCT_VIEW` - View products
   - `PRODUCT_CREATE` - Create new products
   - `PRODUCT_EDIT` - Edit existing products
   - `PRODUCT_DELETE` - Delete products
   - `PRODUCT_IMPORT` - Import products from CSV
   - `PRODUCT_EXPORT` - Export products to CSV/Excel

3. **Sales Permissions**:
   - `SALE_VIEW` - View sales
   - `SALE_CREATE` - Create new sales
   - `SALE_EDIT` - Edit sales
   - `SALE_DELETE` - Delete/void sales
   - `SALE_REFUND` - Process refunds

4. **Purchase Permissions**:
   - `PURCHASE_VIEW` - View purchase orders
   - `PURCHASE_CREATE` - Create purchase orders
   - `PURCHASE_EDIT` - Edit purchase orders
   - `PURCHASE_DELETE` - Delete purchase orders
   - `PURCHASE_APPROVE` - Approve purchase orders
   - `PURCHASE_RECEIVE` - Receive inventory from PO

5. **Customer Permissions**:
   - `CUSTOMER_VIEW` - View customers
   - `CUSTOMER_CREATE` - Create customers
   - `CUSTOMER_EDIT` - Edit customers
   - `CUSTOMER_DELETE` - Delete customers
   - `CUSTOMER_CREDIT_LIMIT_VIEW` - View credit limits
   - `CUSTOMER_CREDIT_LIMIT_EDIT` - Edit credit limits
   - `CUSTOMER_CREDIT_OVERRIDE` - Override credit limits

6. **Supplier Permissions**:
   - `SUPPLIER_VIEW` - View suppliers
   - `SUPPLIER_CREATE` - Create suppliers
   - `SUPPLIER_EDIT` - Edit suppliers
   - `SUPPLIER_DELETE` - Delete suppliers

7. **Report Permissions**:
   - `REPORT_VIEW` - View reports
   - `REPORT_SALES` - View sales reports
   - `REPORT_PURCHASE` - View purchase reports
   - `REPORT_INVENTORY` - View inventory reports
   - `REPORT_FINANCIAL` - View financial reports
   - `REPORT_CUSTOMER_PAYMENTS` - View payment reports

8. **User Management Permissions**:
   - `USER_VIEW` - View users
   - `USER_CREATE` - Create users
   - `USER_EDIT` - Edit users
   - `USER_DELETE` - Delete users

9. **Role Management Permissions**:
   - `ROLE_VIEW` - View roles
   - `ROLE_CREATE` - Create roles
   - `ROLE_EDIT` - Edit roles
   - `ROLE_DELETE` - Delete roles

10. **Inventory Permissions**:
    - `INVENTORY_VIEW` - View inventory
    - `INVENTORY_ADJUST` - Adjust inventory
    - `INVENTORY_TRANSFER` - Transfer inventory between locations

11. **Financial Permissions**:
    - `EXPENSE_VIEW` - View expenses
    - `EXPENSE_CREATE` - Create expenses
    - `EXPENSE_APPROVE` - Approve expenses
    - `PAYMENT_COLLECT_AR` - Collect AR payments

**Default Roles**:

1. **Super Admin**:
   - Has ALL permissions
   - Can manage all businesses (multi-tenant admin)
   - Can create/edit/delete any data

2. **Admin**:
   - Has ALL permissions within their business
   - Cannot access other businesses
   - Full control over business data

3. **Manager**:
   - Can view all reports
   - Can approve purchases, expenses, transfers
   - Can manage inventory
   - Can create/edit products
   - Can view but not delete users

4. **Cashier**:
   - Can create sales
   - Can view limited reports (own sales)
   - Can view products
   - Can view customers
   - Cannot access admin features

**Permission Checking Functions**:

```typescript
// Check if user has a specific permission
hasPermission(user, PERMISSIONS.PRODUCT_CREATE)

// Check if user has a specific role
hasRole(user, "Admin")

// Check if user can perform an action
canPerformAction(user, "create", "product")

// Check multiple permissions (OR logic)
hasAnyPermission(user, [PERMISSIONS.SALE_VIEW, PERMISSIONS.REPORT_SALES])

// Check multiple permissions (AND logic)
hasAllPermissions(user, [PERMISSIONS.PURCHASE_CREATE, PERMISSIONS.PURCHASE_APPROVE])
```

**Related Files**:
- `src/lib/rbac.ts` - RBAC configuration and functions
- `src/hooks/usePermissions.ts` - React hook for permission checking
- `prisma/schema.prisma` - Role and Permission models
- `prisma/seed.ts` - Seeds default roles and permissions

---

### 3.2 Permission Checking Hook (`src/hooks/usePermissions.ts`)
**Purpose**: Provides a React hook for checking permissions in client components.

**Usage Example**:
```typescript
"use client";
import { usePermissions } from "@/hooks/usePermissions";
import { PERMISSIONS } from "@/lib/rbac";

function MyComponent() {
  const { can, hasRole, user } = usePermissions();

  return (
    <div>
      {can(PERMISSIONS.PRODUCT_CREATE) && (
        <button>Create Product</button>
      )}

      {hasRole("Admin") && (
        <div>Admin Panel</div>
      )}
    </div>
  );
}
```

**Available Functions**:
- `can(permission)` - Check single permission
- `hasRole(roleName)` - Check if user has role
- `user` - Full user session object

---

## 4. Dashboard Layout & Navigation

### 4.1 Dashboard Layout (`src/app/dashboard/layout.tsx`)
**Purpose**: Wraps all dashboard pages with navigation, sidebar, and session provider.

**File Location**: `src/app/dashboard/layout.tsx`

**Layout Structure**:
```
SessionProvider (NextAuth context)
  ↓
<html> with dark mode support
  ↓
<body>
  ↓
Main container with Sidebar + Content area
  ↓
Sidebar (fixed left, collapsible)
  ↓
Main content area (scrollable)
  ↓
Children (individual dashboard pages)
```

**Key Features**:
- **Session Provider**: Provides auth context to all child components
- **Sidebar**: Collapsible navigation menu (see section 5)
- **Responsive**: Mobile-friendly with hamburger menu
- **Dark Mode**: Supports light/dark theme toggle
- **Breadcrumbs**: Shows current page location

**Related Files**:
- `src/app/dashboard/layout.tsx` - Dashboard layout
- `src/components/Sidebar.tsx` - Sidebar component
- `src/components/ui/*` - UI components

---

### 4.2 Dashboard Home Page (`src/app/dashboard/page.tsx`)
**Purpose**: Main dashboard landing page with overview stats and widgets.

**File Location**: `src/app/dashboard/page.tsx`

**Features**:
- Sales statistics cards
- Recent transactions
- Quick action buttons
- Financial overview
- Inventory alerts
- Charts and graphs

**Data Sources**:
- `GET /api/dashboard/stats` - Dashboard statistics
- `GET /api/dashboard/analytics` - Analytics data
- `GET /api/dashboard/financial-v4` - Financial summary

---

## 5. Sidebar Menu Structure

### 5.1 Sidebar Component (`src/components/Sidebar.tsx`)
**Purpose**: Main navigation menu with permission-based visibility.

**File Location**: `src/components/Sidebar.tsx`

**Menu Categories**:

#### 5.1.1 Dashboard
- **Dashboard Home** (`/dashboard`)
  - Permission: `DASHBOARD_VIEW`
  - Icon: HomeIcon
  - Always visible to authenticated users

#### 5.1.2 Sales
- **Point of Sale** (`/dashboard/pos`)
  - Permission: `SALE_CREATE`
  - Icon: ShoppingCartIcon
  - Quick sale entry interface

- **Sales List** (`/dashboard/sales`)
  - Permission: `SALE_VIEW`
  - Icon: DocumentTextIcon
  - View all sales transactions

- **Customers** (`/dashboard/customers`)
  - Permission: `CUSTOMER_VIEW`
  - Icon: UsersIcon
  - Customer management

#### 5.1.3 Purchases
- **Purchase Orders** (`/dashboard/purchases`)
  - Permission: `PURCHASE_VIEW`
  - Icon: ShoppingBagIcon
  - Manage purchase orders

- **Purchase Receipts** (`/dashboard/purchases/receipts`)
  - Permission: `PURCHASE_RECEIVE`
  - Icon: DocumentCheckIcon
  - Receive inventory from suppliers

- **Suppliers** (`/dashboard/suppliers`)
  - Permission: `SUPPLIER_VIEW`
  - Icon: BuildingStorefrontIcon
  - Supplier management

- **Purchase Returns** (`/dashboard/purchases/returns`)
  - Permission: `PURCHASE_VIEW`
  - Icon: ArrowUturnLeftIcon
  - Return items to suppliers

#### 5.1.4 Products & Inventory
- **Products** (`/dashboard/products`)
  - Permission: `PRODUCT_VIEW`
  - Icon: CubeIcon
  - Product catalog management

- **Categories** (`/dashboard/products/categories`)
  - Permission: `PRODUCT_VIEW`
  - Icon: TagIcon
  - Product categories

- **Brands** (`/dashboard/products/brands`)
  - Permission: `PRODUCT_VIEW`
  - Icon: SparklesIcon
  - Product brands

- **Stock Levels** (`/dashboard/products/stock`)
  - Permission: `INVENTORY_VIEW`
  - Icon: ChartBarIcon
  - Current stock by location

- **Inventory Transfers** (`/dashboard/transfers`)
  - Permission: `INVENTORY_TRANSFER`
  - Icon: ArrowsRightLeftIcon
  - Transfer stock between locations

- **Inventory Corrections** (`/dashboard/inventory-corrections`)
  - Permission: `INVENTORY_ADJUST`
  - Icon: WrenchIcon
  - Adjust inventory discrepancies

#### 5.1.5 Reports
**Financial Reports**:
- **Sales Reports** (`/dashboard/reports/sales-report`)
  - Permission: `REPORT_SALES`

- **Purchase Reports** (`/dashboard/reports/purchases/page`)
  - Permission: `REPORT_PURCHASE`

- **Profit & Loss** (`/dashboard/reports/profit-loss`)
  - Permission: `REPORT_FINANCIAL`

- **Payment Collections** (`/dashboard/reports/payment-collections`)
  - Permission: `REPORT_CUSTOMER_PAYMENTS`

- **Accounts Receivable** (`/dashboard/reports/accounts-receivable`)
  - Permission: `REPORT_CUSTOMER_PAYMENTS`

- **Receivable Payments** (`/dashboard/reports/receivable-payments`)
  - Permission: `REPORT_CUSTOMER_PAYMENTS`

**Inventory Reports**:
- **Stock Alert** (`/dashboard/reports/stock-alert`)
  - Permission: `REPORT_INVENTORY`

- **Inventory Valuation** (`/dashboard/reports/inventory-valuation`)
  - Permission: `REPORT_INVENTORY`

- **Inventory Ledger** (`/dashboard/reports/inventory-ledger`)
  - Permission: `REPORT_INVENTORY`

**Accounting Reports**:
- **Balance Sheet** (`/dashboard/accounting/balance-sheet`)
  - Permission: `REPORT_FINANCIAL`

- **Income Statement** (`/dashboard/accounting/income-statement`)
  - Permission: `REPORT_FINANCIAL`

- **Trial Balance** (`/dashboard/accounting/trial-balance`)
  - Permission: `REPORT_FINANCIAL`

#### 5.1.6 Finance
- **Expenses** (`/dashboard/expenses`)
  - Permission: `EXPENSE_VIEW`
  - Icon: CurrencyDollarIcon
  - Expense tracking

- **Accounts Payable** (`/dashboard/accounts-payable`)
  - Permission: `EXPENSE_VIEW`
  - Icon: BanknotesIcon
  - Supplier payment tracking

- **Banks** (`/dashboard/banks`)
  - Permission: `REPORT_FINANCIAL`
  - Icon: BuildingLibraryIcon
  - Bank account management

- **Bank Transactions** (`/dashboard/bank-transactions`)
  - Permission: `REPORT_FINANCIAL`
  - Icon: DocumentDuplicateIcon
  - Bank transaction reconciliation

#### 5.1.7 HR & Operations
- **Users** (`/dashboard/users`)
  - Permission: `USER_VIEW`
  - Icon: UserGroupIcon
  - User management

- **Roles** (`/dashboard/roles`)
  - Permission: `ROLE_VIEW`
  - Icon: ShieldCheckIcon
  - Role and permission management

- **Attendance** (`/dashboard/attendance`)
  - Permission: `USER_VIEW`
  - Icon: ClockIcon
  - Employee attendance tracking

- **Schedules** (`/dashboard/schedules`)
  - Permission: `USER_VIEW`
  - Icon: CalendarIcon
  - Employee scheduling

#### 5.1.8 Settings
- **Business Settings** (`/dashboard/business-settings`)
  - Permission: `USER_VIEW` (Admin only)
  - Icon: Cog6ToothIcon
  - Business profile and preferences

- **Locations** (`/dashboard/locations`)
  - Permission: `USER_VIEW`
  - Icon: MapPinIcon
  - Branch/location management

- **Tax Rates** (`/dashboard/settings/tax-rates`)
  - Permission: `REPORT_FINANCIAL`
  - Icon: ReceiptPercentIcon
  - Tax configuration

- **Menu Permissions** (`/dashboard/settings/menu-permissions`)
  - Permission: `ROLE_EDIT`
  - Icon: Bars3Icon
  - Menu visibility by role

#### 5.1.9 Tools & Utilities
- **AI Assistant** (`/dashboard/ai-assistant`)
  - Permission: `DASHBOARD_VIEW`
  - Icon: SparklesIcon
  - OpenAI-powered assistant

- **Audit Logs** (`/dashboard/audit-logs`)
  - Permission: `USER_VIEW` (Admin)
  - Icon: DocumentMagnifyingGlassIcon
  - System activity logs

- **Notifications** (`/dashboard/notifications`)
  - Permission: `DASHBOARD_VIEW`
  - Icon: BellIcon
  - System notifications

---

### 5.2 Menu Visibility Logic

**Permission-Based Filtering**:
```typescript
// Sidebar checks permissions for each menu item
const menuItems = [
  {
    name: "Products",
    href: "/dashboard/products",
    permission: PERMISSIONS.PRODUCT_VIEW,
    icon: CubeIcon
  },
  // ... more items
];

// Only show items user has permission for
const visibleItems = menuItems.filter(item =>
  hasPermission(user, item.permission)
);
```

**Dynamic Menu Management**:
- Admins can customize menu visibility via **Menu Permissions** page
- Per-role customization
- Per-user overrides
- Stored in database (`MenuPermission` model)

---

## 6. API Routes Reference

### 6.1 API Route Structure

All API routes follow REST conventions:
- `GET` - Retrieve data
- `POST` - Create new resource
- `PUT/PATCH` - Update existing resource
- `DELETE` - Delete resource

**Standard Response Format**:
```typescript
// Success
{
  data: any,           // Response data
  message?: string     // Optional success message
}

// Error
{
  error: string,       // Error message
  details?: any        // Optional error details
}
```

**Authentication Check Pattern**:
```typescript
export async function GET(request: Request) {
  // Get session
  const session = await getServerSession(authOptions);

  // Check authentication
  if (!session) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  // Check permission
  if (!hasPermission(session.user, PERMISSIONS.SOME_PERMISSION)) {
    return NextResponse.json(
      { error: "Forbidden" },
      { status: 403 }
    );
  }

  // Business logic...
}
```

---

### 6.2 Core API Routes

#### 6.2.1 Authentication APIs
- `POST /api/auth/logout` - Logout user
- `POST /api/auth/verify-password` - Verify password for sensitive operations

#### 6.2.2 Product APIs
- `GET /api/products` - List all products (with filters)
- `POST /api/products` - Create new product
- `GET /api/products/[id]` - Get product details
- `PUT /api/products/[id]` - Update product
- `DELETE /api/products/[id]` - Delete product
- `POST /api/products/import` - Import products from CSV
- `GET /api/products/search` - Search products
- `GET /api/products/[id]/stock` - Get stock levels by location
- `POST /api/products/[id]/opening-stock` - Set opening stock

#### 6.2.3 Sales APIs
- `GET /api/sales` - List all sales
- `POST /api/sales` - Create new sale
- `GET /api/sales/[id]` - Get sale details
- `POST /api/sales/[id]/payment` - Record payment for credit sale
- `POST /api/sales/[id]/refund` - Refund sale
- `POST /api/sales/[id]/void` - Void sale
- `POST /api/sales/[id]/reprint` - Reprint receipt

#### 6.2.4 Purchase APIs
- `GET /api/purchases` - List purchase orders
- `POST /api/purchases` - Create purchase order
- `GET /api/purchases/[id]` - Get PO details
- `PUT /api/purchases/[id]` - Update PO
- `POST /api/purchases/[id]/receive` - Receive inventory
- `POST /api/purchases/[id]/close` - Close PO
- `GET /api/purchases/receipts` - List receipts
- `POST /api/purchases/receipts` - Create receipt
- `GET /api/purchases/returns` - List purchase returns
- `POST /api/purchases/returns` - Create return

#### 6.2.5 Customer APIs
- `GET /api/customers` - List customers
- `POST /api/customers` - Create customer
- `GET /api/customers/[id]` - Get customer details
- `PUT /api/customers/[id]` - Update customer
- `DELETE /api/customers/[id]` - Delete customer
- `POST /api/customers/import` - Import from CSV

#### 6.2.6 Supplier APIs
- `GET /api/suppliers` - List suppliers
- `POST /api/suppliers` - Create supplier
- `GET /api/suppliers/[id]` - Get supplier details
- `PUT /api/suppliers/[id]` - Update supplier
- `DELETE /api/suppliers/[id]` - Delete supplier
- `POST /api/suppliers/import` - Import from CSV

#### 6.2.7 Inventory APIs
- `GET /api/transfers` - List transfers
- `POST /api/transfers` - Create transfer
- `GET /api/transfers/[id]` - Get transfer details
- `POST /api/transfers/[id]/send` - Send transfer
- `POST /api/transfers/[id]/receive` - Receive transfer
- `POST /api/transfers/[id]/verify-item` - Verify received item
- `GET /api/inventory-corrections` - List corrections
- `POST /api/inventory-corrections` - Create correction
- `POST /api/inventory-corrections/[id]/approve` - Approve correction

#### 6.2.8 Report APIs
- `GET /api/reports/sales` - Sales report
- `GET /api/reports/purchases/page` - Purchase report
- `GET /api/reports/profit-loss` - P&L report
- `GET /api/reports/inventory-valuation` - Inventory valuation
- `GET /api/reports/stock-alert` - Stock alert report
- `GET /api/reports/accounts-receivable` - AR report
- `GET /api/reports/payment-collections` - Payment collections
- `GET /api/reports/receivable-payments` - AR payments

#### 6.2.9 Accounting APIs
- `GET /api/accounting/balance-sheet` - Balance sheet
- `GET /api/accounting/income-statement` - Income statement
- `GET /api/accounting/trial-balance` - Trial balance
- `GET /api/accounting/general-ledger` - General ledger
- `GET /api/accounting/journal-entries` - Journal entries

#### 6.2.10 User & Role APIs
- `GET /api/users` - List users
- `POST /api/users` - Create user
- `GET /api/users/[id]` - Get user details
- `PUT /api/users/[id]` - Update user
- `DELETE /api/users/[id]` - Delete user
- `POST /api/users/[id]/reset-password` - Reset password
- `GET /api/roles` - List roles
- `POST /api/roles` - Create role
- `GET /api/roles/[id]` - Get role details
- `PUT /api/roles/[id]` - Update role
- `DELETE /api/roles/[id]` - Delete role

#### 6.2.11 Settings APIs
- `GET /api/business/settings` - Get business settings
- `PUT /api/business/settings` - Update settings
- `GET /api/locations` - List locations
- `POST /api/locations` - Create location
- `PUT /api/locations/[id]` - Update location
- `GET /api/settings/tax-rates` - Get tax rates
- `POST /api/settings/tax-rates` - Create tax rate
- `GET /api/settings/menu-permissions` - Get menu permissions
- `PUT /api/settings/menu-permissions` - Update menu permissions

#### 6.2.12 Dashboard APIs
- `GET /api/dashboard/stats` - Dashboard statistics
- `GET /api/dashboard/analytics` - Analytics data
- `GET /api/dashboard/financial-v4` - Financial summary
- `GET /api/dashboard/sales-by-location` - Sales by location

#### 6.2.13 Utility APIs
- `GET /api/notifications` - Get user notifications
- `POST /api/notifications/[id]/mark-read` - Mark notification as read
- `GET /api/audit-logs` - Get audit logs
- `POST /api/chat` - AI Assistant chat endpoint

---

## 7. Dashboard Pages Reference

### 7.1 Sales & POS Pages

#### Point of Sale (`/dashboard/pos`)
- **File**: `src/app/dashboard/pos/page.tsx`
- **Permission**: `SALE_CREATE`
- **Features**:
  - Product search and selection
  - Cart management
  - Multiple payment methods
  - Discount application
  - Receipt printing
  - Credit sales with customer selection
- **API Calls**:
  - `POST /api/sales` - Create sale
  - `GET /api/products/search` - Search products
  - `GET /api/customers` - List customers

#### Sales List (`/dashboard/sales`)
- **File**: `src/app/dashboard/sales/page.tsx`
- **Permission**: `SALE_VIEW`
- **Features**:
  - List all sales transactions
  - Filter by date, customer, status
  - View sale details
  - Print receipts
  - Process refunds/voids
- **API Calls**:
  - `GET /api/sales` - List sales

#### Sale Details (`/dashboard/sales/[id]`)
- **File**: `src/app/dashboard/sales/[id]/page.tsx`
- **Permission**: `SALE_VIEW`
- **Features**:
  - View complete sale details
  - Payment history
  - Refund/void actions
  - Reprint receipt
- **API Calls**:
  - `GET /api/sales/[id]` - Get sale details
  - `POST /api/sales/[id]/reprint` - Reprint

---

### 7.2 Purchase Pages

#### Purchase Orders (`/dashboard/purchases`)
- **File**: `src/app/dashboard/purchases/page.tsx`
- **Permission**: `PURCHASE_VIEW`
- **Features**:
  - List all POs
  - Create new PO
  - Filter by supplier, status, date
  - Approve/reject POs
- **API Calls**:
  - `GET /api/purchases` - List POs
  - `POST /api/purchases` - Create PO

#### Create Purchase Order (`/dashboard/purchases/create`)
- **File**: `src/app/dashboard/purchases/create/page.tsx`
- **Permission**: `PURCHASE_CREATE`
- **Features**:
  - Select supplier
  - Add products with quantities
  - Set expected delivery date
  - Calculate totals
- **API Calls**:
  - `POST /api/purchases` - Create PO
  - `GET /api/suppliers` - List suppliers
  - `GET /api/products/search` - Search products

#### Purchase Receipts (`/dashboard/purchases/receipts`)
- **File**: `src/app/dashboard/purchases/receipts/page.tsx`
- **Permission**: `PURCHASE_RECEIVE`
- **Features**:
  - List all receipts
  - Create receipt from PO
  - Verify received quantities
  - Record serial numbers
  - Update inventory
- **API Calls**:
  - `GET /api/purchases/receipts` - List receipts
  - `POST /api/purchases/receipts` - Create receipt

---

### 7.3 Product Pages

#### Products List (`/dashboard/products`)
- **File**: `src/app/dashboard/products/page.tsx`
- **Permission**: `PRODUCT_VIEW`
- **Features**:
  - List all products with DevExtreme DataGrid
  - Filter, search, sort
  - Bulk actions (activate, deactivate, delete)
  - Export to CSV/Excel
  - Quick view stock levels
- **API Calls**:
  - `GET /api/products` - List products
  - `POST /api/products/bulk-toggle-active` - Bulk toggle
  - `POST /api/products/bulk-delete` - Bulk delete

#### Add Product (`/dashboard/products/add`)
- **File**: `src/app/dashboard/products/add/page.tsx`
- **Permission**: `PRODUCT_CREATE`
- **Features**:
  - Product information form
  - Category and brand selection
  - Pricing (cost, selling price)
  - Tax configuration
  - Multi-unit support
  - Product variations
  - Opening stock
- **API Calls**:
  - `POST /api/products` - Create product
  - `GET /api/categories` - List categories
  - `GET /api/brands` - List brands

#### Edit Product (`/dashboard/products/[id]/edit`)
- **File**: `src/app/dashboard/products/[id]/edit/page.tsx`
- **Permission**: `PRODUCT_EDIT`
- **Features**:
  - Edit product details
  - Manage variations
  - Update pricing
  - Location-specific pricing
- **API Calls**:
  - `GET /api/products/[id]` - Get product
  - `PUT /api/products/[id]` - Update product

#### Product Categories (`/dashboard/products/categories`)
- **File**: `src/app/dashboard/products/categories/page.tsx`
- **Permission**: `PRODUCT_VIEW`
- **Features**:
  - List categories
  - Create/edit/delete categories
  - Import categories
- **API Calls**:
  - `GET /api/categories` - List categories
  - `POST /api/categories` - Create category
  - `PUT /api/categories/[id]` - Update
  - `DELETE /api/categories/[id]` - Delete

#### Product Brands (`/dashboard/products/brands`)
- **File**: `src/app/dashboard/products/brands/page.tsx`
- **Permission**: `PRODUCT_VIEW`
- **Features**:
  - List brands
  - Create/edit/delete brands
  - Import brands
- **API Calls**:
  - `GET /api/brands` - List brands
  - `POST /api/brands` - Create brand

---

### 7.4 Inventory Pages

#### Stock Levels (`/dashboard/products/stock`)
- **File**: `src/app/dashboard/products/stock/page.tsx`
- **Permission**: `INVENTORY_VIEW`
- **Features**:
  - View stock by product and location
  - Filter by location, category
  - Stock alerts (low/out of stock)
  - Export reports
- **API Calls**:
  - `GET /api/products/stock` - Get stock levels

#### Inventory Transfers (`/dashboard/transfers`)
- **File**: `src/app/dashboard/transfers/page.tsx`
- **Permission**: `INVENTORY_TRANSFER`
- **Features**:
  - List all transfers
  - Create transfer between locations
  - Send/receive transfers
  - Verify received items
  - Track transfer status
- **API Calls**:
  - `GET /api/transfers` - List transfers
  - `POST /api/transfers` - Create transfer
  - `POST /api/transfers/[id]/send` - Send
  - `POST /api/transfers/[id]/receive` - Receive

#### Inventory Corrections (`/dashboard/inventory-corrections`)
- **File**: `src/app/dashboard/inventory-corrections/page.tsx`
- **Permission**: `INVENTORY_ADJUST`
- **Features**:
  - List corrections
  - Create correction (add/subtract stock)
  - Require approval for corrections
  - Audit trail
- **API Calls**:
  - `GET /api/inventory-corrections` - List
  - `POST /api/inventory-corrections` - Create
  - `POST /api/inventory-corrections/[id]/approve` - Approve

---

### 7.5 Report Pages

#### Sales Reports (`/dashboard/reports/sales-report`)
- **File**: `src/app/dashboard/reports/sales-report/page.tsx`
- **Permission**: `REPORT_SALES`
- **Features**:
  - Date range filtering
  - Sales by location, cashier, customer
  - Export to Excel, PDF
  - Charts and summaries
- **API Calls**:
  - `GET /api/reports/sales` - Sales report data

#### Purchase Reports (`/dashboard/reports/purchases/page`)
- **File**: `src/app/dashboard/reports/purchases/page.tsx`
- **Permission**: `REPORT_PURCHASE`
- **Features**:
  - Purchase analytics
  - Supplier performance
  - Cost trends
  - Export capabilities
- **API Calls**:
  - `GET /api/reports/purchases/route` - Purchase data

#### Profit & Loss (`/dashboard/reports/profit-loss`)
- **File**: `src/app/dashboard/reports/profit-loss/page.tsx`
- **Permission**: `REPORT_FINANCIAL`
- **Features**:
  - Revenue breakdown
  - Expense breakdown
  - Net profit calculation
  - Period comparison
- **API Calls**:
  - `GET /api/reports/profit-loss` - P&L data

#### Accounts Receivable (`/dashboard/reports/accounts-receivable`)
- **File**: `src/app/dashboard/reports/accounts-receivable/page.tsx`
- **Permission**: `REPORT_CUSTOMER_PAYMENTS`
- **Features**:
  - Customer outstanding balances
  - Aging analysis (0-30, 31-60, 61-90, 90+ days)
  - Credit limit tracking
  - Export capabilities
- **API Calls**:
  - `GET /api/reports/accounts-receivable` - AR data

#### Inventory Valuation (`/dashboard/reports/inventory-valuation`)
- **File**: `src/app/dashboard/reports/inventory-valuation/page.tsx`
- **Permission**: `REPORT_INVENTORY`
- **Features**:
  - Total inventory value by location
  - Category breakdown
  - Historical valuation
- **API Calls**:
  - `GET /api/reports/inventory-valuation` - Valuation data

---

### 7.6 User & Role Pages

#### Users (`/dashboard/users`)
- **File**: `src/app/dashboard/users/page.tsx`
- **Permission**: `USER_VIEW`
- **Features**:
  - List all users
  - Create/edit/delete users
  - Assign roles
  - Assign location
  - Reset passwords
- **API Calls**:
  - `GET /api/users` - List users
  - `POST /api/users` - Create user

#### Roles (`/dashboard/roles`)
- **File**: `src/app/dashboard/roles/page.tsx`
- **Permission**: `ROLE_VIEW`
- **Features**:
  - List roles
  - Create/edit/delete roles
  - Assign permissions
  - Duplicate roles
- **API Calls**:
  - `GET /api/roles` - List roles
  - `POST /api/roles` - Create role
  - `GET /api/permissions` - List permissions

---

### 7.7 Settings Pages

#### Business Settings (`/dashboard/business-settings`)
- **File**: `src/app/dashboard/business-settings/page.tsx`
- **Permission**: Admin only
- **Features**:
  - Business profile
  - Currency settings
  - Tax settings
  - Receipt settings
  - Email/SMS configuration
- **API Calls**:
  - `GET /api/business/settings` - Get settings
  - `PUT /api/business/settings` - Update

#### Locations (`/dashboard/locations`)
- **File**: `src/app/dashboard/locations/page.tsx`
- **Permission**: `USER_VIEW`
- **Features**:
  - List branch locations
  - Create/edit/delete locations
  - Set default location
  - Configure location-specific settings
- **API Calls**:
  - `GET /api/locations` - List locations
  - `POST /api/locations` - Create location

#### Menu Permissions (`/dashboard/settings/menu-permissions`)
- **File**: `src/app/dashboard/settings/menu-permissions/page.tsx`
- **Permission**: `ROLE_EDIT`
- **Features**:
  - Configure menu visibility by role
  - User-specific menu overrides
  - Menu reordering
- **API Calls**:
  - `GET /api/settings/menu-permissions` - Get config
  - `PUT /api/settings/menu-permissions` - Update

---

## 8. Database Schema Overview

### 8.1 Core Models

#### User Model
```prisma
model User {
  id            String    @id @default(cuid())
  username      String    @unique
  password      String    // bcrypt hashed
  name          String?
  email         String?   @unique
  businessId    String
  business      Business  @relation(...)
  locationId    String?   // Assigned branch
  roles         Role[]
  permissions   Permission[]
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt
}
```

#### Business Model
```prisma
model Business {
  id            String    @id @default(cuid())
  name          String
  ownerId       String
  owner         User      @relation(...)
  users         User[]
  locations     BusinessLocation[]
  products      Product[]
  sales         Sale[]
  purchases     Purchase[]
  createdAt     DateTime  @default(now())
}
```

#### Role Model
```prisma
model Role {
  id            String       @id @default(cuid())
  name          String
  businessId    String
  business      Business     @relation(...)
  permissions   Permission[]
  users         User[]
  createdAt     DateTime     @default(now())
}
```

#### Permission Model
```prisma
model Permission {
  id            String   @id @default(cuid())
  name          String   // e.g., "PRODUCT_CREATE"
  description   String?
  roles         Role[]
  users         User[]   // Direct user permissions
}
```

---

### 8.2 Product Models

#### Product Model
```prisma
model Product {
  id            String        @id @default(cuid())
  name          String
  sku           String?       @unique
  barcode       String?
  businessId    String
  business      Business      @relation(...)
  categoryId    String?
  category      Category?     @relation(...)
  brandId       String?
  brand         Brand?        @relation(...)
  cost          Decimal
  price         Decimal
  taxId         String?
  isActive      Boolean       @default(true)
  variations    ProductVariation[]
  stock         ProductStock[]
  createdAt     DateTime      @default(now())
  updatedAt     DateTime      @updatedAt
}
```

#### ProductStock Model
```prisma
model ProductStock {
  id            String           @id @default(cuid())
  productId     String
  product       Product          @relation(...)
  locationId    String
  location      BusinessLocation @relation(...)
  quantity      Int
  updatedAt     DateTime         @updatedAt

  @@unique([productId, locationId])
}
```

---

### 8.3 Transaction Models

#### Sale Model
```prisma
model Sale {
  id                String        @id @default(cuid())
  invoiceNumber     String        @unique
  businessId        String
  business          Business      @relation(...)
  locationId        String
  location          BusinessLocation @relation(...)
  customerId        String?
  customer          Customer?     @relation(...)
  userId            String        // Cashier
  user              User          @relation(...)
  subtotal          Decimal
  tax               Decimal
  discount          Decimal       @default(0)
  total             Decimal
  paymentStatus     String        // paid, partial, unpaid
  items             SaleItem[]
  payments          Payment[]
  createdAt         DateTime      @default(now())
}
```

#### Purchase Model
```prisma
model Purchase {
  id                String        @id @default(cuid())
  purchaseNumber    String        @unique
  businessId        String
  business          Business      @relation(...)
  supplierId        String
  supplier          Supplier      @relation(...)
  locationId        String        // Receiving location
  location          BusinessLocation @relation(...)
  status            String        // draft, pending, approved, received
  total             Decimal
  items             PurchaseItem[]
  receipts          PurchaseReceipt[]
  createdAt         DateTime      @default(now())
}
```

---

## 9. Multi-Tenant Architecture

### 9.1 Data Isolation

**Every query must filter by `businessId`**:

```typescript
// ❌ WRONG - No tenant isolation
const products = await prisma.product.findMany();

// ✅ CORRECT - Filtered by businessId
const products = await prisma.product.findMany({
  where: { businessId: session.user.businessId }
});
```

### 9.2 Session Business Context

Every authenticated user has a `businessId` in their session:

```typescript
const session = await getServerSession(authOptions);
const businessId = session.user.businessId;

// Use businessId in all queries
```

---

## 10. Key Components & Utilities

### 10.1 Key Files

| File | Purpose |
|------|---------|
| `src/lib/auth.ts` | NextAuth configuration |
| `src/lib/rbac.ts` | RBAC permissions and functions |
| `src/lib/prisma.ts` | Prisma client singleton |
| `src/hooks/usePermissions.ts` | Permission checking hook |
| `src/components/Sidebar.tsx` | Main navigation |
| `src/components/ui/*` | Reusable UI components |
| `src/middleware.ts` | Route protection middleware |
| `prisma/schema.prisma` | Database schema |
| `prisma/seed.ts` | Database seeding |

---

### 10.2 Utility Functions

#### Permission Checking (`src/lib/rbac.ts`)
```typescript
hasPermission(user, permission) - Check single permission
hasRole(user, roleName) - Check if user has role
hasAnyPermission(user, permissions) - Check multiple (OR)
hasAllPermissions(user, permissions) - Check multiple (AND)
```

#### Database Queries (`src/lib/prisma.ts`)
```typescript
import prisma from "@/lib/prisma";

// Use prisma client for database operations
const data = await prisma.model.findMany({ ... });
```

---

## Conclusion

This documentation provides a comprehensive overview of the application flow from login to all features. Each section details:

1. **Entry points** - How users access the application
2. **Authentication** - How login and sessions work
3. **Authorization** - How permissions control access
4. **Navigation** - How the sidebar menu is structured
5. **API routes** - All available endpoints
6. **Pages** - All dashboard pages and their features
7. **Database** - Schema and data relationships
8. **Multi-tenancy** - How data isolation works

Use this as a reference to understand the codebase architecture and add new features following existing patterns.

---

**Generated**: 2025-11-12
**Version**: 1.0
**Project**: Igoro Tech(IT) Inventory Management System
