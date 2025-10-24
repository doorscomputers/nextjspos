import { prisma } from './prisma'
import { Prisma } from '@prisma/client'

type TransactionClient = Prisma.TransactionClient

/**
 * Generate location prefix from location name
 * Examples:
 * - "Tuguegarao" -> "T"
 * - "Main Store" -> "M"
 * - "Manila Branch" -> "MB"
 * - "Quezon City Store" -> "QC"
 */
function getLocationPrefix(locationName: string): string {
  // Remove common words and split by spaces
  const words = locationName
    .replace(/\b(Store|Branch|Warehouse|Shop|Outlet)\b/gi, '')
    .trim()
    .split(/\s+/)
    .filter(word => word.length > 0)

  if (words.length === 0) {
    return 'X' // Fallback
  }

  if (words.length === 1) {
    // Single word: take first letter (e.g., "Tuguegarao" -> "T")
    return words[0][0].toUpperCase()
  }

  // Multiple words: take first letter of each (e.g., "Manila Branch" -> "MB")
  return words
    .map(word => word[0].toUpperCase())
    .join('')
    .substring(0, 3) // Max 3 characters
}

/**
 * Generates atomic, race-condition-free invoice numbers
 * Uses database sequences to ensure uniqueness per location
 * Format: INV{LocationPrefix}-YYYYMM-####
 * Examples:
 * - Tuguegarao: INVT-202510-0001
 * - Main Store: INVM-202510-0001
 */
export async function getNextInvoiceNumber(
  businessId: number,
  locationId: number,
  locationName: string,
  tx?: TransactionClient
): Promise<string> {
  const client = tx ?? prisma
  const year = new Date().getFullYear()
  const month = new Date().getMonth() + 1
  const prefix = getLocationPrefix(locationName)

  // Atomic upsert with increment - now includes locationId
  const seq = await client.$queryRaw<{ sequence: number }[]>(
    Prisma.sql`
      INSERT INTO invoice_sequences (business_id, location_id, year, month, sequence)
      VALUES (${businessId}, ${locationId}, ${year}, ${month}, 1)
      ON CONFLICT (business_id, location_id, year, month)
      DO UPDATE SET sequence = invoice_sequences.sequence + 1
      RETURNING sequence
    `
  )

  const sequence = seq[0]?.sequence ?? 1
  return `INV${prefix}-${year}${String(month).padStart(2, '0')}-${String(sequence).padStart(4, '0')}`
}

/**
 * Generates atomic receipt numbers
 */
export async function getNextReceiptNumber(
  businessId: number,
  tx?: TransactionClient
): Promise<string> {
  const client = tx ?? prisma
  const year = new Date().getFullYear()
  const month = new Date().getMonth() + 1

  const seq = await client.$queryRaw<{ sequence: number }[]>(
    Prisma.sql`
      INSERT INTO receipt_sequences (business_id, year, month, sequence)
      VALUES (${businessId}, ${year}, ${month}, 1)
      ON CONFLICT (business_id, year, month)
      DO UPDATE SET sequence = receipt_sequences.sequence + 1
      RETURNING sequence
    `
  )

  const sequence = seq[0]?.sequence ?? 1
  return `GRN-${year}${String(month).padStart(2, '0')}-${String(sequence).padStart(4, '0')}`
}

/**
 * Generates atomic transfer numbers
 */
export async function getNextTransferNumber(
  businessId: number,
  tx?: TransactionClient
): Promise<string> {
  const client = tx ?? prisma
  const year = new Date().getFullYear()
  const month = new Date().getMonth() + 1

  const seq = await client.$queryRaw<{ sequence: number }[]>(
    Prisma.sql`
      INSERT INTO transfer_sequences (business_id, year, month, sequence)
      VALUES (${businessId}, ${year}, ${month}, 1)
      ON CONFLICT (business_id, year, month)
      DO UPDATE SET sequence = transfer_sequences.sequence + 1
      RETURNING sequence
    `
  )

  const sequence = seq[0]?.sequence ?? 1
  return `TRF-${year}${String(month).padStart(2, '0')}-${String(sequence).padStart(4, '0')}`
}

/**
 * Generates atomic customer return numbers
 */
export async function getNextReturnNumber(
  businessId: number,
  tx?: TransactionClient
): Promise<string> {
  const client = tx ?? prisma
  const year = new Date().getFullYear()
  const month = new Date().getMonth() + 1

  const seq = await client.$queryRaw<{ sequence: number }[]>(
    Prisma.sql`
      INSERT INTO return_sequences (business_id, year, month, sequence)
      VALUES (${businessId}, ${year}, ${month}, 1)
      ON CONFLICT (business_id, year, month)
      DO UPDATE SET sequence = return_sequences.sequence + 1
      RETURNING sequence
    `
  )

  const sequence = seq[0]?.sequence ?? 1
  return `RET-${year}${String(month).padStart(2, '0')}-${String(sequence).padStart(4, '0')}`
}
