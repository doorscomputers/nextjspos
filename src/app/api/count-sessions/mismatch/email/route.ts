import { NextRequest, NextResponse } from 'next/server'
import { Workbook } from 'exceljs'
import { getCountWebUser } from '@/lib/countSessionAuth'
import { getMismatchReport, parseMismatchFilter, type MismatchRow } from '@/lib/countSessionReview'
import { isEmailConfigured, sendEmail } from '@/lib/email'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const esc = (s: string) =>
  s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)
const qty = (n: number) => n.toLocaleString('en-PH', { maximumFractionDigits: 4 })
const peso = (n: number) => '₱' + n.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const item = (r: MismatchRow) => r.productName + (r.variationName ? ` - ${r.variationName}` : '')
const phTime = (d: Date) =>
  d.toLocaleString('en-PH', { timeZone: 'Asia/Manila', month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })

/**
 * POST /api/count-sessions/mismatch/email
 * body: { from, to, locationId?, emails: "a@x.com, b@y.com", onlyMismatches?: boolean }
 * Emails the Count Mismatch Report (summary per branch + Excel attachment).
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await getCountWebUser('view')
    if ('error' in auth) return auth.error

    const body = await request.json().catch(() => ({}))
    const emails = String(body.emails ?? '')
      .split(/[,;\s]+/)
      .map((e: string) => e.trim())
      .filter(Boolean)
    if (!emails.length || emails.length > 10 || !emails.every((e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e))) {
      return NextResponse.json({ error: 'Enter 1 to 10 valid email addresses, separated by commas.' }, { status: 400 })
    }
    const filter = parseMismatchFilter(body, auth.locationIds)
    if ('error' in filter) return NextResponse.json({ error: filter.error }, { status: 400 })
    if (!isEmailConfigured()) {
      return NextResponse.json({ error: 'Email is not set up on the server (SMTP settings missing).' }, { status: 503 })
    }

    const all = await getMismatchReport({ businessId: auth.businessId, locationIds: auth.locationIds, ...filter })
    const onlyMismatches = body.onlyMismatches !== false
    const rows = onlyMismatches ? all.filter(r => r.difference !== 0) : all
    const fromDay = String(body.from)
    const toDay = String(body.to)
    const period = fromDay === toDay ? fromDay : `${fromDay} to ${toDay}`
    const branchLabel = filter.locationId === null ? 'All branches' : (all[0]?.locationName ?? 'Selected branch')

    // Summary per branch (always over ALL counted items of the period).
    const byBranch = new Map<string, { counted: number; mismatched: number; short: number; over: number; value: number }>()
    for (const r of all) {
      const b = byBranch.get(r.locationName) ?? { counted: 0, mismatched: 0, short: 0, over: 0, value: 0 }
      b.counted++
      if (r.difference !== 0) b.mismatched++
      if (r.difference < 0) b.short += -r.difference
      if (r.difference > 0) b.over += r.difference
      b.value += r.value
      byBranch.set(r.locationName, b)
    }

    // Excel attachment
    const wb = new Workbook()
    const ws = wb.addWorksheet('Count Mismatch')
    ws.addRow([`Count Mismatch Report – ${branchLabel} – ${period}`]).font = { bold: true, size: 14 }
    ws.addRow([`Sent by ${auth.name} on ${phTime(new Date())} (PH time). ${onlyMismatches ? 'Only items with a difference.' : 'All counted items.'}`])
    ws.addRow([])
    const header = ws.addRow(['Branch', 'Session', 'Status', 'Item', 'SKU', 'Last counted (PH)', 'System qty', 'Counted qty', 'Difference', 'Unit cost', 'Value'])
    header.font = { bold: true, color: { argb: 'FFFFFFFF' } }
    header.eachCell(c => (c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F766E' } }))
    for (const r of rows) {
      const row = ws.addRow([r.locationName, r.sessionId, r.status, item(r), r.sku, phTime(new Date(r.countedAt)), r.systemAtCount, r.counted, r.difference, r.unitCost, r.value])
      if (r.difference !== 0) row.getCell(9).font = { bold: true, color: { argb: r.difference < 0 ? 'FFB91C1C' : 'FF15803D' } }
    }
    const total = ws.addRow([
      'TOTAL', '', '', `${rows.length} items`, '', '',
      rows.reduce((s, r) => s + r.systemAtCount, 0),
      rows.reduce((s, r) => s + r.counted, 0),
      rows.reduce((s, r) => s + r.difference, 0),
      '',
      rows.reduce((s, r) => s + r.value, 0),
    ])
    total.font = { bold: true }
    ;[7, 8, 9].forEach(c => (ws.getColumn(c).numFmt = '#,##0.####'))
    ;[10, 11].forEach(c => (ws.getColumn(c).numFmt = '#,##0.00'))
    ;[22, 9, 12, 40, 18, 22, 12, 12, 12, 12, 14].forEach((w, i) => (ws.getColumn(i + 1).width = w))
    const xlsx = Buffer.from(await wb.xlsx.writeBuffer())

    const cell = 'padding:6px 8px;border:1px solid #d6dde8;'
    const summary = [...byBranch.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(
        ([name, b]) => `<tr><td style="${cell}">${esc(name)}</td><td style="${cell}text-align:right">${b.counted}</td>
        <td style="${cell}text-align:right;color:${b.mismatched ? '#b45309' : '#15803d'}"><b>${b.mismatched}</b></td>
        <td style="${cell}text-align:right;color:#b91c1c">${b.short ? '−' + qty(b.short) : '0'}</td>
        <td style="${cell}text-align:right;color:#15803d">${b.over ? '+' + qty(b.over) : '0'}</td>
        <td style="${cell}text-align:right;color:${b.value < 0 ? '#b91c1c' : '#15803d'}"><b>${peso(b.value)}</b></td></tr>`
      )
      .join('')
    const html = `
<div style="font-family:Segoe UI,Arial,sans-serif;color:#1f2937;max-width:760px">
  <h2 style="color:#0f766e;margin:0 0 4px">Count Mismatch Report</h2>
  <p style="margin:0 0 12px">${esc(branchLabel)} · Date counted: <b>${esc(period)}</b></p>
  ${
    all.length
      ? `<table style="border-collapse:collapse;font-size:13px">
    <tr style="background:#0f766e;color:#fff"><th style="${cell}text-align:left">Branch</th><th style="${cell}">Items counted</th>
      <th style="${cell}">With mismatch</th><th style="${cell}">Short</th><th style="${cell}">Over</th><th style="${cell}">Value impact (cost)</th></tr>
    ${summary}
  </table>`
      : '<p>No counts were made in this period.</p>'
  }
  <p style="margin-top:12px">The full list is in the attached Excel file (${rows.length} ${onlyMismatches ? 'items with a difference' : 'counted items'}).</p>
  <p style="color:#6b7280;font-size:12px">System qty is the stock at the moment each item was counted. Stock changes only after the count is approved.
  Sent by ${esc(auth.name)}.</p>
</div>`

    const ok = await sendEmail({
      to: emails,
      subject: `Count Mismatch Report – ${branchLabel} – ${period}`,
      html,
      text: `Count Mismatch Report - ${branchLabel} - ${period}. See the attached Excel file.`,
      attachments: [{ filename: `count-mismatch-${fromDay}${fromDay === toDay ? '' : '_' + toDay}.xlsx`, content: xlsx }],
    })
    if (!ok) {
      return NextResponse.json(
        { error: 'The email server refused to send. Check the SMTP email password (Gmail needs an App Password).' },
        { status: 502 }
      )
    }
    return NextResponse.json({ sent: true, to: emails, items: rows.length })
  } catch (error) {
    console.error('[COUNT MISMATCH] email failed', error)
    return NextResponse.json({ error: 'Failed to email the report' }, { status: 500 })
  }
}
