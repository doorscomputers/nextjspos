'use client'

import { useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { ExclamationTriangleIcon, ArrowPathIcon } from '@heroicons/react/24/outline'

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // Log error to monitoring service (e.g., Sentry)
    console.error('Dashboard error:', error)
  }, [error])

  return (
    <div className="flex min-h-[60vh] items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6 text-center">
        {/* Error Icon */}
        <div className="flex justify-center">
          <div className="rounded-full bg-red-100 p-4 dark:bg-red-900/20">
            <ExclamationTriangleIcon className="h-12 w-12 text-red-600 dark:text-red-400" />
          </div>
        </div>

        {/* Error Title */}
        <div className="space-y-2">
          <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">
            Something went wrong
          </h2>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            An unexpected error occurred while loading this page.
          </p>
        </div>

        {/* Error Details (Development Only) */}
        {process.env.NODE_ENV === 'development' && (
          <div className="rounded-lg bg-gray-100 p-4 text-left dark:bg-gray-800">
            <p className="mb-2 font-mono text-xs font-semibold text-gray-700 dark:text-gray-300">
              Error Details:
            </p>
            <p className="font-mono text-xs text-red-600 dark:text-red-400">
              {error.message || 'Unknown error'}
            </p>
            {error.digest && (
              <p className="mt-2 font-mono text-xs text-gray-500 dark:text-gray-500">
                Error ID: {error.digest}
              </p>
            )}
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Button
            variant="default"
            onClick={reset}
            className="gap-2 min-w-32"
          >
            <ArrowPathIcon className="h-4 w-4" />
            Try Again
          </Button>
          <Button
            variant="outline"
            onClick={() => window.location.href = '/dashboard'}
          >
            Back to Dashboard
          </Button>
        </div>

        {/* Help Text */}
        <p className="text-xs text-gray-500 dark:text-gray-500">
          If this problem persists, please contact support.
          {error.digest && (
            <span className="block mt-1">
              Reference: {error.digest}
            </span>
          )}
        </p>
      </div>
    </div>
  )
}
