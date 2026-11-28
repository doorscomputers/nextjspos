import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma.simple'
import { MobileError, getOwnSession, lockSession, mobileRoute, sessionView } from '@/lib/mobileCount'

type Ctx = { params: Promise<{ id: string }> }

/**
 * POST /api/mobile/count/sessions/:id/join
 * Allowed while open, sent back or submitted (not yet approved). Joining a sent-back or
 * submitted session reopens it so more counts can be added; it must be submitted again.
 */
export const POST = mobileRoute<Ctx>(async (_req, me, { params }) => {
  const sessionId = Number((await params).id)
  await prisma.$transaction(async tx => {
    await lockSession(tx, sessionId)
    const s = await getOwnSession(tx, sessionId, me)
    if (s.status !== 'open' && s.status !== 'sent_back' && s.status !== 'submitted') {
      throw new MobileError(409, 'This count is being approved or is closed. Start a new count instead.')
    }
    if (s.status !== 'open') {
      await tx.countSession.update({
        where: { id: sessionId },
        data: { status: 'open', submittedAt: null, submittedBy: null },
      })
    }
    await tx.countSessionCounter.upsert({
      where: { sessionId_userId: { sessionId, userId: me.userId } },
      update: { doneAt: null },
      create: { sessionId, userId: me.userId, userName: me.name },
    })
  })
  return NextResponse.json({ session: await sessionView(sessionId, me) })
})
