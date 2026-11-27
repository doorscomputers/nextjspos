import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma.simple'
import { MobileError, getOwnSession, lockSession, mobileRoute, sessionView } from '@/lib/mobileCount'

type Ctx = { params: Promise<{ id: string }> }

/**
 * POST /api/mobile/count/sessions/:id/join
 * Allowed while open or sent back. Joining a sent-back session reopens it for recount.
 */
export const POST = mobileRoute<Ctx>(async (_req, me, { params }) => {
  const sessionId = Number((await params).id)
  await prisma.$transaction(async tx => {
    await lockSession(tx, sessionId)
    const s = await getOwnSession(tx, sessionId, me)
    if (s.status !== 'open' && s.status !== 'sent_back') {
      throw new MobileError(409, 'This count was already submitted and can no longer be joined.')
    }
    if (s.status === 'sent_back') {
      await tx.countSession.update({ where: { id: sessionId }, data: { status: 'open' } })
    }
    await tx.countSessionCounter.upsert({
      where: { sessionId_userId: { sessionId, userId: me.userId } },
      update: { doneAt: null },
      create: { sessionId, userId: me.userId, userName: me.name },
    })
  })
  return NextResponse.json({ session: await sessionView(sessionId, me) })
})
