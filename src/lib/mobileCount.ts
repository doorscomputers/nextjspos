/**
 * Mobile Physical Count — shared server helpers.
 * Spec: docs/superpowers/specs/2026-11-27-mobile-physical-count-design.md
 * API:  docs/superpowers/specs/2026-11-27-mobile-count-api.md
 */
import { NextRequest, NextResponse } from 'next/server'
import { encode, decode } from 'next-auth/jwt'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma.simple'
import { PERMISSIONS } from '@/lib/rbac'

type Tx = Prisma.TransactionClient

/** Own salt: a web session cookie can never be used as a mobile token, and vice versa. */
const TOKEN_SALT = 'mobile-physical-count'
export const TOKEN_MAX_AGE_SECONDS = 12 * 60 * 60

const ADMIN_ROLES = [
  'Super Admin',
  'System Administrator',
  'Admin',
  'All Branch Admin',
  'Cross Location Approver',
  'Cross-Location Approver',
]

/** Error that becomes a JSON response: `{ error, ...extra }` with the given status. */
export class MobileError extends Error {
  constructor(public status: number, message: string, public extra: Record<string, unknown> = {}) {
    super(message)
  }
}

export function errorResponse(err: unknown) {
  if (err instanceof MobileError) {
    return NextResponse.json({ error: err.message, ...err.extra }, { status: err.status })
  }
  console.error('[MOBILE COUNT]', err)
  return NextResponse.json({ error: 'Server error. Please try again.' }, { status: 500 })
}

export function displayName(u: { firstName?: string | null; lastName?: string | null; username: string }) {
  return [u.firstName, u.lastName].filter(Boolean).join(' ') || u.username
}

/**
 * Permissions and branches for a user, using the same rules as the web login
 * (src/lib/auth.simple.ts): role + direct permissions; Super Admin / System
 * Administrator get every permission; branches = direct user locations, else
 * role locations; admin roles and access_all_locations may use any branch.
 */
export async function loadUserAccess(where: { id: number } | { username: string }) {
  const user = await prisma.user.findUnique({
    where,
    include: {
      roles: {
        include: {
          role: {
            include: {
              permissions: { include: { permission: true } },
              locations: true,
            },
          },
        },
      },
      permissions: { include: { permission: true } },
      userLocations: true,
    },
  })
  if (!user) return null

  const roleNames = user.roles.map(ur => ur.role.name)
  let permissions = [
    ...new Set([
      ...user.roles.flatMap(ur => ur.role.permissions.map(rp => rp.permission.name)),
      ...user.permissions.map(p => p.permission.name),
    ]),
  ]
  if (roleNames.includes('Super Admin') || roleNames.includes('System Administrator')) {
    permissions = Object.values(PERMISSIONS)
  }

  const direct = user.userLocations.map(ul => ul.locationId)
  const fromRoles = [...new Set(user.roles.flatMap(ur => ur.role.locations.map(rl => rl.locationId)))]
  const anyBranch =
    roleNames.some(r => ADMIN_ROLES.includes(r)) || permissions.includes('access_all_locations')

  return {
    user,
    name: displayName(user),
    permissions,
    /** null = may use any branch of the business */
    locationIds: anyBranch ? null : direct.length > 0 ? direct : fromRoles,
  }
}

export type MobileUser = {
  userId: number
  businessId: number
  locationId: number
  name: string
}

export async function issueMobileToken(u: MobileUser) {
  const secret = process.env.NEXTAUTH_SECRET
  if (!secret) throw new Error('NEXTAUTH_SECRET is not set')
  return encode({
    token: { sub: String(u.userId), scope: 'count', ...u },
    secret,
    salt: TOKEN_SALT,
    maxAge: TOKEN_MAX_AGE_SECONDS,
  })
}

/**
 * Verifies the Bearer token AND re-checks the user on every request, so
 * disabling a user or removing their permission/branch takes effect at once.
 */
export async function getMobileUser(request: NextRequest): Promise<MobileUser> {
  const header = request.headers.get('authorization') || ''
  const raw = header.startsWith('Bearer ') ? header.slice(7).trim() : ''
  const secret = process.env.NEXTAUTH_SECRET
  if (!raw || !secret) throw new MobileError(401, 'Please log in again.')

  let payload: Record<string, unknown> | null = null
  try {
    payload = (await decode({ token: raw, secret, salt: TOKEN_SALT })) as Record<string, unknown> | null
  } catch {
    payload = null
  }
  if (!payload || payload.scope !== 'count') throw new MobileError(401, 'Please log in again.')

  const userId = Number(payload.userId)
  const locationId = Number(payload.locationId)
  const access = await loadUserAccess({ id: userId })
  if (
    !access ||
    !access.user.allowLogin ||
    access.user.businessId !== Number(payload.businessId) ||
    !access.permissions.includes(PERMISSIONS.PHYSICAL_COUNT_MOBILE) ||
    (access.locationIds !== null && !access.locationIds.includes(locationId))
  ) {
    throw new MobileError(401, 'Your access has changed. Please log in again.')
  }
  return { userId, businessId: access.user.businessId!, locationId, name: access.name }
}

/** Route wrapper: authenticates, runs the handler, turns MobileError into JSON. */
export function mobileRoute<C = unknown>(
  handler: (req: NextRequest, me: MobileUser, ctx: C) => Promise<NextResponse>
) {
  return async (req: NextRequest, ctx: C) => {
    try {
      const me = await getMobileUser(req)
      return await handler(req, me, ctx)
    } catch (err) {
      return errorResponse(err)
    }
  }
}

/**
 * System stock of a variation at a branch as of time `at`, from the stock ledger
 * (StockTransaction.balanceQty). Falls back to the balance before the first later
 * movement, then to the current stock when the ledger has no rows at all.
 */
export async function stockAsOf(tx: Tx, variationId: number, locationId: number, at: Date) {
  const before = await tx.stockTransaction.findFirst({
    where: { productVariationId: variationId, locationId, createdAt: { lte: at } },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    select: { balanceQty: true },
  })
  if (before) return before.balanceQty

  const after = await tx.stockTransaction.findFirst({
    where: { productVariationId: variationId, locationId, createdAt: { gt: at } },
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    select: { balanceQty: true, quantity: true },
  })
  if (after) return after.balanceQty.minus(after.quantity)

  const current = await tx.variationLocationDetails.findUnique({
    where: { productVariationId_locationId: { productVariationId: variationId, locationId } },
    select: { qtyAvailable: true },
  })
  return current?.qtyAvailable ?? new Prisma.Decimal(0)
}

export const ACTIVE_STATUSES = ['open', 'submitted', 'sent_back', 'approving']

/** Locks the session row for the rest of the transaction (sync vs submit race). */
export async function lockSession(tx: Tx, sessionId: number) {
  await tx.$queryRaw`SELECT id FROM count_sessions WHERE id = ${sessionId} FOR UPDATE`
}

/** Session in the API-contract shape for the phone (blind: no quantities). */
export async function sessionView(sessionId: number, me: MobileUser) {
  const s = await prisma.countSession.findFirst({
    where: { id: sessionId, businessId: me.businessId },
    include: { counters: { orderBy: { joinedAt: 'asc' } } },
  })
  if (!s) return null
  const lineCount = await prisma.countLine.count({ where: { sessionId, deletedAt: null } })
  const mine = s.counters.find(c => c.userId === me.userId)
  return {
    id: s.id,
    status: s.status,
    sendBackNote: s.sendBackNote,
    startedByName: s.startedByName,
    startedAt: s.startedAt.toISOString(),
    lineCount,
    counters: s.counters.map(c => ({ userId: c.userId, name: c.userName, done: c.doneAt !== null })),
    joined: !!mine,
    myDone: !!mine?.doneAt,
  }
}

/** Loads a session of the caller's business AND branch, or throws 404. */
export async function getOwnSession(tx: Tx | typeof prisma, sessionId: number, me: MobileUser) {
  const s = await tx.countSession.findFirst({
    where: { id: sessionId, businessId: me.businessId, locationId: me.locationId },
  })
  if (!s) throw new MobileError(404, 'Count session not found for this branch.')
  return s
}
