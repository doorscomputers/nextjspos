'use client'

import { useState } from 'react'
import { useSession } from 'next-auth/react'

export default function SalesPerItemTestPage() {
  const { data: session } = useSession()
  const [loading, setLoading] = useState(false)
  const [results, setResults] = useState<any>(null)

  const testEndpoint = async (endpoint: 'original' | 'v2') => {
    setLoading(true)
    setResults(null)

    const url = endpoint === 'original'
      ? '/api/reports/sales-per-item'
      : '/api/reports/sales-per-item-test'

    const startTime = performance.now()

    try {
      const response = await fetch(`${url}?startDate=2025-11-01&endDate=2025-11-30&limit=100`)
      const endTime = performance.now()
      const loadTime = ((endTime - startTime) / 1000).toFixed(2)

      const data = await response.json()

      setResults({
        endpoint,
        loadTime,
        success: response.ok,
        data,
        itemCount: data.items?.length || 0,
        totalProducts: data.summary?.totalProducts || 0,
        totalRevenue: data.summary?.totalRevenue || 0
      })
    } catch (error) {
      const endTime = performance.now()
      const loadTime = ((endTime - startTime) / 1000).toFixed(2)

      setResults({
        endpoint,
        loadTime,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-8">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-8">
          Sales Per Item - Performance Test
        </h1>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white">
            Test Configuration
          </h2>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="font-medium text-gray-700 dark:text-gray-300">Date Range:</span>
              <span className="ml-2 text-gray-600 dark:text-gray-400">2025-11-01 to 2025-11-30</span>
            </div>
            <div>
              <span className="font-medium text-gray-700 dark:text-gray-300">Limit:</span>
              <span className="ml-2 text-gray-600 dark:text-gray-400">100 records per page</span>
            </div>
            <div>
              <span className="font-medium text-gray-700 dark:text-gray-300">User:</span>
              <span className="ml-2 text-gray-600 dark:text-gray-400">{session?.user?.name || 'Not logged in'}</span>
            </div>
            <div>
              <span className="font-medium text-gray-700 dark:text-gray-300">Role:</span>
              <span className="ml-2 text-gray-600 dark:text-gray-400">{(session?.user as any)?.roles?.[0] || 'Unknown'}</span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-6 mb-6">
          {/* Original Version */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
            <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">
              Original Version (Prisma ORM)
            </h3>
            <button
              onClick={() => testEndpoint('original')}
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-medium py-3 px-6 rounded-lg transition-colors"
            >
              {loading && results?.endpoint === 'original' ? 'Testing...' : 'Test Original'}
            </button>
          </div>

          {/* V2 Optimized Version */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
            <h3 className="text-lg font-semibold mb-4 text-green-600 dark:text-green-400">
              V2 Optimized (Prisma.$queryRaw)
            </h3>
            <button
              onClick={() => testEndpoint('v2')}
              disabled={loading}
              className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white font-medium py-3 px-6 rounded-lg transition-colors"
            >
              {loading && results?.endpoint === 'v2' ? 'Testing...' : 'Test V2 Optimized'}
            </button>
          </div>
        </div>

        {/* Results */}
        {results && (
          <div className={`bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 border-l-4 ${
            results.success ? 'border-green-500' : 'border-red-500'
          }`}>
            <h3 className="text-xl font-bold mb-4 text-gray-900 dark:text-white">
              Test Results: {results.endpoint === 'original' ? 'Original' : 'V2 Optimized'}
            </h3>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
                <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">Load Time</div>
                <div className={`text-2xl font-bold ${
                  parseFloat(results.loadTime) < 2 ? 'text-green-600' :
                  parseFloat(results.loadTime) < 5 ? 'text-yellow-600' :
                  'text-red-600'
                }`}>
                  {results.loadTime}s
                </div>
              </div>

              <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
                <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">Status</div>
                <div className={`text-lg font-semibold ${
                  results.success ? 'text-green-600' : 'text-red-600'
                }`}>
                  {results.success ? '✓ Success' : '✗ Failed'}
                </div>
              </div>

              <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
                <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">Items Returned</div>
                <div className="text-2xl font-bold text-gray-900 dark:text-white">
                  {results.itemCount}
                </div>
              </div>

              <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
                <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">Total Products</div>
                <div className="text-2xl font-bold text-gray-900 dark:text-white">
                  {results.totalProducts}
                </div>
              </div>
            </div>

            {results.success ? (
              <>
                <div className="mb-4">
                  <h4 className="font-semibold text-gray-900 dark:text-white mb-2">Summary</h4>
                  <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
                    <div className="grid grid-cols-3 gap-4 text-sm">
                      <div>
                        <span className="text-gray-600 dark:text-gray-400">Total Revenue:</span>
                        <span className="ml-2 font-semibold text-gray-900 dark:text-white">
                          ₱{results.totalRevenue?.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-600 dark:text-gray-400">Total Cost:</span>
                        <span className="ml-2 font-semibold text-gray-900 dark:text-white">
                          ₱{results.data?.summary?.totalCost?.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-600 dark:text-gray-400">Total Profit:</span>
                        <span className="ml-2 font-semibold text-green-600 dark:text-green-400">
                          ₱{results.data?.summary?.totalProfit?.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {results.itemCount > 0 && (
                  <div>
                    <h4 className="font-semibold text-gray-900 dark:text-white mb-2">Sample Data (First 3 Products)</h4>
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                        <thead className="bg-gray-50 dark:bg-gray-700">
                          <tr>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Product</th>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">SKU</th>
                            <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Qty Sold</th>
                            <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Revenue</th>
                          </tr>
                        </thead>
                        <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                          {results.data?.items?.slice(0, 3).map((item: any, index: number) => (
                            <tr key={index}>
                              <td className="px-4 py-2 text-sm text-gray-900 dark:text-white">{item.productName}</td>
                              <td className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400">{item.sku}</td>
                              <td className="px-4 py-2 text-sm text-right text-gray-900 dark:text-white">{item.quantitySold}</td>
                              <td className="px-4 py-2 text-sm text-right text-gray-900 dark:text-white">
                                ₱{item.totalRevenue?.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
                <p className="text-red-800 dark:text-red-400 font-medium mb-2">Error:</p>
                <pre className="text-sm text-red-700 dark:text-red-300 overflow-x-auto">
                  {JSON.stringify(results.error || results.data, null, 2)}
                </pre>
              </div>
            )}
          </div>
        )}

        <div className="mt-8 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-6">
          <h3 className="font-semibold text-blue-900 dark:text-blue-300 mb-2">📝 What to Compare:</h3>
          <ul className="list-disc list-inside space-y-1 text-sm text-blue-800 dark:text-blue-400">
            <li><strong>Load Time:</strong> V2 should be faster (goal: &lt;2 seconds)</li>
            <li><strong>Data Accuracy:</strong> Both should return same number of products and same totals</li>
            <li><strong>Items Returned:</strong> Both should show data (not "No items found")</li>
            <li><strong>Console Logs:</strong> Press F12 to see detailed query timing for V2</li>
          </ul>
        </div>
      </div>
    </div>
  )
}
