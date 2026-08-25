/**
 * One-off data correction — 2026-08-25
 *
 * Voids duplicate sale InvMain08_25_2026_0016 at Main Store.
 *
 * Background: the POS offline queue replayed an Aug 24 sale request on
 * Aug 25 12:13 PH, creating this duplicate (same items as the real sale
 * InvMain08_24_2026_0023: EPSON 0031 BLACK + EPSON 0034 YELLOW, ₱630 cash,
 * sale_date Aug 24) attached to shift 805. It inflated shift 805's expected
 * cash by ₱630 (cashier counted "short") and appeared on the Sales Today
 * dashboard as a phantom "AR Payment Received".
 *
 * Mirrors src/app/api/sales/[id]/void/route.ts minus session auth and
 * email/Telegram alerts. Shift-totals decrement is skipped because shift
 * 805 is closed (frozen Z-reading history) — same as the route's behavior.
 *
 * Run: npx tsx scripts/void-duplicate-sale-InvMain08_25_2026_0016.ts
 */

import { PrismaClient } from '@prisma/client'
import { addStock, StockTransactionType } from '../src/lib/stockOperations'
import { createAuditLog, AuditAction, EntityType } from '../src/lib/auditLog'
import { getManilaDate } from '../src/lib/timezone'

const prisma = new PrismaClient()

const INVOICE = 'InvMain08_25_2026_0016'
const VOID_REASON =
  'System correction: duplicate sale created by offline-queue replay of ' +
  'InvMain08_24_2026_0023 (queued Aug 24, replayed Aug 25 12:13 PH). ' +
  'Cashier not at fault - shift 805 cash shortage of 630.00 is explained by this void.'

async function main() {
  const sale = await prisma.sale.findFirst({
    where: { invoiceNumber: INVOICE },
    include: { items: true, payments: true },
  })

  if (!sale) throw new Error(`Sale ${INVOICE} not found`)
  console.log(
    `Found sale id=${sale.id} status=${sale.status} location=${sale.locationId} total=${sale.totalAmount}`
  )
  if (sale.status !== 'completed') {
    throw new Error(`Refusing to void: status is "${sale.status}", expected "completed"`)
  }

  // Same guard as the void route: never void a sale with active returns
  const activeReturns = await prisma.customerReturn.findMany({
    where: {
      businessId: sale.businessId,
      saleId: sale.id,
      status: { notIn: ['rejected', 'cancelled', 'voided'] },
    },
    select: { id: true },
  })
  if (activeReturns.length > 0) {
    throw new Error(`Refusing to void: ${activeReturns.length} active return(s) reference this sale`)
  }

  // Attribute the void to the business's Super Admin (owner-authorized correction)
  const superAdmin = await prisma.user.findFirst({
    where: {
      businessId: sale.businessId,
      roles: { some: { role: { name: 'Super Admin' } } },
    },
    select: { id: true, username: true, firstName: true, lastName: true },
  })
  if (!superAdmin) throw new Error('No Super Admin user found for this business')
  const adminName =
    [superAdmin.firstName, superAdmin.lastName].filter(Boolean).join(' ') || superAdmin.username
  console.log(`Void attributed to Super Admin: ${superAdmin.username} (id=${superAdmin.id})`)

  // Stock before (for the printed verification)
  const stockBefore = await prisma.variationLocationDetails.findMany({
    where: {
      locationId: sale.locationId,
      productId: { in: sale.items.map((i) => i.productId) },
    },
    select: { productId: true, qtyAvailable: true },
  })
  console.log('Stock BEFORE:', JSON.stringify(stockBefore))

  const result = await prisma.$transaction(
    async (tx) => {
      // Lock the sale row; fail fast if anything else is touching it
      const fresh = await tx.$queryRaw<{ id: number; status: string }[]>`
        SELECT id, status FROM sales WHERE id = ${sale.id} FOR UPDATE NOWAIT
      `
      if (!fresh.length) throw new Error('Sale disappeared')
      if (fresh[0].status !== 'completed') {
        throw new Error(`Status changed concurrently to "${fresh[0].status}" - aborting`)
      }

      const voidedSale = await tx.sale.update({
        where: { id: sale.id },
        data: { status: 'voided' },
      })

      const voidTransaction = await tx.voidTransaction.create({
        data: {
          businessId: sale.businessId,
          locationId: sale.locationId,
          saleId: sale.id,
          voidReason: VOID_REASON,
          originalAmount: sale.totalAmount,
          voidedBy: superAdmin.id,
          approvedBy: superAdmin.id,
          approvedAt: getManilaDate(),
          requiresManagerApproval: false,
        },
      })

      for (const item of sale.items) {
        await addStock({
          tx,
          businessId: sale.businessId,
          productId: item.productId,
          productVariationId: item.productVariationId,
          locationId: sale.locationId,
          quantity: parseFloat(item.quantity.toString()),
          type: StockTransactionType.ADJUSTMENT,
          referenceType: 'sale_void',
          referenceId: voidTransaction.id,
          userId: superAdmin.id,
          userDisplayName: adminName,
          notes: `Voided sale ${sale.invoiceNumber} - ${VOID_REASON}`,
        })
      }

      // Route also restores serial numbers; these items carry none (ink
      // cartridges, serialNumbers JSON is null), so nothing to do here.

      // Shift running totals intentionally NOT touched: shift 805 is closed,
      // and the route skips decrement for closed shifts (frozen Z history).

      return { voidedSale, voidTransaction }
    },
    { timeout: 60000, maxWait: 10000 }
  )

  console.log(
    `Voided. voidTransaction id=${result.voidTransaction.id}, sale status=${result.voidedSale.status}`
  )

  await createAuditLog({
    businessId: sale.businessId,
    userId: superAdmin.id,
    username: superAdmin.username,
    action: AuditAction.SALE_VOID,
    entityType: EntityType.SALE,
    entityIds: [sale.id],
    description: `Voided sale ${sale.invoiceNumber} via data-correction script. Reason: ${VOID_REASON}`,
    metadata: {
      saleId: sale.id,
      invoiceNumber: sale.invoiceNumber,
      voidReason: VOID_REASON,
      authMethod: 'script',
      approvedBy: superAdmin.id,
      approvedByUsername: superAdmin.username,
      totalAmount: parseFloat(sale.totalAmount.toString()),
      script: 'scripts/void-duplicate-sale-InvMain08_25_2026_0016.ts',
    },
  })
  console.log('Audit log written.')

  // Same cleanup as the route: drop cached idempotency responses for this
  // sale so an identical future sale isn't answered with the voided one
  const deletedKeys = await prisma.$executeRaw`
    DELETE FROM idempotency_keys
    WHERE business_id = ${sale.businessId}
    AND (response_body::jsonb->>'id')::int = ${sale.id}
    AND endpoint = '/api/sales'
  `
  console.log(`Deleted ${deletedKeys} idempotency key(s).`)

  const stockAfter = await prisma.variationLocationDetails.findMany({
    where: {
      locationId: sale.locationId,
      productId: { in: sale.items.map((i) => i.productId) },
    },
    select: { productId: true, qtyAvailable: true },
  })
  console.log('Stock AFTER:', JSON.stringify(stockAfter))
}

main()
  .catch((e) => {
    console.error('FAILED:', e.message)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
