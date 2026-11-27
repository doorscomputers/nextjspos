import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma.simple'
import { PERMISSIONS } from '@/lib/rbac'
import { createAuditLog, AuditAction, EntityType, getIpAddress, getUserAgent } from '@/lib/auditLog'
import {
  MobileError,
  errorResponse,
  issueMobileToken,
  loadUserAccess,
  TOKEN_MAX_AGE_SECONDS,
} from '@/lib/mobileCount'

/**
 * POST /api/mobile/auth  (public)
 * Mobile counting app login: username + password + scanned branch card.
 * The card is REQUIRED for every role, because it decides which branch is counted.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const username = typeof body.username === 'string' ? body.username.trim() : ''
    const password = typeof body.password === 'string' ? body.password : ''
    const locationCode = typeof body.locationCode === 'string' ? body.locationCode.trim().toUpperCase() : ''

    if (!username || !password) throw new MobileError(400, 'Enter your username and password.')
    if (!locationCode) throw new MobileError(400, 'Scan the location card of this branch.')

    const access = await loadUserAccess({ username })
    const passwordOk = access ? await bcrypt.compare(password, access.user.password) : false
    if (!access || !access.user.allowLogin || !passwordOk || !access.user.businessId) {
      throw new MobileError(401, 'Wrong username or password.')
    }
    const { user } = access
    const businessId = user.businessId!

    const audit = (description: string, blocked: boolean, extra: Record<string, unknown> = {}) =>
      createAuditLog({
        businessId,
        userId: user.id,
        username: user.username,
        action: AuditAction.USER_LOGIN,
        entityType: EntityType.USER,
        entityIds: [user.id],
        description,
        metadata: { app: 'mobile_count', loginBlocked: blocked, locationCode, ...extra },
        ipAddress: getIpAddress(request),
        userAgent: getUserAgent(request),
      }).catch(e => console.error('[MOBILE AUTH] audit failed', e))

    if (!access.permissions.includes(PERMISSIONS.PHYSICAL_COUNT_MOBILE)) {
      await audit('BLOCKED: Mobile count login without physical_count.mobile permission', true)
      throw new MobileError(403, 'You are not allowed to use the counting app. Ask your admin for the "Count stock with the mobile app" permission.')
    }

    const location = await prisma.businessLocation.findFirst({
      where: { locationCode, businessId, isActive: true, deletedAt: null },
      select: { id: true, name: true },
    })
    if (!location) {
      await audit('BLOCKED: Mobile count login with unknown location card', true)
      throw new MobileError(404, 'This location card was not found. Scan the card of this branch again.')
    }
    if (access.locationIds !== null && !access.locationIds.includes(location.id)) {
      await audit(`BLOCKED: Mobile count login at ${location.name} (not an assigned branch)`, true, {
        locationId: location.id,
      })
      throw new MobileError(403, `This card is for "${location.name}", which is not one of your branches.`)
    }

    const business = await prisma.business.findUnique({ where: { id: businessId }, select: { name: true } })
    const token = await issueMobileToken({ userId: user.id, businessId, locationId: location.id, name: access.name })
    await audit(`Mobile count login at ${location.name}`, false, { locationId: location.id })

    return NextResponse.json({
      token,
      expiresAt: new Date(Date.now() + TOKEN_MAX_AGE_SECONDS * 1000).toISOString(),
      user: { id: user.id, name: access.name },
      location,
      businessName: business?.name ?? '',
    })
  } catch (err) {
    return errorResponse(err)
  }
}
