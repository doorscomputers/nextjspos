# RBAC System - Developer Implementation Notes

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                         Client Browser                               │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌────────────────────┐          ┌────────────────────┐            │
│  │  Users Page        │          │  Roles Page        │            │
│  │  /dashboard/users  │          │  /dashboard/roles  │            │
│  └─────────┬──────────┘          └─────────┬──────────┘            │
│            │                               │                        │
│            │ usePermissions()              │ usePermissions()       │
│            ├───────────────────────────────┤                        │
│            │                               │                        │
│  ┌─────────▼────────────────────────────────▼──────────┐           │
│  │            Session Context (NextAuth)                │           │
│  │  { user, permissions, roles, businessId }            │           │
│  └──────────────────────────────────────────────────────┘           │
│                                                                      │
└─────────────────────────────┬────────────────────────────────────────┘
                              │
                              │ HTTP Requests
                              │
┌─────────────────────────────▼────────────────────────────────────────┐
│                         Next.js API Routes                           │
├──────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌─────────────────┐  ┌─────────────────┐  ┌───────────────────┐  │
│  │  /api/users     │  │  /api/roles     │  │  /api/permissions │  │
│  │  - GET          │  │  - GET          │  │  - GET            │  │
│  │  - POST         │  │  - POST         │  └───────────────────┘  │
│  │  - PUT          │  │  - PUT          │                          │
│  │  - DELETE       │  │  - DELETE       │                          │
│  └────────┬────────┘  └────────┬────────┘                          │
│           │                    │                                    │
│           │  Permission Check  │                                    │
│           ├────────────────────┤                                    │
│           │                    │                                    │
│  ┌────────▼────────────────────▼──────────┐                        │
│  │     RBAC Helper Functions               │                        │
│  │  - hasPermission()                      │                        │
│  │  - isSuperAdmin()                       │                        │
│  │  - hasRole()                            │                        │
│  └────────┬────────────────────────────────┘                        │
│           │                                                          │
└───────────┼──────────────────────────────────────────────────────────┘
            │
            │ Prisma ORM
            │
┌───────────▼──────────────────────────────────────────────────────────┐
│                      PostgreSQL Database                             │
├──────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌─────────┐  ┌─────────┐  ┌──────────────┐  ┌──────────────────┐ │
│  │ users   │  │ roles   │  │ permissions  │  │ business         │ │
│  └────┬────┘  └────┬────┘  └──────┬───────┘  └──────────────────┘ │
│       │            │              │                                 │
│       │            │              │                                 │
│  ┌────▼────────────▼──────────────▼───────┐                        │
│  │      Junction Tables (Many-to-Many)     │                        │
│  │  - user_roles                           │                        │
│  │  - role_permissions                     │                        │
│  │  - user_permissions                     │                        │
│  │  - user_locations                       │                        │
│  └─────────────────────────────────────────┘                        │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

## Data Flow Diagrams

### User Creation Flow

```
User clicks "Add User"
    │
    ▼
UserFormDialog opens
    │
    ▼
User fills form and submits
    │
    ▼
Client-side validation (react-hook-form + Zod)
    │
    ├─ FAIL → Show error messages
    │
    ▼
POST /api/users
    │
    ├─ Check session authentication
    │   └─ FAIL → 401 Unauthorized
    │
    ├─ Check USER_CREATE permission
    │   └─ FAIL → 403 Forbidden
    │
    ├─ Validate request body (Zod)
    │   └─ FAIL → 400 Validation Error
    │
    ├─ Check username uniqueness
    │   └─ FAIL → 400 Username exists
    │
    ├─ Check email uniqueness
    │   └─ FAIL → 400 Email exists
    │
    ├─ Verify roles belong to business
    │   └─ FAIL → 400 Invalid role
    │
    ├─ Hash password (bcrypt)
    │
    ├─ Create user in database
    │   ├─ Insert user record
    │   ├─ Insert user_roles records
    │   └─ Insert user_locations records
    │
    ▼
Return created user (without password)
    │
    ▼
Show success toast
    │
    ▼
Refresh user list
    │
    ▼
Close dialog
```

### Permission Check Flow

```
User accesses protected resource
    │
    ▼
API route handler
    │
    ├─ Get session from NextAuth
    │
    ├─ Extract user from session
    │   └─ session.user contains:
    │       - id
    │       - businessId
    │       - permissions[] (from roles + direct)
    │       - roles[]
    │
    ├─ Call hasPermission(user, PERMISSION)
    │   │
    │   ├─ Check if permission exists in user.permissions[]
    │   │
    │   └─ Return true/false
    │
    ├─ If false → Return 403 Forbidden
    │
    └─ If true → Continue with request
```

### Multi-Tenant Isolation Flow

```
User makes data request
    │
    ▼
Extract businessId from session
    │
    ├─ Is user Super Admin?
    │   │
    │   ├─ YES → Can access all businesses
    │   │
    │   └─ NO → Can only access own businessId
    │
    ▼
Build WHERE clause
    │
    ├─ Super Admin:
    │   └─ WHERE { ...filters }
    │
    └─ Regular User:
        └─ WHERE { businessId: user.businessId, ...filters }
    │
    ▼
Execute Prisma query
    │
    ▼
Return filtered results
```

## Database Schema Relationships

```
┌─────────────┐
│  Business   │
│             │
│  - id       │
│  - name     │
│  - ownerId  │
└──────┬──────┘
       │
       │ 1:N
       │
       ├─────────────────────────────────┐
       │                                 │
       ▼                                 ▼
┌──────────────┐                  ┌─────────────┐
│    User      │                  │    Role     │
│              │                  │             │
│  - id        │                  │  - id       │
│  - username  │◄────────┐        │  - name     │
│  - businessId│         │        │  - businessId│
└──────┬───────┘         │        └──────┬──────┘
       │                 │               │
       │ M:N             │ M:N           │ M:N
       │                 │               │
       ▼                 │               ▼
┌──────────────┐         │        ┌─────────────────┐
│  user_roles  │─────────┘        │ role_permissions│
│              │                  │                 │
│  - userId    │                  │  - roleId       │
│  - roleId    │                  │  - permissionId │
└──────────────┘                  └────────┬────────┘
                                           │
       ┌───────────────────────────────────┘
       │
       ▼
┌─────────────────┐
│   Permission    │
│                 │
│  - id           │
│  - name         │
│  - guardName    │
└─────────────────┘
       ▲
       │ M:N
       │
┌──────────────────┐
│ user_permissions │
│                  │
│  - userId        │
│  - permissionId  │
└──────────────────┘
```

## Key Design Decisions

### 1. Multi-Tenant Architecture

**Decision**: Use `businessId` foreign key with query-level filtering

**Rationale**:
- Single database for all tenants (easier management)
- Row-level security via application logic
- Prisma makes filtering transparent

**Implementation**:
```typescript
const whereClause: any = { deletedAt: null }
if (!isSuperAdmin(user)) {
  whereClause.businessId = parseInt(user.businessId)
}
```

### 2. Permission Storage in Session

**Decision**: Store all permissions (role-based + direct) in JWT token

**Rationale**:
- Fast permission checks without database queries
- No need to join tables on every request
- Trade-off: Requires re-login to see new permissions

**Implementation** (`src/lib/auth.ts`):
```typescript
// On login, collect all permissions
const rolePermissions = user.roles.flatMap(ur =>
  ur.role.permissions.map(rp => rp.permission.name)
)
const directPermissions = user.permissions.map(up => up.permission.name)
const allPermissions = [...new Set([...rolePermissions, ...directPermissions])]

// Store in JWT token
token.permissions = allPermissions
```

### 3. Soft Delete Pattern

**Decision**: Use `deletedAt` timestamp instead of hard delete

**Rationale**:
- Preserve audit trail
- Can restore deleted users if needed
- Safer than permanent deletion

**Implementation**:
```typescript
await prisma.user.update({
  where: { id: userId },
  data: {
    deletedAt: new Date(),
    allowLogin: false  // Also disable login
  }
})
```

### 4. Password Handling

**Decision**: Hash with bcrypt, never return in responses

**Rationale**:
- Industry standard security
- Slow hashing prevents brute force
- One-way encryption

**Implementation**:
```typescript
// Create
const hashedPassword = await bcrypt.hash(password, 10)

// Verify
const isValid = await bcrypt.compare(inputPassword, storedHash)

// Never expose
const { password, ...userWithoutPassword } = user
return userWithoutPassword
```

### 5. Client-Side Validation

**Decision**: Use react-hook-form + Zod for forms

**Rationale**:
- Better UX with instant feedback
- Type-safe validation
- Reusable schemas
- Still validate server-side for security

**Implementation**:
```typescript
const schema = z.object({
  username: z.string().min(3, 'Username must be at least 3 characters')
})

const { register, handleSubmit, formState: { errors } } = useForm<FormData>()
```

### 6. Permission Grouping

**Decision**: Group permissions by functional area in UI

**Rationale**:
- Easier to find related permissions
- Select all/deselect all by group
- Better UX for role management

**Implementation** (`src/app/api/permissions/route.ts`):
```typescript
const PERMISSION_GROUPS = {
  Dashboard: ['dashboard.view'],
  Users: ['user.view', 'user.create', 'user.update', 'user.delete'],
  // ... more groups
}
```

### 7. Responsive Design Strategy

**Decision**: Table for desktop, cards for mobile

**Rationale**:
- Tables don't work well on small screens
- Cards provide better mobile UX
- Both views show same data, different layout

**Implementation**:
```typescript
{/* Desktop */}
<div className="hidden md:block">
  <Table>...</Table>
</div>

{/* Mobile */}
<div className="md:hidden">
  {items.map(item => <Card>...</Card>)}
</div>
```

## Performance Considerations

### 1. Database Queries

**Optimization**: Use `include` selectively, avoid N+1 queries

```typescript
// Good: Single query with includes
const users = await prisma.user.findMany({
  include: {
    roles: { include: { role: true } },
    userLocations: { include: { location: true } }
  }
})

// Bad: N+1 queries (avoid this)
const users = await prisma.user.findMany()
for (const user of users) {
  user.roles = await prisma.userRole.findMany({ where: { userId: user.id } })
}
```

### 2. Pagination

**Implementation**: Offset-based pagination

```typescript
const page = parseInt(searchParams.get('page') || '1')
const limit = parseInt(searchParams.get('limit') || '20')
const offset = (page - 1) * limit

const [users, total] = await Promise.all([
  prisma.user.findMany({ skip: offset, take: limit }),
  prisma.user.count()
])
```

### 3. Caching Strategy

**Current**: No caching (data changes frequently)

**Future Enhancement**: Consider Redis for:
- Session data
- Permission lookups
- Frequently accessed reference data

### 4. Bundle Size

**Optimization**: Use dynamic imports for dialogs

```typescript
// Instead of:
import { UserFormDialog } from '@/components/users/UserFormDialog'

// Consider:
const UserFormDialog = dynamic(() => import('@/components/users/UserFormDialog'))
```

## Security Best Practices

### 1. Input Validation

```typescript
// Always validate on both client and server
const schema = z.object({
  username: z.string().min(3).max(50),
  email: z.string().email().optional()
})

// Client
const { register, handleSubmit } = useForm({ resolver: zodResolver(schema) })

// Server
const validatedData = schema.parse(body)
```

### 2. SQL Injection Prevention

Prisma automatically escapes parameters:

```typescript
// Safe: Prisma parameterizes
await prisma.user.findMany({
  where: { username: userInput }
})

// Never use raw SQL with user input unless escaped
```

### 3. XSS Prevention

React automatically escapes JSX:

```typescript
// Safe: React escapes
<p>{userInput}</p>

// Dangerous: Avoid dangerouslySetInnerHTML
<div dangerouslySetInnerHTML={{ __html: userInput }} />
```

### 4. CSRF Protection

NextAuth handles CSRF tokens automatically.

### 5. Rate Limiting

**TODO**: Consider adding rate limiting to prevent abuse:

```typescript
// Example using middleware
const rateLimit = new Map()

function checkRateLimit(ip: string): boolean {
  const now = Date.now()
  const requests = rateLimit.get(ip) || []
  const recentRequests = requests.filter((time: number) => now - time < 60000)

  if (recentRequests.length >= 100) {
    return false // Too many requests
  }

  recentRequests.push(now)
  rateLimit.set(ip, recentRequests)
  return true
}
```

## Common Gotchas

### 1. Permissions Not Updating After Change

**Problem**: User changes role but still sees old permissions

**Solution**: Permissions are cached in JWT token. User must logout and login again.

```typescript
// Consider adding a "force logout" feature for admins
// Or implement short-lived tokens with refresh
```

### 2. businessId Type Confusion

**Problem**: Session has string businessId, Prisma expects number

**Solution**: Always parse to integer

```typescript
// Wrong
where: { businessId: user.businessId }

// Correct
where: { businessId: parseInt(user.businessId) }
```

### 3. Soft Deleted Records Appearing

**Problem**: Forgot to filter by deletedAt

**Solution**: Always include in WHERE clause

```typescript
const whereClause = {
  deletedAt: null,
  // ... other conditions
}
```

### 4. Password Field Empty on Edit

**Problem**: Users confused why password field is empty when editing

**Solution**: Add placeholder text and help text

```typescript
<Input
  type="password"
  placeholder={isEditing ? "Leave blank to keep current" : "Enter password"}
/>
{isEditing && (
  <p className="text-sm text-muted-foreground">
    Leave blank to keep current password
  </p>
)}
```

### 5. Role Assignment Confusion

**Problem**: Multiple roles vs single role

**Solution**: Support multiple roles, but UI should make it clear

```typescript
// Allow multiple roles
roleIds: z.array(z.number()).min(1, 'At least one role is required')

// UI shows all selected roles
{user.roles.map(role => <Badge>{role.name}</Badge>)}
```

## Debugging Tips

### 1. Check Session Data

```typescript
// In client component
const { data: session } = useSession()
console.log('Session:', session)

// In API route
const session = await getServerSession(authOptions)
console.log('User:', session?.user)
console.log('Permissions:', (session?.user as any)?.permissions)
```

### 2. Verify Permissions

```typescript
// Check what permissions user has
const { user } = usePermissions()
console.log('All permissions:', user?.permissions)
console.log('All roles:', user?.roles)

// Check specific permission
const canView = can(PERMISSIONS.USER_VIEW)
console.log('Can view users:', canView)
```

### 3. Database Queries

```typescript
// Enable Prisma query logging in .env
DATABASE_URL="postgresql://user:pass@localhost:5432/db?schema=public&connection_limit=10"
DEBUG="prisma:query"
```

### 4. API Response Inspection

```typescript
// In browser console (Network tab)
// Check request payload
// Check response status and body
// Check headers

// Add logging in API routes
console.log('Request body:', await request.json())
console.log('Query params:', new URL(request.url).searchParams)
```

## Extension Points

### 1. Direct User Permissions

Currently users only inherit permissions from roles. To add direct permissions:

```typescript
// API route
if (validatedData.directPermissionIds) {
  await tx.userPermission.createMany({
    data: validatedData.directPermissionIds.map(permissionId => ({
      userId: user.id,
      permissionId
    }))
  })
}

// Form
<Label>Direct Permissions (override role permissions)</Label>
<PermissionCheckboxGroup
  selectedPermissions={selectedDirectPermissions}
  onChange={setSelectedDirectPermissions}
/>
```

### 2. Audit Logging

Add audit trail for all RBAC changes:

```typescript
// Create audit_log table
model AuditLog {
  id        Int      @id @default(autoincrement())
  userId    Int
  action    String   // "user.create", "role.update", etc.
  entityType String  // "user", "role", etc.
  entityId  Int
  changes   Json     // Before/after data
  createdAt DateTime @default(now())
}

// In API routes
await prisma.auditLog.create({
  data: {
    userId: currentUser.id,
    action: 'user.create',
    entityType: 'user',
    entityId: newUser.id,
    changes: { created: newUser }
  }
})
```

### 3. Email Notifications

Send emails when users are created or modified:

```typescript
import { sendEmail } from '@/lib/email'

// After user creation
await sendEmail({
  to: newUser.email,
  subject: 'Welcome to UltimatePOS',
  template: 'user-created',
  data: {
    username: newUser.username,
    temporaryPassword: generatedPassword
  }
})
```

### 4. Two-Factor Authentication

Add 2FA support for enhanced security:

```typescript
// Add to User model
model User {
  twoFactorEnabled Boolean @default(false)
  twoFactorSecret  String?
}

// In login flow
if (user.twoFactorEnabled) {
  // Prompt for TOTP code
  // Verify with user.twoFactorSecret
}
```

## Maintenance Notes

### Regular Tasks

1. **Review Permissions**: Audit which users have which permissions
2. **Clean Soft Deletes**: Permanently delete old soft-deleted records
3. **Password Expiry**: Consider implementing password expiry policy
4. **Session Cleanup**: Remove expired sessions from database
5. **Monitor Failed Logins**: Track and alert on suspicious activity

### Backup Recommendations

```bash
# Backup user and role data
pg_dump -h localhost -U postgres -d ultimatepos_modern \
  -t users -t roles -t permissions -t user_roles -t role_permissions \
  > rbac_backup.sql

# Restore
psql -h localhost -U postgres -d ultimatepos_modern < rbac_backup.sql
```

## Changelog

### Version 1.0.0 (2025-10-05)

**Initial Release**
- User management (CRUD)
- Role management (CRUD)
- Permission assignment
- Multi-tenant security
- Responsive UI
- Form validation
- Toast notifications
- Empty states
- Loading states
- Mobile-responsive design

**Future Enhancements**
- Direct user permissions
- Audit logging
- Email notifications
- 2FA support
- Advanced filtering
- Bulk operations
- User import/export
- Password policies
