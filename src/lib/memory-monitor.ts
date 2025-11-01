/**
 * Memory Monitoring Utility for UltimatePOS
 *
 * Monitors Node.js memory usage and provides alerts when thresholds are exceeded
 */

interface MemoryStats {
    rss: number // Resident Set Size - total memory allocated
    heapTotal: number // Total heap size
    heapUsed: number // Used heap
    external: number // C++ objects bound to JavaScript
    arrayBuffers: number // ArrayBuffer and SharedArrayBuffer memory
}

interface MemoryAlert {
    level: 'warning' | 'critical'
    message: string
    stats: MemoryStats
    timestamp: Date
}

class MemoryMonitor {
    private warningThreshold: number // in MB
    private criticalThreshold: number // in MB
    private checkInterval: number // in ms
    private intervalId?: NodeJS.Timeout
    private alerts: MemoryAlert[] = []
    private maxAlerts = 100

    constructor(
        warningThreshold = 1024, // 1GB
        criticalThreshold = 1536, // 1.5GB
        checkInterval = 30000 // 30 seconds
    ) {
        this.warningThreshold = warningThreshold
        this.criticalThreshold = criticalThreshold
        this.checkInterval = checkInterval
    }

    /**
     * Get current memory usage in MB
     */
    private getMemoryStats(): MemoryStats {
        const usage = process.memoryUsage()
        return {
            rss: Math.round(usage.rss / 1024 / 1024),
            heapTotal: Math.round(usage.heapTotal / 1024 / 1024),
            heapUsed: Math.round(usage.heapUsed / 1024 / 1024),
            external: Math.round(usage.external / 1024 / 1024),
            arrayBuffers: Math.round(usage.arrayBuffers / 1024 / 1024)
        }
    }

    /**
     * Check memory and alert if thresholds exceeded
     */
    private checkMemory(): void {
        const stats = this.getMemoryStats()

        if (stats.heapUsed >= this.criticalThreshold) {
            this.addAlert({
                level: 'critical',
                message: `Critical: Heap memory at ${stats.heapUsed}MB (threshold: ${this.criticalThreshold}MB)`,
                stats,
                timestamp: new Date()
            })

            // Force garbage collection if available
            if (global.gc) {
                console.warn('🔴 CRITICAL MEMORY: Forcing garbage collection...')
                global.gc()
            }
        } else if (stats.heapUsed >= this.warningThreshold) {
            this.addAlert({
                level: 'warning',
                message: `Warning: Heap memory at ${stats.heapUsed}MB (threshold: ${this.warningThreshold}MB)`,
                stats,
                timestamp: new Date()
            })
        }
    }

    /**
     * Add alert to list
     */
    private addAlert(alert: MemoryAlert): void {
        console.warn(`⚠️  [MEMORY ${alert.level.toUpperCase()}] ${alert.message}`)

        this.alerts.push(alert)

        // Keep only last N alerts
        if (this.alerts.length > this.maxAlerts) {
            this.alerts = this.alerts.slice(-this.maxAlerts)
        }
    }

    /**
     * Start monitoring
     */
    start(): void {
        if (this.intervalId) {
            console.warn('Memory monitor already running')
            return
        }

        console.log(`✅ Memory monitor started (warning: ${this.warningThreshold}MB, critical: ${this.criticalThreshold}MB)`)

        // Initial check
        this.checkMemory()

        // Periodic checks
        this.intervalId = setInterval(() => {
            this.checkMemory()
        }, this.checkInterval)
    }

    /**
     * Stop monitoring
     */
    stop(): void {
        if (this.intervalId) {
            clearInterval(this.intervalId)
            this.intervalId = undefined
            console.log('Memory monitor stopped')
        }
    }

    /**
     * Get current memory usage
     */
    getCurrentStats(): MemoryStats {
        return this.getMemoryStats()
    }

    /**
     * Get recent alerts
     */
    getAlerts(limit = 10): MemoryAlert[] {
        return this.alerts.slice(-limit)
    }

    /**
     * Clear alerts
     */
    clearAlerts(): void {
        this.alerts = []
    }

    /**
     * Get memory usage percentage
     */
    getHeapUsagePercentage(): number {
        const stats = this.getMemoryStats()
        return Math.round((stats.heapUsed / stats.heapTotal) * 100)
    }

    /**
     * Log detailed memory stats
     */
    logStats(): void {
        const stats = this.getMemoryStats()
        const percentage = this.getHeapUsagePercentage()

        console.log('\n📊 Memory Statistics:')
        console.log(`  RSS: ${stats.rss}MB`)
        console.log(`  Heap Used: ${stats.heapUsed}MB / ${stats.heapTotal}MB (${percentage}%)`)
        console.log(`  External: ${stats.external}MB`)
        console.log(`  Array Buffers: ${stats.arrayBuffers}MB`)
        console.log('')
    }

    /**
     * Force garbage collection (if available)
     */
    forceGC(): boolean {
        if (global.gc) {
            console.log('🗑️  Forcing garbage collection...')
            global.gc()
            return true
        } else {
            console.warn('Garbage collection not available. Run with --expose-gc flag.')
            return false
        }
    }
}

// Global instance
let memoryMonitor: MemoryMonitor | null = null

/**
 * Get or create memory monitor instance
 */
export function getMemoryMonitor(): MemoryMonitor {
    if (!memoryMonitor) {
        memoryMonitor = new MemoryMonitor()
    }
    return memoryMonitor
}

/**
 * Start memory monitoring (call once at app startup)
 */
export function startMemoryMonitoring(): void {
    if (typeof window !== 'undefined') {
        // Don't run in browser
        return
    }

    const monitor = getMemoryMonitor()
    monitor.start()

    // Log stats every 5 minutes
    setInterval(() => {
        monitor.logStats()
    }, 5 * 60 * 1000)
}

/**
 * Express/Next.js middleware to log memory after each request
 */
export function memoryLoggingMiddleware(req: any, res: any, next: any): void {
    const monitor = getMemoryMonitor()
    const startMemory = monitor.getCurrentStats()

    res.on('finish', () => {
        const endMemory = monitor.getCurrentStats()
        const memoryDiff = endMemory.heapUsed - startMemory.heapUsed

        if (memoryDiff > 50) { // Log if request used more than 50MB
            console.warn(
                `⚠️  High memory request: ${req.method} ${req.url} used ${memoryDiff}MB`
            )
        }
    })

    next()
}

/**
 * API route to get memory stats
 */
export async function getMemoryStatsAPI() {
    const monitor = getMemoryMonitor()
    return {
        current: monitor.getCurrentStats(),
        heapUsagePercentage: monitor.getHeapUsagePercentage(),
        recentAlerts: monitor.getAlerts(5)
    }
}

export default MemoryMonitor
