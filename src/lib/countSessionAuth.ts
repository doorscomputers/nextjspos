import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth.simple'
import { PERMISSIONS, getUserAccessibleLocationIds } from '@/lib/rbac'

/** Web session + permission check shared by the /api/count-sessions routes. */
export async function getCountWebUser(need: 'view' | 'approve') {
  const session = await getServerSession(authOptions)
  const user = session?.user as any
  if (!user) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }

  const perms: string[] = user.permissions || []
  const allowed =
    need === 'approve'
      ? perms.includes(PERMISSIONS.INVENTORY_CORRECTION_APPROVE)
      : perms.includes(PERMISSIONS.PHYSICAL_COUNT_VIEW) || perms.includes(PERMISSIONS.INVENTORY_CORRECTION_APPROVE)
  if (!allowed) {
    return { error: NextResponse.json({ error: 'Forbidden - you do not have permission for Physical Count Sessions' }, { status: 403 }) }
  }

  return {
    user,
    userId: Number(user.id),
    businessId: Number(user.businessId),
    name: [user.firstName, user.lastName].filter(Boolean).join(' ') || user.username || `User#${user.id}`,
    /** null = all branches */
    locationIds: getUserAccessibleLocationIds(user),
  }
}
