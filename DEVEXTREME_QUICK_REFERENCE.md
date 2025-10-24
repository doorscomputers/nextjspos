# DevExtreme Form Components - Quick Reference

A quick reference guide for using DevExtreme components in the UltimatePOS system.

---

## SelectBox (Dropdown)

### Basic Usage
```tsx
import { SelectBox } from 'devextreme-react/select-box'
import { Validator, RequiredRule } from 'devextreme-react/validator'

<SelectBox
  dataSource={items}
  displayExpr="name"
  valueExpr="id"
  value={selectedId}
  onValueChanged={(e) => setSelectedId(e.value)}
  placeholder="Select item"
  stylingMode="outlined"
>
  <Validator>
    <RequiredRule message="This field is required" />
  </Validator>
</SelectBox>
```

### With Search
```tsx
<SelectBox
  dataSource={items}
  displayExpr="name"
  valueExpr="id"
  value={selectedId}
  onValueChanged={(e) => setSelectedId(e.value)}
  searchEnabled={true}
  searchMode="contains"
  searchExpr={['name', 'email', 'code']}
  placeholder="Select item"
  showClearButton={true}
  stylingMode="outlined"
/>
```

### Custom Display
```tsx
<SelectBox
  dataSource={users}
  displayExpr={(item) => item ? `${item.firstName} ${item.lastName}` : ''}
  valueExpr="id"
  value={userId}
  onValueChanged={(e) => setUserId(e.value)}
  itemRender={(item) => (
    <div>
      <div className="font-medium">{item.firstName} {item.lastName}</div>
      <div className="text-xs text-gray-500">{item.email}</div>
    </div>
  )}
/>
```

---

## DateBox (Date & Time Pickers)

### Date Picker
```tsx
import { DateBox } from 'devextreme-react/date-box'

<DateBox
  type="date"
  value={date}
  onValueChanged={(e) => setDate(e.value)}
  displayFormat="MM/dd/yyyy"
  stylingMode="outlined"
  showClearButton={true}
  useMaskBehavior={true}
>
  <Validator>
    <RequiredRule message="Date is required" />
  </Validator>
</DateBox>
```

### Time Picker
```tsx
<DateBox
  type="time"
  value={time}
  onValueChanged={(e) => setTime(e.value)}
  displayFormat="hh:mm a"
  pickerType="rollers"
  stylingMode="outlined"
  showClearButton={true}
/>
```

### DateTime Picker
```tsx
<DateBox
  type="datetime"
  value={datetime}
  onValueChanged={(e) => setDatetime(e.value)}
  displayFormat="MM/dd/yyyy hh:mm a"
  stylingMode="outlined"
/>
```

### With Min/Max Constraints
```tsx
<DateBox
  type="date"
  value={endDate}
  onValueChanged={(e) => setEndDate(e.value)}
  min={startDate}
  max={new Date(2030, 11, 31)}
  stylingMode="outlined"
/>
```

---

## CheckBox

```tsx
import { CheckBox } from 'devextreme-react/check-box'

<CheckBox
  value={isActive}
  onValueChanged={(e) => setIsActive(e.value)}
  text="Active"
/>
```

---

## TextArea

```tsx
import { TextArea } from 'devextreme-react/text-area'

<TextArea
  value={notes}
  onValueChanged={(e) => setNotes(e.value)}
  height={90}
  placeholder="Enter notes..."
  stylingMode="outlined"
/>
```

---

## TextBox (Input)

```tsx
import { TextBox } from 'devextreme-react/text-box'

<TextBox
  value={name}
  onValueChanged={(e) => setName(e.value)}
  placeholder="Enter name"
  stylingMode="outlined"
  showClearButton={true}
>
  <Validator>
    <RequiredRule message="Name is required" />
  </Validator>
</TextBox>
```

---

## NumberBox

```tsx
import { NumberBox } from 'devextreme-react/number-box'

<NumberBox
  value={quantity}
  onValueChanged={(e) => setQuantity(e.value)}
  min={0}
  max={1000}
  showSpinButtons={true}
  stylingMode="outlined"
/>
```

---

## Button

```tsx
import { Button } from 'devextreme-react/button'

// Primary Button
<Button
  text="Submit"
  type="default"
  stylingMode="contained"
  onClick={handleSubmit}
  disabled={submitting}
/>

// Secondary Button
<Button
  text="Cancel"
  type="normal"
  stylingMode="outlined"
  onClick={handleCancel}
/>

// Danger Button
<Button
  text="Delete"
  type="danger"
  stylingMode="contained"
  onClick={handleDelete}
/>

// With Icon
<Button
  icon="save"
  text="Save"
  type="default"
  stylingMode="contained"
  onClick={handleSave}
/>
```

---

## LoadPanel

```tsx
import { LoadPanel } from 'devextreme-react/load-panel'

<LoadPanel
  visible={loading}
  message="Loading..."
  showIndicator={true}
  showPane={true}
  shading={true}
  shadingColor="rgba(0,0,0,0.4)"
/>
```

---

## DataGrid (Table)

```tsx
import DataGrid, { Column, Paging, FilterRow, Export } from 'devextreme-react/data-grid'

<DataGrid
  dataSource={data}
  showBorders={true}
  columnAutoWidth={true}
  rowAlternationEnabled={true}
>
  <FilterRow visible={true} />
  <Paging defaultPageSize={10} />
  <Export enabled={true} formats={['xlsx', 'pdf']} />

  <Column dataField="id" caption="ID" width={80} />
  <Column dataField="name" caption="Name" />
  <Column dataField="email" caption="Email" />
  <Column dataField="price" caption="Price" format="currency" />
</DataGrid>
```

---

## Validation Rules

### RequiredRule
```tsx
<Validator>
  <RequiredRule message="This field is required" />
</Validator>
```

### EmailRule
```tsx
<Validator>
  <EmailRule message="Invalid email address" />
</Validator>
```

### NumericRule
```tsx
<Validator>
  <NumericRule message="Must be a number" />
</Validator>
```

### RangeRule
```tsx
<Validator>
  <RangeRule min={0} max={100} message="Value must be between 0 and 100" />
</Validator>
```

### PatternRule
```tsx
<Validator>
  <PatternRule pattern={/^\d{3}-\d{3}-\d{4}$/} message="Invalid phone format" />
</Validator>
```

### CustomRule
```tsx
const validatePassword = () => {
  return password === confirmPassword
}

<Validator>
  <CustomRule
    message="Passwords must match"
    validationCallback={validatePassword}
  />
</Validator>
```

### CompareRule
```tsx
<Validator>
  <CompareRule
    comparisonTarget={() => password}
    message="Passwords must match"
  />
</Validator>
```

---

## Styling Modes

DevExtreme components support three styling modes:

1. **outlined** (recommended for forms)
   ```tsx
   stylingMode="outlined"
   ```

2. **filled**
   ```tsx
   stylingMode="filled"
   ```

3. **underlined**
   ```tsx
   stylingMode="underlined"
   ```

---

## Common Patterns

### Form with Validation
```tsx
const handleSubmit = async () => {
  // DevExtreme will automatically validate before this runs
  const response = await fetch('/api/endpoint', {
    method: 'POST',
    body: JSON.stringify(formData)
  })
}

<div className="space-y-4">
  <TextBox value={name} onValueChanged={(e) => setName(e.value)}>
    <Validator>
      <RequiredRule message="Name is required" />
    </Validator>
  </TextBox>

  <Button text="Submit" onClick={handleSubmit} />
</div>
```

### Loading State
```tsx
const [loading, setLoading] = useState(false)

const fetchData = async () => {
  setLoading(true)
  try {
    // fetch data
  } finally {
    setLoading(false)
  }
}

<LoadPanel visible={loading} message="Loading..." />
```

### Master-Detail Dropdown
```tsx
const [categoryId, setCategoryId] = useState(null)
const [productId, setProductId] = useState(null)

<SelectBox
  dataSource={categories}
  value={categoryId}
  onValueChanged={(e) => {
    setCategoryId(e.value)
    setProductId(null) // Reset dependent field
  }}
/>

<SelectBox
  dataSource={products.filter(p => p.categoryId === categoryId)}
  value={productId}
  onValueChanged={(e) => setProductId(e.value)}
  disabled={!categoryId}
/>
```

---

## Dark Mode Support

DevExtreme provides built-in dark mode support. Import the dark theme:

```tsx
// For dark mode only
import 'devextreme/dist/css/dx.dark.css'

// For light mode only
import 'devextreme/dist/css/dx.light.css'
```

For dynamic theme switching, use DevExtreme's theme system:
```tsx
import themes from 'devextreme/ui/themes'

// Switch to dark theme
themes.current('generic.dark')

// Switch to light theme
themes.current('generic.light')
```

---

## Mobile Optimization

### Responsive Widths
```tsx
<SelectBox
  width="100%"  // Full width on all devices
/>

<SelectBox
  width={300}  // Fixed width in pixels
/>
```

### Mobile-Friendly Time Picker
```tsx
<DateBox
  type="time"
  pickerType="rollers"  // Uses native-like rollers on mobile
/>
```

### Touch-Optimized
All DevExtreme components are touch-optimized by default. No additional configuration needed.

---

## TypeScript Types

```tsx
import { SelectBox } from 'devextreme-react/select-box'
import { ValueChangedEvent } from 'devextreme/ui/select_box'

interface User {
  id: number
  name: string
  email: string
}

const [userId, setUserId] = useState<number | null>(null)

<SelectBox
  dataSource={users}
  valueExpr="id"
  value={userId}
  onValueChanged={(e: ValueChangedEvent) => setUserId(e.value)}
/>
```

---

## CSS Import Locations

### Page-Level Import (Recommended)
```tsx
// At the top of your page component
import 'devextreme/dist/css/dx.light.css'
```

### Global Import
```tsx
// In app/layout.tsx or _app.tsx
import 'devextreme/dist/css/dx.light.css'
```

---

## Common Props

Most DevExtreme components support these common props:

| Prop | Type | Description |
|------|------|-------------|
| `value` | any | Current value |
| `onValueChanged` | function | Value change handler |
| `disabled` | boolean | Disable the component |
| `readOnly` | boolean | Make read-only |
| `placeholder` | string | Placeholder text |
| `stylingMode` | string | Styling mode (outlined, filled, underlined) |
| `width` | number/string | Width (100%, 300px, etc.) |
| `height` | number/string | Height |
| `showClearButton` | boolean | Show clear button |
| `isValid` | boolean | Validation state |
| `validationError` | object | Validation error |

---

## Export Functionality

### Export to Excel
```tsx
import { exportDataGrid } from 'devextreme/excel_exporter'
import { Workbook } from 'exceljs'
import { saveAs } from 'file-saver'

const handleExport = () => {
  const workbook = new Workbook()
  const worksheet = workbook.addWorksheet('Data')

  exportDataGrid({
    component: dataGridRef.current.instance,
    worksheet,
  }).then(() => {
    workbook.xlsx.writeBuffer().then((buffer) => {
      saveAs(new Blob([buffer]), 'data.xlsx')
    })
  })
}
```

### Export to PDF
```tsx
import { exportDataGrid } from 'devextreme/pdf_exporter'
import { jsPDF } from 'jspdf'

const handleExport = () => {
  const doc = new jsPDF()

  exportDataGrid({
    jsPDFDocument: doc,
    component: dataGridRef.current.instance,
  }).then(() => {
    doc.save('data.pdf')
  })
}
```

---

## Resources

- [DevExtreme React Documentation](https://js.devexpress.com/React/Documentation/Guide/React_Components/DevExtreme_React_Components/)
- [API Reference](https://js.devexpress.com/React/Documentation/ApiReference/)
- [Demos](https://js.devexpress.com/Demos/WidgetsGallery/)
- [Support](https://supportcenter.devexpress.com/)

---

## Tips

1. **Always use TypeScript types** for better IDE support
2. **Use `stylingMode="outlined"`** for form consistency
3. **Enable search on large dropdowns** with `searchEnabled={true}`
4. **Add clear buttons** with `showClearButton={true}`
5. **Use LoadPanel** for async operations
6. **Validate with Validator components** instead of manual checks
7. **Set width="100%"** for responsive forms
8. **Use pickerType="rollers"** for mobile time pickers
9. **Import CSS at page level** to avoid global conflicts
10. **Check DevExtreme version** for feature availability

---

**Last Updated**: October 23, 2025
**DevExtreme Version**: Latest
**Framework**: Next.js 15 + React
