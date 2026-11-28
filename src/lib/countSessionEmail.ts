import { prisma } from '@/lib/prisma.simple'
import { sendEmail } from '@/lib/email'

/** Every count email also goes here (hidden copy) as the owner's backup record. */
const BACKUP_EMAIL = process.env.COUNT_BACKUP_EMAIL || 'rr3800@gmail.com'
const TZ = 'Asia/Manila'

const day = (d: Date) => d.toLocaleDateString('en-PH', { timeZone: TZ, year: 'numeric', month: 'long', day: 'numeric' })
const time = (d: Date) =>
  d.toLocaleString('en-PH', { timeZone: TZ, month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })
const esc = (s: string) =>
  s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)
const csv = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`
const qtyText = (n: number) => n.toLocaleString('en-PH', { maximumFractionDigits: 4 })
const isEmail = (s: string | null | undefined): s is string => !!s && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.trim())

type Row = { item: string; sku: string; spot: string; qty: number; countedAt: Date }

/**
 * After a count is submitted: email each counter the list of what THEY counted
 * (blind — no system qty), with the actual counting date(s), and a hidden copy
 * to BACKUP_EMAIL. Never throws: a failed email must not undo the submit.
 */
export async function emailCountSessionCopies(sessionId: number): Promise<void> {
  // Cap the wait so a slow mail server never keeps the phone stuck on "Submitting…".
  await Promise.race([sendCopies(sessionId), new Promise(resolve => setTimeout(resolve, 20_000))])
}

async function sendCopies(sessionId: number): Promise<void> {
  try {
    const session = await prisma.countSession.findUnique({ where: { id: sessionId }, include: { counters: true } })
    if (!session) return

    const [location, lines, unknown, users] = await Promise.all([
      prisma.businessLocation.findUnique({ where: { id: session.locationId }, select: { name: true } }),
      prisma.countLine.findMany({
        where: { sessionId, deletedAt: null },
        select: { productVariationId: true, qty: true, spot: true, countedBy: true, countedAt: true },
        orderBy: { countedAt: 'asc' },
      }),
      prisma.countUnknownItem.findMany({
        where: { sessionId, deletedAt: null },
        select: { scannedCode: true, description: true, qty: true, countedBy: true, countedAt: true },
        orderBy: { countedAt: 'asc' },
      }),
      prisma.user.findMany({ where: { id: { in: session.counters.map(c => c.userId) } }, select: { id: true, email: true } }),
    ])

    const variations = await prisma.productVariation.findMany({
      where: { id: { in: [...new Set(lines.map(l => l.productVariationId))] } },
      select: { id: true, name: true, sku: true, product: { select: { name: true, sku: true } } },
    })
    const itemOf = new Map(
      variations.map(v => {
        const variation = v.name === 'DUMMY' || v.name === 'Default' ? '' : v.name
        return [v.id, { item: v.product.name + (variation ? ` - ${variation}` : ''), sku: v.sku || v.product.sku || '' }]
      })
    )
    const emailOf = new Map(users.map(u => [u.id, u.email]))
    const branch = location?.name ?? `Location #${session.locationId}`

    await Promise.all(
      session.counters.map(async counter => {
        const rows: Row[] = [
          ...lines
            .filter(l => l.countedBy === counter.userId)
            .map(l => ({
              item: itemOf.get(l.productVariationId)?.item ?? `Item #${l.productVariationId}`,
              sku: itemOf.get(l.productVariationId)?.sku ?? '',
              spot: l.spot ?? '',
              qty: Number(l.qty),
              countedAt: l.countedAt,
            })),
          ...unknown
            .filter(u => u.countedBy === counter.userId)
            .map(u => ({
              item: `UNKNOWN ITEM: ${u.description}`,
              sku: u.scannedCode ?? '',
              spot: '',
              qty: Number(u.qty),
              countedAt: u.countedAt,
            })),
        ].sort((a, b) => a.countedAt.getTime() - b.countedAt.getTime())
        if (!rows.length) return

        const first = day(rows[0].countedAt)
        const last = day(rows[rows.length - 1].countedAt)
        const countedOn = first === last ? first : `${first} to ${last}`
        const total = rows.reduce((sum, r) => sum + r.qty, 0)

        const own = emailOf.get(counter.userId)
        const to = isEmail(own) ? own.trim() : BACKUP_EMAIL
        const subject = `Inventory Count #${sessionId} – ${branch} – ${counter.userName} – counted ${countedOn}`

        const cell = 'padding:6px 8px;border:1px solid #d6dde8;'
        const html = `
<div style="font-family:Segoe UI,Arial,sans-serif;color:#1f2937;max-width:760px">
  <h2 style="color:#1d4ed8;margin:0 0 4px">Inventory Count #${sessionId}</h2>
  <p style="margin:0 0 12px">This is your record of what you counted.</p>
  <table style="border-collapse:collapse;margin-bottom:14px">
    <tr><td style="${cell}background:#eff6ff"><b>Branch</b></td><td style="${cell}">${esc(branch)}</td></tr>
    <tr><td style="${cell}background:#eff6ff"><b>Counted by</b></td><td style="${cell}">${esc(counter.userName)}</td></tr>
    <tr><td style="${cell}background:#eff6ff"><b>Date counted</b></td><td style="${cell}">${esc(countedOn)}</td></tr>
    <tr><td style="${cell}background:#eff6ff"><b>Submitted</b></td><td style="${cell}">${esc(time(session.submittedAt ?? new Date()))}</td></tr>
    <tr><td style="${cell}background:#eff6ff"><b>Lines / total qty</b></td><td style="${cell}">${rows.length} / ${qtyText(total)}</td></tr>
  </table>
  <table style="border-collapse:collapse;width:100%;font-size:13px">
    <tr style="background:#1d4ed8;color:#fff">
      <th style="${cell}text-align:left">#</th><th style="${cell}text-align:left">Item</th><th style="${cell}text-align:left">SKU / Code</th>
      <th style="${cell}text-align:left">Spot</th><th style="${cell}text-align:right">Qty</th><th style="${cell}text-align:left">Counted at</th>
    </tr>
    ${rows
      .map(
        (r, i) => `<tr style="background:${i % 2 ? '#f8fafc' : '#fff'}">
      <td style="${cell}">${i + 1}</td><td style="${cell}">${esc(r.item)}</td><td style="${cell}">${esc(r.sku)}</td>
      <td style="${cell}">${esc(r.spot)}</td><td style="${cell}text-align:right"><b>${qtyText(r.qty)}</b></td>
      <td style="${cell}">${esc(time(r.countedAt))}</td></tr>`
      )
      .join('')}
    <tr style="background:#eff6ff"><td style="${cell}" colspan="4"><b>TOTAL</b></td>
      <td style="${cell}text-align:right"><b>${qtyText(total)}</b></td><td style="${cell}"></td></tr>
  </table>
  <p style="color:#6b7280;font-size:12px;margin-top:12px">Times are Philippine time. A CSV copy is attached.
  Stock changes only after an admin approves this count.</p>
</div>`

        const csvText = [
          ['#', 'Item', 'SKU / Code', 'Spot', 'Qty', 'Counted at (PH time)'].map(csv).join(','),
          ...rows.map((r, i) => [i + 1, r.item, r.sku, r.spot, r.qty, time(r.countedAt)].map(csv).join(',')),
        ].join('\r\n')

        const ok = await sendEmail({
          to,
          bcc: to === BACKUP_EMAIL ? undefined : BACKUP_EMAIL,
          subject,
          html,
          text: `Inventory Count #${sessionId} - ${branch} - ${counter.userName} - counted ${countedOn}. ${rows.length} lines, total qty ${qtyText(total)}. See the attached CSV.`,
          attachments: [{ filename: `count-${sessionId}-${counter.userName.replace(/[^\w-]+/g, '_')}.csv`, content: '﻿' + csvText }],
        })
        if (!ok) console.error(`[COUNT EMAIL] session ${sessionId}: email to counter ${counter.userId} failed`)
      })
    )
  } catch (error) {
    console.error(`[COUNT EMAIL] session ${sessionId}: failed`, error)
  }
}
