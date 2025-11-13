import { prisma } from './prisma'
import { Prisma } from '@prisma/client'

type TransactionClient = Prisma.TransactionClient

/**
 * Generate location name abbreviation for invoice numbering
 * Examples:
 * - "Tuguegarao" -> "Tugue"
 * - "Main Store" -> "Main"
 * - "Manila Branch" -> "Manila"
 * - "Bambang Store" -> "Bambang"
 * - "Quezon City Store" -> "Quezon"
 */
function getLocationAbbreviation(locationName: string): string {
  // Remove common words (Store, Branch, Warehouse, Shop, Outlet)
  const cleanedName = locationName
    .replace(/\b(Store|Branch|Warehouse|Shop|Outlet)\b/gi, '')
    .trim()

  // Split into words and get the first significant word
  const words = cleanedName.split(/\s+/).filter(word => word.length > 0)

  if (words.length === 0) {
    // Fallback to first 5 chars of original name
    return locationName.substring(0, 5).replace(/\s/g, '')
  }

  // Take first word and limit to 7 characters
  // Examples: "Tuguegarao" -> "Tugue", "Main" -> "Main", "Bambang" -> "Bambang"
  const firstWord = words[0]
  return firstWord.substring(0, 7)
}

/**
 * Generates atomic, race-condition-free invoice numbers with DAILY sequences per location
 * Uses database sequences to ensure uniqueness per location per day
 * Format: Inv{LocationName}{MM_DD_YYYY}_####
 * Examples:
 * - Tuguegarao on Nov 13, 2025: InvTugue11_13_2025_0001
 * - Main Store on Nov 13, 2025: InvMain11_13_2025_0001
 * - Bambang on Nov 13, 2025: InvBambang11_13_2025_0001
 * - Tuguegarao on Nov 14, 2025: InvTugue11_14_2025_0001 (resets to 0001)
 */
export async function getNextInvoiceNumber(
  businessId: number,
  locationId: number,
  locationName: string,
  tx?: TransactionClient
): Promise<string> {
  const client = tx ?? prisma
  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth() + 1
  const day = now.getDate()
  const locationAbbrev = getLocationAbbreviation(locationName)

  // Atomic upsert with increment - includes location + date (day level)
  const seq = await client.$queryRaw<{ sequence: number }[]>(
    Prisma.sql`
      INSERT INTO invoice_sequences (business_id, location_id, year, month, day, sequence)
      VALUES (${businessId}, ${locationId}, ${year}, ${month}, ${day}, 1)
      ON CONFLICT (business_id, location_id, year, month, day)
      DO UPDATE SET sequence = invoice_sequences.sequence + 1
      RETURNING sequence
    `
  )

  const sequence = seq[0]?.sequence ?? 1

  // Format: Inv{LocationName}{MM_DD_YYYY}_####
  // Example: InvTugue11_13_2025_0001
  return `Inv${locationAbbrev}${String(month).padStart(2, '0')}_${String(day).padStart(2, '0')}_${year}_${String(sequence).padStart(4, '0')}`
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

/**
 * Generates location-based X/Z Reading receipt numbers
 * Format: Inv{LocationName}{MM_DD_YYYY}_####
 * These use the SAME sequence as regular invoices (shared counter per location per day)
 * Examples:
 * - X Reading at Tuguegarao: InvTugue11_13_2025_0001
 * - Z Reading at Tuguegarao: InvTugue11_13_2025_0002
 * - Sale at Tuguegarao: InvTugue11_13_2025_0003
 */
export async function getNextReadingReceiptNumber(
  businessId: number,
  locationId: number,
  locationName: string,
  tx?: TransactionClient
): Promise<string> {
  // X and Z Readings share the same sequence as sales invoices
  // This ensures continuous numbering and BIR compliance
  return getNextInvoiceNumber(businessId, locationId, locationName, tx)
}
