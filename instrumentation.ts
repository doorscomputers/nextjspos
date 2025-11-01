/**
 * Next.js Instrumentation Hook
 *
 * This file runs once when the Next.js server starts
 * Used for initializing monitoring and global configurations
 *
 * @see https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 */

export async function register() {
    if (process.env.NEXT_RUNTIME === 'nodejs') {
        // Only run on server-side
        console.log('🚀 Initializing UltimatePOS server instrumentation...')

        // Initialize memory monitoring
        const { startMemoryMonitoring } = await import('./src/lib/memory-monitor')
        startMemoryMonitoring()

        // Log connection pool settings
        if (process.env.DATABASE_URL) {
            const url = new URL(process.env.DATABASE_URL)
            const connectionLimit = url.searchParams.get('connection_limit')
            const poolTimeout = url.searchParams.get('pool_timeout')

            console.log('📊 Database Configuration:')
            console.log(`  Connection Limit: ${connectionLimit || 'default'}`)
            console.log(`  Pool Timeout: ${poolTimeout || 'default'}s`)
        }

        // Log Node.js memory settings
        const v8 = await import('v8')
        const heapStats = v8.getHeapStatistics()
        const heapSizeMB = Math.round(heapStats.heap_size_limit / 1024 / 1024)

        console.log('🧠 Node.js Memory Configuration:')
        console.log(`  Max Heap Size: ${heapSizeMB}MB`)
        console.log(`  GC Available: ${global.gc ? 'Yes' : 'No (use --expose-gc)'}`)

        console.log('✅ Server instrumentation complete\n')
    }
}
