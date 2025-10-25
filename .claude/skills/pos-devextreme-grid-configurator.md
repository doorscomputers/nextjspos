# pos-devextreme-grid-configurator

## Purpose
Provides standardized DevExtreme DataGrid configuration for consistent UI across all list pages.

## Standard Configuration
```typescript
export const standardGridConfig = {
  allowColumnReordering: true,
  allowColumnResizing: true,
  columnAutoWidth: true,
  showBorders: true,
  rowAlternationEnabled: true,
  hoverStateEnabled: true,
  export: { enabled: true },
  filterRow: { visible: true },
  searchPanel: { visible: true, width: 240 },
  paging: { pageSize: 50 },
  pager: {
    visible: true,
    showPageSizeSelector: true,
    allowedPageSizes: [25, 50, 100, 200]
  }
}
```

## Best Practices
- Consistent styling across all grids
- Mobile-responsive
- Dark mode support
- Column state persistence
