import { NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma.simple'
import { MobileError, getOwnSession, lockSession, mobileRoute, stockAsOf } from '@/lib/mobileCount'
import { correctCountTime, isValidCountQty } from '@/lib/mobileCountRules'

const MAX_ITEMS = 500
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

type InLine = { id: string; variationId: number; qty: number; spot?: string | null; countedAt: string; deleted?: boolean }
type InUnknown = { id: string; scannedCode?: string | null; description: string; qty: number; countedAt: string; deleted?: boolean }


/**
 * POST /api/mobile/count/sync — uploads the phone queue (see API contract).
 * Idempotent: rows are keyed by the phone UUID, so a retried upload never duplicates.
 * Runs under a row lock on the session so it cannot interleave with submit.
 */
export const POST = mobileRoute(async (req, me) => {
  const body = await req.json().catch(() => null)
  const sessionId = Number(body?.sessionId)
  const deviceNow = new Date(body?.deviceNow)
  const lines: InLine[] = Array.isArray(body?.lines) ? body.lines : []
  const unknownItems: InUnknown[] = Array.isArray(body?.unknownItems) ? body.unknownItems : []
  if (!sessionId || isNaN(deviceNow.getTime())) throw new MobileError(400, 'sessionId and deviceNow are required.')
  if (lines.length > MAX_ITEMS || unknownItems.length > MAX_ITEMS) {
    throw new MobileError(400, `Send at most ${MAX_ITEMS} lines and ${MAX_ITEMS} unknown items per upload.`)
  }

  const accepted: string[] = []
  const rejected: { id: string; error: string }[] = []

  await prisma.$transaction(
    async tx => {
      await lockSession(tx, sessionId)
      const session = await getOwnSession(tx, sessionId, me)
      if (session.status !== 'open') {
        throw new MobileError(409, 'This count is no longer open. Your unsent counts were kept on the phone.', {
          status: session.status,
        })
      }
      const joined = await tx.countSessionCounter.findUnique({
        where: { sessionId_userId: { sessionId, userId: me.userId } },
      })
      if (!joined) throw new MobileError(409, 'Join this count first.')

      // Phone clock protection: shift phone times by (server − phone) and keep them inside the session window.
      const now = new Date()
      const correctTime = (iso: string) => correctCountTime(iso, deviceNow, now, session.startedAt)

      const variationIds = [...new Set(lines.map(l => Number(l.variationId)).filter(Number.isInteger))]
      const variations = await tx.productVariation.findMany({
        where: { id: { in: variationIds }, businessId: me.businessId },
        select: { id: true, productId: true },
      })
      const productOf = new Map(variations.map(v => [v.id, v.productId]))

      const existingLines = await tx.countLine.findMany({
        where: { id: { in: lines.map(l => String(l.id)) } },
      })
      const lineById = new Map(existingLines.map(l => [l.id, l]))
      let changed = false

      for (const l of lines) {
        const id = String(l?.id ?? '')
        if (!UUID_RE.test(id)) { rejected.push({ id, error: 'Invalid line id.' }); continue }
        const existing = lineById.get(id)
        if (existing && (existing.sessionId !== sessionId || existing.countedBy !== me.userId)) {
          rejected.push({ id, error: 'This line belongs to another count or counter.' }); continue
        }

        if (l.deleted) {
          if (existing && !existing.deletedAt) {
            await tx.countLine.update({ where: { id }, data: { deletedAt: now } })
            await tx.countLineEdit.create({
              data: { lineId: id, oldQty: existing.qty, newQty: null, editedBy: me.userId, editedByName: me.name },
            })
            changed = true
          }
          accepted.push(id); continue
        }

        if (!isValidCountQty(l.qty)) { rejected.push({ id, error: 'Quantity must be 0 to 1,000,000 (max 4 decimals).' }); continue }
        const spot = typeof l.spot === 'string' && l.spot.trim() ? l.spot.trim().slice(0, 100) : null
        const qty = new Prisma.Decimal(l.qty)

        if (existing) {
          if (!existing.qty.equals(qty) || existing.deletedAt || existing.spot !== spot) {
            await tx.countLine.update({ where: { id }, data: { qty, spot, deletedAt: null } })
            if (!existing.qty.equals(qty) || existing.deletedAt) {
              await tx.countLineEdit.create({
                data: { lineId: id, oldQty: existing.deletedAt ? 0 : existing.qty, newQty: qty, editedBy: me.userId, editedByName: me.name },
              })
            }
            changed = true
          }
          accepted.push(id); continue
        }

        const variationId = Number(l.variationId)
        const productId = productOf.get(variationId)
        if (!productId) { rejected.push({ id, error: 'Product not found.' }); continue }
        const countedAt = correctTime(l.countedAt)
        if (!countedAt) { rejected.push({ id, error: 'Invalid countedAt.' }); continue }

        await tx.countLine.create({
          data: {
            id,
            sessionId,
            productId,
            productVariationId: variationId,
            qty,
            spot,
            countedBy: me.userId,
            countedByName: me.name,
            countedAt,
            systemQtyAtCount: await stockAsOf(tx, variationId, me.locationId, countedAt),
          },
        })
        changed = true
        accepted.push(id)
      }

      const existingUnknown = await tx.countUnknownItem.findMany({
        where: { id: { in: unknownItems.map(u => String(u.id)) } },
      })
      const unknownById = new Map(existingUnknown.map(u => [u.id, u]))

      for (const u of unknownItems) {
        const id = String(u?.id ?? '')
        if (!UUID_RE.test(id)) { rejected.push({ id, error: 'Invalid id.' }); continue }
        const existing = unknownById.get(id)
        if (existing && (existing.sessionId !== sessionId || existing.countedBy !== me.userId)) {
          rejected.push({ id, error: 'This item belongs to another count or counter.' }); continue
        }
        if (u.deleted) {
          if (existing && !existing.deletedAt) {
            await tx.countUnknownItem.update({ where: { id }, data: { deletedAt: now } })
            changed = true
          }
          accepted.push(id); continue
        }
        const description = typeof u.description === 'string' ? u.description.trim().slice(0, 500) : ''
        if (!description) { rejected.push({ id, error: 'Description is required.' }); continue }
        if (!isValidCountQty(u.qty)) { rejected.push({ id, error: 'Quantity must be 0 to 1,000,000 (max 4 decimals).' }); continue }
        const scannedCode = typeof u.scannedCode === 'string' && u.scannedCode.trim() ? u.scannedCode.trim().slice(0, 191) : null
        const data = { description, qty: new Prisma.Decimal(u.qty), scannedCode, deletedAt: null }

        if (existing) {
          await tx.countUnknownItem.update({ where: { id }, data })
        } else {
          const countedAt = correctTime(u.countedAt)
          if (!countedAt) { rejected.push({ id, error: 'Invalid countedAt.' }); continue }
          await tx.countUnknownItem.create({
            data: { id, sessionId, ...data, countedBy: me.userId, countedByName: me.name, countedAt },
          })
        }
        changed = true
        accepted.push(id)
      }

      // New counts after "I'm done" mean this counter is counting again.
      if (changed && joined.doneAt) {
        await tx.countSessionCounter.update({
          where: { sessionId_userId: { sessionId, userId: me.userId } },
          data: { doneAt: null },
        })
      }
    },
    { maxWait: 10000, timeout: 60000 }
  )

  return NextResponse.json({ accepted, rejected })
})
