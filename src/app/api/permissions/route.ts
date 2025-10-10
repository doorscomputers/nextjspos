import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { PERMISSIONS } from '@/lib/rbac'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = session.user as any

    // Check permission
    if (!user.permissions?.includes(PERMISSIONS.ROLE_VIEW)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Get all permissions
    const permissions = await prisma.permission.findMany({
      orderBy: {
        name: 'asc',
      },
    })

    // Group permissions by category
    const grouped: Record<string, string[]> = {}

    permissions.forEach(p => {
      const parts = p.name.split('.')
      const category = parts[0] || 'other'

      if (!grouped[category]) {
        grouped[category] = []
      }
      grouped[category].push(p.name)
    })

    return NextResponse.json({ permissions: permissions.map(p => p.name), grouped })
  } catch (error) {
    console.error('Error fetching permissions:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
