# Sales Customer Category - Backfill & Edit

## Tasks
- [x] Add `customerCategory` field to Sale model (previous task)
- [x] Create Sales by Category report (previous task)
- [ ] Run SQL backfill: set all NULL customerCategory to "Walkin Private"
- [ ] Add PATCH endpoint to `src/app/api/sales/[id]/route.ts` for editing customerCategory
- [ ] Update Sales History API to return `customerCategory` in response
- [ ] Add customerCategory column + inline edit dropdown to Sales History DataGrid
- [ ] Verify TypeScript compiles cleanly
- [ ] Commit and push

## Categories
- Walkin Private, Walkin Individual, Walkin Govt, Reseller, Bidding, Negotiated
