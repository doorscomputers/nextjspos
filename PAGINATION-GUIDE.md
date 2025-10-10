# Pagination Implementation Guide

## Overview
This guide explains how to add pagination to any list page in the UltimatePOS Modern application.

## Components Available

### 1. `Pagination` - Main pagination controls
### 2. `ItemsPerPage` - Items per page selector
### 3. `ResultsInfo` - Shows "Showing X to Y of Z items"

All components are in `src/components/Pagination.tsx`

---

## Quick Implementation (3 Steps)

### Step 1: Add State
```typescript
import { useState } from 'react'

const [currentPage, setCurrentPage] = useState(1)
const [itemsPerPage, setItemsPerPage] = useState(25)
```

### Step 2: Calculate Pagination
```typescript
// After filtering your data
const totalItems = filteredData.length
const totalPages = Math.ceil(totalItems / itemsPerPage)
const startIndex = (currentPage - 1) * itemsPerPage
const endIndex = startIndex + itemsPerPage
const paginatedData = filteredData.slice(startIndex, endIndex)

// Reset to page 1 when search/filter changes
useEffect(() => {
  setCurrentPage(1)
}, [searchTerm, selectedFilter])
```

### Step 3: Add Components to UI
```typescript
import Pagination, { ItemsPerPage, ResultsInfo } from '@/components/Pagination'

return (
  <div>
    {/* Above your table */}
    <div className="mb-4 flex items-center justify-between">
      <ResultsInfo
        startIndex={startIndex}
        endIndex={endIndex}
        totalItems={totalItems}
        itemName="products"
      />
      <ItemsPerPage
        value={itemsPerPage}
        onChange={(value) => {
          setItemsPerPage(value)
          setCurrentPage(1)
        }}
      />
    </div>

    {/* Your table with paginatedData instead of filteredData */}
    <table>
      {paginatedData.map(item => (...))}
    </table>

    {/* Below your table */}
    <Pagination
      currentPage={currentPage}
      totalPages={totalPages}
      onPageChange={setCurrentPage}
      className="px-6 py-4 border-t border-gray-200 bg-gray-50"
    />
  </div>
)
```

---

## Full Example: Products List

```typescript
'use client'

import { useState, useEffect } from 'react'
import Pagination, { ItemsPerPage, ResultsInfo } from '@/components/Pagination'

export default function ProductsPage() {
  const [products, setProducts] = useState([])
  const [searchTerm, setSearchTerm] = useState('')

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(25)

  // Reset to page 1 when search changes
  useEffect(() => {
    setCurrentPage(1)
  }, [searchTerm])

  // Filter data
  const filteredProducts = products.filter(p =>
    p.name.toLowerCase().includes(searchTerm.toLowerCase())
  )

  // Paginate
  const totalItems = filteredProducts.length
  const totalPages = Math.ceil(totalItems / itemsPerPage)
  const startIndex = (currentPage - 1) * itemsPerPage
  const endIndex = startIndex + itemsPerPage
  const paginatedProducts = filteredProducts.slice(startIndex, endIndex)

  return (
    <div className="p-6">
      {/* Search */}
      <input
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        placeholder="Search products..."
        className="mb-4 w-full px-4 py-2 border rounded"
      />

      {/* Results info and items per page */}
      <div className="mb-4 flex items-center justify-between">
        <ResultsInfo
          startIndex={startIndex}
          endIndex={endIndex}
          totalItems={totalItems}
          itemName="products"
        />
        <ItemsPerPage
          value={itemsPerPage}
          onChange={(value) => {
            setItemsPerPage(value)
            setCurrentPage(1)
          }}
        />
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg shadow">
        <table className="w-full">
          <thead>
            <tr>
              <th>Name</th>
              <th>SKU</th>
              <th>Price</th>
            </tr>
          </thead>
          <tbody>
            {paginatedProducts.map(product => (
              <tr key={product.id}>
                <td>{product.name}</td>
                <td>{product.sku}</td>
                <td>${product.price}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Pagination */}
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={setCurrentPage}
          className="px-6 py-4 border-t border-gray-200 bg-gray-50"
        />
      </div>
    </div>
  )
}
```

---

## Customization Options

### Items Per Page Options
```typescript
<ItemsPerPage
  value={itemsPerPage}
  onChange={setItemsPerPage}
  options={[5, 10, 20, 50]} // Custom options
/>
```

### Custom Item Name
```typescript
<ResultsInfo
  startIndex={startIndex}
  endIndex={endIndex}
  totalItems={totalItems}
  itemName="customers" // Changes "items" to "customers"
/>
```

### Custom Styling
```typescript
<Pagination
  currentPage={currentPage}
  totalPages={totalPages}
  onPageChange={setCurrentPage}
  className="px-8 py-6 bg-blue-50" // Custom classes
/>
```

---

## Best Practices

✅ **DO:**
- Always reset to page 1 when search/filter changes
- Use reasonable default page size (25-50 items)
- Show total item count for transparency
- Disable Previous/Next buttons at boundaries
- Smooth scroll to top on page change

❌ **DON'T:**
- Load all data at once for large datasets (use server-side pagination)
- Forget to handle empty states
- Show pagination if totalPages <= 1
- Allow invalid page numbers

---

## Server-Side Pagination (Advanced)

For datasets with thousands of records, implement server-side pagination:

```typescript
// Frontend
const fetchData = async (page: number, limit: number) => {
  const res = await fetch(`/api/products?page=${page}&limit=${limit}`)
  const data = await res.json()
  setProducts(data.items)
  setTotalItems(data.total) // Server returns total count
}

// Backend (example)
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const page = parseInt(searchParams.get('page') || '1')
  const limit = parseInt(searchParams.get('limit') || '25')
  const skip = (page - 1) * limit

  const [items, total] = await Promise.all([
    prisma.product.findMany({
      skip,
      take: limit,
      where: { businessId }
    }),
    prisma.product.count({ where: { businessId } })
  ])

  return NextResponse.json({ items, total, page, limit })
}
```

---

## Migration Checklist

To add pagination to existing list pages:

- [ ] Add pagination state (currentPage, itemsPerPage)
- [ ] Calculate totalPages, startIndex, endIndex
- [ ] Slice data to get paginatedData
- [ ] Replace full list with paginatedData in render
- [ ] Add ResultsInfo above table
- [ ] Add ItemsPerPage selector
- [ ] Add Pagination component below table
- [ ] Add useEffect to reset page on filter changes
- [ ] Test with large datasets (100+ items)
- [ ] Test search/filter interaction
- [ ] Test edge cases (0 items, 1 item, exactly 1 page)

---

## Ready-to-Copy Template

```typescript
// 1. State
const [currentPage, setCurrentPage] = useState(1)
const [itemsPerPage, setItemsPerPage] = useState(25)

// 2. Reset on filter change
useEffect(() => {
  setCurrentPage(1)
}, [searchTerm, selectedFilter])

// 3. Calculate
const totalItems = filteredData.length
const totalPages = Math.ceil(totalItems / itemsPerPage)
const startIndex = (currentPage - 1) * itemsPerPage
const endIndex = startIndex + itemsPerPage
const paginatedData = filteredData.slice(startIndex, endIndex)

// 4. UI (inside return statement)
<div className="mb-4 flex items-center justify-between">
  <ResultsInfo startIndex={startIndex} endIndex={endIndex} totalItems={totalItems} />
  <ItemsPerPage value={itemsPerPage} onChange={(v) => { setItemsPerPage(v); setCurrentPage(1) }} />
</div>

{/* Your table using paginatedData */}

<Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} />
```

---

## Testing Your Implementation

1. ✅ Page 1 shows first N items
2. ✅ Page 2 shows next N items
3. ✅ Previous button disabled on page 1
4. ✅ Next button disabled on last page
5. ✅ Changing items per page resets to page 1
6. ✅ Searching resets to page 1
7. ✅ Page numbers render correctly
8. ✅ Clicking page number changes data
9. ✅ Scrolls to top on page change
10. ✅ Shows correct "X to Y of Z" info

---

🎉 **You're ready to add pagination to all your lists!**
