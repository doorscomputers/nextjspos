# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Core Workflow Rules (MUST FOLLOW)

1. **First think through the problem**, read the codebase for relevant files, and write a plan to `tasks/todo.md`.
2. **The plan should have a list of todo items** that you can check off as you complete them.
3. **Before you begin working, check in with me** and I will verify the plan.
4. **Then, begin working on the todo items**, marking them as complete as you go.
5. **Please every step of the way** just give me a high level explanation of what changes you made.
6. **Make every task and code change you do as simple as possible.** We want to avoid making any massive or complex changes. Every change should impact as little code as possible. Everything is about simplicity.
7. **Finally, add a review section** to the `todo.md` file with a summary of the changes you made and any other relevant information.
8. **DO NOT BE LAZY. NEVER BE LAZY.** If there is a bug, find the root cause and fix it. NO TEMPORARY FIXES. You are a senior developer. NEVER BE LAZY.
9. **MAKE ALL FIXES AND CODE CHANGES AS SIMPLE AS HUMANLY POSSIBLE.** They should only impact necessary code relevant to the task and nothing else. It should impact as little code as possible. Your goal is to NOT introduce any bugs. IT'S ALL ABOUT SIMPLICITY.

## Project Overview

**Igoro Tech(IT) Inventory Management System** is a multi-tenant Point of Sale (POS) and Inventory Management system built with Next.js 15, Prisma ORM, NextAuth, and PostgreSQL/MySQL. It features role-based access control (RBAC), AI-powered assistance via OpenAI, and a responsive design using Tailwind CSS.

## Commands

### Development

```bash
npm run dev          # Start dev server with Turbopack
npm run build        # Build for production with Turbopack
npm start           # Start production server
npm run lint        # Run ESLint
```

### Database

```bash
npm run db:push     # Push Prisma schema to database (sync without migrations)
npm run db:seed     # Seed database with demo data
npm run db:studio   # Open Prisma Studio (database GUI)
npx prisma generate # Generate Prisma Client (run after schema changes)
```

### Demo Accounts (after seeding)

- **Super Admin**: `superadmin` / `password`
- **Admin**: `admin` / `password`
- **Manager**: `manager` / `password`
- **Cashier**: `cashier` / `password`

## Architecture

### Multi-Tenant System

- Each `Business` has an owner and multiple users
- Users belong to one business via `businessId`
- Business locations (branches) support multiple store fronts
- Data isolation enforced at query level by businessId

### Authentication & Authorization

- **NextAuth v4** with JWT strategy for sessions
- Custom Credentials provider with bcrypt password hashing
- Auth config: `src/lib/auth.ts`
- Protected routes via `middleware.ts` or per-page session checks
- Login page: `src/app/login/page.tsx`

### RBAC (Role-Based Access Control)

- Permission system defined in `src/lib/rbac.ts`
- Users can have roles AND direct permissions
- Roles belong to a Business and contain permissions
- Four default roles: Super Admin, Admin, Manager, Cashier
- Permission checking utilities: `hasPermission()`, `hasRole()`, etc.
- Hook for components: `usePermissions()` in `src/hooks/usePermissions.ts`
- Sidebar menu items filtered by user permissions (`src/components/Sidebar.tsx`)

### Database Schema (`prisma/schema.prisma`)

Core models:

- **User**: Authentication, profile, business relationship
- **Business**: Multi-tenant core, settings, owner
- **BusinessLocation**: Physical branches/stores
- **Role/Permission**: RBAC system with junction tables
- **Currency**: Multi-currency support
- **Session/VerificationToken**: NextAuth sessions

### AI Assistant Integration

- Endpoint: `src/app/api/chat/route.ts`
- Uses OpenAI SDK with streaming responses
- Page: `src/app/dashboard/ai-assistant/page.tsx`
- Configured via `OPENAI_API_KEY` environment variable
- Context-aware (includes user info, role, business name)

### Frontend Architecture

- **App Router** (Next.js 15) with Server Components where possible
- Client components marked with `"use client"`
- Layout hierarchy: `app/layout.tsx` → `app/dashboard/layout.tsx` → pages
- Dashboard uses `SessionProvider` for auth context
- Global styles: `app/globals.css` with Tailwind
- State management: Zustand (imported in project)
- Data fetching: TanStack Query (React Query)

### Environment Configuration

Required `.env` variables:

```env
DATABASE_URL="postgresql://user:password@localhost:5432/db"  # or MySQL
OPENAI_API_KEY="sk-proj-..."                                  # For AI features
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="random-secret-min-32-chars"
NEXT_PUBLIC_APP_NAME="Igoro Tech(IT) Inventory Management System"
NEXT_PUBLIC_APP_URL="http://localhost:3000"
```

### Path Aliases

- `@/*` maps to `src/*` (configured in `tsconfig.json`)

## Key Patterns

### Permission Checking

```typescript
// In components
import { usePermissions } from "@/hooks/usePermissions";
const { can, hasRole, user } = usePermissions();
if (can(PERMISSIONS.PRODUCT_CREATE)) {
  /* show button */
}

// In API routes
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
const session = await getServerSession(authOptions);
// session.user has: id, username, businessId, permissions, roles
```

### Database Queries with Multi-Tenancy

Always filter by businessId for tenant isolation:

```typescript
const products = await prisma.product.findMany({
  where: { businessId: user.businessId },
});
```

### Prisma Client Singleton

Import from `src/lib/prisma.ts` (handles singleton pattern for dev/prod)

## Database Setup

### PostgreSQL (recommended)

1. Install PostgreSQL
2. Create database: `CREATE DATABASE ultimatepos_modern;`
3. Update `DATABASE_URL` in `.env`
4. Run `npm run db:push` then `npm run db:seed`

## Common Workflows

### Adding New Features

1. Check RBAC permissions needed in `src/lib/rbac.ts`
2. Add permissions to appropriate roles in `DEFAULT_ROLES`
3. Update seed file if new permissions added
4. Create API routes under `src/app/api/`
5. Build UI under `src/app/dashboard/`
6. Add menu items to `src/components/Sidebar.tsx` with permission checks

### Modifying Database Schema

1. Edit `prisma/schema.prisma`
2. Run `npx prisma generate` to update Prisma Client types
3. Run `npm run db:push` to sync database
4. Update seed file if needed: `prisma/seed.ts`
5. Be careful not to mess the RBAC, Users and ROles Permissions

### Testing Different User Roles

1. Seed database: `npm run db:seed`
2. Login with different demo accounts to see role-based UI
3. Check sidebar menu visibility based on permissions
4. Verify API authorization in route handlers
5. Be careful not to mess the RBAC, Users and ROles Permissions

- No More Errors on UI Designs
- add to memory. please save this because I will import the latest csv with updated quantities in the coming days

### UI Design Consistency Rules

1. Always make all the Forms design consistent. Like Colors, Buttons not to look like labels
2. User Devextreme Components or Telerik Kendo UI
3. All forms must have consistent colors and button styles
4. Buttons must not look like labels - use clear backgrounds and borders
5. Toggle states must be immediately obvious (green ON / gray OFF)
6. Loading states must show visual feedback (spinners, disabled states)
7. Always support dark mode with appropriate color variants

### Button Styling Standards

**IMPORTANT**: All buttons across the application must follow these professional styling guidelines:

#### Button Component (`src/components/ui/button.tsx`)

- Use the enhanced button variants with shadows, rounded corners, and hover effects
- Available variants: `default`, `destructive`, `outline`, `secondary`, `ghost`, `link`, `success`
- Available sizes: `default`, `sm`, `lg`, `icon`, `icon-sm`, `icon-lg`
- All buttons have subtle press animation (`active:scale-[0.98]`)

#### Export/Action Buttons (CSV, Excel, PDF, Print)

```tsx
<Button variant="outline" size="sm" onClick={() => handleExport("csv")}
  className="gap-2 hover:border-green-500 hover:text-green-700 dark:hover:text-green-400">
  <DocumentArrowDownIcon className="h-4 w-4" />
  CSV
</Button>

<Button variant="outline" size="sm" onClick={() => handleExport("excel")}
  className="gap-2 hover:border-green-500 hover:text-green-700 dark:hover:text-green-400">
  <DocumentArrowDownIcon className="h-4 w-4" />
  Excel
</Button>

<Button variant="outline" size="sm" onClick={() => handleExport("pdf")}
  className="gap-2 hover:border-red-500 hover:text-red-700 dark:hover:text-red-400">
  <DocumentTextIcon className="h-4 w-4" />
  PDF
</Button>

<Button variant="outline" size="sm" onClick={() => handleExport("print")}
  className="gap-2 hover:border-blue-500 hover:text-blue-700 dark:hover:text-blue-400">
  <PrinterIcon className="h-4 w-4" />
  Print
</Button>
```

#### Primary Action Buttons (Add, Create, Save)

```tsx
<Button variant="success" size="sm" className="gap-2" onClick={handleCreate}>
  <PlusIcon className="h-4 w-4" />
  Add Item
</Button>

// In dialogs/forms
<Button variant="success" size="default" className="gap-2 min-w-32" onClick={handleSubmit} disabled={submitting}>
  {submitting && <span className="animate-spin">⏳</span>}
  {editing ? "Update" : "Create"}
</Button>
```

#### Edit and Delete Actions (Table Rows)

```tsx
{
  /* Edit Button */
}
<Button
  size="icon-sm"
  variant="outline"
  onClick={() => openEditDialog(item)}
  className="hover:border-blue-500 hover:text-blue-700 hover:bg-blue-50 dark:hover:text-blue-400 dark:hover:bg-blue-950"
  title="Edit item"
>
  <PencilIcon className="h-4 w-4" />
</Button>;

{
  /* Delete Button */
}
<Button
  size="icon-sm"
  variant="outline"
  className="hover:border-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:text-red-400 dark:hover:bg-red-950"
  onClick={() => handleDelete(item)}
  title="Delete item"
>
  <TrashIcon className="h-4 w-4" />
</Button>;
```

#### Cancel/Secondary Buttons

```tsx
<Button variant="outline" size="default" onClick={handleCancel}>
  Cancel
</Button>
```

#### Button Guidelines Summary

1. ✅ Use `variant="success"` for primary actions (Add, Create, Save, Submit)
2. ✅ Use `variant="outline"` for secondary actions (Export, Edit, Delete, Cancel)
3. ✅ Use `size="sm"` for toolbar buttons, `size="default"` for dialog buttons
4. ✅ Use `size="icon-sm"` for table action buttons (Edit/Delete)
5. ✅ Always include contextual hover colors (green for exports, blue for edit, red for delete)
6. ✅ Add `gap-2` class when buttons contain icons + text
7. ✅ Include `title` attribute for icon-only buttons (accessibility)
8. ✅ Add `min-w-32` or `min-w-36` to dialog submit buttons for consistent width
9. ✅ Show loading state with spinner emoji and `disabled` state during submission
10. ✅ Support dark mode with `dark:` variants in custom hover classes

### User Restrictions

On this Project, Only the Main Warehouse will process Purchase orders

### Reports

1. Consistent report creation with Print , Export to Pdf and Excel
2. For list Reports use the

- SOD settings should be dynamic
- Please take note of the RBAC , menus permission and Suers and Roles so that there will be no errors in the future
- THis is how you change Price from Excel direct to Supabase