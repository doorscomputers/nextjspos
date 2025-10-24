import fs from 'fs'

const schemaPath = 'prisma/schema.prisma'
let schema = fs.readFileSync(schemaPath, 'utf-8')

// Map of model names to their unique constraints
const modelConstraints = {
  'purchases': '@@unique([businessId, purchaseOrderNumber])',
  'purchase_returns': '@@unique([businessId, returnNumber])',
  'supplier_returns': '@@unique([businessId, returnNumber])',
  'supplier_payments': '@@unique([businessId, paymentNumber])',
  'cashier_shifts': '@@unique([businessId, shiftNumber])',
  'quotations': '@@unique([businessId, quotationNumber])',
  'warranty_claims': '@@unique([businessId, claimNumber])',
  'quality_control_inspections': '@@unique([businessId, inspectionNumber])',
  'supplier_debit_notes': '@@unique([businessId, debitNoteNumber])'
}

console.log('Adding @@unique constraints to models...\n')

Object.entries(modelConstraints).forEach(([tableName, constraint]) => {
  // Find the @@map line for this table and add @@unique before it if not already present
  const mapPattern = `@@map("${tableName}")`

  if (schema.includes(mapPattern)) {
    // Check if constraint already exists
    const lines = schema.split('\n')
    const mapIndex = lines.findIndex(line => line.includes(mapPattern))

    if (mapIndex > 0) {
      // Check if the constraint already exists in the previous lines
      const prevLines = lines.slice(Math.max(0, mapIndex - 20), mapIndex).join('\n')

      if (!prevLines.includes(constraint)) {
        // Find the line with @@map and add @@unique before it
        const beforeMap = lines.slice(0, mapIndex)
        const afterMap = lines.slice(mapIndex)

        // Get the indentation from the @@map line
        const indent = lines[mapIndex].match(/^\s*/)[0]

        // Add the constraint
        beforeMap.push(`${indent}${constraint}`)
        schema = [...beforeMap, ...afterMap].join('\n')
        console.log(`✓ Added ${constraint} to ${tableName}`)
      } else {
        console.log(`  ${tableName} already has the constraint`)
      }
    }
  } else {
    console.log(`  Warning: @@map("${tableName}") not found`)
  }
})

console.log('\nSaving changes...')
fs.writeFileSync(schemaPath, schema)
console.log('✓ Done!')
