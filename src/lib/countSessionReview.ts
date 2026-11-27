/**
 * Web side of the Mobile Physical Count: review data + approval posting.
 * Spec: docs/superpowers/specs/2026-11-27-mobile-physical-count-design.md (6.5, 8)
 */
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma.simple'
import { StockTransactionType, updateStock } from '@/lib/stockOperations'

export type ReviewItem = {
  productId: number
  variationId: number
  productName: string
  variationName: string
  sku: string
  lineCount: number
  counted: number
  systemAtCount: number
  difference: number
  unitCost: number
  value: number
  movedAfterCount: boolean
  /** posted = adjustment made, matched = difference 0, skipped = left out at approval, pending = not approved yet */
  result: 'pending' | 'posted' | 'matched' | 'skipped'
}

/** Single products use a placeholder variation name; show nothing instead (same rule as the Excel export). */
const cleanVariation = (name: string) => (name === 'DUMMY' || name === 'Default' ? '' : name)

type ItemRow = {
  product_id: number
  variation_id: number
  product_name: string
  variation_name: string
  sku: string
  line_count: number
  counted: Prisma.Decimal
  system_at_count: Prisma.Decimal
  unit_cost: Prisma.Decimal
  moved_after: boolean
}

/**
 * One row per counted item: total = sum of lines; system = snapshot of the item's
 * LATEST line (by counted time); moved_after = any stock movement after that time.
 */
async function loadItems(sessionId: number, locationId: number): Promise<ItemRow[]> {
  return prisma.$queryRaw<ItemRow[]>`
    WITH agg AS (
      SELECT cl.product_id, cl.product_variation_id AS variation_id,
             COUNT(*)::int AS line_count,
             SUM(cl.qty) AS counted,
             MAX(cl.counted_at) AS last_at,
             (ARRAY_AGG(cl.system_qty_at_count ORDER BY cl.counted_at DESC, cl.created_at DESC))[1] AS system_at_count
      FROM count_lines cl
      WHERE cl.session_id = ${sessionId} AND cl.deleted_at IS NULL
      GROUP BY cl.product_id, cl.product_variation_id
    )
    SELECT agg.product_id, agg.variation_id, p.name AS product_name, pv.name AS variation_name,
           COALESCE(NULLIF(pv.sku, ''), p.sku) AS sku, agg.line_count, agg.counted, agg.system_at_count,
           pv.purchase_price AS unit_cost,
           EXISTS (
             SELECT 1 FROM stock_transactions st
             WHERE st.product_variation_id = agg.variation_id AND st.location_id = ${locationId}
               AND st.created_at > agg.last_at
           ) AS moved_after
    FROM agg
    JOIN product_variations pv ON pv.id = agg.variation_id
    JOIN products p ON p.id = agg.product_id
    ORDER BY p.name, pv.name`
}

export async function getSessionReview(sessionId: number, businessId: number) {
  const session = await prisma.countSession.findFirst({
    where: { id: sessionId, businessId },
    include: { counters: { orderBy: { joinedAt: 'asc' } } },
  })
  if (!session) return null

  const [rows, location, posted, unknownItems, edits] = await Promise.all([
    loadItems(sessionId, session.locationId),
    prisma.businessLocation.findUnique({ where: { id: session.locationId }, select: { name: true } }),
    prisma.inventoryCorrection.findMany({
      where: { countSessionId: sessionId },
      select: { productVariationId: true },
    }),
    prisma.countUnknownItem.findMany({ where: { sessionId, deletedAt: null }, orderBy: { countedAt: 'asc' } }),
    prisma.countLineEdit.findMany({
      where: { line: { sessionId } },
      include: { line: { select: { productVariationId: true, countedByName: true } } },
      orderBy: { editedAt: 'desc' },
    }),
  ])
  const postedSet = new Set(posted.map(p => p.productVariationId))
  const approved = session.status === 'approved'

  const items: ReviewItem[] = rows.map(r => {
    const counted = Number(r.counted)
    const systemAtCount = Number(r.system_at_count)
    const difference = Number(new Prisma.Decimal(r.counted).minus(r.system_at_count))
    const unitCost = Number(r.unit_cost)
    return {
      productId: r.product_id,
      variationId: r.variation_id,
      productName: r.product_name,
      variationName: cleanVariation(r.variation_name),
      sku: r.sku,
      lineCount: r.line_count,
      counted,
      systemAtCount,
      difference,
      unitCost,
      value: difference * unitCost,
      movedAfterCount: !approved && r.moved_after,
      result: postedSet.has(r.variation_id)
        ? 'posted'
        : difference === 0
          ? 'matched'
          : approved
            ? 'skipped'
            : 'pending',
    }
  })

  // Not counted: items with stock at this branch that nobody scanned (information only).
  const countedIds = items.map(i => i.variationId)
  const notCountedRows = await prisma.variationLocationDetails.findMany({
    where: {
      locationId: session.locationId,
      qtyAvailable: { not: 0 },
      productVariationId: countedIds.length ? { notIn: countedIds } : undefined,
      productVariation: { deletedAt: null, businessId, product: { deletedAt: null } },
    },
    select: {
      qtyAvailable: true,
      productVariation: {
        select: { id: true, name: true, sku: true, purchasePrice: true, product: { select: { name: true, sku: true } } },
      },
    },
  })
  const notCounted = notCountedRows
    .map(n => ({
      variationId: n.productVariation.id,
      productName: n.productVariation.product.name,
      variationName: cleanVariation(n.productVariation.name),
      sku: n.productVariation.sku || n.productVariation.product.sku,
      systemQty: Number(n.qtyAvailable),
      value: Number(n.qtyAvailable) * Number(n.productVariation.purchasePrice),
    }))
    .sort((a, b) => a.productName.localeCompare(b.productName))

  const nameOf = new Map(items.map(i => [i.variationId, `${i.productName}${i.variationName ? ' - ' + i.variationName : ''}`]))

  return {
    session: {
      id: session.id,
      status: session.status,
      locationId: session.locationId,
      locationName: location?.name ?? '',
      startedByName: session.startedByName,
      startedAt: session.startedAt,
      submittedAt: session.submittedAt,
      approvedAt: session.approvedAt,
      approvedBy: session.approvedBy,
      sendBackNote: session.sendBackNote,
      counters: session.counters.map(c => ({ userId: c.userId, name: c.userName, done: c.doneAt !== null })),
    },
    items,
    notCounted,
    unknownItems: unknownItems.map(u => ({
      id: u.id,
      scannedCode: u.scannedCode,
      description: u.description,
      qty: Number(u.qty),
      countedByName: u.countedByName,
      countedAt: u.countedAt,
    })),
    edits: edits.map(e => ({
      id: e.id,
      productName: nameOf.get(e.line.productVariationId) ?? `Variation #${e.line.productVariationId}`,
      countedByName: e.line.countedByName,
      oldQty: Number(e.oldQty),
      newQty: e.newQty === null ? null : Number(e.newQty),
      editedByName: e.editedByName,
      editedAt: e.editedAt,
    })),
  }
}

/**
 * Posts the selected items of a submitted session.
 * - Claim: submitted|approving → approving (one approval run at a time in practice).
 * - Each item: its own transaction = InventoryCorrection (unique per session+item, so an
 *   item can NEVER be posted twice, even on retry/resume) + updateStock(difference).
 * - Difference = counted − system qty AT COUNT TIME, so sales after the count stay correct.
 * - All done → approved and the branch is free for a new count.
 */
export async function approveCountSession(params: {
  sessionId: number
  businessId: number
  approverId: number
  approverName: string
  variationIds: number[] | 'all'
}) {
  const { sessionId, businessId, approverId, approverName } = params
  const claim = await prisma.countSession.updateMany({
    where: { id: sessionId, businessId, status: { in: ['submitted', 'approving'] } },
    data: { status: 'approving' },
  })
  if (claim.count === 0) throw new Error('NOT_SUBMITTED')

  const session = await prisma.countSession.findUniqueOrThrow({ where: { id: sessionId } })
  const rows = await loadItems(sessionId, session.locationId)
  const wanted = params.variationIds === 'all' ? null : new Set(params.variationIds)

  let posted = 0
  let unitsAdded = 0
  let unitsRemoved = 0
  let valueImpact = 0
  const failures: { variationId: number; productName: string; error: string }[] = []

  for (const r of rows) {
    const difference = new Prisma.Decimal(r.counted).minus(r.system_at_count)
    if (difference.isZero()) continue
    if (wanted && !wanted.has(r.variation_id)) continue
    const diff = Number(difference)

    try {
      await prisma.$transaction(
        async tx => {
          const correction = await tx.inventoryCorrection.create({
            data: {
              businessId,
              locationId: session.locationId,
              productId: r.product_id,
              productVariationId: r.variation_id,
              systemCount: r.system_at_count,
              physicalCount: r.counted,
              difference,
              reason: 'physical_count',
              remarks: `Mobile count session #${sessionId}`,
              countSessionId: sessionId,
              createdBy: session.startedBy,
              createdByName: session.startedByName,
              status: 'approved',
              approvedBy: approverId,
              approvedAt: new Date(),
            },
          })
          const stock = await updateStock({
            tx,
            businessId,
            productId: r.product_id,
            productVariationId: r.variation_id,
            locationId: session.locationId,
            quantity: diff,
            type: StockTransactionType.ADJUSTMENT,
            referenceType: 'inventory_correction',
            referenceId: correction.id,
            userId: approverId,
            userDisplayName: approverName,
            notes: `Physical count #${sessionId}: counted ${Number(r.counted)}, system at count ${Number(r.system_at_count)}`,
            allowNegative: true,
          })
          await tx.inventoryCorrection.update({
            where: { id: correction.id },
            data: { stockTransactionId: stock.transaction.id },
          })
        },
        { maxWait: 10000, timeout: 30000 }
      )
      posted++
      if (diff > 0) unitsAdded += diff
      else unitsRemoved += -diff
      valueImpact += diff * Number(r.unit_cost)
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') continue // already posted earlier
      console.error(`[COUNT APPROVE] session ${sessionId} variation ${r.variation_id}`, err)
      failures.push({ variationId: r.variation_id, productName: r.product_name, error: (err as Error).message })
    }
  }

  // Failures keep the session in "approving" so the approver can press Approve again (safe: no double posting).
  if (failures.length === 0) {
    await prisma.countSession.update({
      where: { id: sessionId },
      data: { status: 'approved', activeLocationId: null, approvedBy: approverId, approvedAt: new Date() },
    })
  }

  return { session, itemsCounted: rows.length, posted, unitsAdded, unitsRemoved, valueImpact, failures }
}
