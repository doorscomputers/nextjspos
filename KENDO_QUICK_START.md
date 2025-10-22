# Kendo React - Quick Start Guide

## Your License File (.txt from Telerik)

Your license file from Telerik is a `.txt` file that contains your license key.

### How to Set It Up

**Option 1: Copy License from .txt File (Easiest)**

1. Locate your license `.txt` file from Telerik (you downloaded or received it)
2. Open it with Notepad or any text editor
3. Copy the ENTIRE content (it's a long string starting with `eyJ...`)
4. Create a new file in your project root: `kendo-license.txt`
5. Paste the license key
6. Save the file

**Option 2: Add to .env File**

1. Open your `.env` file
2. Add this line:
   ```env
   KENDO_UI_LICENSE="paste-your-license-key-here"
   ```
3. Save the file

### After Setup

```bash
# Restart your dev server
npm run dev

# Then visit this page to verify
http://localhost:3000/dashboard/kendo-demo
```

You should see: **"✓ Valid License Activated"** in green

## Quick Examples

### Example 1: Simple Button

```tsx
'use client';

import { Button } from '@progress/kendo-react-buttons';

export default function MyPage() {
  return (
    <Button
      themeColor="primary"
      onClick={() => alert('Clicked!')}
    >
      Click Me
    </Button>
  );
}
```

### Example 2: Data Grid

```tsx
'use client';

import { Grid, GridColumn } from '@progress/kendo-react-grid';

const products = [
  { id: 1, name: 'Product A', price: 100 },
  { id: 2, name: 'Product B', price: 200 },
];

export default function ProductList() {
  return (
    <Grid data={products} sortable pageable>
      <GridColumn field="id" title="ID" width="100px" />
      <GridColumn field="name" title="Product" />
      <GridColumn field="price" title="Price" format="{0:c2}" />
    </Grid>
  );
}
```

### Example 3: Form with Validation

```tsx
'use client';

import { Form, Field, FormElement } from '@progress/kendo-react-form';
import { Input } from '@progress/kendo-react-inputs';
import { Button } from '@progress/kendo-react-buttons';

const required = (value: any) => value ? "" : "Required";

export default function ProductForm() {
  const handleSubmit = (data: any) => {
    console.log('Submitted:', data);
  };

  return (
    <Form onSubmit={handleSubmit}>
      <Field
        name="productName"
        label="Product Name"
        component={Input}
        validator={required}
      />
      <Button type="submit" themeColor="primary">
        Save
      </Button>
    </Form>
  );
}
```

### Example 4: Dropdown Selector

```tsx
'use client';

import { DropDownList } from '@progress/kendo-react-dropdowns';
import { useState } from 'react';

export default function CategorySelector() {
  const [category, setCategory] = useState('Electronics');

  const categories = ['Electronics', 'Furniture', 'Stationery'];

  return (
    <DropDownList
      data={categories}
      value={category}
      onChange={(e) => setCategory(e.value)}
    />
  );
}
```

### Example 5: Date Picker

```tsx
'use client';

import { DatePicker } from '@progress/kendo-react-dateinputs';
import { useState } from 'react';

export default function DateSelector() {
  const [date, setDate] = useState<Date | null>(new Date());

  return (
    <DatePicker
      value={date}
      onChange={(e) => setDate(e.value)}
      format="yyyy-MM-dd"
    />
  );
}
```

## Common Components

### Data Management
- `Grid` - Data tables with sorting, filtering, paging
- `TreeList` - Hierarchical data
- `ListView` - Custom list layouts

### Inputs
- `Input` - Text input
- `NumericTextBox` - Number input
- `DatePicker` - Date selection
- `TimePicker` - Time selection
- `DropDownList` - Dropdown selector
- `ComboBox` - Searchable dropdown
- `MultiSelect` - Multiple selections

### Buttons & Navigation
- `Button` - Action buttons
- `ButtonGroup` - Grouped buttons
- `Menu` - Navigation menus
- `TabStrip` - Tabs

### Layout
- `Dialog` - Modal dialogs
- `Window` - Floating windows
- `Drawer` - Side drawer
- `Splitter` - Resizable panels

### Charts
- `Chart` - Line, bar, pie, area charts
- `Sparkline` - Mini charts

### Notifications
- `Notification` - Toast messages
- `Tooltip` - Hover tooltips

## Important Notes

### 1. Always Use 'use client'

Kendo components are interactive and need client-side JavaScript:

```tsx
'use client';  // REQUIRED at the top of file

import { Grid } from '@progress/kendo-react-grid';
// ... rest of your code
```

### 2. Import Only What You Need

For better performance:

```tsx
// Good - imports only what's needed
import { Button } from '@progress/kendo-react-buttons';
import { Grid, GridColumn } from '@progress/kendo-react-grid';

// Avoid - imports everything (slower)
import * as Kendo from '@progress/kendo-react-all';
```

### 3. TypeScript Support

All Kendo components are fully typed:

```tsx
import { GridColumn, GridSortChangeEvent } from '@progress/kendo-react-grid';

const handleSort = (e: GridSortChangeEvent) => {
  console.log(e.sort);
};
```

### 4. Styling with Tailwind

You can combine Kendo with Tailwind classes:

```tsx
<div className="p-6 bg-white rounded-lg shadow">
  <Grid data={products}>
    <GridColumn field="name" title="Product" />
  </Grid>
</div>
```

## Troubleshooting

### License Issues

**Problem**: Components show watermarks or trial messages

**Solution**:
1. Check file exists: `ls kendo-license.txt`
2. Check file content (should be long string starting with `eyJ`)
3. Restart dev server: `npm run dev`
4. Visit: `http://localhost:3000/dashboard/kendo-demo`
5. Look for green checkmark in license status

### Console Errors

Check browser console (F12) for errors:
- `✓ Kendo UI license activated` = Working
- `⚠ License not activated` = License file not found

### TypeScript Errors

If you see TypeScript errors:
```bash
# Restart TypeScript server in VS Code
Ctrl+Shift+P → "TypeScript: Restart TS Server"
```

## Resources

- **Demo Page**: http://localhost:3000/dashboard/kendo-demo
- **Full Guide**: See `KENDO_REACT_LICENSE_SETUP.md`
- **Official Docs**: https://www.telerik.com/kendo-react-ui/components/
- **Your Account**: https://www.telerik.com/account/

## Verification Script

Run this anytime to check your setup:

```bash
node verify-kendo-setup.mjs
```

It will tell you:
- If license file exists
- If all packages are installed
- If infrastructure is set up correctly
- What steps you need to take

## Next Steps

1. **Get your license**: Download from Telerik account
2. **Create `kendo-license.txt`**: Paste license key
3. **Restart server**: `npm run dev`
4. **Visit demo page**: Verify green checkmark
5. **Start building**: Use components in your pages

---

**Need Help?**
- Run: `node verify-kendo-setup.mjs`
- Check: `KENDO_REACT_LICENSE_SETUP.md`
- Visit: http://localhost:3000/dashboard/kendo-demo
