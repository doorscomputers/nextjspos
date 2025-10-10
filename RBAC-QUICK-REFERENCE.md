# RBAC System - Quick Reference Guide

## File Locations

### Pages
- Users: `src/app/dashboard/users/page.tsx`
- Roles: `src/app/dashboard/roles/page.tsx`

### API Routes
```
src/app/api/
├── users/
│   ├── route.ts          # GET, POST, PUT, DELETE
│   └── [id]/route.ts     # GET single user
├── roles/
│   ├── route.ts          # GET, POST, PUT, DELETE
│   └── [id]/route.ts     # GET single role
├── permissions/
│   └── route.ts          # GET all permissions grouped
└── locations/
    └── route.ts          # GET all locations
```

### Components
```
src/components/
├── users/
│   ├── UserFormDialog.tsx       # Create/Edit user form
│   └── UserDetailDialog.tsx     # View user details
├── roles/
│   ├── RoleFormDialog.tsx       # Create/Edit role form
│   └── RoleDetailDialog.tsx     # View role details
└── ui/
    ├── loading-spinner.tsx      # Loading indicator
    └── empty-state.tsx          # Empty state component
```

## API Endpoints Quick Reference

### Users API

#### List Users
```typescript
GET /api/users?search=john&roleId=2&locationId=1&page=1&limit=20

Response:
{
  users: User[],
  pagination: { page, limit, total, totalPages }
}
```

#### Get Single User
```typescript
GET /api/users/[id]

Response:
{
  user: {
    ...userFields,
    roles: Role[],
    locations: Location[],
    allPermissions: string[],
    directPermissions: Permission[]
  }
}
```

#### Create User
```typescript
POST /api/users
Body: {
  surname: string,
  firstName: string,
  lastName?: string,
  username: string,
  email?: string,
  password: string,
  roleIds: number[],
  locationIds?: number[],
  maxSaleDiscount?: number,
  allowLogin?: boolean
}
```

#### Update User
```typescript
PUT /api/users
Body: {
  id: number,
  // All fields from create (partial)
  password?: string  // Optional, only if changing
}
```

#### Delete User
```typescript
DELETE /api/users?id=123
```

### Roles API

#### List Roles
```typescript
GET /api/roles

Response:
{
  roles: [{
    id, name, businessId, isDefault,
    permissions: Permission[],
    userCount: number
  }]
}
```

#### Get Single Role
```typescript
GET /api/roles/[id]

Response:
{
  role: {
    ...roleFields,
    permissions: Permission[],
    users: User[],
    business: Business
  }
}
```

#### Create Role
```typescript
POST /api/roles
Body: {
  name: string,
  permissionIds?: number[]
}
```

#### Update Role
```typescript
PUT /api/roles
Body: {
  id: number,
  name: string,
  permissionIds?: number[]
}
```

#### Delete Role
```typescript
DELETE /api/roles?id=123
```

### Permissions API

```typescript
GET /api/permissions

Response:
{
  permissions: Permission[],
  grouped: {
    "Dashboard": Permission[],
    "Users": Permission[],
    ...
  }
}
```

## Permission Constants

Import from `@/lib/rbac`:

```typescript
import { PERMISSIONS } from '@/lib/rbac'

// User permissions
PERMISSIONS.USER_VIEW
PERMISSIONS.USER_CREATE
PERMISSIONS.USER_UPDATE
PERMISSIONS.USER_DELETE

// Role permissions
PERMISSIONS.ROLE_VIEW
PERMISSIONS.ROLE_CREATE
PERMISSIONS.ROLE_UPDATE
PERMISSIONS.ROLE_DELETE

// Other common permissions
PERMISSIONS.DASHBOARD_VIEW
PERMISSIONS.PRODUCT_VIEW
PERMISSIONS.SELL_VIEW
PERMISSIONS.PURCHASE_VIEW
PERMISSIONS.SUPERADMIN_ALL
```

## Using Permissions in Components

### Client Components

```typescript
'use client'

import { usePermissions } from '@/hooks/usePermissions'
import { PERMISSIONS } from '@/lib/rbac'

export default function MyComponent() {
  const { can, canAny, canAll, hasRole, user } = usePermissions()

  // Check single permission
  if (!can(PERMISSIONS.USER_VIEW)) {
    return <p>Access denied</p>
  }

  // Check multiple permissions (any)
  const canManageUsers = canAny([
    PERMISSIONS.USER_CREATE,
    PERMISSIONS.USER_UPDATE,
    PERMISSIONS.USER_DELETE
  ])

  // Check role
  if (hasRole('Super Admin')) {
    // Show admin-only features
  }

  return (
    <>
      {can(PERMISSIONS.USER_CREATE) && (
        <button>Add User</button>
      )}
    </>
  )
}
```

### Server Components / API Routes

```typescript
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { hasPermission, isSuperAdmin, PERMISSIONS } from '@/lib/rbac'

export async function GET() {
  const session = await getServerSession(authOptions)

  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const user = session.user as any

  if (!hasPermission(user, PERMISSIONS.USER_VIEW)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Build query with multi-tenant isolation
  const whereClause: any = {}

  if (!isSuperAdmin(user)) {
    whereClause.businessId = parseInt(user.businessId)
  }

  // Continue with database query...
}
```

## Common Patterns

### Multi-Tenant Query Pattern

```typescript
// Always filter by businessId unless Super Admin
const whereClause: any = {
  deletedAt: null  // Exclude soft-deleted
}

if (!isSuperAdmin(user)) {
  whereClause.businessId = parseInt(user.businessId)
}

const results = await prisma.someModel.findMany({
  where: whereClause
})
```

### Form Dialog Pattern

```typescript
const [showDialog, setShowDialog] = useState(false)
const [editingItem, setEditingItem] = useState<Item | null>(null)

// Open for create
<Button onClick={() => setShowDialog(true)}>Add</Button>

// Open for edit
<Button onClick={() => {
  setEditingItem(item)
  setShowDialog(true)
}}>Edit</Button>

// Dialog component
<MyFormDialog
  open={showDialog}
  onClose={() => {
    setShowDialog(false)
    setEditingItem(null)
  }}
  onSuccess={() => {
    fetchData()  // Refresh list
    setShowDialog(false)
    setEditingItem(null)
  }}
  item={editingItem}
/>
```

### Search and Filter Pattern

```typescript
const [search, setSearch] = useState('')
const [filter1, setFilter1] = useState<string>('all')
const [filter2, setFilter2] = useState<string>('all')

useEffect(() => {
  fetchData()
}, [search, filter1, filter2])

const fetchData = async () => {
  const params = new URLSearchParams()
  if (search) params.append('search', search)
  if (filter1 !== 'all') params.append('filter1', filter1)
  if (filter2 !== 'all') params.append('filter2', filter2)

  const response = await fetch(`/api/endpoint?${params.toString()}`)
  // Handle response
}
```

### Password Update Pattern

```typescript
// In create user: password required
const payload = {
  ...formData,
  password: data.password  // Required
}

// In update user: password optional
const payload = {
  ...formData,
  password: data.password || undefined  // Only if provided
}
```

## Validation Schemas

### User Schema

```typescript
const userSchema = z.object({
  surname: z.string().min(1, 'Surname is required'),
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().optional(),
  username: z.string().min(3, 'Username must be at least 3 characters'),
  email: z.string().email('Invalid email').optional().or(z.literal('')),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  roleIds: z.array(z.number()).min(1, 'At least one role is required'),
  locationIds: z.array(z.number()).optional(),
  maxSaleDiscount: z.number().min(0).max(100).optional(),
  allowLogin: z.boolean().optional(),
})
```

### Role Schema

```typescript
const roleSchema = z.object({
  name: z.string().min(1, 'Role name is required'),
  permissionIds: z.array(z.number()).optional(),
})
```

## Responsive Design Classes

```typescript
// Container
className="container mx-auto py-6 px-4"

// Flex responsive
className="flex flex-col sm:flex-row sm:items-center gap-4"

// Grid responsive
className="grid grid-cols-1 md:grid-cols-2 gap-4"

// Button responsive
className="w-full sm:w-auto"

// Hide on mobile, show on desktop
className="hidden md:block"

// Hide on desktop, show on mobile
className="md:hidden"
```

## Toast Notifications

```typescript
import { toast } from 'sonner'

// Success
toast.success('User created successfully')

// Error
toast.error('Failed to create user')

// With description
toast.success('User created', {
  description: 'An email has been sent to the user'
})
```

## Common Errors and Solutions

### "Unauthorized" (401)
- User not logged in
- Session expired
- Solution: Redirect to login page

### "Forbidden" (403)
- User lacks required permission
- Solution: Check user has correct role/permissions

### "User not found" (404)
- User ID doesn't exist
- User belongs to different business (multi-tenant isolation)
- Solution: Verify ID and businessId match

### "Username already exists" (400)
- Duplicate username in database
- Solution: Choose different username

### "Cannot delete role" (400)
- Role has users assigned
- Role is default system role
- Solution: Reassign users first or cannot delete default roles

### "Validation error" (400)
- Form data doesn't match schema
- Solution: Check error.details for specific field errors

## Testing Checklist

- [ ] Create user with valid data
- [ ] Create user with duplicate username (should fail)
- [ ] Update user profile
- [ ] Update user password
- [ ] Delete user
- [ ] Search users
- [ ] Filter users by role
- [ ] Filter users by location
- [ ] Create custom role
- [ ] Edit role permissions
- [ ] Delete custom role
- [ ] Attempt to delete default role (should fail)
- [ ] Attempt to delete role with users (should fail)
- [ ] View user details
- [ ] View role details
- [ ] Test as different user roles
- [ ] Test mobile responsive layout

## Environment Variables Required

```env
DATABASE_URL="postgresql://user:password@localhost:5432/db"
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="your-secret-key-min-32-chars"
```

## Database Requirements

Ensure these tables exist:
- users
- roles
- permissions
- user_roles (junction)
- role_permissions (junction)
- user_permissions (junction)
- user_locations (junction)
- business_locations

## Commands

```bash
# Install dependencies
npm install

# Generate Prisma Client
npx prisma generate

# Push schema to database
npm run db:push

# Seed database with demo data
npm run db:seed

# Run development server
npm run dev

# Build for production
npm run build
```

## Support and Documentation

- Full implementation details: `RBAC-IMPLEMENTATION-SUMMARY.md`
- Project setup: `QUICKSTART.md`
- RBAC concepts: `src/lib/rbac.ts`
- Auth configuration: `src/lib/auth.ts`
