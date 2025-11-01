# Phase 2: Server-Side Operations - Implementation Guide

## 🎯 Overview

Phase 2 adds **DevExtreme RemoteOperations** to enable searching, filtering, and sorting across **ALL records** in the database without loading them into memory. This eliminates the 50-record limit from Phase 1.

---

## ✅ What's Been Completed

### 1. Server-Side API for Products ✅
**File**: `src/app/api/products/devextreme/route.ts` (NEW)

This API endpoint supports:
- **Pagination**: `skip` and `take` parameters
- **Sorting**: `sort` and `sortOrder` parameters
- **Searching**: `searchValue`, `searchExpr`, `searchOperation`
- **Filtering**: DevExtreme filter format (JSON)

**Response Format**:
```json
{
  "data": [...],
  "totalCount": 1000
}
```

### 2. DevExtreme CustomStore Utility ✅
**File**: `src/lib/devextreme-custom-store.ts` (NEW)

Reusable utilities:
- `createDevExtremeCustomStore()` - Creates CustomStore with server-side operations
- `createLocalCustomStore()` - Creates in-memory CustomStore for small datasets
- `debounce()` - Debounce function for search inputs

---

## 📝 Implementation Steps

### Step 1: Update Products List Page

Replace the existing fetch logic in `src/app/dashboard/products/list-v2/page.tsx`:

#### Before (Phase 1):
```typescript
const fetchProducts = async () => {
  const response = await fetch('/api/products?page=1&limit=50&fullDetails=true')
  const data = await response.json()
  setProducts(data.products)
  // ... transform data
}
```

#### After (Phase 2):
```typescript
import { createDevExtremeCustomStore } from '@/lib/devextreme-custom-store'

// Create CustomStore (inside component)
const dataSource = useMemo(
  () => createDevExtremeCustomStore('/api/products/devextreme', {
    key: 'id',
    onLoading: () => setLoading(true),
    onLoaded: () => setLoading(false),
    onError: (error) => toast.error('Failed to load products')
  }),
  []
)

// Use in DataGrid
<DataGrid
  ref={dataGridRef}
  dataSource={dataSource}  // <-- Use CustomStore
  ...
>
  {/* Enable Remote Operations */}
  <RemoteOperations
    sorting={true}
    paging={true}
    filtering={true}
  />
  ...
</DataGrid>
```

### Step 2: Create Sales API Endpoint

Create `src/app/api/sales/devextreme/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const skip = parseInt(searchParams.get('skip') || '0')
  const take = Math.min(parseInt(searchParams.get('take') || '50'), 200)

  // Add sorting, filtering, searching logic similar to products API

  const [sales, totalCount] = await Promise.all([
    prisma.sale.findMany({
      where: { businessId: session.user.businessId },
      include: {
        customer: { select: { id: true, name: true, mobile: true } },
        items: { select: { id: true, quantity: true } },
        payments: { select: { id: true, amount: true, paymentMethod: true } }
      },
      skip,
      take
    }),
    prisma.sale.count({ where: { businessId: session.user.businessId } })
  ])

  return NextResponse.json({
    data: sales.map(sale => ({
      id: sale.id,
      invoiceNumber: sale.invoiceNumber,
      saleDate: sale.saleDate,
      customerName: sale.customer?.name || 'Walk-in',
      totalAmount: sale.totalAmount,
      status: sale.status,
      itemCount: sale.items.length
    })),
    totalCount
  })
}
```

### Step 3: Update Sales Page

Update `src/app/dashboard/sales/page.tsx`:

```typescript
import { createDevExtremeCustomStore } from '@/lib/devextreme-custom-store'

const dataSource = useMemo(
  () => createDevExtremeCustomStore('/api/sales/devextreme', {
    key: 'id',
    onLoading: () => setLoading(true),
    onLoaded: () => setLoading(false)
  }),
  []
)

<DataGrid dataSource={dataSource}>
  <RemoteOperations sorting={true} paging={true} filtering={true} />
  <Paging defaultPageSize={50} />
  <SearchPanel visible={true} />
  <FilterRow visible={true} />
  ...
</DataGrid>
```

---

## 🚀 Benefits of Phase 2

| Feature | Phase 1 | Phase 2 |
|---------|---------|---------|
| **Initial Load** | 50 records | 50 records |
| **Search** | Only 50 records | **ALL records** |
| **Filter** | Only 50 records | **ALL records** |
| **Sort** | Only 50 records | **ALL records** |
| **Performance** | Client-side | **Server-side** |
| **Memory Usage** | 50 records in memory | 50 records in memory |
| **Scalability** | Limited to 50 | **Unlimited** |

---

## ⚙️ Advanced Features

### 1. Custom Filters

Add custom filter UI:

```typescript
const handleCategoryFilter = (category: string) => {
  const gridInstance = dataGridRef.current?.instance
  gridInstance?.filter(['category', '=', category])
}
```

### 2. Debounced Search

```typescript
import { debounce } from '@/lib/devextreme-custom-store'

const debouncedSearch = debounce((value: string) => {
  dataGridRef.current?.instance.searchByText(value)
}, 300)
```

### 3. Export All Data

For exporting large datasets:

```typescript
const handleExportAll = async () => {
  const response = await fetch('/api/products/devextreme?take=10000')
  const { data } = await response.json()
  // Export data to Excel
}
```

---

## 🔧 Testing

### Test Server-Side Operations:

1. **Pagination Test**:
   - Open Products page
   - Change page size to 100
   - Navigate to page 2, 3, etc.
   - Verify only 100 records load at a time

2. **Search Test**:
   - Search for a product name
   - Verify results include products beyond the first 50
   - Check network tab: should see API call with searchValue parameter

3. **Filter Test**:
   - Apply column filter (e.g., Category = "Electronics")
   - Verify filter works across ALL products
   - Check network tab: should see API call with filter parameter

4. **Sort Test**:
   - Click column header to sort
   - Verify sorting works across ALL products
   - Check network tab: should see API call with sort parameter

### Performance Benchmarks:

| Operation | Target | Acceptable |
|-----------|--------|------------|
| Initial Load | < 800ms | < 1.5s |
| Search (with 10,000 records) | < 500ms | < 1s |
| Filter | < 500ms | < 1s |
| Sort | < 500ms | < 1s |
| Page Change | < 300ms | < 800ms |

---

## 🐛 Troubleshooting

### Issue: "No data to display"
**Solution**: Check API endpoint returns correct format:
```json
{
  "data": [...],  // Array of records
  "totalCount": 100  // Total number of records
}
```

### Issue: Search not working across all records
**Solution**: Verify `RemoteOperations` is enabled:
```typescript
<RemoteOperations filtering={true} />
```

### Issue: Slow performance
**Solution**:
1. Add database indexes (completed in Phase 1)
2. Reduce `take` parameter (default: 50, max: 200)
3. Add caching to API endpoint

---

## 📊 Phase 2 Summary

**Files Created**:
1. ✅ `src/app/api/products/devextreme/route.ts` - Products server-side API
2. ✅ `src/lib/devextreme-custom-store.ts` - CustomStore utilities

**Files to Update**:
3. ⏳ `src/app/dashboard/products/list-v2/page.tsx` - Use CustomStore
4. ⏳ `src/app/api/sales/devextreme/route.ts` - Create Sales API
5. ⏳ `src/app/dashboard/sales/page.tsx` - Use CustomStore

**Expected Results**:
- Users can search/filter **millions of records** without performance issues
- Initial page load remains **fast** (~800ms)
- Server handles all heavy operations
- Client only renders visible records

---

## 🎉 Next Steps

After completing Phase 2:

### Phase 3 Options:
1. **Report Optimization**: Fix N+1 queries in reports
2. **TanStack Query**: Add client-side caching
3. **Virtual Scrolling**: Implement infinite scroll
4. **Real-time Updates**: Add WebSocket support
5. **Advanced Filtering**: Add date range pickers, multi-select filters

---

## 📝 Notes

- Phase 2 is **backward compatible** - existing code continues to work
- RemoteOperations can be enabled per-grid (no global changes needed)
- API endpoints are **cached** (60s TTL from Phase 1)
- All RBAC permissions are **still enforced**

---

**Phase 2 Implementation Status: 60% Complete**

✅ Server-side API created
✅ CustomStore utility created
⏳ Frontend integration pending
⏳ Sales grid pending
⏳ Testing pending

