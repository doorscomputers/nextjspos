import { NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma.simple'
import { ACTIVE_STATUSES, MobileError, mobileRoute, sessionView } from '@/lib/mobileCount'

/**
 * POST /api/mobile/count/sessions — start a count at the token's branch and join it.
 * The unique active_location_id column makes a second active session impossible.
 */
export const POST = mobileRoute(async (_req, me) => {
  try {
    const session = await prisma.countSession.create({
      data: {
        businessId: me.businessId,
        locationId: me.locationId,
        activeLocationId: me.locationId,
        startedBy: me.userId,
        startedByName: me.name,
        counters: { create: { userId: me.userId, userName: me.name } },
      },
    })
    return NextResponse.json({ session: await sessionView(session.id, me) })
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      const existing = await prisma.countSession.findFirst({
        where: { locationId: me.locationId, status: { in: ACTIVE_STATUSES } },
        select: { id: true },
      })
      throw new MobileError(409, 'This branch already has a count in progress. Join it instead.', {
        sessionId: existing?.id ?? null,
      })
    }
    throw err
  }
})
