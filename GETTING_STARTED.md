# Getting Started Guide
# Igoro Tech(IT) Inventory Management System

> **Complete beginner's guide to setting up and understanding the codebase**

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Installation](#installation)
3. [Understanding the Tech Stack](#understanding-the-tech-stack)
4. [Running the Application](#running-the-application)
5. [Exploring the Application](#exploring-the-application)
6. [Understanding Key Concepts](#understanding-key-concepts)
7. [Your First Code Change](#your-first-code-change)
8. [Common Tasks](#common-tasks)
9. [Troubleshooting](#troubleshooting)
10. [Next Steps](#next-steps)

---

## Prerequisites

Before you begin, ensure you have the following installed:

### Required Software

1. **Node.js** (v18 or higher)
   - Download: https://nodejs.org/
   - Check version: `node --version`

2. **npm** (comes with Node.js)
   - Check version: `npm --version`

3. **PostgreSQL** or **MySQL** Database
   - PostgreSQL (recommended): https://www.postgresql.org/download/
   - OR MySQL (XAMPP includes MySQL): https://www.apachefriends.org/

4. **Git** (for version control)
   - Download: https://git-scm.com/
   - Check version: `git --version`

5. **Code Editor**
   - Recommended: Visual Studio Code https://code.visualstudio.com/

### Recommended VS Code Extensions

- ESLint - JavaScript linting
- Prettier - Code formatting
- Prisma - Prisma schema highlighting
- Tailwind CSS IntelliSense - Tailwind class autocomplete
- TypeScript Vue Plugin (Volar) - TypeScript support

---

## Installation

### Step 1: Clone or Navigate to Repository

```bash
# If you already have the code:
cd C:\xampp\htdocs\ultimatepos-modern

# If cloning from Git:
git clone <repository-url>
cd ultimatepos-modern
```

### Step 2: Install Dependencies

```bash
npm install
```

This will install all required packages listed in `package.json`. It may take a few minutes.

### Step 3: Set Up Environment Variables

1. Copy the example environment file:
   ```bash
   cp .env.example .env
   ```

2. Open `.env` in your editor and configure:

   ```env
   # Database Connection
   # For PostgreSQL:
   DATABASE_URL="postgresql://postgres:your-password@localhost:5432/ultimatepos_modern"

   # For MySQL (if using XAMPP):
   DATABASE_URL="mysql://root:@localhost:3306/ultimatepos_modern"

   # NextAuth Configuration
   NEXTAUTH_URL="http://localhost:3000"
   NEXTAUTH_SECRET="your-random-secret-key-at-least-32-characters-long"

   # OpenAI API (Optional - for AI Assistant feature)
   OPENAI_API_KEY="sk-proj-your-api-key"

   # Application
   NEXT_PUBLIC_APP_NAME="Igoro Tech(IT) Inventory Management System"
   NEXT_PUBLIC_APP_URL="http://localhost:3000"
   ```

   **Important**:
   - Replace `your-password` with your actual database password
   - Generate a secure `NEXTAUTH_SECRET` (at least 32 characters)

### Step 4: Create Database

**For PostgreSQL**:
```sql
-- Open psql or pgAdmin
CREATE DATABASE ultimatepos_modern;
```

**For MySQL** (via phpMyAdmin):
1. Open http://localhost/phpmyadmin
2. Click "New" to create database
3. Name it `ultimatepos_modern`
4. Set collation to `utf8mb4_general_ci`

### Step 5: Set Up Database Schema

```bash
# Push Prisma schema to database
npm run db:push
```

This creates all tables based on `prisma/schema.prisma`.

### Step 6: Seed Demo Data

```bash
# Create demo accounts and sample data
npm run db:seed
```

This creates:
- **Demo Business**: "Demo Business"
- **Super Admin**: username: `superadmin`, password: `password`
- **Admin**: username: `admin`, password: `password`
- **Manager**: username: `manager`, password: `password`
- **Cashier**: username: `cashier`, password: `password`

---

## Understanding the Tech Stack

### Frontend

**Next.js 15** - React framework with:
- App Router (file-based routing)
- Server Components (default)
- Client Components (with `"use client"`)

**React 18** - UI library

**Tailwind CSS** - Utility-first CSS framework

**ShadCN UI** - Prebuilt component library

**DevExtreme React** - Advanced data grid components

### Backend

**Next.js API Routes** - Built-in API endpoints

**Prisma ORM** - Database toolkit
- Type-safe database queries
- Automatic migrations
- Database GUI (Prisma Studio)

**NextAuth.js** - Authentication library
- JWT-based sessions
- Custom credentials provider

### Database

**PostgreSQL** or **MySQL** - Relational database

### State Management

**Zustand** - Lightweight state management

**TanStack Query (React Query)** - Server state management

### Authentication & Authorization

**NextAuth.js** - Session management

**JWT** - Token-based authentication

**RBAC** - Role-Based Access Control system

---

## Running the Application

### Development Mode

```bash
npm run dev
```

This starts the development server at http://localhost:3000

**Features**:
- Hot reload (changes reflect immediately)
- Error overlay (shows errors in browser)
- Fast refresh (preserves React state)

### Production Mode

```bash
# Build for production
npm run build

# Start production server
npm start
```

### Accessing the Application

1. Open browser: http://localhost:3000
2. You'll be redirected to http://localhost:3000/login
3. Login with demo account:
   - Username: `superadmin`
   - Password: `password`
4. You'll be redirected to dashboard: http://localhost:3000/dashboard

---

## Exploring the Application

### Dashboard Home

After logging in, you'll see:
- **Dashboard Statistics** - Sales, transactions, low stock alerts
- **Sidebar Navigation** - Main menu (left side)
- **User Menu** - Profile, settings, logout (top right)

### Main Features to Explore

1. **Point of Sale (POS)**
   - Navigate to: **POS** in sidebar
   - Try creating a test sale
   - Add products to cart
   - Process payment

2. **Products**
   - Navigate to: **Products > Products**
   - View product list
   - Click "Add Product" to create new product
   - Try editing/deleting products

3. **Sales**
   - Navigate to: **Sales > Sales List**
   - View all sales transactions
   - Click a sale to see details

4. **Reports**
   - Navigate to: **Reports** section
   - Try viewing different reports
   - Test export features (CSV, Excel, PDF)

5. **Users & Roles**
   - Navigate to: **Settings > Users**
   - View all users
   - Check roles and permissions

### Database GUI

View and edit database directly:

```bash
npm run db:studio
```

Opens Prisma Studio at http://localhost:5555

---

## Understanding Key Concepts

### 1. Multi-Tenant Architecture

**What is it?**
Multiple businesses (tenants) share the same application, but their data is isolated.

**How it works:**
- Each user belongs to one `Business`
- All queries filter by `businessId`
- Users can only see/edit their business's data

**Example**:
```typescript
// CORRECT - Filtered by businessId
const products = await prisma.product.findMany({
  where: { businessId: user.businessId }
});

// WRONG - Returns ALL products from ALL businesses
const products = await prisma.product.findMany();
```

### 2. Role-Based Access Control (RBAC)

**What is it?**
Users have roles (Admin, Manager, Cashier) with different permissions.

**How it works:**
- Permissions defined in `src/lib/rbac.ts`
- Roles have multiple permissions
- Users can have multiple roles
- UI elements show/hide based on permissions

**Example**:
```typescript
// Check permission in component
const { can } = usePermissions();

{can(PERMISSIONS.PRODUCT_CREATE) && (
  <Button>Create Product</Button>
)}
```

### 3. Authentication Flow

**Login Process:**
1. User enters username/password
2. `src/lib/auth.ts` validates credentials
3. Password compared with bcrypt hash
4. JWT token created with user data
5. Token stored in HTTP-only cookie
6. User redirected to dashboard

**Protected Routes:**
- `middleware.ts` checks for valid JWT
- If no token, redirects to login
- If valid token, allows access

### 4. API Routes

**Structure:**
- Located in `src/app/api/`
- Each `route.ts` exports HTTP handlers

**Example**:
```typescript
// src/app/api/products/route.ts

export async function GET(request: Request) {
  // Handle GET /api/products
}

export async function POST(request: Request) {
  // Handle POST /api/products
}
```

**Authentication:**
```typescript
const session = await getServerSession(authOptions);
if (!session) {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}
```

### 5. Next.js App Router

**File-Based Routing:**
- `page.tsx` = Page route
- `layout.tsx` = Layout wrapper
- `[id]/page.tsx` = Dynamic route

**Examples:**
- `src/app/dashboard/page.tsx` → `/dashboard`
- `src/app/dashboard/products/page.tsx` → `/dashboard/products`
- `src/app/dashboard/products/[id]/page.tsx` → `/dashboard/products/123`

---

## Your First Code Change

Let's make a simple change to understand the workflow.

### Example: Add Welcome Message to Dashboard

1. **Open the dashboard home page**:
   ```
   src/app/dashboard/page.tsx
   ```

2. **Find the return statement** (around line 50-100)

3. **Add a welcome message**:
   ```tsx
   return (
     <div>
       {/* Add this new section */}
       <div className="bg-blue-50 dark:bg-blue-900 p-4 rounded-lg mb-6">
         <h2 className="text-xl font-bold text-blue-900 dark:text-blue-100">
           Welcome to Your Dashboard!
         </h2>
         <p className="text-blue-700 dark:text-blue-200 mt-2">
           This is your first code change. Great job! 🎉
         </p>
       </div>

       {/* Existing dashboard content below... */}
       {/* ... rest of code ... */}
     </div>
   );
   ```

4. **Save the file**

5. **Check your browser** - The page should automatically reload with your new message!

6. **Congratulations!** You've made your first code change.

---

## Common Tasks

### Task 1: Create a New API Endpoint

**Goal**: Create `/api/hello` that returns a greeting.

1. **Create file**:
   ```
   src/app/api/hello/route.ts
   ```

2. **Add code**:
   ```typescript
   import { NextResponse } from 'next/server';

   export async function GET() {
     return NextResponse.json({
       message: "Hello from the API!",
       timestamp: new Date().toISOString()
     });
   }
   ```

3. **Test**: Visit http://localhost:3000/api/hello

### Task 2: Add a New Permission

**Goal**: Add permission for viewing analytics.

1. **Open**: `src/lib/rbac.ts`

2. **Add permission** to PERMISSIONS object:
   ```typescript
   export const PERMISSIONS = {
     // ... existing permissions ...
     ANALYTICS_VIEW: "analytics:view",
   };
   ```

3. **Add to role** (e.g., Manager):
   ```typescript
   {
     name: "Manager",
     permissions: [
       // ... existing permissions ...
       PERMISSIONS.ANALYTICS_VIEW,
     ]
   }
   ```

4. **Use in component**:
   ```typescript
   {can(PERMISSIONS.ANALYTICS_VIEW) && (
     <div>Analytics Content</div>
   )}
   ```

### Task 3: Create a New Dashboard Page

**Goal**: Create `/dashboard/analytics` page.

1. **Create directory and file**:
   ```
   src/app/dashboard/analytics/page.tsx
   ```

2. **Add code**:
   ```tsx
   export default function AnalyticsPage() {
     return (
       <div className="p-6">
         <h1 className="text-2xl font-bold mb-4">Analytics</h1>
         <p>Your analytics content here...</p>
       </div>
     );
   }
   ```

3. **Add to sidebar** (`src/components/Sidebar.tsx`):
   ```tsx
   {can(PERMISSIONS.ANALYTICS_VIEW) && (
     <Link href="/dashboard/analytics">
       <ChartBarIcon className="h-5 w-5" />
       <span>Analytics</span>
     </Link>
   )}
   ```

4. **Visit**: http://localhost:3000/dashboard/analytics

### Task 4: Add a Database Model

**Goal**: Add a `Note` model for user notes.

1. **Edit**: `prisma/schema.prisma`

2. **Add model**:
   ```prisma
   model Note {
     id         String   @id @default(cuid())
     content    String   @db.Text
     userId     String
     user       User     @relation(fields: [userId], references: [id])
     businessId Int
     business   Business @relation(fields: [businessId], references: [id])
     createdAt  DateTime @default(now())
     updatedAt  DateTime @updatedAt
   }
   ```

3. **Update User model** (add relation):
   ```prisma
   model User {
     // ... existing fields ...
     notes Note[]
   }
   ```

4. **Push to database**:
   ```bash
   npm run db:push
   ```

5. **Regenerate Prisma Client**:
   ```bash
   npx prisma generate
   ```

6. **Use in code**:
   ```typescript
   const notes = await prisma.note.findMany({
     where: { businessId: user.businessId }
   });
   ```

---

## Troubleshooting

### Issue: Port 3000 Already in Use

**Solution**:
```bash
# Kill process using port 3000
# Windows:
netstat -ano | findstr :3000
taskkill /PID <PID> /F

# Mac/Linux:
lsof -i :3000
kill -9 <PID>
```

### Issue: Database Connection Error

**Check**:
1. Is PostgreSQL/MySQL running?
2. Is `DATABASE_URL` in `.env` correct?
3. Does database exist?

**Test connection**:
```bash
npm run db:studio
```

### Issue: Module Not Found

**Solution**:
```bash
# Delete node_modules and reinstall
rm -rf node_modules package-lock.json
npm install
```

### Issue: Prisma Client Not Generated

**Solution**:
```bash
npx prisma generate
```

### Issue: Login Not Working

**Check**:
1. Did you run `npm run db:seed`?
2. Try credentials: `superadmin` / `password`
3. Check browser console for errors
4. Check terminal for server errors

---

## Next Steps

### 1. Read Documentation

- **APPLICATION_FLOW.md** - Understand authentication and navigation
- **API_ENDPOINTS.md** - Learn all API routes
- **CODE_STRUCTURE.md** - Understand file organization

### 2. Explore the Codebase

Focus on these key files first:
- `src/lib/auth.ts` - Authentication
- `src/lib/rbac.ts` - Permissions
- `src/components/Sidebar.tsx` - Navigation
- `src/app/api/products/route.ts` - Example API
- `src/app/dashboard/products/page.tsx` - Example page

### 3. Practice

Try these exercises:
1. Create a new dashboard page
2. Add a new API endpoint
3. Create a new permission and use it
4. Add a field to an existing model
5. Create a simple form

### 4. Learn the Technologies

- **Next.js**: https://nextjs.org/docs
- **React**: https://react.dev/
- **Prisma**: https://www.prisma.io/docs
- **Tailwind CSS**: https://tailwindcss.com/docs
- **NextAuth**: https://next-auth.js.org/

### 5. Build Something

Best way to learn: Build a feature!

Ideas:
- Add a notes feature
- Create a todo list for users
- Build a simple report
- Add email notifications

---

## Getting Help

### Resources

1. **Project Documentation**:
   - `APPLICATION_FLOW.md`
   - `API_ENDPOINTS.md`
   - `CODE_STRUCTURE.md`
   - `CLAUDE.md` (project instructions)

2. **Code Comments**:
   - Check `src/lib/auth.ts` for detailed authentication comments
   - Check `middleware.ts` for routing comments

3. **Online Resources**:
   - Next.js Docs: https://nextjs.org/docs
   - Prisma Docs: https://www.prisma.io/docs
   - Tailwind Docs: https://tailwindcss.com/docs

### Debugging Tools

1. **Browser DevTools** (F12):
   - Console: View JavaScript errors
   - Network: Inspect API calls
   - React DevTools: Inspect components

2. **Prisma Studio**:
   ```bash
   npm run db:studio
   ```
   View/edit database directly

3. **VS Code Debugger**:
   - Set breakpoints
   - Step through code
   - Inspect variables

---

## Best Practices

### 1. Always Filter by businessId

```typescript
// CORRECT
const products = await prisma.product.findMany({
  where: { businessId: user.businessId }
});

// WRONG - Data leak!
const products = await prisma.product.findMany();
```

### 2. Check Permissions

```typescript
// In API routes
if (!hasPermission(session.user, PERMISSIONS.PRODUCT_CREATE)) {
  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}

// In components
{can(PERMISSIONS.PRODUCT_CREATE) && <Button>Create</Button>}
```

### 3. Handle Errors

```typescript
try {
  const result = await someOperation();
  return NextResponse.json({ data: result });
} catch (error) {
  console.error("Error:", error);
  return NextResponse.json(
    { error: "Something went wrong" },
    { status: 500 }
  );
}
```

### 4. Use TypeScript Types

```typescript
// Define types
interface Product {
  id: string;
  name: string;
  price: number;
}

// Use types
const products: Product[] = [];
```

### 5. Follow Naming Conventions

- **Components**: PascalCase (`ProductList.tsx`)
- **Utilities**: camelCase (`formatCurrency.ts`)
- **Constants**: UPPER_SNAKE_CASE (`PERMISSIONS.PRODUCT_VIEW`)
- **Database Models**: PascalCase (`Product`, `SaleItem`)

---

## Summary

You've learned:
- ✅ How to install and set up the project
- ✅ How to run the development server
- ✅ Key concepts (multi-tenancy, RBAC, auth)
- ✅ How to make your first code change
- ✅ Common development tasks
- ✅ Where to find help

**Next**: Start exploring the codebase and building features!

---

**Generated**: 2025-11-12
**Version**: 1.0
**Project**: Igoro Tech(IT) Inventory Management System
