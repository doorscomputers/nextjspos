import { Card, CardContent, CardHeader } from '@/components/ui/card'

export function LoadingSkeleton() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6">
      {/* Header Skeleton */}
      <div className="mb-6 animate-pulse">
        <div className="h-9 bg-gray-200 dark:bg-gray-700 rounded w-64 mb-2"></div>
        <div className="h-5 bg-gray-200 dark:bg-gray-700 rounded w-96"></div>
      </div>

      {/* Filter Panel Skeleton */}
      <Card className="mb-6 bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
        <CardHeader>
          <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-48 animate-pulse"></div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 animate-pulse">
            <div className="h-10 bg-gray-200 dark:bg-gray-700 rounded"></div>
            <div className="h-10 bg-gray-200 dark:bg-gray-700 rounded"></div>
            <div className="h-10 bg-gray-200 dark:bg-gray-700 rounded"></div>
            <div className="h-10 bg-gray-200 dark:bg-gray-700 rounded"></div>
          </div>
        </CardContent>
      </Card>

      {/* Loading Spinner */}
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 dark:border-blue-400"></div>
        <p className="ml-4 text-gray-600 dark:text-gray-300">Loading profit/loss data...</p>
      </div>

      {/* Main Content Skeleton */}
      <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 mb-6">
        <CardHeader className="animate-pulse">
          <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-48"></div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Left Column Skeleton */}
            <div className="space-y-4">
              <div className="h-6 bg-orange-200 dark:bg-orange-800 rounded w-full animate-pulse mb-4"></div>
              {[1, 2, 3, 4, 5, 6, 7].map((i) => (
                <div key={i} className="flex justify-between items-center py-2 border-b border-gray-200 dark:border-gray-700 animate-pulse">
                  <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2"></div>
                  <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-24"></div>
                </div>
              ))}
            </div>

            {/* Right Column Skeleton */}
            <div className="space-y-4">
              <div className="h-6 bg-green-200 dark:bg-green-800 rounded w-full animate-pulse mb-4"></div>
              {[1, 2, 3, 4, 5, 6, 7].map((i) => (
                <div key={i} className="flex justify-between items-center py-2 border-b border-gray-200 dark:border-gray-700 animate-pulse">
                  <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2"></div>
                  <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-24"></div>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Calculation Cards Skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {[1, 2, 3].map((i) => (
          <Card key={i} className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
            <CardHeader className="animate-pulse">
              <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-32"></div>
            </CardHeader>
            <CardContent className="animate-pulse">
              <div className="h-10 bg-gray-200 dark:bg-gray-700 rounded w-40 mb-2"></div>
              <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-full mb-1"></div>
              <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-3/4"></div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
