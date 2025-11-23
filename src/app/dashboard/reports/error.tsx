'use client'

import { useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { ChartBarIcon, ArrowPathIcon, DocumentArrowDownIcon } from '@heroicons/react/24/outline'

export default function ReportsError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('Reports error:', error)
  }, [error])

  return (
    <div className="flex min-h-[60vh] items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6 text-center">
        {/* Error Icon */}
        <div className="flex justify-center">
          <div className="rounded-full bg-yellow-100 p-4 dark:bg-yellow-900/20">
            <ChartBarIcon className="h-12 w-12 text-yellow-600 dark:text-yellow-400" />
          </div>
        </div>

        {/* Error Title */}
        <div className="space-y-2">
          <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">
            Report Generation Failed
          </h2>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Unable to generate the requested report. This might be due to invalid filters or a data processing issue.
          </p>
        </div>

        {/* Error Details (Development Only) */}
        {process.env.NODE_ENV === 'development' && (
          <div className="rounded-lg bg-gray-100 p-4 text-left dark:bg-gray-800">
            <p className="mb-2 font-mono text-xs font-semibold text-gray-700 dark:text-gray-300">
              Error Details:
            </p>
            <p className="font-mono text-xs text-red-600 dark:text-red-400 break-words">
              {error.message || 'Unknown error'}
            </p>
            {error.digest && (
              <p className="mt-2 font-mono text-xs text-gray-500 dark:text-gray-500">
                Error ID: {error.digest}
              </p>
            )}
          </div>
        )}

        {/* Suggestions */}
        <div className="rounded-lg bg-blue-50 p-4 text-left dark:bg-blue-900/20">
          <p className="mb-2 text-sm font-semibold text-blue-900 dark:text-blue-300">
            Suggestions:
          </p>
          <ul className="space-y-1 text-xs text-blue-800 dark:text-blue-400">
            <li>• Check if the selected date range is valid</li>
            <li>• Ensure you have permission to view this report</li>
            <li>• Try reducing the date range for large datasets</li>
            <li>• Clear filters and try again</li>
          </ul>
        </div>

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
            onClick={() => window.location.href = '/dashboard/reports'}
          >
            <DocumentArrowDownIcon className="h-4 w-4 mr-2" />
            All Reports
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
