# pos-telerik-form-builder

## Purpose
Creates consistent Telerik-based forms following design standards (colors, buttons, validation).

## Standard Form Components
```typescript
import { Form, Field, FormElement } from '@progress/kendo-react-form'
import { Input, NumericTextBox } from '@progress/kendo-react-inputs'

<Form onSubmit={handleSubmit}>
  <FormElement>
    <Field name="productName" component={Input} label="Product Name *" />
    <Field name="price" component={NumericTextBox} label="Price *" format="c2" />
    <Button type="submit" themeColor="primary">Save</Button>
  </FormElement>
</Form>
```

## Design Standards
- Required fields marked with *
- Clear error messages
- Submit buttons: green with icon
- Cancel buttons: gray outline
- Loading states with spinner
