import { prisma } from './prisma'
import { Prisma } from '@prisma/client'

type TransactionClient = Prisma.TransactionClient

/**
 * Generates atomic, race-condition-free invoice numbers
 * Uses database sequences to ensure uniqueness
 */
export async function getNextInvoiceNumber(
  businessId: number,
  tx?: TransactionClient
): Promise<string> {
  const client = tx ?? prisma
  const year = new Date().getFullYear()
  const month = new Date().getMonth() + 1

  // Atomic upsert with increment
  const seq = await client.$queryRaw<{ sequence: number }[]>(
    Prisma.sql`
      INSERT INTO invoice_sequences (business_id, year, month, sequence)
      VALUES (${businessId}, ${year}, ${month}, 1)
      ON CONFLICT (business_id, year, month)
      DO UPDATE SET sequence = invoice_sequences.sequence + 1
      RETURNING sequence
    `
  )

  const sequence = seq[0]?.sequence ?? 1
  return `INV-${year}${String(month).padStart(2, '0')}-${String(sequence).padStart(4, '0')}`
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
