'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { CheckCircleIcon, XCircleIcon, ArrowPathIcon } from '@heroicons/react/24/outline'

export default function SyncPermissionsPage() {
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)

  const handleSync = async () => {
    setLoading(true)
    setError(null)
    setResult(null)

    try {
      const response = await fetch('/api/admin/sync-cashier-void-permission', {
        method: 'POST',
        credentials: 'include',
      })

      const data = await response.json()

      if (response.ok) {
        setResult(data)
      } else {
        setError(data.error || 'Failed to sync permissions')
      }
    } catch (err: any) {
      setError(err.message || 'Network error occurred')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="container mx-auto py-8 px-4 max-w-4xl">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ArrowPathIcon className="h-6 w-6" />
            Sync Cashier Void Permission
          </CardTitle>
          <CardDescription>
            This tool adds the SELL_VOID permission to all Sales Cashier roles in the database.
            Run this once to enable the Void button for cashiers.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Sync Button */}
          <div>
            <Button
              onClick={handleSync}
              disabled={loading}
              size="lg"
              className="w-full"
            >
              {loading ? (
                <>
                  <ArrowPathIcon className="h-5 w-5 mr-2 animate-spin" />
                  Syncing Permissions...
                </>
              ) : (
                <>
                  <ArrowPathIcon className="h-5 w-5 mr-2" />
                  Sync Permissions Now
                </>
              )}
            </Button>
          </div>

          {/* Success Result */}
          {result && result.success && (
            <Alert className="bg-green-50 border-green-200 dark:bg-green-950 dark:border-green-800">
              <CheckCircleIcon className="h-5 w-5 text-green-600 dark:text-green-400" />
              <AlertDescription className="ml-2">
                <div className="space-y-2">
                  <p className="font-semibold text-green-900 dark:text-green-100">
                    ✅ {result.message}
                  </p>

                  <div className="bg-white dark:bg-gray-900 rounded p-3 text-sm">
                    <p><strong>Total Roles:</strong> {result.summary.totalRoles}</p>
                    <p><strong>Permissions Added:</strong> {result.summary.permissionsAdded}</p>
                    <p><strong>Already Had:</strong> {result.summary.alreadyHad}</p>
                  </div>

                  {result.results && result.results.length > 0 && (
                    <div className="mt-3">
                      <p className="font-semibold mb-2">Details:</p>
                      <ul className="space-y-1 text-sm">
                        {result.results.map((r: any, i: number) => (
                          <li key={i} className="flex items-center gap-2">
                            {r.status === 'added' ? (
                              <CheckCircleIcon className="h-4 w-4 text-green-600" />
                            ) : (
                              <CheckCircleIcon className="h-4 w-4 text-gray-400" />
                            )}
                            <span>{r.business} - {r.status}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {result.nextSteps && (
                    <div className="mt-4 p-3 bg-yellow-50 dark:bg-yellow-950 border border-yellow-200 dark:border-yellow-800 rounded">
                      <p className="font-semibold mb-2 text-yellow-900 dark:text-yellow-100">
                        🚨 IMPORTANT - Next Steps:
                      </p>
                      <ol className="list-decimal list-inside space-y-1 text-sm text-yellow-900 dark:text-yellow-100">
                        {result.nextSteps.map((step: string, i: number) => (
                          <li key={i}>{step}</li>
                        ))}
                      </ol>
                    </div>
                  )}
                </div>
              </AlertDescription>
            </Alert>
          )}

          {/* Error */}
          {error && (
            <Alert className="bg-red-50 border-red-200 dark:bg-red-950 dark:border-red-800">
              <XCircleIcon className="h-5 w-5 text-red-600 dark:text-red-400" />
              <AlertDescription className="ml-2">
                <p className="font-semibold text-red-900 dark:text-red-100">Error:</p>
                <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
              </AlertDescription>
            </Alert>
          )}

          {/* Instructions */}
          <div className="p-4 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded">
            <h3 className="font-semibold text-blue-900 dark:text-blue-100 mb-2">
              How it works:
            </h3>
            <ol className="list-decimal list-inside space-y-1 text-sm text-blue-900 dark:text-blue-100">
              <li>Click "Sync Permissions Now" button above</li>
              <li>Wait for the sync to complete (1-2 seconds)</li>
              <li>Logout from your current session</li>
              <li>Login again as Cashier</li>
              <li>Go to Reports → Sales Today</li>
              <li>The Void button should now appear!</li>
            </ol>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
