import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma.simple'
import { getOwnSession, mobileRoute } from '@/lib/mobileCount'

export const dynamic = 'force-dynamic' // always per request (auth + live data)

type Ctx = { params: Promise<{ id: string }> }

/** GET /api/mobile/count/sessions/:id/lines — all counters' lines + unknown items. BLIND: no system qty. */
export const GET = mobileRoute<Ctx>(async (_req, me, { params }) => {
  const sessionId = Number((await params).id)
  await getOwnSession(prisma, sessionId, me)
  const [lines, unknownItems] = await Promise.all([
    prisma.countLine.findMany({
      where: { sessionId, deletedAt: null },
      select: { id: true, productVariationId: true, qty: true, spot: true, countedByName: true, countedAt: true },
      orderBy: { countedAt: 'asc' },
    }),
    prisma.countUnknownItem.findMany({
      where: { sessionId, deletedAt: null },
      select: { id: true, scannedCode: true, description: true, qty: true, countedByName: true, countedAt: true },
      orderBy: { countedAt: 'asc' },
    }),
  ])
  return NextResponse.json({
    lines: lines.map(l => ({
      id: l.id,
      variationId: l.productVariationId,
      qty: Number(l.qty),
      spot: l.spot,
      countedByName: l.countedByName,
      countedAt: l.countedAt.toISOString(),
    })),
    unknownItems: unknownItems.map(u => ({ ...u, qty: Number(u.qty), countedAt: u.countedAt.toISOString() })),
  })
})
