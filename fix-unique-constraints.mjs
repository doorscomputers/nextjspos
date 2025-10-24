import fs from 'fs'

const schemaPath = 'prisma/schema.prisma'
let schema = fs.readFileSync(schemaPath, 'utf-8')

// Patterns to fix: Remove @unique and add @@unique([businessId, fieldName])
const fieldsToFix = [
  { model: 'StockTransfer', field: 'transferNumber', line: 'transferNumber String @unique' },
  { model: 'Purchase', field: 'purchaseOrderNumber', line: 'purchaseOrderNumber String @unique' },
  { model: 'SupplierReturn', field: 'returnNumber', line: 'returnNumber String   @unique' },
  { model: 'PurchaseReturn', field: 'returnNumber', line: 'returnNumber String   @unique' },
  { model: 'SupplierPayment', field: 'paymentNumber', line: 'paymentNumber String   @unique' },
  { model: 'CashierShift', field: 'shiftNumber', line: 'shiftNumber String    @unique' },
  { model: 'Quotation', field: 'quotationNumber', line: 'quotationNumber String    @unique' },
  { model: 'WarrantyClaim', field: 'claimNumber', line: 'claimNumber      String   @unique' },
  { model: 'QualityControlInspection', field: 'inspectionNumber', line: 'inspectionNumber String   @unique' },
  { model: 'SupplierDebitNote', field: 'debitNoteNumber', line: 'debitNoteNumber String   @unique' }
]

console.log('Fixing unique constraints in Prisma schema...\n')

fieldsToFix.forEach(({ model, field, line }) => {
  const uniquePattern = new RegExp(`(${field}\\s+String\\s+)@unique`, 'g')
  const beforeCount = (schema.match(uniquePattern) || []).length

  // Remove @unique from the field
  schema = schema.replace(uniquePattern, `$1`)

  const afterCount = (schema.match(uniquePattern) || []).length

  if (beforeCount > afterCount) {
    console.log(`✓ Removed @unique from ${model}.${field}`)
  }
})

console.log('\nSaving changes to schema...')
fs.writeFileSync(schemaPath, schema)
console.log('✓ Schema updated successfully!')

console.log('\nNext step: Manually add @@unique constraints to each model')
console.log('Run the add-composite-unique.mjs script next')
