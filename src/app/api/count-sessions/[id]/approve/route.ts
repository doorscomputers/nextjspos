import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma.simple'
import { getCountWebUser } from '@/lib/countSessionAuth'
import { approveCountSession } from '@/lib/countSessionReview'
import { createAuditLog, AuditAction, EntityType, getIpAddress, getUserAgent } from '@/lib/auditLog'
import { sendTelegramPhysicalCountApprovedAlert } from '@/lib/telegram'

/**
 * POST /api/count-sessions/:id/approve   body: { variationIds?: number[] }  (omit = all with differences)
 * Posts counted − system-at-count for each selected item to the stock ledger.
 */
export const maxDuration = 300 // big counts post many items

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await getCountWebUser('approve')
    if ('error' in auth) return auth.error

    const sessionId = Number((await params).id)
    const body = await request.json().catch(() => ({}))
    const variationIds: number[] | 'all' = Array.isArray(body?.variationIds)
      ? body.variationIds.map(Number).filter(Number.isInteger)
      : 'all'

    const session = await prisma.countSession.findFirst({
      where: { id: sessionId, businessId: auth.businessId },
      include: { counters: true },
    })
    if (!session || (auth.locationIds !== null && !auth.locationIds.includes(session.locationId))) {
      return NextResponse.json({ error: 'Count session not found' }, { status: 404 })
    }
    if (session.status !== 'submitted' && session.status !== 'approving') {
      return NextResponse.json({ error: `This count is "${session.status}" and cannot be approved.` }, { status: 409 })
    }
    if (session.startedBy === auth.userId || session.counters.some(c => c.userId === auth.userId)) {
      return NextResponse.json(
        { error: 'You counted in this session, so you cannot approve it. Another approver must do it.' },
        { status: 403 }
      )
    }

    let result
    try {
      result = await approveCountSession({
        sessionId,
        businessId: auth.businessId,
        approverId: auth.userId,
        approverName: auth.name,
        variationIds,
      })
    } catch (err) {
      if ((err as Error).message === 'NOT_SUBMITTED') {
        return NextResponse.json({ error: 'This count was already approved or changed. Refresh the page.' }, { status: 409 })
      }
      throw err
    }

    const location = await prisma.businessLocation.findUnique({ where: { id: session.locationId }, select: { name: true } })
    const summary = `Approved count session #${sessionId} at ${location?.name}: ${result.posted} items adjusted (+${result.unitsAdded} / -${result.unitsRemoved}), value impact ${result.valueImpact.toFixed(2)}`

    createAuditLog({
      businessId: auth.businessId,
      userId: auth.userId,
      username: auth.user.username,
      action: 'inventory_correction_approve' as AuditAction,
      entityType: EntityType.PRODUCT,
      entityIds: [],
      description: summary + (result.failures.length ? ` — ${result.failures.length} failed` : ''),
      metadata: {
        countSessionId: sessionId,
        locationId: session.locationId,
        itemsCounted: result.itemsCounted,
        posted: result.posted,
        unitsAdded: result.unitsAdded,
        unitsRemoved: result.unitsRemoved,
        valueImpact: result.valueImpact,
        failures: result.failures,
      },
      ipAddress: getIpAddress(request),
      userAgent: getUserAgent(request),
    }).catch(e => console.error('[COUNT APPROVE] audit failed', e))

    if (result.failures.length) {
      return NextResponse.json(
        {
          error: `${result.failures.length} item(s) could not be posted. Press Approve again to retry them — items already posted will not be posted twice.`,
          failures: result.failures,
          posted: result.posted,
        },
        { status: 500 }
      )
    }

    sendTelegramPhysicalCountApprovedAlert({
      sessionId,
      locationName: location?.name ?? '',
      counters: session.counters.map(c => c.userName).join(', '),
      itemsCounted: result.itemsCounted,
      itemsPosted: result.posted,
      unitsAdded: result.unitsAdded,
      unitsRemoved: result.unitsRemoved,
      valueImpact: result.valueImpact,
      approvedBy: auth.name,
      timestamp: new Date(),
    }).catch(e => console.error('[COUNT APPROVE] telegram failed', e))

    return NextResponse.json({ message: summary, ...result, session: undefined })
  } catch (error) {
    console.error('[COUNT APPROVE] failed', error)
    return NextResponse.json({ error: 'Failed to approve count session' }, { status: 500 })
  }
}
