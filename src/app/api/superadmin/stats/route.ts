import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { isSuperAdmin } from '@/lib/rbac'

export async function GET() {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = session.user as any
    if (!isSuperAdmin({ id: user.id, permissions: user.permissions || [], roles: user.roles || [] })) {
      return NextResponse.json({ error: 'Forbidden - Super Admin access required' }, { status: 403 })
    }

    // Get business stats
    const totalBusinesses = await prisma.business.count()
    const businesses = await prisma.business.findMany({
      include: {
        subscriptions: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        }
      }
    })

    let activeBusinesses = 0
    let inactiveBusinesses = 0

    businesses.forEach(business => {
      const latestSub = business.subscriptions[0]
      if (latestSub && latestSub.status === 'approved' &&
          (!latestSub.endDate || new Date(latestSub.endDate) > new Date())) {
        activeBusinesses++
      } else {
        inactiveBusinesses++
      }
    })

    // Get subscription stats
    const totalSubscriptions = await prisma.subscription.count()
    const now = new Date()

    const activeSubscriptions = await prisma.subscription.count({
      where: {
        status: 'approved',
        OR: [
          { endDate: null },
          { endDate: { gt: now } }
        ]
      }
    })

    const trialSubscriptions = await prisma.subscription.count({
      where: {
        status: 'approved',
        trialEndDate: { gt: now },
        startDate: { lte: now }
      }
    })

    const expiredSubscriptions = await prisma.subscription.count({
      where: {
        endDate: { lt: now }
      }
    })

    // Calculate revenue
    const allSubscriptions = await prisma.subscription.findMany({
      where: {
        status: 'approved'
      }
    })

    let totalRevenue = 0
    let monthlyRevenue = 0
    const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)

    allSubscriptions.forEach(sub => {
      const price = parseFloat(sub.packagePrice.toString())
      totalRevenue += price

      if (new Date(sub.createdAt) >= firstDayOfMonth) {
        monthlyRevenue += price
      }
    })

    const stats = {
      totalBusinesses,
      activeBusinesses,
      inactiveBusinesses,
      totalSubscriptions,
      activeSubscriptions,
      trialSubscriptions,
      expiredSubscriptions,
      totalRevenue,
      monthlyRevenue,
    }

    return NextResponse.json({ stats })
  } catch (error) {
    console.error('Error fetching super admin stats:', error)
    return NextResponse.json({ error: 'Failed to fetch stats' }, { status: 500 })
  }
}
