import fs from 'fs'

const schemaPath = 'prisma/schema.prisma'
let schema = fs.readFileSync(schemaPath, 'utf-8')

// Models and fields to fix
const fixes = [
  'purchaseOrderNumber String @unique',
  'inspectionNumber String   @unique',
  'returnNumber String   @unique', // PurchaseReturn and SupplierReturn
  'debitNoteNumber String   @unique',
  'paymentNumber String   @unique',
  'shiftNumber String    @unique',
  'quotationNumber String    @unique',
  'claimNumber      String   @unique'
]

console.log('Removing @unique from all number fields...\n')

fixes.forEach(pattern => {
  const regex = new RegExp(pattern.replace(/\s+/g, '\\s+'), 'g')
  const match = schema.match(regex)

  if (match) {
    const field = pattern.split(' ')[0]
    schema = schema.replace(regex, pattern.replace('@unique', '').replace(/\s+/g, ' '))
    console.log(`✓ Removed @unique from ${field}`)
  }
})

console.log('\nSaving changes...')
fs.writeFileSync(schemaPath, schema)
console.log('✓ Done!\n')

console.log('Now you need to manually add @@unique constraints:')
console.log('- Purchase: @@unique([businessId, purchaseOrderNumber])')
console.log('- PurchaseReturn: @@unique([businessId, returnNumber])')
console.log('- SupplierReturn: @@unique([businessId, returnNumber])')
console.log('- SupplierPayment: @@unique([businessId, paymentNumber])')
console.log('- CashierShift: @@unique([businessId, shiftNumber])')
console.log('- Quotation: @@unique([businessId, quotationNumber])')
console.log('- WarrantyClaim: @@unique([businessId, claimNumber])')
console.log('- QualityControlInspection: @@unique([businessId, inspectionNumber])')
console.log('- SupplierDebitNote: @@unique([businessId, debitNoteNumber])')
