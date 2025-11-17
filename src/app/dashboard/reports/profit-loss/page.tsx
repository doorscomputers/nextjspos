import { Suspense, cache } from 'react'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { PERMISSIONS } from '@/lib/rbac'
import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { LoadingSkeleton } from '@/components/reports/profit-loss/LoadingSkeleton'
import { FilterPanel } from '@/components/reports/profit-loss/FilterPanel'
import { ReportDisplay } from '@/components/reports/profit-loss/ReportDisplay'

// Cache the session fetch using React's cache function to prevent redundant calls
const getSession = cache(async () => {
  return await getServerSession(authOptions)
})

// Server component for fetching data
async function ProfitLossReport({
  startDate,
  endDate,
  locationId,
}: {
  startDate: string
  endDate: string
  locationId: string
}) {
  const session = await getSession()

  if (!session?.user) {
    redirect('/login')
  }

  // Build query params
  const params = new URLSearchParams({
    startDate,
    endDate,
  })

  if (locationId !== 'all') {
    params.append('locationId', locationId)
  }

  // Get all cookies to pass to API request
  const cookieStore = cookies()
  const cookieHeader = cookieStore.getAll()
    .map(cookie => `${cookie.name}=${cookie.value}`)
    .join('; ')

  // Fetch from API (server-side)
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  const res = await fetch(`${baseUrl}/api/reports/profit-loss?${params.toString()}`, {
    headers: {
      cookie: cookieHeader, // Pass all cookies including session
    },
    // Add cache configuration for optimal performance
    next: {
      revalidate: 60, // Revalidate every 60 seconds
    },
  })

  if (!res.ok) {
    const error = await res.json()
    throw new Error(error.error || 'Failed to fetch report data')
  }

  const data = await res.json()

  return <ReportDisplay data={data} startDate={startDate} endDate={endDate} />
}

// Main page component (Server Component)
export default async function ProfitLossReportPage({
  searchParams,
}: {
  searchParams: { startDate?: string; endDate?: string; locationId?: string }
}) {
  // Check session and permissions on server-side
  const session = await getSession()

  if (!session?.user) {
    redirect('/login')
  }

  const user = session.user as any

  // Check permissions server-side
  if (!user.permissions?.includes(PERMISSIONS.REPORT_VIEW)) {
    return (
      <div className="p-8">
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-800 dark:text-red-200 px-4 py-3 rounded">
          You do not have permission to view reports.
        </div>
      </div>
    )
  }

  // Default dates
  const getDefaultStartDate = () => {
    const date = new Date()
    date.setDate(date.getDate() - 30)
    return date.toISOString().split('T')[0]
  }

  const getDefaultEndDate = () => {
    return new Date().toISOString().split('T')[0]
  }

  const startDate = searchParams.startDate || getDefaultStartDate()
  const endDate = searchParams.endDate || getDefaultEndDate()
  const locationId = searchParams.locationId || 'all'

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6 print:p-0 print:bg-white">
      {/* Screen Header - Static, rendered immediately */}
      <div className="print:hidden mb-6">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Profit / Loss Report</h1>
        <p className="text-gray-600 dark:text-gray-300 mt-1">
          Comprehensive profit and loss statement with COGS, Gross Profit, and Net Profit calculations
        </p>
      </div>

      {/* Filter Panel - Client Component for interactivity */}
      <FilterPanel />

      {/* Report Data - Wrapped in Suspense for streaming */}
      <Suspense fallback={<LoadingSkeleton />}>
        <ProfitLossReport
          startDate={startDate}
          endDate={endDate}
          locationId={locationId}
        />
      </Suspense>
    </div>
  )
}

// Enable static optimization where possible
export const dynamic = 'force-dynamic' // Required for searchParams
export const revalidate = 60 // Revalidate every 60 seconds
