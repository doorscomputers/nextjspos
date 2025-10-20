# DevExtreme Export Functionality - Technical Information

## 📄 DevExtreme License File

**File Location:** `src/devextreme-license.js`

**Content:**
```javascript
import config from 'devextreme/core/config'

// Configure DevExtreme license
config({
  licenseKey: 'b88d1754d700e49a'
})
```

---

## 📦 DevExtreme Packages Used

**From package.json:**
- `devextreme`: 25.1
- `devextreme-react`: 25.1

---

## 🔧 Where License is Initialized

**File:** `src/app/providers.tsx`

The license is imported at the application root level:
```typescript
import "@/devextreme-license" // DevExtreme commercial license configuration
```

---

## 📊 DevExtreme Components Used for Export

### 1. **Data Grid Exports** (Excel & PDF)
Used in multiple pages:

#### Branch Stock Pivot Report
**File:** `src/app/dashboard/products/branch-stock-pivot-v2/page.tsx`

**Imports:**
```typescript
import DataGrid, {
  Column,
  Export,
  FilterRow,
  HeaderFilter,
  SearchPanel,
  Paging,
  Grouping,
  GroupPanel,
  Summary,
  TotalItem,
  GroupItem
} from 'devextreme-react/data-grid'

import { exportDataGrid as exportToExcel } from 'devextreme/excel_exporter'
import { exportDataGrid as exportToPDF } from 'devextreme/pdf_exporter'
import { Workbook } from 'exceljs'
import { saveAs } from 'file-saver'
import { jsPDF } from 'jspdf'
```

#### Transfer Exports
**File:** `src/app/dashboard/transfers/[id]/ExportTransfers/page.tsx`

**Imports:**
```typescript
import DataGrid, {
  Column,
  Export,
  Summary,
  TotalItem
} from 'devextreme-react/data-grid'

import { exportDataGrid as exportToExcel } from 'devextreme/excel_exporter'
import { exportDataGrid as exportToPDF } from 'devextreme/pdf_exporter'
import { Workbook } from 'exceljs'
import { saveAs } from 'file-saver'
import { jsPDF } from 'jspdf'
```

#### Purchases Report
**File:** `src/app/dashboard/reports/purchases-devextreme/page.tsx`

**Imports:**
```typescript
import DataGrid, {
  Column,
  Export,
  FilterRow,
  Paging,
  Grouping,
  GroupPanel,
  Summary,
  TotalItem,
  GroupItem
} from 'devextreme-react/data-grid'
```

---

### 2. **Charts** (with Export functionality)
**File:** `src/app/dashboard/analytics-devextreme/page.tsx`

**Imports:**
```typescript
// Bar/Line Charts
import {
  Chart,
  Series,
  CommonSeriesSettings,
  Legend,
  Export as ChartExport,
  Title,
  Tooltip,
  ArgumentAxis,
  ValueAxis,
  Label
} from 'devextreme-react/chart'

// Pie Charts
import PieChart, {
  Series as PieSeries,
  Legend as PieLegend,
  Export as PieExport,
  Label as PieLabel
} from 'devextreme-react/pie-chart'
```

---

## 🎯 Export Features Implemented

### Excel Export
- Uses `exportDataGrid` from `devextreme/excel_exporter`
- Utilizes `exceljs` library for workbook creation
- Saves files using `file-saver` library

### PDF Export
- Uses `exportDataGrid` from `devextreme/pdf_exporter`
- Utilizes `jspdf` library for PDF generation
- Supports custom formatting and styling

### Chart Export
- Built-in export functionality for charts
- Supports PNG, SVG, PDF formats
- Configurable export button in chart UI

---

## 📋 Related Dependencies

**From package.json:**
```json
{
  "devextreme": "25.1",
  "devextreme-react": "25.1",
  "exceljs": "^4.3.0",
  "file-saver": "^2.0.5",
  "jspdf": "^2.5.1"
}
```

---

## 🔍 Pages Using DevExtreme Export

1. **Branch Stock Pivot Report**
   - Path: `/dashboard/products/branch-stock-pivot-v2`
   - Features: Excel export, PDF export, Data grid with grouping

2. **Transfer Details Export**
   - Path: `/dashboard/transfers/[id]/ExportTransfers`
   - Features: Excel export, PDF export

3. **Purchases Report**
   - Path: `/dashboard/reports/purchases-devextreme`
   - Features: Data grid with export, grouping, filtering

4. **Analytics Dashboard**
   - Path: `/dashboard/analytics-devextreme`
   - Features: Chart exports (PNG, SVG, PDF)

---

## ⚙️ Typical Export Code Pattern

### Excel Export Example:
```typescript
const onExportExcel = useCallback(() => {
  const workbook = new Workbook()
  const worksheet = workbook.addWorksheet('Main sheet')

  exportToExcel({
    component: dataGridRef.current.instance,
    worksheet,
    autoFilterEnabled: true,
  }).then(() => {
    workbook.xlsx.writeBuffer().then((buffer) => {
      saveAs(
        new Blob([buffer], { type: 'application/octet-stream' }),
        'DataGrid.xlsx'
      )
    })
  })
}, [])
```

### PDF Export Example:
```typescript
const onExportPdf = useCallback(() => {
  const doc = new jsPDF()

  exportToPDF({
    jsPDFDocument: doc,
    component: dataGridRef.current.instance,
  }).then(() => {
    doc.save('DataGrid.pdf')
  })
}, [])
```

---

## 🐛 Common Issues & Solutions

### Issue 1: License Key Not Working
**Symptom:** Warning message about missing or invalid license
**Solution:** Ensure `devextreme-license.js` is imported in `providers.tsx`

### Issue 2: Export Button Not Showing
**Symptom:** Export functionality not visible in DataGrid
**Solution:** Add `<Export enabled={true} />` component inside DataGrid

### Issue 3: Excel Export Empty
**Symptom:** Excel file downloads but is empty or corrupted
**Solution:** Check if dataGridRef is properly initialized and has data

### Issue 4: PDF Export Formatting Issues
**Symptom:** PDF layout doesn't match screen display
**Solution:** Customize export options in `exportToPDF` configuration

---

## 📦 Files to Share with Tech Support

If your tech support needs the complete setup:

1. **License File:**
   - `src/devextreme-license.js`

2. **Provider Setup:**
   - `src/app/providers.tsx` (lines with DevExtreme import)

3. **Example Export Implementation:**
   - `src/app/dashboard/products/branch-stock-pivot-v2/page.tsx`
   - `src/app/dashboard/transfers/[id]/ExportTransfers/page.tsx`

4. **Package Configuration:**
   - `package.json` (DevExtreme-related dependencies)

---

## 💡 Additional Notes

- DevExtreme v25.1 is the latest version being used
- License key: `b88d1754d700e49a`
- License is configured globally via `providers.tsx`
- Export functionality requires both DevExtreme components and third-party libraries (exceljs, jspdf)
- All export pages use React hooks pattern with useRef for DataGrid access

---

**Created:** 2025-10-19
**DevExtreme Version:** 25.1
**License Status:** ✅ Configured
**Export Features:** Excel, PDF, Chart (PNG/SVG/PDF)
