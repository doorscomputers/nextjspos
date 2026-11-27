import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma.simple'
import { getCountWebUser } from '@/lib/countSessionAuth'

export const dynamic = 'force-dynamic' // always per request (auth + live data)

/** GET /api/count-sessions[?status=] — list of mobile count sessions for the approver page. */
export async function GET(request: NextRequest) {
  try {
    const auth = await getCountWebUser('view')
    if ('error' in auth) return auth.error

    const status = request.nextUrl.searchParams.get('status')
    const sessions = await prisma.countSession.findMany({
      where: {
        businessId: auth.businessId,
        ...(auth.locationIds !== null ? { locationId: { in: auth.locationIds } } : {}),
        ...(status ? { status } : {}),
      },
      include: {
        counters: { select: { userName: true } },
        _count: { select: { lines: { where: { deletedAt: null } }, unknownItems: { where: { deletedAt: null } } } },
      },
      orderBy: { startedAt: 'desc' },
      take: 500,
    })

    const locations = await prisma.businessLocation.findMany({
      where: { id: { in: [...new Set(sessions.map(s => s.locationId))] } },
      select: { id: true, name: true },
    })
    const locName = new Map(locations.map(l => [l.id, l.name]))

    return NextResponse.json({
      sessions: sessions.map(s => ({
        id: s.id,
        status: s.status,
        locationName: locName.get(s.locationId) ?? '',
        counters: s.counters.map(c => c.userName).join(', '),
        startedByName: s.startedByName,
        startedAt: s.startedAt,
        submittedAt: s.submittedAt,
        approvedAt: s.approvedAt,
        lineCount: s._count.lines,
        unknownCount: s._count.unknownItems,
      })),
    })
  } catch (error) {
    console.error('[COUNT SESSIONS] list failed', error)
    return NextResponse.json({ error: 'Failed to load count sessions' }, { status: 500 })
  }
}
