import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma.simple'
import { MobileError, getOwnSession, lockSession, mobileRoute, sessionView } from '@/lib/mobileCount'

type Ctx = { params: Promise<{ id: string }> }

/** POST /api/mobile/count/sessions/:id/submit — locks the count for approval. Needs every counter done. */
export const POST = mobileRoute<Ctx>(async (_req, me, { params }) => {
  const sessionId = Number((await params).id)
  await prisma.$transaction(async tx => {
    await lockSession(tx, sessionId)
    const s = await getOwnSession(tx, sessionId, me)
    if (s.status !== 'open') throw new MobileError(409, 'This count is not open.')
    const counters = await tx.countSessionCounter.findMany({ where: { sessionId } })
    if (!counters.some(c => c.userId === me.userId)) throw new MobileError(409, 'Join this count first.')
    const stillCounting = counters.filter(c => !c.doneAt).map(c => c.userName)
    if (stillCounting.length) {
      throw new MobileError(409, `Still counting: ${stillCounting.join(', ')}. Everyone must tap "Done Counting" first.`, {
        stillCounting,
      })
    }
    const lines = await tx.countLine.count({ where: { sessionId, deletedAt: null } })
    const unknown = await tx.countUnknownItem.count({ where: { sessionId, deletedAt: null } })
    if (lines + unknown === 0) throw new MobileError(409, 'Nothing has been counted yet.')
    await tx.countSession.update({
      where: { id: sessionId },
      data: { status: 'submitted', submittedBy: me.userId, submittedAt: new Date(), sendBackNote: null },
    })
  })
  return NextResponse.json({ session: await sessionView(sessionId, me) })
})
