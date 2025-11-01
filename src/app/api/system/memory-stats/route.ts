import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getMemoryMonitor } from '@/lib/memory-monitor'
import { getMemoryCacheSize } from '@/lib/cache'
import { PERMISSIONS } from '@/lib/rbac'

/**
 * GET /api/system/memory-stats
 *
 * Returns current Node.js memory statistics
 * Requires SUPER_ADMIN or SYSTEM_ADMIN role
 */
export async function GET() {
    try {
        const session = await getServerSession(authOptions)

        if (!session?.user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const user = session.user as any

        // Only super admins can view system stats
        if (!user.permissions?.includes(PERMISSIONS.SUPER_ADMIN)) {
            return NextResponse.json(
                { error: 'Forbidden - Super Admin access required' },
                { status: 403 }
            )
        }

        const monitor = getMemoryMonitor()
        const currentStats = monitor.getCurrentStats()
        const heapUsagePercentage = monitor.getHeapUsagePercentage()
        const recentAlerts = monitor.getAlerts(10)
        const cacheSize = getMemoryCacheSize()

        // Get process uptime
        const uptimeSeconds = process.uptime()
        const uptimeHours = Math.floor(uptimeSeconds / 3600)
        const uptimeMinutes = Math.floor((uptimeSeconds % 3600) / 60)

        return NextResponse.json({
            memory: {
                ...currentStats,
                heapUsagePercentage,
                warning: heapUsagePercentage > 70,
                critical: heapUsagePercentage > 85
            },
            cache: {
                inMemoryEntries: cacheSize
            },
            process: {
                pid: process.pid,
                uptime: `${uptimeHours}h ${uptimeMinutes}m`,
                uptimeSeconds,
                nodeVersion: process.version,
                platform: process.platform,
                arch: process.arch
            },
            alerts: recentAlerts,
            timestamp: new Date().toISOString()
        })
    } catch (error) {
        console.error('Error fetching memory stats:', error)
        return NextResponse.json(
            { error: 'Failed to fetch memory stats' },
            { status: 500 }
        )
    }
}

/**
 * POST /api/system/memory-stats
 *
 * Force garbage collection (if enabled with --expose-gc)
 */
export async function POST() {
    try {
        const session = await getServerSession(authOptions)

        if (!session?.user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const user = session.user as any

        if (!user.permissions?.includes(PERMISSIONS.SUPER_ADMIN)) {
            return NextResponse.json(
                { error: 'Forbidden - Super Admin access required' },
                { status: 403 }
            )
        }

        const monitor = getMemoryMonitor()
        const beforeStats = monitor.getCurrentStats()

        const gcSuccess = monitor.forceGC()

        // Wait a moment for GC to complete
        await new Promise(resolve => setTimeout(resolve, 100))

        const afterStats = monitor.getCurrentStats()
        const freedMemory = beforeStats.heapUsed - afterStats.heapUsed

        return NextResponse.json({
            success: gcSuccess,
            before: beforeStats,
            after: afterStats,
            freedMemoryMB: freedMemory,
            message: gcSuccess
                ? `Garbage collection completed. Freed ${freedMemory}MB`
                : 'Garbage collection not available. Start Node.js with --expose-gc flag'
        })
    } catch (error) {
        console.error('Error forcing garbage collection:', error)
        return NextResponse.json(
            { error: 'Failed to force garbage collection' },
            { status: 500 }
        )
    }
}
