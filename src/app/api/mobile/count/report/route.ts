import { NextResponse } from 'next/server'
import { Workbook } from 'exceljs'
import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import { prisma } from '@/lib/prisma.simple'
import { MobileError, mobileRoute } from '@/lib/mobileCount'
import { getMismatchReport, parseMismatchFilter } from '@/lib/countSessionReview'

export const dynamic = 'force-dynamic' // always per request (auth + live data)
export const maxDuration = 60

const MAX_DAYS = 93
const phTime = (d: Date) =>
  d.toLocaleString('en-PH', { timeZone: 'Asia/Manila', month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })
const qty = (n: number) => n.toLocaleString('en-PH', { maximumFractionDigits: 4 })

/**
 * GET /api/mobile/count/report?from=YYYY-MM-DD&to=YYYY-MM-DD[&format=xlsx|pdf]
 * What was counted at the phone's branch in the date range (PH days), one row per count + item.
 * BLIND like the rest of the phone API: counted qty only, never the system qty.
 */
export const GET = mobileRoute(async (req, me) => {
  const q = req.nextUrl.searchParams
  const filter = parseMismatchFilter({ from: q.get('from'), to: q.get('to'), locationId: me.locationId }, [me.locationId])
  if ('error' in filter) throw new MobileError(400, filter.error)
  if (filter.to.getTime() - filter.from.getTime() > MAX_DAYS * 86400000) {
    throw new MobileError(400, `Choose at most ${MAX_DAYS} days.`)
  }

  const all = await getMismatchReport({ businessId: me.businessId, locationIds: [me.locationId], ...filter })
  const rows = all.map(r => ({
    key: r.key,
    sessionId: r.sessionId,
    status: r.status,
    item: r.productName + (r.variationName ? ` - ${r.variationName}` : ''),
    sku: r.sku,
    counted: r.counted,
    countedAt: r.countedAt.toISOString(),
  }))

  const format = q.get('format')
  if (format !== 'xlsx' && format !== 'pdf') return NextResponse.json({ rows })

  const location = await prisma.businessLocation.findUnique({ where: { id: me.locationId }, select: { name: true } })
  const fromDay = q.get('from')!
  const toDay = q.get('to')!
  const period = fromDay === toDay ? fromDay : `${fromDay} to ${toDay}`
  const title = `Counted Items - ${location?.name ?? ''} - ${period}`
  const subtitle = `Downloaded by ${me.name} on ${phTime(new Date())} (PH time). ${rows.length} items.`
  const totalQty = rows.reduce((s, r) => s + r.counted, 0)
  const fileName = `counted-items-${fromDay}${fromDay === toDay ? '' : '_' + toDay}.${format}`
  const headers = (type: string) => ({
    'Content-Type': type,
    'Content-Disposition': `attachment; filename="${fileName}"`,
  })

  if (format === 'xlsx') {
    const wb = new Workbook()
    const ws = wb.addWorksheet('Counted Items')
    ws.addRow([title]).font = { bold: true, size: 14 }
    ws.addRow([subtitle])
    ws.addRow([])
    const header = ws.addRow(['Count #', 'Status', 'Item', 'SKU', 'Counted qty', 'Last counted (PH)'])
    header.font = { bold: true, color: { argb: 'FFFFFFFF' } }
    header.eachCell(c => (c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F766E' } }))
    for (const r of rows) ws.addRow([r.sessionId, r.status, r.item, r.sku, r.counted, phTime(new Date(r.countedAt))])
    ws.addRow(['TOTAL', '', `${rows.length} items`, '', totalQty, '']).font = { bold: true }
    ws.getColumn(5).numFmt = '#,##0.####'
    ;[10, 12, 45, 18, 14, 24].forEach((w, i) => (ws.getColumn(i + 1).width = w))
    return new NextResponse(Buffer.from(await wb.xlsx.writeBuffer()), {
      headers: headers('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'),
    })
  }

  const doc = new jsPDF()
  doc.setFontSize(14)
  doc.text(title, 14, 16)
  doc.setFontSize(9)
  doc.text(subtitle, 14, 22)
  autoTable(doc, {
    startY: 27,
    head: [['Count #', 'Status', 'Item', 'SKU', 'Counted', 'Last counted']],
    body: rows.map(r => [r.sessionId, r.status, r.item, r.sku, qty(r.counted), phTime(new Date(r.countedAt))]),
    foot: [['TOTAL', '', `${rows.length} items`, '', qty(totalQty), '']],
    theme: 'striped',
    styles: { fontSize: 8 },
    headStyles: { fillColor: [15, 118, 110], textColor: [255, 255, 255] },
    footStyles: { fillColor: [226, 232, 240], textColor: [15, 23, 42], fontStyle: 'bold' },
    columnStyles: { 0: { cellWidth: 15 }, 1: { cellWidth: 20 }, 4: { halign: 'right', cellWidth: 18 }, 5: { cellWidth: 32 } },
  })
  return new NextResponse(Buffer.from(doc.output('arraybuffer')), { headers: headers('application/pdf') })
})
