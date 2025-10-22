# Telerik Kendo React License Setup Guide

This guide will walk you through setting up your Telerik Kendo React license in the UltimatePOS Modern application.

## Current Status

Your application already has the complete Kendo React infrastructure installed and configured:

### Installed Packages (v12.1.0)
- `@progress/kendo-react-all` - Complete Kendo UI component suite
- `@progress/kendo-licensing` - License management
- `@progress/kendo-theme-default` - Default Kendo UI theme
- Individual component packages (grid, charts, inputs, etc.)

### Infrastructure Files
- **License API**: `src/app/api/kendo-license/route.ts`
- **License Provider**: `src/components/KendoLicenseProvider.tsx`
- **License Utilities**: `src/lib/kendo-license.ts`
- **Demo Page**: `src/app/dashboard/kendo-demo/page.tsx`
- **Example File**: `kendo-license.txt.example`

## Step-by-Step License Setup

### Option 1: License File Method (Recommended for Development)

#### Step 1: Obtain Your License Key

1. Visit [Telerik Account Portal](https://www.telerik.com/account/)
2. Log in with your Telerik credentials
3. Navigate to **"Licenses & Downloads"** or **"Products & Subscriptions"**
4. Find your **Kendo UI for React** license
5. Click **"Download"** or **"View License"**
6. Copy the entire license key (it's a long JWT-like string)

Your license key will look like this:
```
eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJodHRwczovL3d3dy50ZWxlcmlrLmNvbS9rZW5kby11aS1saWNlbnNlIiwiYXVkIjoiaHR0cHM6Ly93d3cudGVsZXJpay5jb20va2VuZG8tdWkiLCJpYXQiOjE2MDM4...more-characters...
```

#### Step 2: Create License File

1. In your project root directory (`C:\xampp\htdocs\ultimatepos-modern\`), create a new file named **`kendo-license.txt`**

   **IMPORTANT**: Remove the `.example` extension - the file must be named exactly `kendo-license.txt`

2. Paste your entire license key into the file as a **single line** with no extra spaces or line breaks

3. Save the file

Example:
```
C:\xampp\htdocs\ultimatepos-modern\kendo-license.txt
```

#### Step 3: Verify File Security

The file is already added to `.gitignore`, so it won't be committed to version control. Verify:

```bash
cat .gitignore | grep kendo
```

You should see:
```
kendo-license.txt
```

#### Step 4: Restart Development Server

```bash
npm run dev
```

Watch the console output. You should see:
```
✓ Kendo UI license found in kendo-license.txt
```

### Option 2: Environment Variable Method (Recommended for Production)

#### Step 1: Add to .env File

Open your `.env` file and add:

```env
# Kendo UI License
KENDO_UI_LICENSE="your-license-key-here"
```

Replace `your-license-key-here` with your actual license key.

#### Step 2: Restart Development Server

```bash
npm run dev
```

Console output should show:
```
✓ Kendo UI license found in environment
```

### Step 5: Verify License Activation

#### Method 1: Visit Demo Page

1. Start your development server if not running:
   ```bash
   npm run dev
   ```

2. Log in to your application

3. Navigate to: `http://localhost:3000/dashboard/kendo-demo`

4. Check the **License Status** section at the top:
   - **Green checkmark** "✓ Valid License Activated" = SUCCESS
   - **Warning** "⚠ No License Found" = License file not detected

#### Method 2: Check Browser Console

1. Open your browser's Developer Tools (F12)
2. Go to the **Console** tab
3. Look for one of these messages:
   - `✓ Kendo UI license activated` = SUCCESS
   - `⚠ Kendo UI license not activated - components will show trial watermark` = License not found

#### Method 3: Check Components

1. On the demo page, observe the Kendo components
2. If you see **watermarks** or **trial messages** on components, the license is not activated
3. If components appear clean without watermarks, the license is working

## Troubleshooting

### Issue 1: "No License Found" Warning

**Symptoms:**
- Console shows: `⚠ No Kendo UI license found`
- Demo page shows warning message
- Components display trial watermarks

**Solutions:**

1. **Check File Name**: Must be exactly `kendo-license.txt` (not `.txt.txt` or `kendo-license.txt.example`)

   ```bash
   ls kendo-license.txt
   ```

2. **Check File Location**: Must be in project root directory

   ```bash
   # From project root
   pwd  # Should show: C:\xampp\htdocs\ultimatepos-modern
   ls kendo-license.txt  # Should exist
   ```

3. **Check File Content**:
   - Open the file
   - Ensure license key is a single line
   - No extra spaces, newlines, or characters
   - License should start with something like `eyJhbGc...`

4. **Check Environment Variable** (if using that method):
   ```bash
   # In .env file
   KENDO_UI_LICENSE="eyJhbGc..."  # Should have quotes
   ```

5. **Restart Server**: After any changes, restart the dev server
   ```bash
   # Stop with Ctrl+C
   npm run dev
   ```

### Issue 2: Components Still Show Watermarks

**Cause**: Client-side license activation failed

**Solutions:**

1. **Clear Browser Cache**:
   - Press Ctrl+Shift+Delete
   - Clear cached files
   - Refresh page (Ctrl+F5)

2. **Check Network Tab**:
   - Open DevTools (F12)
   - Go to Network tab
   - Look for request to `/api/kendo-license`
   - Response should have `{ "license": "eyJ..." }`

3. **Check for JavaScript Errors**:
   - Open Console tab
   - Look for red error messages
   - Share errors if seeking help

### Issue 3: License File Exists but Not Loading

**Solutions:**

1. **Check File Encoding**:
   - File should be UTF-8
   - No BOM (Byte Order Mark)
   - Use a text editor like VS Code to verify

2. **Check File Permissions**:
   ```bash
   ls -la kendo-license.txt
   ```
   File should be readable

3. **Verify API Route**:
   - Visit: `http://localhost:3000/api/kendo-license`
   - Should return JSON with license
   - If 404 error, API route might not be working

### Issue 4: "License Expired" or "Invalid License"

**Cause**: License key is expired or for wrong product

**Solutions:**

1. **Check License Validity**:
   - Log in to Telerik account
   - Verify license is active and not expired
   - Confirm it's for "Kendo UI for React" (not jQuery, Angular, or Vue)

2. **Get New License Key**:
   - Generate new key from Telerik portal
   - Replace in `kendo-license.txt` or `.env`

## Using Kendo Components in Your App

### Basic Pattern for Client Components

All Kendo components must be used in **Client Components** (marked with `'use client'`):

```tsx
'use client';

import { Button } from '@progress/kendo-react-buttons';
import { Grid, GridColumn } from '@progress/kendo-react-grid';

export default function MyPage() {
  return (
    <div>
      <Button themeColor="primary">Click Me</Button>
    </div>
  );
}
```

### Integration with Next.js 15 App Router

#### Example: Product Grid with Server Data

```tsx
'use client';

import { Grid, GridColumn } from '@progress/kendo-react-grid';
import { useEffect, useState } from 'react';

export default function ProductsPage() {
  const [products, setProducts] = useState([]);

  useEffect(() => {
    // Fetch from your API
    fetch('/api/products')
      .then(res => res.json())
      .then(data => setProducts(data));
  }, []);

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Products</h1>

      <Grid
        data={products}
        sortable={true}
        pageable={true}
        pageSize={20}
        style={{ height: '600px' }}
      >
        <GridColumn field="id" title="ID" width="80px" />
        <GridColumn field="name" title="Product Name" />
        <GridColumn field="price" title="Price" format="{0:c2}" />
        <GridColumn field="stock" title="Stock" />
      </Grid>
    </div>
  );
}
```

#### Example: Form with Validation

```tsx
'use client';

import { Form, Field, FormElement } from '@progress/kendo-react-form';
import { Input } from '@progress/kendo-react-inputs';
import { NumericTextBox } from '@progress/kendo-react-inputs';
import { Button } from '@progress/kendo-react-buttons';

const requiredValidator = (value: any) =>
  value ? "" : "This field is required";

export default function ProductForm() {
  const handleSubmit = (data: any) => {
    console.log('Form data:', data);
    // Submit to API
  };

  return (
    <Form
      onSubmit={handleSubmit}
      render={(formRenderProps) => (
        <FormElement className="space-y-4">
          <Field
            name="name"
            label="Product Name"
            component={Input}
            validator={requiredValidator}
          />

          <Field
            name="price"
            label="Price"
            component={NumericTextBox}
            validator={requiredValidator}
          />

          <Button
            themeColor="primary"
            type="submit"
            disabled={!formRenderProps.allowSubmit}
          >
            Save Product
          </Button>
        </FormElement>
      )}
    />
  );
}
```

### Integration with Multi-Tenant Architecture

When using Kendo components with your multi-tenant system:

```tsx
'use client';

import { Grid, GridColumn } from '@progress/kendo-react-grid';
import { useSession } from 'next-auth/react';
import { useEffect, useState } from 'react';

export default function TenantProductsPage() {
  const { data: session } = useSession();
  const [products, setProducts] = useState([]);

  useEffect(() => {
    if (session?.user?.businessId) {
      // Fetch products filtered by businessId
      fetch(`/api/products?businessId=${session.user.businessId}`)
        .then(res => res.json())
        .then(data => setProducts(data));
    }
  }, [session]);

  return (
    <Grid data={products} sortable pageable>
      <GridColumn field="name" title="Product" />
      <GridColumn field="price" title="Price" format="{0:c2}" />
      <GridColumn field="businessLocation.name" title="Location" />
    </Grid>
  );
}
```

## Available Kendo Components

Your installation includes the complete Kendo React suite:

### Data Management
- **Grid** - Advanced data table
- **TreeList** - Hierarchical data display
- **ListView** - Customizable list view
- **Virtual Scroller** - Performance for large lists

### Charts & Visualization
- **Chart** - Line, bar, pie, area charts
- **Sparkline** - Inline mini charts
- **StockChart** - Financial charts

### Form Controls
- **Input** - Text input
- **NumericTextBox** - Number input
- **DatePicker** - Date selection
- **TimePicker** - Time selection
- **DropDownList** - Dropdown selector
- **ComboBox** - Searchable dropdown
- **MultiSelect** - Multiple selections
- **Switch** - Toggle switch
- **Slider** - Range slider

### Layout
- **Dialog** - Modal dialogs
- **Window** - Floating windows
- **TabStrip** - Tabbed interface
- **Drawer** - Side drawer navigation
- **Splitter** - Resizable panels

### Buttons & Navigation
- **Button** - Action buttons
- **ButtonGroup** - Grouped buttons
- **Menu** - Navigation menu
- **Breadcrumb** - Navigation path

### Notifications
- **Notification** - Toast notifications
- **Tooltip** - Hover tooltips

## Theme Customization

The default Kendo theme is already imported in `src/app/layout.tsx`:

```tsx
import "@progress/kendo-theme-default/dist/all.css";
```

### Dark Mode Support

Kendo themes automatically support dark mode when you use CSS variables. For custom styling:

```css
/* In your CSS file */
.k-grid {
  --kendo-color-primary: #3b82f6; /* Custom primary color */
}
```

## Best Practices

### 1. License Security
- Never commit `kendo-license.txt` to Git (already in `.gitignore`)
- Use environment variables in production
- Each developer should have their own license

### 2. Performance
- Use virtualization for grids with 100+ rows
- Implement pagination for large datasets
- Lazy load components when possible

### 3. TypeScript
- Import types from Kendo packages
- Use proper typing for better IDE support
- Example: `import { GridColumn } from '@progress/kendo-react-grid'`

### 4. Styling
- Use Kendo's built-in themes for consistency
- Customize via CSS variables
- Test in both light and dark modes
- Follow CLAUDE.md guidelines (no dark-on-dark, light-on-light)

### 5. Mobile Responsiveness
- Test all Kendo components on mobile
- Use responsive Grid columns
- Consider mobile-friendly date pickers

## Production Deployment

### Using Environment Variables

For production, use environment variables instead of files:

1. In your hosting platform (Vercel, Netlify, etc.):
   - Add environment variable: `KENDO_UI_LICENSE`
   - Set value to your license key

2. The app will automatically use the environment variable

3. No need to deploy `kendo-license.txt` file

## Resources

- [Kendo React Documentation](https://www.telerik.com/kendo-react-ui/components/)
- [Kendo React Grid Guide](https://www.telerik.com/kendo-react-ui/components/grid/)
- [Kendo React API Reference](https://www.telerik.com/kendo-react-ui/components/grid/api/)
- [Telerik Support Portal](https://www.telerik.com/account/support-tickets)
- [Demo Page in Your App](http://localhost:3000/dashboard/kendo-demo)

## Quick Reference

### File Locations
```
C:\xampp\htdocs\ultimatepos-modern\
├── kendo-license.txt              # Your license file (create this)
├── kendo-license.txt.example      # Example template
├── src/
│   ├── app/
│   │   ├── layout.tsx             # Kendo theme imported here
│   │   ├── api/kendo-license/     # License API endpoint
│   │   └── dashboard/kendo-demo/  # Demo page
│   ├── components/
│   │   └── KendoLicenseProvider.tsx  # License provider
│   └── lib/
│       └── kendo-license.ts       # License utilities
└── .env                           # Environment variables
```

### Commands
```bash
# Start development server
npm run dev

# Check if license file exists
ls kendo-license.txt

# View .gitignore
cat .gitignore | grep kendo

# Test API endpoint (in browser or curl)
curl http://localhost:3000/api/kendo-license
```

### Import Statements
```tsx
// Buttons
import { Button } from '@progress/kendo-react-buttons';

// Grid
import { Grid, GridColumn } from '@progress/kendo-react-grid';

// Form
import { Form, Field, FormElement } from '@progress/kendo-react-form';
import { Input } from '@progress/kendo-react-inputs';

// Date
import { DatePicker } from '@progress/kendo-react-dateinputs';

// Dropdown
import { DropDownList } from '@progress/kendo-react-dropdowns';

// Dialog
import { Dialog } from '@progress/kendo-react-dialogs';

// Charts
import { Chart, ChartSeries, ChartSeriesItem } from '@progress/kendo-react-charts';
```

## Next Steps

1. **Obtain your license key** from Telerik portal
2. **Create `kendo-license.txt`** in project root with your license
3. **Restart dev server** with `npm run dev`
4. **Visit demo page** at `http://localhost:3000/dashboard/kendo-demo`
5. **Verify license status** shows green checkmark
6. **Start using components** in your pages

## Support

If you encounter issues:

1. Check this guide's Troubleshooting section
2. Visit the demo page to check license status
3. Check browser console for error messages
4. Review `KENDO_UI_INTEGRATION_GUIDE.md` for more examples
5. Contact Telerik support for license-specific issues

---

**Last Updated**: January 2025
**Kendo React Version**: 12.1.0
**Next.js Version**: 15.5.4
**Documentation**: Complete and ready to use
