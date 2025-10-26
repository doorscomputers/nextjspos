---
name: pos-syncfusion-component-wrapper
description: Wraps Syncfusion components with consistent theming and configuration.
---

# pos-syncfusion-component-wrapper

## Purpose
Wraps Syncfusion components with consistent theming and configuration.

## Usage
```typescript
import { GridComponent } from '@syncfusion/ej2-react-grids'

export function StandardGrid({ dataSource, columns }) {
  return (
    <GridComponent
      dataSource={dataSource}
      allowPaging={true}
      allowSorting={true}
      allowFiltering={true}
      filterSettings={{ type: 'Excel' }}
    >
      {columns}
    </GridComponent>
  )
}
```
