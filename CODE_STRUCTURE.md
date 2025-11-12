# Code Structure Guide
# Igoro Tech(IT) Inventory Management System

> **Complete guide to understanding the codebase structure, file locations, and their purposes**

---

## Table of Contents

1. [Project Root](#project-root)
2. [Source Directory (src/)](#source-directory-src)
3. [App Directory (src/app/)](#app-directory-srcapp)
4. [Components (src/components/)](#components-srccomponents)
5. [Libraries (src/lib/)](#libraries-srclib)
6. [Hooks (src/hooks/)](#hooks-srchooks)
7. [Database (prisma/)](#database-prisma)
8. [Configuration Files](#configuration-files)

---

## Project Root

```
ultimatepos-modern/
├── prisma/                  # Database schema and migrations
├── public/                  # Static assets (images, fonts)
├── src/                     # Source code
├── .env                     # Environment variables (not in git)
├── .env.example             # Example environment variables
├── .gitignore              # Git ignore rules
├── middleware.ts           # Next.js middleware (auth + performance)
├── next.config.js          # Next.js configuration
├── package.json            # Dependencies and scripts
├── tailwind.config.js      # Tailwind CSS configuration
├── tsconfig.json           # TypeScript configuration
├── APPLICATION_FLOW.md     # Application flow documentation
├── API_ENDPOINTS.md        # API reference guide
├── CODE_STRUCTURE.md       # This file
└── CLAUDE.md              # AI assistant instructions
```

---

## Source Directory (src/)

The `src/` directory contains all application source code.

```
src/
├── app/                    # Next.js App Router (pages + API routes)
├── components/             # Reusable React components
├── hooks/                  # Custom React hooks
├── lib/                    # Utility functions and libraries
└── types/                  # TypeScript type definitions
```

---

## App Directory (src/app/)

Next.js 15 uses the App Router, where directories define routes.

### Structure

```
src/app/
├── api/                    # API routes
├── dashboard/              # Dashboard pages (protected)
├── login/                  # Login page
├── globals.css            # Global styles
├── layout.tsx             # Root layout
└── page.tsx               # Landing page (/)
```

### API Routes (src/app/api/)

All API endpoints are located here. Each `route.ts` file handles HTTP methods (GET, POST, PUT, DELETE).

```
src/app/api/
├── auth/                           # Authentication endpoints
│   ├── logout/route.ts            # POST: Logout user
│   └── verify-password/route.ts   # POST: Verify password
│
├── products/                       # Product management
│   ├── route.ts                   # GET: List products, POST: Create product
│   ├── [id]/route.ts              # GET: Get product, PUT: Update, DELETE: Delete
│   ├── [id]/stock/route.ts        # GET: Get stock levels
│   ├── [id]/opening-stock/route.ts # POST: Set opening stock
│   ├── search/route.ts            # GET: Search products
│   └── import/route.ts            # POST: Import from CSV
│
├── sales/                          # Sales transactions
│   ├── route.ts                   # GET: List sales, POST: Create sale
│   ├── [id]/route.ts              # GET: Get sale details
│   ├── [id]/payment/route.ts      # POST: Record payment
│   ├── [id]/void/route.ts         # POST: Void sale
│   └── [id]/refund/route.ts       # POST: Process refund
│
├── purchases/                      # Purchase orders
│   ├── route.ts                   # GET: List POs, POST: Create PO
│   ├── [id]/route.ts              # GET: Get PO, PUT: Update
│   ├── [id]/receive/route.ts      # POST: Receive inventory
│   ├── receipts/route.ts          # GET: List receipts
│   └── returns/route.ts           # GET: List returns
│
├── customers/                      # Customer management
│   ├── route.ts                   # GET: List, POST: Create
│   ├── [id]/route.ts              # GET/PUT/DELETE: Manage customer
│   └── import/route.ts            # POST: Import from CSV
│
├── suppliers/                      # Supplier management
│   ├── route.ts                   # GET: List, POST: Create
│   ├── [id]/route.ts              # GET/PUT/DELETE: Manage supplier
│   └── import/route.ts            # POST: Import from CSV
│
├── transfers/                      # Inventory transfers
│   ├── route.ts                   # GET: List, POST: Create
│   ├── [id]/route.ts              # GET: Get details
│   ├── [id]/send/route.ts         # POST: Send transfer
│   ├── [id]/receive/route.ts      # POST: Receive transfer
│   └── [id]/verify-item/route.ts  # POST: Verify received item
│
├── inventory-corrections/          # Inventory adjustments
│   ├── route.ts                   # GET: List, POST: Create
│   ├── [id]/route.ts              # GET/PUT/DELETE: Manage
│   └── [id]/approve/route.ts      # POST: Approve correction
│
├── reports/                        # Reporting endpoints
│   ├── sales/route.ts             # GET: Sales report
│   ├── purchases/route.ts         # GET: Purchase report
│   ├── profit-loss/route.ts       # GET: P&L report
│   ├── inventory-valuation/route.ts # GET: Inventory valuation
│   ├── accounts-receivable/route.ts # GET: AR report
│   └── payment-collections/route.ts # GET: Payment collections
│
├── users/                          # User management
│   ├── route.ts                   # GET: List, POST: Create
│   ├── [id]/route.ts              # GET/PUT/DELETE: Manage user
│   └── [id]/reset-password/route.ts # POST: Reset password
│
├── roles/                          # Role management
│   ├── route.ts                   # GET: List, POST: Create
│   ├── [id]/route.ts              # GET/PUT/DELETE: Manage role
│   └── [id]/duplicate/route.ts    # POST: Duplicate role
│
├── dashboard/                      # Dashboard data
│   ├── stats/route.ts             # GET: Dashboard statistics
│   ├── analytics/route.ts         # GET: Analytics data
│   └── financial-v4/route.ts      # GET: Financial summary
│
├── business/                       # Business settings
│   ├── route.ts                   # GET/PUT: Business details
│   └── settings/route.ts          # GET/PUT: Business settings
│
├── locations/                      # Location management
│   ├── route.ts                   # GET: List, POST: Create
│   ├── [id]/route.ts              # GET/PUT/DELETE: Manage location
│   └── [id]/toggle-status/route.ts # POST: Activate/deactivate
│
├── accounting/                     # Accounting reports
│   ├── balance-sheet/route.ts     # GET: Balance sheet
│   ├── income-statement/route.ts  # GET: Income statement
│   ├── trial-balance/route.ts     # GET: Trial balance
│   └── general-ledger/route.ts    # GET: General ledger
│
├── settings/                       # Application settings
│   ├── tax-rates/route.ts         # GET/POST: Tax rates
│   ├── menu-permissions/route.ts  # GET/PUT: Menu config
│   └── pricing/route.ts           # GET/PUT: Pricing settings
│
└── notifications/                  # Notifications
    ├── route.ts                   # GET: List notifications
    └── [id]/mark-read/route.ts    # POST: Mark as read
```

### Dashboard Pages (src/app/dashboard/)

Protected pages requiring authentication.

```
src/app/dashboard/
├── layout.tsx                      # Dashboard layout (sidebar + content)
├── page.tsx                        # Dashboard home page
│
├── pos/page.tsx                    # Point of Sale interface
│
├── sales/                          # Sales pages
│   ├── page.tsx                   # List all sales
│   ├── [id]/page.tsx              # Sale details
│   ├── [id]/payment/page.tsx      # Payment page
│   └── create/page.tsx            # Create sale (alternative POS)
│
├── purchases/                      # Purchase pages
│   ├── page.tsx                   # List purchase orders
│   ├── [id]/page.tsx              # PO details
│   ├── [id]/receive/page.tsx      # Receive inventory
│   ├── create/page.tsx            # Create PO
│   ├── receipts/                  # Purchase receipts
│   │   ├── page.tsx               # List receipts
│   │   ├── [id]/page.tsx          # Receipt details
│   │   └── new/page.tsx           # Create receipt
│   └── returns/                   # Purchase returns
│       ├── page.tsx               # List returns
│       └── [id]/page.tsx          # Return details
│
├── products/                       # Product pages
│   ├── page.tsx                   # List products
│   ├── [id]/page.tsx              # Product details
│   ├── [id]/edit/page.tsx         # Edit product
│   ├── [id]/stock-history/page.tsx # Stock history
│   ├── add/page.tsx               # Create product
│   ├── categories/page.tsx        # Manage categories
│   ├── brands/page.tsx            # Manage brands
│   ├── stock/page.tsx             # Stock levels
│   ├── units/page.tsx             # Unit of measures
│   └── import/page.tsx            # Import products
│
├── customers/                      # Customer pages
│   ├── page.tsx                   # List customers
│   └── import/page.tsx            # Import customers
│
├── suppliers/                      # Supplier pages
│   ├── page.tsx                   # List suppliers
│   └── import/page.tsx            # Import suppliers
│
├── transfers/                      # Transfer pages
│   ├── page.tsx                   # List transfers
│   ├── [id]/page.tsx              # Transfer details
│   └── create/page.tsx            # Create transfer
│
├── inventory-corrections/          # Correction pages
│   ├── page.tsx                   # List corrections
│   ├── [id]/page.tsx              # Correction details
│   └── new/page.tsx               # Create correction
│
├── reports/                        # Report pages
│   ├── page.tsx                   # Reports index
│   ├── sales-report/page.tsx      # Sales report
│   ├── purchases/page.tsx         # Purchase report
│   ├── profit-loss/page.tsx       # P&L report
│   ├── inventory-valuation/page.tsx # Inventory valuation
│   ├── accounts-receivable/page.tsx # AR report
│   ├── receivable-payments/page.tsx # AR payments
│   ├── payment-collections/page.tsx # Payment collections
│   └── stock-alert/page.tsx       # Low stock alert
│
├── accounting/                     # Accounting pages
│   ├── balance-sheet/page.tsx     # Balance sheet
│   ├── income-statement/page.tsx  # Income statement
│   └── trial-balance/page.tsx     # Trial balance
│
├── users/                          # User pages
│   ├── page.tsx                   # List users
│   ├── [id]/edit/page.tsx         # Edit user
│   └── new/page.tsx               # Create user
│
├── roles/page.tsx                  # Role management
│
├── locations/page.tsx              # Location management
│
├── business-settings/page.tsx      # Business settings
│
├── accounts-payable/page.tsx       # Accounts payable
│
├── expenses/                       # Expense pages
│   ├── page.tsx                   # List expenses
│   └── categories/page.tsx        # Expense categories
│
├── banks/page.tsx                  # Bank accounts
│
├── bank-transactions/page.tsx      # Bank transactions
│
├── attendance/page.tsx             # Employee attendance
│
├── schedules/page.tsx              # Employee schedules
│
├── shifts/                         # Cashier shifts
│   ├── page.tsx                   # List shifts
│   ├── begin/page.tsx             # Start shift
│   └── close/page.tsx             # Close shift
│
├── readings/                       # POS readings
│   ├── x-reading/page.tsx         # X Reading (mid-shift)
│   ├── z-reading/page.tsx         # Z Reading (end-of-day)
│   └── history/page.tsx           # Reading history
│
├── notifications/page.tsx          # Notifications
│
├── audit-logs/page.tsx             # Audit logs
│
├── ai-assistant/page.tsx           # AI Assistant
│
├── profile/page.tsx                # User profile
│
└── settings/                       # Settings pages
    ├── tax-rates/page.tsx         # Tax configuration
    ├── menu-permissions/page.tsx  # Menu config
    ├── pricing/page.tsx           # Pricing settings
    └── inactivity/page.tsx        # Inactivity timeout
```

---

## Components (src/components/)

Reusable React components used across the application.

```
src/components/
├── Sidebar.tsx                     # Main navigation sidebar
├── Topbar.tsx                      # Top navigation bar
├── SessionProvider.tsx             # NextAuth session context
│
└── ui/                             # ShadCN UI components
    ├── button.tsx                 # Button component
    ├── input.tsx                  # Input field
    ├── select.tsx                 # Select dropdown
    ├── dialog.tsx                 # Modal dialog
    ├── table.tsx                  # Table component
    ├── card.tsx                   # Card container
    ├── badge.tsx                  # Badge/label
    ├── alert.tsx                  # Alert message
    ├── dropdown-menu.tsx          # Dropdown menu
    ├── form.tsx                   # Form components
    ├── label.tsx                  # Form label
    ├── checkbox.tsx               # Checkbox input
    ├── radio-group.tsx            # Radio buttons
    ├── switch.tsx                 # Toggle switch
    ├── tabs.tsx                   # Tab navigation
    ├── toast.tsx                  # Toast notification
    ├── tooltip.tsx                # Tooltip
    └── ...                        # Other UI components
```

### Key Components

#### Sidebar.tsx
```typescript
/**
 * Main navigation sidebar
 *
 * Location: src/components/Sidebar.tsx
 *
 * Features:
 * - Collapsible sidebar with icon + text
 * - Permission-based menu item filtering
 * - Nested menu groups
 * - Active route highlighting
 * - Mobile-responsive (hamburger menu)
 *
 * Uses:
 * - usePermissions() hook for permission checks
 * - PERMISSIONS constants from src/lib/rbac.ts
 * - Next.js Link for navigation
 */
```

#### SessionProvider.tsx
```typescript
/**
 * NextAuth session provider wrapper
 *
 * Location: src/components/SessionProvider.tsx
 *
 * Purpose:
 * - Wraps dashboard layout to provide session context
 * - Enables useSession() hook in client components
 * - Handles session refresh and updates
 */
```

---

## Libraries (src/lib/)

Utility functions and core libraries.

```
src/lib/
├── auth.ts                        # NextAuth configuration
├── rbac.ts                        # RBAC permissions and functions
├── prisma.ts                      # Prisma client singleton
├── utils.ts                       # General utilities
├── auditLog.ts                    # Audit logging functions
├── shift-running-totals.ts        # Shift calculations
├── readings-instant.ts            # X/Z Reading generation
└── notifications/                 # Notification services
    ├── login-alert-service.ts     # Login monitoring
    ├── telegram-service.ts        # Telegram integration
    └── email-service.ts           # Email integration
```

### Key Library Files

#### auth.ts
```typescript
/**
 * NextAuth Configuration
 *
 * Location: src/lib/auth.ts
 *
 * Purpose:
 * - Configures JWT authentication
 * - Defines credentials provider
 * - Handles login validation
 * - Enforces RFID location scanning
 * - Validates shift conflicts
 * - Checks schedule-based login restrictions
 * - Creates audit logs
 * - Sends login alerts
 *
 * Key Functions:
 * - authorize(credentials) - Main authentication logic
 * - jwt() callback - Encodes user data into JWT
 * - session() callback - Decodes JWT into session
 *
 * Used By:
 * - middleware.ts - Route protection
 * - API routes - Session validation
 * - Dashboard pages - User context
 */
```

#### rbac.ts
```typescript
/**
 * Role-Based Access Control
 *
 * Location: src/lib/rbac.ts
 *
 * Purpose:
 * - Defines all permissions
 * - Defines default roles
 * - Provides permission checking functions
 *
 * Key Exports:
 * - PERMISSIONS - Object with all permission constants
 * - DEFAULT_ROLES - Array of default role definitions
 * - hasPermission(user, permission) - Check single permission
 * - hasRole(user, roleName) - Check if user has role
 * - hasAnyPermission(user, permissions) - Check multiple (OR)
 * - hasAllPermissions(user, permissions) - Check multiple (AND)
 *
 * Permission Categories:
 * - Dashboard, Products, Sales, Purchases
 * - Customers, Suppliers, Inventory, Reports
 * - Users, Roles, Expenses, etc.
 *
 * Used By:
 * - API routes - Authorization checks
 * - Dashboard pages - UI element visibility
 * - Components - Conditional rendering
 */
```

#### prisma.ts
```typescript
/**
 * Prisma Client Singleton
 *
 * Location: src/lib/prisma.ts
 *
 * Purpose:
 * - Provides single Prisma client instance
 * - Prevents multiple connections in development
 * - Optimized for production
 *
 * Usage:
 * import { prisma } from "@/lib/prisma";
 * const users = await prisma.user.findMany();
 *
 * Important: Always filter by businessId for multi-tenancy
 */
```

#### utils.ts
```typescript
/**
 * General Utilities
 *
 * Location: src/lib/utils.ts
 *
 * Common Functions:
 * - cn() - Tailwind class name merger
 * - formatCurrency() - Format numbers as currency
 * - formatDate() - Format dates
 * - generateInvoiceNumber() - Generate unique invoice #s
 */
```

---

## Hooks (src/hooks/)

Custom React hooks for common functionality.

```
src/hooks/
├── usePermissions.ts              # Permission checking hook
├── useDebounce.ts                 # Debounce input hook
└── useLocalStorage.ts             # Local storage hook
```

### Key Hooks

#### usePermissions.ts
```typescript
/**
 * Permissions Hook
 *
 * Location: src/hooks/usePermissions.ts
 *
 * Purpose:
 * - Provides permission checking in client components
 * - Accesses current user session
 * - Wraps RBAC functions for easy use
 *
 * Usage:
 * const { can, hasRole, user } = usePermissions();
 *
 * if (can(PERMISSIONS.PRODUCT_CREATE)) {
 *   // Show create button
 * }
 *
 * Returns:
 * - can(permission) - Check single permission
 * - hasRole(roleName) - Check if user has role
 * - user - Full user session object
 */
```

---

## Database (prisma/)

Database schema and seed data.

```
prisma/
├── schema.prisma                  # Database schema definition
├── seed.ts                        # Seed data (demo accounts)
└── migrations/                    # Database migrations (if using migrate)
```

### Key Files

#### schema.prisma
```prisma
/**
 * Prisma Schema
 *
 * Location: prisma/schema.prisma
 *
 * Purpose:
 * - Defines all database models
 * - Specifies relationships
 * - Sets up indexes
 * - Configures database provider
 *
 * Key Models:
 * - User - User accounts
 * - Business - Multi-tenant businesses
 * - BusinessLocation - Physical locations/branches
 * - Role - User roles
 * - Permission - Permission definitions
 * - Product - Product catalog
 * - ProductStock - Stock levels by location
 * - Sale - Sales transactions
 * - SaleItem - Sale line items
 * - Purchase - Purchase orders
 * - PurchaseItem - PO line items
 * - Customer - Customer records
 * - Supplier - Supplier records
 * - Transfer - Inventory transfers
 * - CashierShift - POS shifts
 * - And many more...
 *
 * Commands:
 * - npx prisma generate - Generate Prisma Client
 * - npm run db:push - Sync schema to database
 * - npm run db:seed - Seed demo data
 * - npm run db:studio - Open Prisma Studio GUI
 */
```

#### seed.ts
```typescript
/**
 * Database Seeder
 *
 * Location: prisma/seed.ts
 *
 * Purpose:
 * - Creates demo business
 * - Creates demo users (superadmin, admin, manager, cashier)
 * - Creates default roles and permissions
 * - Creates sample products (optional)
 *
 * Run: npm run db:seed
 *
 * Demo Accounts:
 * - superadmin / password
 * - admin / password
 * - manager / password
 * - cashier / password
 */
```

---

## Configuration Files

### Root Configuration

#### .env
```env
# Environment Variables
# Location: .env (not in git)
#
# Database
DATABASE_URL="postgresql://user:pass@localhost:5432/db"
#
# NextAuth
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="random-secret-key-min-32-chars"
#
# OpenAI (AI Assistant)
OPENAI_API_KEY="sk-proj-..."
#
# Application
NEXT_PUBLIC_APP_NAME="Igoro Tech(IT) Inventory Management System"
NEXT_PUBLIC_APP_URL="http://localhost:3000"
```

#### package.json
```json
/**
 * Dependencies and Scripts
 *
 * Location: package.json
 *
 * Scripts:
 * - npm run dev - Start development server
 * - npm run build - Build for production
 * - npm start - Start production server
 * - npm run lint - Run ESLint
 * - npm run db:push - Sync Prisma schema
 * - npm run db:seed - Seed database
 * - npm run db:studio - Open Prisma Studio
 *
 * Key Dependencies:
 * - next - Next.js framework
 * - react - React library
 * - prisma - Database ORM
 * - next-auth - Authentication
 * - tailwindcss - CSS framework
 * - bcryptjs - Password hashing
 * - devextreme-react - UI grid components
 * - zustand - State management
 * - react-query - Data fetching
 */
```

#### next.config.js
```javascript
/**
 * Next.js Configuration
 *
 * Location: next.config.js
 *
 * Configures:
 * - Turbopack (faster bundler)
 * - Image optimization
 * - Environment variables
 * - Redirects and rewrites
 * - Webpack customization
 */
```

#### tailwind.config.js
```javascript
/**
 * Tailwind CSS Configuration
 *
 * Location: tailwind.config.js
 *
 * Configures:
 * - Content paths (where to find classes)
 * - Theme customization (colors, fonts)
 * - Dark mode settings
 * - Plugins (forms, typography)
 */
```

#### tsconfig.json
```json
/**
 * TypeScript Configuration
 *
 * Location: tsconfig.json
 *
 * Configures:
 * - Compiler options
 * - Module resolution
 * - Path aliases (@/* = src/*)
 * - Strict type checking
 */
```

#### middleware.ts
```typescript
/**
 * Next.js Middleware
 *
 * Location: middleware.ts (root)
 *
 * Purpose:
 * - Protects dashboard routes
 * - Monitors request performance
 * - Logs request timing
 *
 * Runs: Before every request
 *
 * See: Full comments in middleware.ts file
 */
```

---

## File Naming Conventions

### Next.js App Router

- `page.tsx` - Page component (defines route)
- `layout.tsx` - Layout component (wraps pages)
- `route.ts` - API route handler
- `[id]` - Dynamic route segment
- `[...slug]` - Catch-all route segment

### React Components

- `ComponentName.tsx` - Component file (PascalCase)
- `component-name.css` - Component styles (kebab-case)

### Utilities

- `util-name.ts` - Utility file (kebab-case)
- `ServiceName.ts` - Service class (PascalCase)

---

## Import Aliases

The project uses path aliases for cleaner imports:

```typescript
// Instead of:
import { Button } from "../../components/ui/button";

// Use:
import { Button } from "@/components/ui/button";
```

**Configured in** `tsconfig.json`:
```json
{
  "compilerOptions": {
    "paths": {
      "@/*": ["./src/*"]
    }
  }
}
```

---

## Development Workflow

### 1. Starting Development
```bash
npm run dev
```
Opens http://localhost:3000

### 2. Making Database Changes
```bash
# 1. Edit prisma/schema.prisma
# 2. Sync to database
npm run db:push
# 3. Regenerate Prisma Client
npx prisma generate
```

### 3. Adding New API Route
```
1. Create file: src/app/api/my-endpoint/route.ts
2. Export HTTP method handlers (GET, POST, etc.)
3. Add authentication check
4. Add permission check
5. Implement business logic
6. Return NextResponse.json()
```

### 4. Adding New Dashboard Page
```
1. Create file: src/app/dashboard/my-page/page.tsx
2. Add to Sidebar.tsx with permission check
3. Implement page UI
4. Fetch data from API routes
5. Handle loading and error states
```

---

## Debugging Tips

### Check Session Data
```typescript
const session = await getServerSession(authOptions);
console.log("Session:", session);
```

### Check Permissions
```typescript
import { hasPermission, PERMISSIONS } from "@/lib/rbac";
console.log("Can create product?", hasPermission(user, PERMISSIONS.PRODUCT_CREATE));
```

### View Database
```bash
npm run db:studio
```
Opens Prisma Studio at http://localhost:5555

### Check Logs
- Middleware logs every request with timing
- API routes log errors to console
- Check browser DevTools Network tab

---

## Additional Resources

- **Next.js Docs**: https://nextjs.org/docs
- **Prisma Docs**: https://www.prisma.io/docs
- **NextAuth Docs**: https://next-auth.js.org
- **Tailwind Docs**: https://tailwindcss.com/docs
- **DevExtreme Docs**: https://js.devexpress.com/React/

---

**Generated**: 2025-11-12
**Version**: 1.0
**Project**: Igoro Tech(IT) Inventory Management System
