# Export Features Implementation Guide

## 🎯 What Was Implemented

### 1. **Export Utilities Library**
Created a comprehensive export utilities module at `src/lib/exportUtils.ts` with support for:
- **CSV Export** - Comma-separated values with proper escaping
- **Excel Export** - Using XLSX library with formatted worksheets
- **PDF Export** - Using jsPDF with auto-table for professional PDF documents
- **Print** - Opens a print-friendly window with styled table

### 2. **Column-Aware Exports**
All export functions respect the **visible columns** feature:
- Only exports columns that are currently visible in the table
- Excludes the "Actions" column from exports (not relevant for data export)
- Maintains column order as displayed

### 3. **Products Page Integration**
Added 4 export buttons to the Products page:
- Export CSV
- Export Excel
- Print
- Export PDF

**Location:** Right above the product table, alongside the items-per-page selector

### 4. **Actions Column Repositioned**
Moved the Actions column to be **second** (right after Product Name) for better usability

---

## 📚 Libraries Used

```json
{
  "xlsx": "^0.18.5",           // Excel file generation
  "jspdf": "^2.5.2",            // PDF generation
  "jspdf-autotable": "^3.8.3"  // PDF table formatting
}
```

---

## 🛠️ Export Functions API

### **exportToCSV(options: ExportOptions)**

Exports data to a CSV file with proper escaping for commas, quotes, and newlines.

```typescript
exportToCSV({
  filename: 'products',
  columns: [
    { id: 'name', label: 'Product Name', getValue: (p) => p.name },
    { id: 'price', label: 'Price', getValue: (p) => p.price }
  ],
  data: products,
  title: 'Products' // Optional
})
```

**Features:**
- Automatic escaping of special characters
- Header row with column labels
- Downloads as `.csv` file

---

### **exportToExcel(options: ExportOptions)**

Exports data to an Excel (.xlsx) file with formatting.

```typescript
exportToExcel({
  filename: 'products',
  columns: [
    { id: 'name', label: 'Product Name', getValue: (p) => p.name },
    { id: 'price', label: 'Price', getValue: (p) => p.price }
  ],
  data: products,
  title: 'Products' // Optional - used as sheet name
})
```

**Features:**
- Professional Excel format (.xlsx)
- Auto-sized columns (minimum 15 characters)
- Header row formatting
- Downloads immediately

---

### **exportToPDF(options: ExportOptions)**

Exports data to a PDF file with styled table.

```typescript
exportToPDF({
  filename: 'products',
  columns: [
    { id: 'name', label: 'Product Name', getValue: (p) => p.name },
    { id: 'price', label: 'Price', getValue: (p) => p.price }
  ],
  data: products,
  title: 'Products Export' // Optional - shown as title
})
```

**Features:**
- Auto-detects orientation (landscape for >8 columns, portrait otherwise)
- Blue header row
- Alternating row colors for readability
- Professional formatting
- Automatic page breaks

---

### **printTable(options: ExportOptions)**

Opens a print dialog with a print-friendly view.

```typescript
printTable({
  filename: 'products',
  columns: [
    { id: 'name', label: 'Product Name', getValue: (p) => p.name },
    { id: 'price', label: 'Price', getValue: (p) => p.price }
  ],
  data: products,
  title: 'Products' // Optional - shown as heading
})
```

**Features:**
- Opens in new window
- Print-optimized CSS
- Automatic print dialog
- Window closes after print
- Avoids page breaks in table rows

---

## 💡 How It Works

### **Column Definition**

The export system uses a column mapping that transforms table columns into exportable data:

```typescript
const getExportColumns = (): ExportColumn[] => {
  const columnMap: Record<string, ExportColumn> = {
    product: {
      id: 'product',
      label: 'Product',
      getValue: (p: Product) => p.name
    },
    price: {
      id: 'price',
      label: 'Price',
      getValue: (p: Product) => `$${p.price.toFixed(2)}`
    },
    // ... more columns
  }

  // Return only visible columns, excluding 'actions'
  return visibleColumns
    .filter(colId => colId !== 'actions' && columnMap[colId])
    .map(colId => columnMap[colId])
}
```

**Key Points:**
- `getValue` function transforms raw data into display format
- Only includes visible columns
- Excludes non-data columns like "actions"
- Maintains column order from visibility state

---

### **Export Handlers**

Each export button triggers a handler that:
1. Gets current visible columns
2. Uses filtered/searched data (not paginated - exports ALL matching data)
3. Calls appropriate export function
4. Shows success toast

```typescript
const handleExportCSV = () => {
  exportToCSV({
    filename: 'products',
    columns: getExportColumns(),
    data: filteredProducts, // All filtered data, not just current page
    title: 'Products'
  })
  toast.success('Products exported to CSV')
}
```

---

## 🎨 UI Implementation

### **Export Buttons Layout**

```tsx
<div className="flex items-center gap-2">
  <button onClick={handleExportCSV} className="...">
    <DocumentTextIcon className="w-4 h-4" />
    <span className="hidden sm:inline">Export CSV</span>
  </button>

  <button onClick={handleExportExcel} className="...">
    <DocumentArrowDownIcon className="w-4 h-4" />
    <span className="hidden sm:inline">Export Excel</span>
  </button>

  <button onClick={handlePrint} className="...">
    <PrinterIcon className="w-4 h-4" />
    <span className="hidden sm:inline">Print</span>
  </button>

  <button onClick={handleExportPDF} className="...">
    <DocumentTextIcon className="w-4 h-4" />
    <span className="hidden sm:inline">Export PDF</span>
  </button>
</div>
```

**Features:**
- Icon + text on desktop
- Icon only on mobile (responsive)
- Hover effects
- Consistent styling with app theme

---

## 📋 Adding Exports to Other Pages

### **Step 1: Import Dependencies**

```typescript
import { exportToCSV, exportToExcel, exportToPDF, printTable, ExportColumn } from '@/lib/exportUtils'
import { DocumentArrowDownIcon, PrinterIcon, DocumentTextIcon } from '@heroicons/react/24/outline'
```

### **Step 2: Define Column Mapping**

```typescript
const getExportColumns = (): ExportColumn[] => {
  const columnMap: Record<string, ExportColumn> = {
    columnId1: {
      id: 'columnId1',
      label: 'Column Label',
      getValue: (row: YourDataType) => row.field
    },
    columnId2: {
      id: 'columnId2',
      label: 'Another Column',
      getValue: (row: YourDataType) => row.anotherField
    },
    // ... more columns
  }

  // If you have column visibility:
  return visibleColumns
    .filter(colId => colId !== 'actions' && columnMap[colId])
    .map(colId => columnMap[colId])

  // If no column visibility, return all columns:
  return Object.values(columnMap)
}
```

### **Step 3: Add Export Handlers**

```typescript
const handleExportCSV = () => {
  exportToCSV({
    filename: 'your-data',
    columns: getExportColumns(),
    data: yourFilteredData,
    title: 'Your Data Title'
  })
  toast.success('Data exported to CSV')
}

const handleExportExcel = () => {
  exportToExcel({
    filename: 'your-data',
    columns: getExportColumns(),
    data: yourFilteredData,
    title: 'Your Data Title'
  })
  toast.success('Data exported to Excel')
}

const handleExportPDF = () => {
  exportToPDF({
    filename: 'your-data',
    columns: getExportColumns(),
    data: yourFilteredData,
    title: 'Your Data Title'
  })
  toast.success('Data exported to PDF')
}

const handlePrint = () => {
  printTable({
    filename: 'your-data',
    columns: getExportColumns(),
    data: yourFilteredData,
    title: 'Your Data Title'
  })
}
```

### **Step 4: Add Export Buttons to UI**

```tsx
<div className="flex items-center gap-2">
  <button onClick={handleExportCSV} className="px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center gap-2">
    <DocumentTextIcon className="w-4 h-4" />
    <span className="hidden sm:inline">Export CSV</span>
  </button>

  <button onClick={handleExportExcel} className="px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center gap-2">
    <DocumentArrowDownIcon className="w-4 h-4" />
    <span className="hidden sm:inline">Export Excel</span>
  </button>

  <button onClick={handlePrint} className="px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center gap-2">
    <PrinterIcon className="w-4 h-4" />
    <span className="hidden sm:inline">Print</span>
  </button>

  <button onClick={handleExportPDF} className="px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center gap-2">
    <DocumentTextIcon className="w-4 h-4" />
    <span className="hidden sm:inline">Export PDF</span>
  </button>
</div>
```

---

## ✅ Best Practices

### **DO:**
- ✅ Export filtered/searched data, not just current page
- ✅ Exclude action columns from exports
- ✅ Format values appropriately (e.g., add $ for prices)
- ✅ Use descriptive filenames
- ✅ Show success toasts after export
- ✅ Handle null/undefined values gracefully

### **DON'T:**
- ❌ Export only the current page (users expect all data)
- ❌ Include UI-specific columns (like Actions, Checkboxes)
- ❌ Use generic filenames like "export.csv"
- ❌ Export raw data without formatting
- ❌ Forget to handle missing data

---

## 🎨 Customization Options

### **Custom Column Widths (Excel)**

```typescript
// Modify in exportUtils.ts
const colWidths = columns.map(col => ({
  wch: col.id === 'description' ? 50 : 15 // Wide column for descriptions
}))
```

### **Custom PDF Styles**

```typescript
// Modify in exportUtils.ts
headStyles: {
  fillColor: [34, 197, 94], // Green instead of blue
  fontSize: 10,
  fontStyle: 'bold'
}
```

### **Custom CSV Delimiter**

```typescript
// Change comma to semicolon or tab
const csvContent = [
  headers.join(';'),
  ...rows.map(row => row.join(';'))
].join('\n')
```

---

## 📱 Responsive Design

Export buttons are responsive:
- **Desktop:** Icon + text label
- **Mobile:** Icon only (text hidden with `hidden sm:inline`)
- **Tooltips:** Use `title` attribute for mobile users

---

## 🚀 Future Enhancements

**1. Batch Export Options**
```typescript
// Export all formats at once
const handleExportAll = () => {
  handleExportCSV()
  handleExportExcel()
  handleExportPDF()
  toast.success('Exported in all formats')
}
```

**2. Custom Export Configuration**
```typescript
// Let users choose which columns to export
<ExportConfigModal
  columns={availableColumns}
  onExport={(selectedColumns, format) => {
    // Export with selected columns
  }}
/>
```

**3. Scheduled Exports**
```typescript
// Export data automatically (e.g., daily reports)
const scheduleExport = (frequency: 'daily' | 'weekly') => {
  // Schedule background export
}
```

**4. Email Exports**
```typescript
// Email exported file instead of downloading
const handleEmailExport = async (email: string) => {
  const data = generateExport()
  await sendEmail(email, data)
}
```

---

## 🧪 Testing Checklist

- [x] CSV export works with visible columns
- [x] Excel export formats properly
- [x] PDF export handles many columns (landscape mode)
- [x] Print opens new window and prints
- [x] Export respects search/filter
- [x] Export includes all filtered data (not just current page)
- [x] Actions column excluded from exports
- [x] Success toasts shown
- [x] Files download with correct names
- [x] Special characters handled (CSV escaping)
- [x] Null values handled gracefully
- [x] Responsive on mobile (icons only)

---

## 📂 Files Modified/Created

### **New Files:**
- `src/lib/exportUtils.ts` - Export utility functions

### **Modified Files:**
- `src/app/dashboard/products/page.tsx` - Added export buttons and handlers
- `package.json` - Added xlsx, jspdf, jspdf-autotable dependencies

### **Dependencies Installed:**
```bash
npm install xlsx jspdf jspdf-autotable
```

---

## 🎓 Example Usage

### **Simple Export (All Data)**

```typescript
import { exportToCSV } from '@/lib/exportUtils'

const data = [
  { name: 'Product 1', price: 100 },
  { name: 'Product 2', price: 200 }
]

exportToCSV({
  filename: 'products',
  columns: [
    { id: 'name', label: 'Name', getValue: (d) => d.name },
    { id: 'price', label: 'Price', getValue: (d) => `$${d.price}` }
  ],
  data: data
})
```

### **Export with Column Visibility**

```typescript
const visibleColumns = ['name', 'price'] // From column visibility state

const getExportColumns = () => {
  const allColumns = {
    name: { id: 'name', label: 'Name', getValue: (d) => d.name },
    price: { id: 'price', label: 'Price', getValue: (d) => `$${d.price}` },
    stock: { id: 'stock', label: 'Stock', getValue: (d) => d.stock }
  }

  return visibleColumns
    .filter(id => allColumns[id])
    .map(id => allColumns[id])
}

exportToExcel({
  filename: 'products',
  columns: getExportColumns(), // Only visible columns
  data: filteredProducts
})
```

---

## 📝 Summary

✅ **Implemented:**
- Export to CSV, Excel, PDF
- Print functionality
- Column-aware exports (respects visibility)
- Actions column moved to second position
- Responsive export buttons
- Success notifications

✅ **Respects:**
- Column visibility settings
- Search/filter state
- Data formatting

✅ **Ready to use:**
- Products page fully functional
- Easy to add to other pages
- Professional export quality

🎉 **All export features are complete and tested!**
