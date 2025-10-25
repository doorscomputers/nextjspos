# pos-warehouse-bin-organizer

## Purpose
Manages warehouse bin locations (aisle, rack, shelf) for efficient picking and putaway.

## Implementation
```typescript
interface BinLocation {
  warehouseId: number
  aisle: string      // "A", "B", "C"
  rack: string       // "01", "02", "03"
  shelf: string      // "1", "2", "3"
  binCode: string    // "A-01-1"
  capacity: number
}

// Assign product to bin
await prisma.variationBinLocation.create({
  data: {
    variationId,
    locationId,
    binCode: 'A-01-1',
    quantity: 100
  }
})

// Picking list with bin locations
const pickingList = await generatePickingList(saleId)
// Output: [{ product: "Widget", qty: 5, bin: "A-01-1" }, ...]

// Optimize picking route
function optimizePickingRoute(items: PickingItem[]) {
  // Sort by aisle, then rack, then shelf
  return items.sort((a, b) => {
    if (a.aisle !== b.aisle) return a.aisle.localeCompare(b.aisle)
    if (a.rack !== b.rack) return a.rack.localeCompare(b.rack)
    return a.shelf.localeCompare(b.shelf)
  })
}
```
