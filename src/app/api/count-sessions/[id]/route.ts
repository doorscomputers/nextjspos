import { NextRequest, NextResponse } from 'next/server'
import { getCountWebUser } from '@/lib/countSessionAuth'
import { getSessionReview } from '@/lib/countSessionReview'

export const dynamic = 'force-dynamic' // always per request (auth + live data)

/** GET /api/count-sessions/:id — full review: counted, not counted, unknown items, edit history. */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await getCountWebUser('view')
    if ('error' in auth) return auth.error

    const review = await getSessionReview(Number((await params).id), auth.businessId)
    if (!review || (auth.locationIds !== null && !auth.locationIds.includes(review.session.locationId))) {
      return NextResponse.json({ error: 'Count session not found' }, { status: 404 })
    }
    return NextResponse.json(review)
  } catch (error) {
    console.error('[COUNT SESSIONS] detail failed', error)
    return NextResponse.json({ error: 'Failed to load count session' }, { status: 500 })
  }
}
