import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma.simple'
import { getCountWebUser } from '@/lib/countSessionAuth'

/** POST /api/count-sessions/:id/send-back  body: { note } — reopens a submitted count for recount. */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await getCountWebUser('approve')
    if ('error' in auth) return auth.error

    const sessionId = Number((await params).id)
    const body = await request.json().catch(() => ({}))
    const note = typeof body?.note === 'string' ? body.note.trim().slice(0, 2000) : ''
    if (!note) return NextResponse.json({ error: 'Write a note telling the counters what to recount.' }, { status: 400 })

    const session = await prisma.countSession.findFirst({ where: { id: sessionId, businessId: auth.businessId } })
    if (!session || (auth.locationIds !== null && !auth.locationIds.includes(session.locationId))) {
      return NextResponse.json({ error: 'Count session not found' }, { status: 404 })
    }

    const updated = await prisma.$transaction(async tx => {
      const r = await tx.countSession.updateMany({
        where: { id: sessionId, status: 'submitted' },
        data: { status: 'sent_back', sendBackNote: note, submittedAt: null, submittedBy: null },
      })
      if (r.count === 0) return false
      await tx.countSessionCounter.updateMany({ where: { sessionId }, data: { doneAt: null } })
      return true
    })
    if (!updated) {
      return NextResponse.json({ error: 'Only a submitted count can be sent back.' }, { status: 409 })
    }
    return NextResponse.json({ message: 'Count sent back to the counters.' })
  } catch (error) {
    console.error('[COUNT SEND BACK] failed', error)
    return NextResponse.json({ error: 'Failed to send back count session' }, { status: 500 })
  }
}
