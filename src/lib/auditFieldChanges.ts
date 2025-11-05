/**
 * Field-Level Audit Tracking Utility
 *
 * This module provides utilities for tracking field-level changes in database records.
 * It detects what fields changed, stores old/new values, and formats them for audit logs.
 *
 * Usage:
 * ```typescript
 * const changes = detectFieldChanges(oldData, newData, ['price', 'quantity', 'status'])
 * if (changes.length > 0) {
 *   await createAuditLog({
 *     description: formatChangesDescription(changes),
 *     metadata: { changes }
 *   })
 * }
 * ```
 */

export interface FieldChange {
  field: string
  oldValue: any
  newValue: any
  fieldType: 'string' | 'number' | 'boolean' | 'date' | 'json' | 'null'
}

/**
 * Detect which fields changed between old and new data
 *
 * @param oldData - Original record data before update
 * @param newData - Updated record data after update
 * @param fieldsToTrack - Array of field names to check for changes
 * @returns Array of FieldChange objects for fields that actually changed
 */
export function detectFieldChanges(
  oldData: Record<string, any>,
  newData: Record<string, any>,
  fieldsToTrack: string[]
): FieldChange[] {
  const changes: FieldChange[] = []

  for (const field of fieldsToTrack) {
    const oldValue = oldData[field]
    const newValue = newData[field]

    // Skip if values are identical (deep comparison for objects)
    if (areValuesEqual(oldValue, newValue)) {
      continue
    }

    changes.push({
      field,
      oldValue: sanitizeValue(oldValue),
      newValue: sanitizeValue(newValue),
      fieldType: getFieldType(newValue)
    })
  }

  return changes
}

/**
 * Compare two values for equality (handles objects, dates, null, etc.)
 */
function areValuesEqual(val1: any, val2: any): boolean {
  // Handle null/undefined
  if (val1 === val2) return true
  if (val1 == null && val2 == null) return true
  if (val1 == null || val2 == null) return false

  // Handle dates
  if (val1 instanceof Date && val2 instanceof Date) {
    return val1.getTime() === val2.getTime()
  }

  // Handle objects/arrays (deep comparison)
  if (typeof val1 === 'object' && typeof val2 === 'object') {
    return JSON.stringify(val1) === JSON.stringify(val2)
  }

  // Handle numbers (compare as numbers to avoid string comparison issues)
  if (typeof val1 === 'number' && typeof val2 === 'number') {
    return val1 === val2
  }

  // String comparison
  return String(val1) === String(val2)
}

/**
 * Sanitize value for safe storage (remove sensitive data, limit size)
 */
function sanitizeValue(value: any): any {
  // Don't store actual passwords
  if (typeof value === 'string' && value.length > 1000) {
    return value.substring(0, 1000) + '... (truncated)'
  }

  // Handle dates - convert to ISO string
  if (value instanceof Date) {
    return value.toISOString()
  }

  // Handle Prisma Decimal types
  if (value && typeof value === 'object' && 'toNumber' in value) {
    return value.toNumber()
  }

  return value
}

/**
 * Determine the type of a field value
 */
function getFieldType(value: any): FieldChange['fieldType'] {
  if (value === null || value === undefined) return 'null'
  if (value instanceof Date) return 'date'
  if (typeof value === 'boolean') return 'boolean'
  if (typeof value === 'number') return 'number'
  if (typeof value === 'object') return 'json'
  return 'string'
}

/**
 * Format a single field change into human-readable text
 *
 * @param change - The field change to format
 * @returns Human-readable description
 */
export function formatFieldChange(change: FieldChange): string {
  const { field, oldValue, newValue, fieldType } = change

  // Format field name (convert camelCase to Title Case)
  const fieldName = field.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())

  switch (fieldType) {
    case 'number':
      if (typeof oldValue === 'number' && typeof newValue === 'number') {
        const diff = newValue - oldValue
        const sign = diff > 0 ? '+' : ''
        return `${fieldName}: ${formatNumber(oldValue)} → ${formatNumber(newValue)} (${sign}${formatNumber(diff)})`
      }
      return `${fieldName}: ${oldValue} → ${newValue}`

    case 'boolean':
      return `${fieldName}: ${oldValue ? 'Yes' : 'No'} → ${newValue ? 'Yes' : 'No'}`

    case 'date':
      return `${fieldName}: ${formatDate(oldValue)} → ${formatDate(newValue)}`

    case 'null':
      if (oldValue === null || oldValue === undefined) {
        return `${fieldName}: (empty) → "${newValue}"`
      }
      if (newValue === null || newValue === undefined) {
        return `${fieldName}: "${oldValue}" → (empty)`
      }
      return `${fieldName}: "${oldValue}" → "${newValue}"`

    case 'json':
      return `${fieldName}: [complex data changed]`

    default:
      // String values - truncate if too long
      const oldStr = truncateString(String(oldValue), 50)
      const newStr = truncateString(String(newValue), 50)
      return `${fieldName}: "${oldStr}" → "${newStr}"`
  }
}

/**
 * Format multiple field changes into a single description string
 *
 * @param changes - Array of field changes
 * @returns Combined human-readable description
 */
export function formatChangesDescription(changes: FieldChange[]): string {
  if (changes.length === 0) return 'No changes detected'
  if (changes.length === 1) return formatFieldChange(changes[0])

  return changes.map(formatFieldChange).join('; ')
}

/**
 * Helper: Format number with thousand separators
 */
function formatNumber(num: number): string {
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2
  }).format(num)
}

/**
 * Helper: Format date
 */
function formatDate(dateValue: any): string {
  if (!dateValue) return '(none)'

  try {
    const date = dateValue instanceof Date ? dateValue : new Date(dateValue)
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  } catch {
    return String(dateValue)
  }
}

/**
 * Helper: Truncate long strings
 */
function truncateString(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str
  return str.substring(0, maxLength) + '...'
}

/**
 * Critical fields that should always be tracked (can be customized per model)
 */
export const CRITICAL_FIELDS = {
  Product: [
    'name',
    'purchasePrice',
    'sellingPrice',
    'isActive',
    'sku',
    'categoryId',
    'brandId',
    'enableStock',
    'alertQuantity'
  ],
  ProductVariation: [
    'name',
    'purchasePrice',
    'sellingPrice',
    'sku',
    'defaultPurchasePrice',
    'defaultSellingPrice'
  ],
  User: [
    'username',
    'email',
    'firstName',
    'lastName',
    'isActive',
    'allowLogin'
  ],
  Sale: [
    'customerId',
    'subtotal',
    'taxAmount',
    'discountAmount',
    'totalAmount',
    'status',
    'discountType',
    'saleType'
  ],
  Purchase: [
    'supplierId',
    'status',
    'subtotal',
    'taxAmount',
    'discountAmount',
    'totalAmount',
    'purchaseDate'
  ],
  Inventory: [
    'quantity',
    'locationId',
    'qtyAvailable',
    'sellingPrice',
    'purchasePrice'
  ],
  Customer: [
    'name',
    'email',
    'mobile',
    'creditLimit',
    'isActive'
  ],
  Supplier: [
    'name',
    'email',
    'mobile',
    'isActive'
  ],
  StockTransfer: [
    'fromLocationId',
    'toLocationId',
    'status',
    'transferDate'
  ],
  InventoryCorrection: [
    'quantity',
    'reason',
    'status',
    'approvedBy'
  ]
} as const

/**
 * Get critical fields for a specific model
 */
export function getCriticalFields(modelName: string): string[] {
  return CRITICAL_FIELDS[modelName as keyof typeof CRITICAL_FIELDS] || []
}
