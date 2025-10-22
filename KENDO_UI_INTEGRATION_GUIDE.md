# Kendo UI for React - Integration Guide

This guide explains how to use Kendo UI for React in the UltimatePOS Modern application.

## Overview

Kendo UI for React has been integrated into the application with the complete commercial suite, providing access to professional-grade components including:

- **Data Grid** - Advanced data tables with sorting, filtering, grouping, virtualization
- **Charts** - Various chart types for data visualization
- **Scheduler** - Calendar and scheduling components
- **Form Controls** - Inputs, dropdowns, date/time pickers
- **Layout Components** - Dialogs, windows, drawers, panels
- **Navigation** - Menus, breadcrumbs, tabs
- And many more enterprise-ready components

## Installation

The following packages have been installed:

```bash
npm install @progress/kendo-react-all @progress/kendo-theme-default @progress/kendo-licensing
```

### Packages Installed:
- `@progress/kendo-react-all` - Complete Kendo UI component suite
- `@progress/kendo-theme-default` - Default Kendo UI theme
- `@progress/kendo-licensing` - License validation

## License Setup

### Step 1: Obtain Your License Key

1. Go to [Telerik Account Portal](https://www.telerik.com/account/)
2. Navigate to "Licenses & Downloads"
3. Find your Kendo UI license key
4. Copy the entire license key string

### Step 2: Add License (Choose ONE method)

**Method 1: Environment Variable (Recommended)**

1. Open your `.env` file (or create one if it doesn't exist)
2. Add the following line:
   ```
   KENDO_UI_LICENSE=your-license-key-here
   ```
3. Replace `your-license-key-here` with your actual license key

**Method 2: License File**

1. Create a file named `kendo-license.txt` in the project root directory
2. Paste your license key into the file (should be a single line)
3. Save the file

Example license format:
```
eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...rest-of-your-license-key...
```

### Step 3: Restart Development Server

```bash
npm run dev
```

The license will be automatically loaded and validated when the app starts.

**Note**: Environment variable method is recommended because:
- Easier to manage in deployment environments
- Works better with Docker and cloud platforms
- No risk of accidentally committing license files

## License Validation

The application includes automatic license validation:

### Server-Side
- Located in: `src/lib/kendo-license.ts`
- Reads license from `kendo-license.txt` file
- Validates on application startup

### Client-Side
- Component: `src/components/KendoLicenseProvider.tsx`
- API Endpoint: `src/app/api/kendo-license/route.ts`
- Fetches license via API and activates it in the browser

### Checking License Status

Visit the demo page to check if your license is properly activated:
- URL: `http://localhost:3000/dashboard/kendo-demo`
- The page displays license status at the top
- Green checkmark = License valid
- Warning = No license file found

## Using Kendo Components

### Basic Example - Button

```tsx
'use client';

import { Button } from '@progress/kendo-react-buttons';

export default function MyComponent() {
  return (
    <Button themeColor="primary" onClick={() => alert('Clicked!')}>
      Click Me
    </Button>
  );
}
```

### Example - Data Grid

```tsx
'use client';

import { Grid, GridColumn as Column } from '@progress/kendo-react-grid';

const data = [
  { id: 1, name: 'Product A', price: 100 },
  { id: 2, name: 'Product B', price: 200 },
];

export default function ProductGrid() {
  return (
    <Grid data={data} style={{ height: '400px' }}>
      <Column field="id" title="ID" width="100px" />
      <Column field="name" title="Name" width="200px" />
      <Column field="price" title="Price" format="{0:c2}" />
    </Grid>
  );
}
```

### Example - Form Controls

```tsx
'use client';

import { Input } from '@progress/kendo-react-inputs';
import { DatePicker } from '@progress/kendo-react-dateinputs';
import { DropDownList } from '@progress/kendo-react-dropdowns';
import { useState } from 'react';

export default function MyForm() {
  const [name, setName] = useState('');
  const [date, setDate] = useState(null);
  const [category, setCategory] = useState('Electronics');

  return (
    <div className="space-y-4">
      <Input
        label="Product Name"
        value={name}
        onChange={(e) => setName(e.value)}
      />

      <DatePicker
        label="Date"
        value={date}
        onChange={(e) => setDate(e.value)}
      />

      <DropDownList
        label="Category"
        data={['Electronics', 'Furniture', 'Stationery']}
        value={category}
        onChange={(e) => setCategory(e.value)}
      />
    </div>
  );
}
```

## Theme Customization

The default Kendo theme is imported in `src/app/layout.tsx`:

```tsx
import "@progress/kendo-theme-default/dist/all.css";
```

### Available Themes

You can switch to other themes by installing and importing them:

```bash
# Material theme
npm install @progress/kendo-theme-material
import "@progress/kendo-theme-material/dist/all.css";

# Bootstrap theme
npm install @progress/kendo-theme-bootstrap
import "@progress/kendo-theme-bootstrap/dist/all.css";
```

## Demo Page

A comprehensive demo page is available at:
- **Path**: `src/app/dashboard/kendo-demo/page.tsx`
- **URL**: `http://localhost:3000/dashboard/kendo-demo`

The demo page showcases:
- License validation status
- Data Grid with sorting
- Input components
- DropDownList
- DatePicker
- Buttons
- Dialog (Modal)

## Integration Points

### Files Modified/Created

1. **Layout** - `src/app/layout.tsx`
   - Added Kendo theme CSS import
   - Added KendoLicenseProvider wrapper

2. **License Configuration** - `src/lib/kendo-license.ts`
   - Server-side license initialization
   - Client-side license activation

3. **License Provider** - `src/components/KendoLicenseProvider.tsx`
   - Client component for license activation

4. **License API** - `src/app/api/kendo-license/route.ts`
   - Serves license to client-side

5. **Demo Page** - `src/app/dashboard/kendo-demo/page.tsx`
   - Validation and demonstration page

6. **Git Ignore** - `.gitignore`
   - Added `kendo-license.txt` to prevent committing licenses

## Best Practices

### 1. License Security
- Never commit `kendo-license.txt` to version control
- Each developer should use their own license key
- Store license securely

### 2. Component Usage
- Always import from specific packages for better tree-shaking
- Use TypeScript for better type safety
- Mark components as 'use client' when using Kendo components

### 3. Performance
- Use virtualization for large datasets
- Implement pagination for grids with many rows
- Lazy load components when possible

### 4. Theming
- Use Kendo's built-in themes for consistency
- Customize via CSS variables if needed
- Test in both light and dark modes

## Troubleshooting

### License Not Loading

**Problem**: Warning message "No License Found"

**Solution**:
1. Verify `kendo-license.txt` exists in project root
2. Check the file contains the license key (no extra spaces/newlines)
3. Restart the development server
4. Check browser console for errors

### Theme Conflicts

**Problem**: Kendo components look unstyled

**Solution**:
1. Verify theme CSS is imported in `src/app/layout.tsx`
2. Check that the import is before any custom styles
3. Clear browser cache and rebuild

### TypeScript Errors

**Problem**: TypeScript errors when using Kendo components

**Solution**:
1. Run `npx prisma generate` to update types
2. Check that `@progress/kendo-react-all` is installed
3. Restart TypeScript server in your IDE

## Resources

- [Kendo UI for React Documentation](https://www.telerik.com/kendo-react-ui/components/)
- [Kendo UI for React Demos](https://www.telerik.com/kendo-react-ui/components/grid/)
- [Telerik Support Portal](https://www.telerik.com/account/support-tickets)
- [Kendo UI for React GitHub](https://github.com/telerik/kendo-react)

## Support

For issues specific to the integration:
- Check the demo page: `/dashboard/kendo-demo`
- Review this guide
- Check console for errors

For Kendo UI specific issues:
- Visit Telerik's support portal
- Check the official documentation
- Review Kendo UI for React examples

## Next Steps

1. **Add Navigation Link**: Add a menu item in `src/components/Sidebar.tsx` to access the demo page
2. **Create Custom Components**: Build reusable Kendo-based components for your app
3. **Replace Existing Components**: Gradually migrate existing components to Kendo UI
4. **Customize Themes**: Adjust themes to match your brand colors
5. **Optimize Performance**: Implement virtualization for large datasets

---

**Last Updated**: January 2025
**Kendo UI Version**: Latest
**Next.js Version**: 15.x
