import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma.simple'
import { ACTIVE_STATUSES, mobileRoute, sessionView } from '@/lib/mobileCount'

export const dynamic = 'force-dynamic' // always per request (auth + live data)

/** GET /api/mobile/count/sessions/current — the active session at the token's branch, or null. */
export const GET = mobileRoute(async (_req, me) => {
  const active = await prisma.countSession.findFirst({
    where: { businessId: me.businessId, locationId: me.locationId, status: { in: ACTIVE_STATUSES } },
    select: { id: true },
  })
  return NextResponse.json({ session: active ? await sessionView(active.id, me) : null })
})
