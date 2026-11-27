import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma.simple'
import { MobileError, getOwnSession, lockSession, mobileRoute, sessionView } from '@/lib/mobileCount'

type Ctx = { params: Promise<{ id: string }> }

/** POST /api/mobile/count/sessions/:id/done — the caller finished their part (queue already uploaded). */
export const POST = mobileRoute<Ctx>(async (_req, me, { params }) => {
  const sessionId = Number((await params).id)
  await prisma.$transaction(async tx => {
    await lockSession(tx, sessionId)
    const s = await getOwnSession(tx, sessionId, me)
    if (s.status !== 'open') throw new MobileError(409, 'This count is no longer open.')
    const r = await tx.countSessionCounter.updateMany({
      where: { sessionId, userId: me.userId },
      data: { doneAt: new Date() },
    })
    if (r.count === 0) throw new MobileError(409, 'Join this count first.')
  })
  return NextResponse.json({ session: await sessionView(sessionId, me) })
})
