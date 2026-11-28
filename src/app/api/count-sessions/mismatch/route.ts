import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma.simple'
import { getCountWebUser } from '@/lib/countSessionAuth'
import { getMismatchReport, parseMismatchFilter } from '@/lib/countSessionReview'

export const dynamic = 'force-dynamic' // always per request (auth + live data)

/** GET /api/count-sessions/mismatch?from=YYYY-MM-DD&to=YYYY-MM-DD[&locationId=] — system vs counted. */
export async function GET(request: NextRequest) {
  try {
    const auth = await getCountWebUser('view')
    if ('error' in auth) return auth.error

    const q = request.nextUrl.searchParams
    const filter = parseMismatchFilter({ from: q.get('from'), to: q.get('to'), locationId: q.get('locationId') }, auth.locationIds)
    if ('error' in filter) return NextResponse.json({ error: filter.error }, { status: 400 })

    const [rows, locations] = await Promise.all([
      getMismatchReport({ businessId: auth.businessId, locationIds: auth.locationIds, ...filter }),
      prisma.businessLocation.findMany({
        where: {
          businessId: auth.businessId,
          deletedAt: null,
          ...(auth.locationIds !== null ? { id: { in: auth.locationIds } } : {}),
        },
        select: { id: true, name: true },
        orderBy: { name: 'asc' },
      }),
    ])
    return NextResponse.json({ rows, locations })
  } catch (error) {
    console.error('[COUNT MISMATCH] report failed', error)
    return NextResponse.json({ error: 'Failed to load the mismatch report' }, { status: 500 })
  }
}
