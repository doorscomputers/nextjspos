# API Endpoints Reference
# Igoro Tech(IT) Inventory Management System

> **Complete reference guide for all API endpoints in the application**

---

## Table of Contents

1. [API Conventions](#api-conventions)
2. [Authentication APIs](#authentication-apis)
3. [Product APIs](#product-apis)
4. [Sales APIs](#sales-apis)
5. [Purchase APIs](#purchase-apis)
6. [Customer & Supplier APIs](#customer--supplier-apis)
7. [Inventory APIs](#inventory-apis)
8. [Report APIs](#report-apis)
9. [User & Role APIs](#user--role-apis)
10. [Dashboard APIs](#dashboard-apis)
11. [Settings APIs](#settings-apis)

---

## API Conventions

### Base URL
```
Development: http://localhost:3000/api
Production: https://your-domain.com/api
```

### Authentication
All API routes (except auth routes) require authentication via NextAuth session.

**Check in API routes**:
```typescript
const session = await getServerSession(authOptions);
if (!session) {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}
```

### Standard Response Format

**Success Response**:
```json
{
  "data": { /* response data */ },
  "message": "Optional success message"
}
```

**Error Response**:
```json
{
  "error": "Error message",
  "details": { /* optional error details */ }
}
```

### HTTP Status Codes
- `200 OK` - Successful GET/PUT/DELETE
- `201 Created` - Successful POST (resource created)
- `400 Bad Request` - Invalid request data
- `401 Unauthorized` - Not authenticated
- `403 Forbidden` - Not authorized (lacks permission)
- `404 Not Found` - Resource not found
- `500 Internal Server Error` - Server error

---

## Authentication APIs

### 1. Logout
**POST** `/api/auth/logout`

Logs out the current user and destroys session.

**File**: `src/app/api/auth/logout/route.ts`

**Request**: No body required

**Response**:
```json
{
  "message": "Logged out successfully"
}
```

---

### 2. Verify Password
**POST** `/api/auth/verify-password`

Verifies user's current password (used before sensitive operations).

**File**: `src/app/api/auth/verify-password/route.ts`

**Request Body**:
```json
{
  "password": "current-password"
}
```

**Response**:
```json
{
  "valid": true
}
```

**Permission**: Authenticated user

---

## Product APIs

### 1. List Products
**GET** `/api/products`

Retrieves all products for the current business.

**File**: `src/app/api/products/route.ts`

**Query Parameters**:
- `search` - Search by name, SKU, barcode
- `categoryId` - Filter by category
- `brandId` - Filter by brand
- `isActive` - Filter by active status (true/false)
- `page` - Page number (default: 1)
- `limit` - Items per page (default: 50)

**Response**:
```json
{
  "data": [
    {
      "id": "clx...",
      "name": "Product Name",
      "sku": "SKU-001",
      "barcode": "1234567890",
      "cost": 100.00,
      "price": 150.00,
      "category": { "name": "Category" },
      "brand": { "name": "Brand" },
      "isActive": true
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 50,
    "total": 100,
    "pages": 2
  }
}
```

**Permission**: `PRODUCT_VIEW`

---

### 2. Create Product
**POST** `/api/products`

Creates a new product.

**File**: `src/app/api/products/route.ts`

**Request Body**:
```json
{
  "name": "Product Name",
  "sku": "SKU-001",
  "barcode": "1234567890",
  "categoryId": "clx...",
  "brandId": "clx...",
  "cost": 100.00,
  "price": 150.00,
  "taxId": "clx...",
  "description": "Product description",
  "isActive": true
}
```

**Response**:
```json
{
  "data": {
    "id": "clx...",
    "name": "Product Name",
    "sku": "SKU-001"
  },
  "message": "Product created successfully"
}
```

**Permission**: `PRODUCT_CREATE`

---

### 3. Get Product Details
**GET** `/api/products/[id]`

Retrieves detailed information for a specific product.

**File**: `src/app/api/products/[id]/route.ts`

**URL Parameters**:
- `id` - Product ID

**Response**:
```json
{
  "data": {
    "id": "clx...",
    "name": "Product Name",
    "sku": "SKU-001",
    "barcode": "1234567890",
    "cost": 100.00,
    "price": 150.00,
    "category": { "id": "clx...", "name": "Category" },
    "brand": { "id": "clx...", "name": "Brand" },
    "stock": [
      {
        "locationId": 1,
        "location": { "name": "Main Warehouse" },
        "quantity": 50
      }
    ],
    "variations": []
  }
}
```

**Permission**: `PRODUCT_VIEW`

---

### 4. Update Product
**PUT** `/api/products/[id]`

Updates an existing product.

**File**: `src/app/api/products/[id]/route.ts`

**URL Parameters**:
- `id` - Product ID

**Request Body**: Same as Create Product

**Response**:
```json
{
  "data": { /* updated product */ },
  "message": "Product updated successfully"
}
```

**Permission**: `PRODUCT_EDIT`

---

### 5. Delete Product
**DELETE** `/api/products/[id]`

Deletes a product (soft delete).

**File**: `src/app/api/products/[id]/route.ts`

**URL Parameters**:
- `id` - Product ID

**Response**:
```json
{
  "message": "Product deleted successfully"
}
```

**Permission**: `PRODUCT_DELETE`

---

### 6. Search Products
**GET** `/api/products/search`

Fast product search for POS and forms.

**File**: `src/app/api/products/search/route.ts`

**Query Parameters**:
- `q` - Search query
- `locationId` - Filter by location (optional)
- `limit` - Max results (default: 20)

**Response**:
```json
{
  "data": [
    {
      "id": "clx...",
      "name": "Product Name",
      "sku": "SKU-001",
      "price": 150.00,
      "stock": 50
    }
  ]
}
```

**Permission**: `PRODUCT_VIEW`

---

### 7. Get Product Stock
**GET** `/api/products/[id]/stock`

Retrieves stock levels for a product across all locations.

**File**: `src/app/api/products/[id]/stock/route.ts`

**URL Parameters**:
- `id` - Product ID

**Response**:
```json
{
  "data": [
    {
      "locationId": 1,
      "locationName": "Main Warehouse",
      "quantity": 50
    },
    {
      "locationId": 2,
      "locationName": "Retail Store",
      "quantity": 20
    }
  ]
}
```

**Permission**: `INVENTORY_VIEW`

---

### 8. Import Products
**POST** `/api/products/import`

Imports products from CSV file.

**File**: `src/app/api/products/import/route.ts`

**Request Body**: FormData with CSV file

**Response**:
```json
{
  "data": {
    "imported": 100,
    "failed": 5,
    "errors": [
      { "row": 3, "error": "Missing SKU" }
    ]
  }
}
```

**Permission**: `PRODUCT_IMPORT`

---

## Sales APIs

### 1. List Sales
**GET** `/api/sales`

Retrieves all sales transactions.

**File**: `src/app/api/sales/route.ts`

**Query Parameters**:
- `startDate` - Filter by start date
- `endDate` - Filter by end date
- `locationId` - Filter by location
- `customerId` - Filter by customer
- `paymentStatus` - Filter by status (paid/unpaid/partial)
- `page` - Page number
- `limit` - Items per page

**Response**:
```json
{
  "data": [
    {
      "id": "clx...",
      "invoiceNumber": "INV-0001",
      "customerId": "clx...",
      "customer": { "name": "John Doe" },
      "total": 500.00,
      "paymentStatus": "paid",
      "createdAt": "2025-11-12T10:00:00Z",
      "items": []
    }
  ]
}
```

**Permission**: `SALE_VIEW`

---

### 2. Create Sale
**POST** `/api/sales`

Creates a new sale transaction (POS).

**File**: `src/app/api/sales/route.ts`

**Request Body**:
```json
{
  "customerId": "clx...",
  "locationId": 1,
  "items": [
    {
      "productId": "clx...",
      "variationId": "clx...",
      "quantity": 2,
      "unitPrice": 150.00,
      "discount": 0
    }
  ],
  "subtotal": 300.00,
  "tax": 30.00,
  "discount": 0,
  "total": 330.00,
  "paymentMethod": "cash",
  "paymentAmount": 330.00,
  "notes": ""
}
```

**Response**:
```json
{
  "data": {
    "id": "clx...",
    "invoiceNumber": "INV-0001",
    "total": 330.00
  },
  "message": "Sale created successfully"
}
```

**Permission**: `SALE_CREATE`

**Business Logic**:
1. Validates customer credit limit (if credit sale)
2. Checks product stock availability
3. Creates sale record
4. Deducts inventory from stock
5. Records payment
6. Updates shift running totals
7. Generates invoice number

---

### 3. Get Sale Details
**GET** `/api/sales/[id]`

Retrieves detailed information for a specific sale.

**File**: `src/app/api/sales/[id]/route.ts`

**URL Parameters**:
- `id` - Sale ID

**Response**:
```json
{
  "data": {
    "id": "clx...",
    "invoiceNumber": "INV-0001",
    "customer": { "name": "John Doe" },
    "location": { "name": "Retail Store" },
    "items": [
      {
        "productName": "Product A",
        "quantity": 2,
        "unitPrice": 150.00,
        "subtotal": 300.00
      }
    ],
    "subtotal": 300.00,
    "tax": 30.00,
    "total": 330.00,
    "payments": [
      {
        "method": "cash",
        "amount": 330.00,
        "date": "2025-11-12T10:00:00Z"
      }
    ]
  }
}
```

**Permission**: `SALE_VIEW`

---

### 4. Record Payment
**POST** `/api/sales/[id]/payment`

Records payment for a credit sale (Accounts Receivable).

**File**: `src/app/api/sales/[id]/payment/route.ts`

**URL Parameters**:
- `id` - Sale ID

**Request Body**:
```json
{
  "amount": 500.00,
  "paymentMethod": "cash",
  "notes": "Partial payment"
}
```

**Response**:
```json
{
  "data": {
    "paymentId": "clx...",
    "remainingBalance": 0
  },
  "message": "Payment recorded successfully"
}
```

**Permission**: `PAYMENT_COLLECT_AR`

**Business Logic**:
1. Validates payment amount
2. Updates sale payment status
3. Records in shift running totals (for Z Reading)
4. Updates customer balance
5. Creates audit log

---

### 5. Void Sale
**POST** `/api/sales/[id]/void`

Voids a sale transaction.

**File**: `src/app/api/sales/[id]/void/route.ts`

**URL Parameters**:
- `id` - Sale ID

**Request Body**:
```json
{
  "reason": "Customer cancelled order"
}
```

**Response**:
```json
{
  "message": "Sale voided successfully"
}
```

**Permission**: `SALE_DELETE`

**Business Logic**:
1. Validates sale can be voided
2. Returns inventory to stock
3. Reverses payment
4. Updates shift totals
5. Creates audit log

---

### 6. Refund Sale
**POST** `/api/sales/[id]/refund`

Processes a refund for a sale.

**File**: `src/app/api/sales/[id]/refund/route.ts`

**URL Parameters**:
- `id` - Sale ID

**Request Body**:
```json
{
  "amount": 330.00,
  "reason": "Defective product",
  "items": [
    {
      "saleItemId": "clx...",
      "quantity": 2
    }
  ]
}
```

**Response**:
```json
{
  "data": {
    "refundId": "clx...",
    "amount": 330.00
  },
  "message": "Refund processed successfully"
}
```

**Permission**: `SALE_REFUND`

---

## Purchase APIs

### 1. List Purchase Orders
**GET** `/api/purchases`

Retrieves all purchase orders.

**File**: `src/app/api/purchases/route.ts`

**Query Parameters**:
- `supplierId` - Filter by supplier
- `status` - Filter by status (draft/pending/approved/received)
- `startDate` - Filter by start date
- `endDate` - Filter by end date

**Response**:
```json
{
  "data": [
    {
      "id": "clx...",
      "purchaseNumber": "PO-0001",
      "supplier": { "name": "Supplier Inc" },
      "total": 5000.00,
      "status": "pending",
      "createdAt": "2025-11-12T10:00:00Z"
    }
  ]
}
```

**Permission**: `PURCHASE_VIEW`

---

### 2. Create Purchase Order
**POST** `/api/purchases`

Creates a new purchase order.

**File**: `src/app/api/purchases/route.ts`

**Request Body**:
```json
{
  "supplierId": "clx...",
  "locationId": 1,
  "expectedDate": "2025-11-20",
  "items": [
    {
      "productId": "clx...",
      "variationId": "clx...",
      "quantity": 100,
      "unitCost": 50.00,
      "subtotal": 5000.00
    }
  ],
  "subtotal": 5000.00,
  "tax": 500.00,
  "total": 5500.00,
  "notes": ""
}
```

**Response**:
```json
{
  "data": {
    "id": "clx...",
    "purchaseNumber": "PO-0001",
    "total": 5500.00
  },
  "message": "Purchase order created successfully"
}
```

**Permission**: `PURCHASE_CREATE`

---

### 3. Receive Purchase
**POST** `/api/purchases/[id]/receive`

Receives inventory from a purchase order.

**File**: `src/app/api/purchases/[id]/receive/route.ts`

**URL Parameters**:
- `id` - Purchase Order ID

**Request Body**:
```json
{
  "receivedItems": [
    {
      "purchaseItemId": "clx...",
      "receivedQuantity": 100,
      "actualCost": 50.00
    }
  ],
  "receiptDate": "2025-11-12"
}
```

**Response**:
```json
{
  "data": {
    "receiptId": "clx...",
    "receivedTotal": 100
  },
  "message": "Purchase received successfully"
}
```

**Permission**: `PURCHASE_RECEIVE`

**Business Logic**:
1. Validates PO status
2. Creates purchase receipt
3. Adds inventory to stock
4. Updates product costs
5. Creates accounts payable entry
6. Updates PO status

---

## Customer & Supplier APIs

### 1. List Customers
**GET** `/api/customers`

**File**: `src/app/api/customers/route.ts`

**Query Parameters**:
- `search` - Search by name, email, phone
- `page` - Page number
- `limit` - Items per page

**Permission**: `CUSTOMER_VIEW`

---

### 2. Create Customer
**POST** `/api/customers`

**File**: `src/app/api/customers/route.ts`

**Request Body**:
```json
{
  "name": "John Doe",
  "email": "john@example.com",
  "phone": "123-456-7890",
  "address": "123 Main St",
  "creditLimit": 10000.00
}
```

**Permission**: `CUSTOMER_CREATE`

---

### 3. List Suppliers
**GET** `/api/suppliers`

**File**: `src/app/api/suppliers/route.ts`

**Permission**: `SUPPLIER_VIEW`

---

### 4. Create Supplier
**POST** `/api/suppliers`

**File**: `src/app/api/suppliers/route.ts`

**Request Body**:
```json
{
  "name": "Supplier Inc",
  "email": "supplier@example.com",
  "phone": "123-456-7890",
  "address": "456 Supplier Rd",
  "terms": "Net 30"
}
```

**Permission**: `SUPPLIER_CREATE`

---

## Inventory APIs

### 1. List Transfers
**GET** `/api/transfers`

Retrieves inventory transfer requests.

**File**: `src/app/api/transfers/route.ts`

**Query Parameters**:
- `status` - Filter by status
- `fromLocationId` - Filter by source location
- `toLocationId` - Filter by destination location

**Response**:
```json
{
  "data": [
    {
      "id": "clx...",
      "transferNumber": "TR-0001",
      "fromLocation": { "name": "Warehouse" },
      "toLocation": { "name": "Retail Store" },
      "status": "pending",
      "items": []
    }
  ]
}
```

**Permission**: `INVENTORY_TRANSFER`

---

### 2. Create Transfer
**POST** `/api/transfers`

Creates inventory transfer request.

**File**: `src/app/api/transfers/route.ts`

**Request Body**:
```json
{
  "fromLocationId": 1,
  "toLocationId": 2,
  "items": [
    {
      "productId": "clx...",
      "variationId": "clx...",
      "quantity": 50
    }
  ],
  "notes": ""
}
```

**Permission**: `INVENTORY_TRANSFER`

---

### 3. Send Transfer
**POST** `/api/transfers/[id]/send`

Marks transfer as sent (deducts from source location).

**File**: `src/app/api/transfers/[id]/send/route.ts`

**Permission**: `INVENTORY_TRANSFER`

---

### 4. Receive Transfer
**POST** `/api/transfers/[id]/receive`

Receives transfer (adds to destination location).

**File**: `src/app/api/transfers/[id]/receive/route.ts`

**Permission**: `INVENTORY_TRANSFER`

---

## Report APIs

### 1. Sales Report
**GET** `/api/reports/sales`

**File**: `src/app/api/reports/sales/route.ts`

**Query Parameters**:
- `startDate` - Report start date
- `endDate` - Report end date
- `locationId` - Filter by location
- `groupBy` - Group by (day/week/month)

**Permission**: `REPORT_SALES`

---

### 2. Profit & Loss Report
**GET** `/api/reports/profit-loss`

**File**: `src/app/api/reports/profit-loss/route.ts`

**Query Parameters**:
- `startDate` - Period start
- `endDate` - Period end
- `locationId` - Filter by location

**Permission**: `REPORT_FINANCIAL`

---

### 3. Inventory Valuation
**GET** `/api/reports/inventory-valuation`

**File**: `src/app/api/reports/inventory-valuation/route.ts`

**Query Parameters**:
- `locationId` - Filter by location
- `asOfDate` - Valuation date

**Permission**: `REPORT_INVENTORY`

---

### 4. Accounts Receivable
**GET** `/api/reports/accounts-receivable`

**File**: `src/app/api/reports/accounts-receivable/route.ts`

**Query Parameters**:
- `customerId` - Filter by customer
- `agingBuckets` - Show aging analysis

**Permission**: `REPORT_CUSTOMER_PAYMENTS`

---

## User & Role APIs

### 1. List Users
**GET** `/api/users`

**File**: `src/app/api/users/route.ts`

**Permission**: `USER_VIEW`

---

### 2. Create User
**POST** `/api/users`

**File**: `src/app/api/users/route.ts`

**Request Body**:
```json
{
  "username": "newuser",
  "password": "securepassword",
  "firstName": "John",
  "lastName": "Doe",
  "email": "john@example.com",
  "roleIds": ["clx..."],
  "locationIds": [1, 2]
}
```

**Permission**: `USER_CREATE`

---

### 3. List Roles
**GET** `/api/roles`

**File**: `src/app/api/roles/route.ts`

**Permission**: `ROLE_VIEW`

---

### 4. Create Role
**POST** `/api/roles`

**File**: `src/app/api/roles/route.ts`

**Request Body**:
```json
{
  "name": "Store Manager",
  "description": "Manages retail store operations",
  "permissionIds": ["clx...", "clx..."]
}
```

**Permission**: `ROLE_CREATE`

---

## Dashboard APIs

### 1. Dashboard Statistics
**GET** `/api/dashboard/stats`

**File**: `src/app/api/dashboard/stats/route.ts`

**Response**:
```json
{
  "data": {
    "todaySales": 5000.00,
    "todayTransactions": 25,
    "lowStockProducts": 12,
    "pendingOrders": 5
  }
}
```

**Permission**: `DASHBOARD_VIEW`

---

### 2. Analytics Data
**GET** `/api/dashboard/analytics`

**File**: `src/app/api/dashboard/analytics/route.ts`

**Response**:
```json
{
  "data": {
    "salesChart": [],
    "topProducts": [],
    "topCustomers": []
  }
}
```

**Permission**: `DASHBOARD_VIEW`

---

## Settings APIs

### 1. Get Business Settings
**GET** `/api/business/settings`

**File**: `src/app/api/business/settings/route.ts`

**Permission**: Admin only

---

### 2. Update Business Settings
**PUT** `/api/business/settings`

**File**: `src/app/api/business/settings/route.ts`

**Permission**: Admin only

---

### 3. List Locations
**GET** `/api/locations`

**File**: `src/app/api/locations/route.ts`

**Permission**: `USER_VIEW`

---

### 4. Create Location
**POST** `/api/locations`

**File**: `src/app/api/locations/route.ts`

**Request Body**:
```json
{
  "name": "Retail Store",
  "address": "789 Store Ave",
  "phone": "123-456-7890",
  "isActive": true
}
```

**Permission**: `USER_VIEW` (Admin)

---

## Error Handling

All API routes follow consistent error handling:

```typescript
try {
  // Business logic
} catch (error) {
  console.error("Error:", error);
  return NextResponse.json(
    { error: "Internal server error" },
    { status: 500 }
  );
}
```

Common errors:
- `401 Unauthorized` - No session/invalid token
- `403 Forbidden` - Lacks required permission
- `404 Not Found` - Resource doesn't exist
- `400 Bad Request` - Validation failed
- `500 Internal Server Error` - Unexpected error

---

## Multi-Tenant Data Isolation

**CRITICAL**: All API routes must filter by `businessId`:

```typescript
const session = await getServerSession(authOptions);
const businessId = session.user.businessId;

// Always include businessId in queries
const products = await prisma.product.findMany({
  where: { businessId } // REQUIRED
});
```

---

## Rate Limiting

Currently not implemented. Consider adding rate limiting for:
- Login attempts (prevent brute force)
- API calls (prevent abuse)
- Export operations (prevent server overload)

---

## Testing APIs

### Using Postman/Insomnia

1. Login via browser to get session cookie
2. Copy cookie from browser DevTools
3. Add cookie to Postman/Insomnia request headers
4. Make API requests

### Using cURL

```bash
# Example: Get products
curl -X GET http://localhost:3000/api/products \
  -H "Cookie: next-auth.session-token=YOUR_TOKEN"
```

---

**Generated**: 2025-11-12
**Version**: 1.0
**Project**: Igoro Tech(IT) Inventory Management System
