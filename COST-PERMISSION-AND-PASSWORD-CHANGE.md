# Cost Visibility Permission & Password Change Feature

## 📋 Overview

This document describes two new security features added to the POS system:

1. **Cost Visibility Permission** - Control which roles can see purchase costs and prices
2. **User Profile & Password Change** - Allow users to change their own passwords securely

---

## 🔐 Feature 1: Cost Visibility Permission

### Purpose

Restrict viewing of sensitive cost information (unit costs, subtotals, totals) in purchase-related pages to authorized roles only. This prevents unauthorized users from seeing supplier costs and profit margins.

### Permission Details

**Permission Name:** `purchase.view_cost`

**Description:** View purchase costs and prices

**Default Assignment:**
- ✅ Super Admin - Yes
- ✅ Branch Admin - Yes
- ❌ Branch Manager - No (by default, can be enabled)
- ❌ Cashier - No (by default, can be enabled)

### Pages Where Cost is Hidden

#### 1. Purchase Order Detail Page (`/dashboard/purchases/[id]`)
- **Hidden:** Unit Cost per item
- **Hidden:** Summary box (Subtotal, Tax, Discount, Shipping, Total)
- **Visible:** Ordered quantity, Received quantity, Remaining quantity

#### 2. Goods Received Note (GRN) Detail Page (`/dashboard/purchases/receipts/[id]`)
- **Hidden:** Unit Cost column in table
- **Hidden:** Total column in table
- **Hidden:** Grand Total in footer
- **Visible:** Product name, SKU, Ordered quantity, Received quantity

#### 3. Purchase Orders List Page
- **Always Visible:** Total amount (needed for approval workflow)
- *Note: Only total shown, not individual costs*

### Implementation Details

```typescript
// Permission check in components
const { can } = usePermissions()

// Hide cost column
{can(PERMISSIONS.PURCHASE_VIEW_COST) && (
  <th className="text-right py-3 px-4">Unit Cost</th>
)}

// Hide summary section
{can(PERMISSIONS.PURCHASE_VIEW_COST) && (
  <div className="bg-white p-6 rounded-lg shadow">
    <h2>Summary</h2>
    {/* Cost details */}
  </div>
)}
```

### Setup Instructions

#### Enable Cost Viewing for a Role:

1. Login as **Super Admin**
2. Go to **User Management** → **Roles & Permissions**
3. Click **Edit** on the desired role
4. Scroll to **Purchase** section
5. Check the box for **"view cost"** permission
6. Click **Update**
7. Users with this role can now see costs

#### Create a Script to Add Permission:

```bash
node add-cost-permission.js
```

This script:
- Creates `purchase.view_cost` permission in database
- Assigns it to Super Admin role
- Assigns it to Branch Admin role

---

## 👤 Feature 2: User Profile & Password Change

### Purpose

Allow users to securely change their own passwords without administrator intervention. This enforces individual accountability for transactions and prevents password sharing.

### Key Features

#### 1. User Profile Page (`/dashboard/profile`)

**Location in Sidebar:** "My Profile" (accessible to all users, no permission required)

**Sections:**

**a) Account Information**
- Display: Name, Username, Email, Role
- Read-only (users cannot edit these fields themselves)

**b) Change Password Form**
- Current Password (required)
- New Password (required, min 6 characters)
- Confirm New Password (required, must match)
- Security best practices tips

**c) Security Notice Card**
- Password guidelines
- Security recommendations

#### 2. Password Change API (`/api/user/change-password`)

**Method:** POST

**Authentication:** Required (uses session)

**Request Body:**
```json
{
  "currentPassword": "old-password",
  "newPassword": "new-password"
}
```

**Validations:**
- ✅ User must be logged in
- ✅ Current password must be correct
- ✅ New password minimum 6 characters
- ✅ Passwords are bcrypt hashed
- ✅ Audit log created for password changes

**Response:**
```json
{
  "success": true,
  "message": "Password changed successfully"
}
```

**Error Responses:**
- `401` - Unauthorized (not logged in)
- `400` - Current password incorrect
- `400` - New password too short
- `400` - Validation errors

#### 3. Default Password for New Users

**Default Password:** `123456`

**Implementation:**
- When creating a user, if password is not provided, default to "123456"
- Admin can optionally provide a different password
- User must change password on first login (optional feature, not yet implemented)

**Modified API:** `/api/users` (POST endpoint)

```typescript
// Use provided password or default to "123456"
const userPassword = password || '123456'
const hashedPassword = await bcrypt.hash(userPassword, 10)
```

### User Workflow

#### For New Users:

1. **Admin creates user account**
   - Admin goes to User Management → Users → Add User
   - Admin fills in username, name, role, locations
   - Admin leaves password blank or sets custom password
   - System uses default password "123456" if blank

2. **User receives credentials**
   - Username: (provided by admin)
   - Password: 123456 (or custom if admin set one)

3. **User logs in**
   - User logs in with provided credentials
   - **(Future feature)** System prompts to change password on first login

4. **User changes password**
   - User clicks "My Profile" in sidebar
   - User fills in Current Password, New Password, Confirm Password
   - User clicks "Change Password"
   - System validates and updates password
   - User must use new password for next login

#### Security Benefits:

✅ **Individual Accountability** - Each user has unique password
✅ **No Password Sharing** - Users can't blame others for their actions
✅ **Audit Trail** - Password changes are logged
✅ **Transaction Integrity** - Approvals tied to specific user credentials
✅ **Simple Setup** - Admins don't need to create complex passwords
✅ **User Control** - Users manage their own password security

### Implementation Files

#### Created Files:
1. `src/app/dashboard/profile/page.tsx` - User profile page
2. `src/app/api/user/change-password/route.ts` - Password change API
3. `add-cost-permission.js` - Script to add cost permission to database

#### Modified Files:
1. `src/lib/rbac.ts` - Added PURCHASE_VIEW_COST permission
2. `src/app/dashboard/purchases/[id]/page.tsx` - Hide costs based on permission
3. `src/app/dashboard/purchases/receipts/[id]/page.tsx` - Hide costs based on permission
4. `src/components/Sidebar.tsx` - Added "My Profile" menu item
5. `src/app/api/users/route.ts` - Default password "123456" for new users

---

## 🧪 Testing

### Automated Test

Run the test script:

```bash
node test-password-change.js
```

**Test Coverage:**
1. ✅ Login functionality
2. ✅ Profile page loads
3. ✅ Profile page has all required sections
4. ✅ Password change form validation works
5. ✅ Cost visibility permission works

### Manual Testing

#### Test Cost Visibility:

**Test Case 1: User WITH permission**
1. Login as Super Admin or Branch Admin
2. Go to Purchases → View a purchase order
3. **Expected:** Unit costs and summary visible

**Test Case 2: User WITHOUT permission**
1. Create a role without `purchase.view_cost` permission
2. Assign this role to a test user
3. Login as that user
4. Go to Purchases → View a purchase order
5. **Expected:** Unit costs and summary hidden

#### Test Password Change:

**Test Case 1: Successful password change**
1. Login as any user
2. Go to My Profile
3. Enter current password, new password (min 6 chars), confirm password
4. Click "Change Password"
5. **Expected:** Success message, fields cleared
6. Logout and login with new password
7. **Expected:** Login successful

**Test Case 2: Wrong current password**
1. Go to My Profile
2. Enter incorrect current password
3. **Expected:** Error "Current password is incorrect"

**Test Case 3: Passwords don't match**
1. Go to My Profile
2. Enter new password and different confirm password
3. **Expected:** Error "New passwords do not match"

**Test Case 4: Password too short**
1. Go to My Profile
2. Enter new password with less than 6 characters
3. **Expected:** Browser validation prevents submit

#### Test Default Password:

**Test Case: Create user without password**
1. Login as admin
2. Go to User Management → Users → Add User
3. Fill username, name, role (don't set password)
4. Save
5. Logout
6. Login with username and password "123456"
7. **Expected:** Login successful

---

## 🔒 Security Considerations

### Cost Visibility

- **Data Sensitivity:** Purchase costs are sensitive business data
- **Profit Protection:** Prevents unauthorized users from calculating profit margins
- **Supplier Relationships:** Protects negotiated supplier pricing
- **Role-Based:** Only authorized roles can view costs

### Password Management

- **Password Hashing:** All passwords stored as bcrypt hashes (salt rounds: 10)
- **Session Security:** Password change requires active session
- **Audit Logging:** Password changes recorded in audit log
- **No Password Recovery:** Users cannot reset forgotten passwords (admin must reset)
- **Validation:** Minimum 6 characters enforced (can be increased)

### Future Enhancements

1. ⏳ **Force Password Change on First Login**
   - Add `mustChangePassword` flag to User model
   - Redirect to password change on first login
   - Prevent access to other pages until password changed

2. ⏳ **Password Strength Requirements**
   - Require uppercase, lowercase, numbers, symbols
   - Minimum 8-12 characters
   - Password strength meter in UI

3. ⏳ **Password Expiry Policy**
   - Force password change every 90 days
   - Warning before expiry
   - Prevent password reuse

4. ⏳ **Two-Factor Authentication (2FA)**
   - OTP via SMS or email
   - Authenticator app support
   - Backup codes

5. ⏳ **Hide Product Costs Permission**
   - Similar to purchase costs
   - Hide purchase price in product pages
   - Control profit margin visibility

---

## 📊 Database Changes

### New Permission

```sql
INSERT INTO Permission (name) VALUES ('purchase.view_cost');
```

### Assigned to Roles

```sql
-- Super Admin (automatically has all permissions via code)
-- Branch Admin
INSERT INTO RolePermission (roleId, permissionId)
SELECT r.id, p.id
FROM Role r, Permission p
WHERE r.name = 'Branch Admin' AND p.name = 'purchase.view_cost';
```

---

## 🎯 Business Benefits

### Cost Visibility Control

1. **Protect Business Secrets** - Supplier costs remain confidential
2. **Prevent Competitive Disadvantage** - Employees can't share pricing with competitors
3. **Role Segregation** - Warehouse staff don't need cost visibility
4. **Better Security** - Limit sensitive data access

### Password Change Feature

1. **Accountability** - Each user responsible for their own actions
2. **Audit Compliance** - Individual logins required for audits
3. **Prevent Fraud** - Harder to blame others for unauthorized actions
4. **Security Culture** - Users take ownership of account security
5. **Simple Onboarding** - Default password makes setup easy

---

## 📝 Summary

### Completed Features

- ✅ Cost visibility permission (`purchase.view_cost`)
- ✅ Hide costs in purchase detail pages
- ✅ Hide costs in GRN detail pages
- ✅ User profile page with password change
- ✅ Password change API with validation
- ✅ Default password "123456" for new users
- ✅ Audit logging for password changes
- ✅ Automated testing script

### Pending Features

- ⏳ Hide product costs permission
- ⏳ Force password change on first login
- ⏳ Password strength requirements
- ⏳ Password expiry policy

---

**Status:** ✅ Production Ready

**Last Updated:** 2025-10-09

**Tested By:** Automated test script + Manual verification
