'use client'

import { useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'

export default function ZReadingPage() {
  const searchParams = useSearchParams()
  const shiftIdFromParams = searchParams.get('shiftId')

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [zReading, setZReading] = useState<any>(null)
  const [shiftId, setShiftId] = useState<string | null>(shiftIdFromParams)

  // Fetch most recent closed shift if no shiftId provided
  const fetchRecentClosedShift = async () => {
    try {
      const res = await fetch('/api/shifts?status=closed&limit=1')
      const data = await res.json()

      if (!res.ok || !data.shifts || data.shifts.length === 0) {
        throw new Error('No closed shifts found. Please close a shift first.')
      }

      return data.shifts[0].id.toString()
    } catch (err: any) {
      throw new Error(err.message || 'Failed to fetch recent closed shift')
    }
  }

  const generateReading = async (useShiftId?: string) => {
    setLoading(true)
    setError('')

    try {
      let targetShiftId = useShiftId || shiftId

      // If no shift ID, fetch the most recent closed shift
      if (!targetShiftId) {
        targetShiftId = await fetchRecentClosedShift()
        setShiftId(targetShiftId)
      }

      const res = await fetch(`/api/readings/z-reading?shiftId=${targetShiftId}`)
      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Failed to generate Z Reading')
      }

      setZReading(data.zReading)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    generateReading()
  }, [])

  const printReading = () => {
    window.print()
  }

  if (loading && !zReading) {
    return (
      <div className="container max-w-2xl mx-auto py-8 px-4">
        <div className="text-center">
          <div className="text-lg">Generating Z Reading...</div>
          <div className="text-sm text-muted-foreground mt-2">Please wait</div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="container max-w-2xl mx-auto py-8 px-4">
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
        <div className="mt-4 space-y-2">
          <p className="text-sm text-muted-foreground">
            To view past Z readings, go to <a href="/dashboard/readings/history" className="text-primary underline">Readings History</a>
          </p>
          <div className="flex gap-2">
            <Button onClick={() => window.history.back()} variant="outline">
              Go Back
            </Button>
            <Button onClick={() => window.location.href = '/dashboard/readings/history'} variant="default">
              View Readings History
            </Button>
          </div>
        </div>
      </div>
    )
  }

  if (!zReading) return null

  return (
    <div className="container max-w-3xl mx-auto py-8 px-4">
      <div className="flex justify-between mb-4 print:hidden">
        <h1 className="text-2xl font-bold">Z Reading (End of Day)</h1>
        <div className="flex gap-2">
          <Button onClick={generateReading}>Refresh</Button>
          <Button onClick={printReading} variant="outline">
            Print
          </Button>
        </div>
      </div>

      <Card className="print:shadow-none print:border-0">
        <CardHeader className="text-center border-b bg-gray-50">
          <CardTitle className="text-2xl">Z READING</CardTitle>
          <div className="text-lg font-bold text-primary">END OF DAY REPORT</div>
          <div className="text-sm text-muted-foreground mt-3">
            <p className="font-bold">Shift: {zReading.shiftNumber}</p>
            <p>Cashier: {zReading.cashierName}</p>
            <p>
              Opened: {new Date(zReading.openedAt).toLocaleString()} | Closed:{' '}
              {new Date(zReading.closedAt).toLocaleString()}
            </p>
            <p className="text-xs mt-1">
              Report Generated: {new Date(zReading.readingTime).toLocaleString()}
            </p>
            <p className="text-xs">X Readings Generated: {zReading.xReadingCount}</p>
          </div>
        </CardHeader>

        <CardContent className="py-6 space-y-6">
          {/* Sales Summary */}
          <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
            <h3 className="font-bold mb-3 text-blue-900 border-b border-blue-300 pb-2">
              SALES SUMMARY
            </h3>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span>Gross Sales:</span>
                <span className="font-mono font-bold">₱{zReading.grossSales.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-red-700">
                <span>Less: Total Discounts</span>
                <span className="font-mono">-₱{zReading.totalDiscounts.toFixed(2)}</span>
              </div>
              <div className="flex justify-between font-bold border-t-2 border-blue-300 pt-2 mt-2 text-lg text-blue-900">
                <span>NET SALES:</span>
                <span className="font-mono">₱{zReading.netSales.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-gray-600 pt-2">
                <span>Void Amount:</span>
                <span className="font-mono">₱{zReading.voidAmount.toFixed(2)}</span>
              </div>
            </div>
          </div>

          {/* Transaction Count */}
          <div>
            <h3 className="font-bold mb-3 border-b pb-1">TRANSACTION SUMMARY</h3>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span>Completed Transactions:</span>
                <span className="font-mono font-bold">{zReading.transactionCount}</span>
              </div>
              <div className="flex justify-between">
                <span>Voided Transactions:</span>
                <span className="font-mono">{zReading.voidCount}</span>
              </div>
              {zReading.cashInCount > 0 && (
                <div className="flex justify-between text-green-700">
                  <span>Cash In Count:</span>
                  <span className="font-mono">{zReading.cashInCount}</span>
                </div>
              )}
              {zReading.cashOutCount > 0 && (
                <div className="flex justify-between text-red-700">
                  <span>Cash Out Count:</span>
                  <span className="font-mono">{zReading.cashOutCount}</span>
                </div>
              )}
            </div>
          </div>

          {/* Payment Breakdown */}
          <div>
            <h3 className="font-bold mb-3 border-b pb-1">PAYMENT METHOD BREAKDOWN</h3>
            <div className="space-y-1 text-sm">
              {Object.entries(zReading.paymentBreakdown).map(([method, amount]: [string, any]) => (
                <div key={method} className="flex justify-between">
                  <span className="capitalize">{method}:</span>
                  <span className="font-mono">₱{amount.toFixed(2)}</span>
                </div>
              ))}
              <div className="flex justify-between font-bold border-t pt-1 mt-2">
                <span>Total Collections:</span>
                <span className="font-mono">
                  ₱
                  {Object.values(zReading.paymentBreakdown)
                    .reduce((sum: number, val: any) => sum + val, 0)
                    .toFixed(2)}
                </span>
              </div>
            </div>
          </div>

          {/* BIR Discount Breakdown */}
          {(zReading.discountBreakdown.senior.count > 0 ||
            zReading.discountBreakdown.pwd.count > 0 ||
            zReading.discountBreakdown.regular.count > 0) && (
            <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200">
              <h3 className="font-bold mb-3 border-b border-yellow-300 pb-2 text-yellow-900">
                DISCOUNT BREAKDOWN (BIR COMPLIANCE)
              </h3>
              <div className="space-y-2 text-sm">
                {zReading.discountBreakdown.senior.count > 0 && (
                  <div className="flex justify-between">
                    <span>
                      Senior Citizen (20%): {zReading.discountBreakdown.senior.count} transactions
                    </span>
                    <span className="font-mono">
                      ₱{zReading.discountBreakdown.senior.amount.toFixed(2)}
                    </span>
                  </div>
                )}
                {zReading.discountBreakdown.pwd.count > 0 && (
                  <div className="flex justify-between">
                    <span>PWD (20%): {zReading.discountBreakdown.pwd.count} transactions</span>
                    <span className="font-mono">
                      ₱{zReading.discountBreakdown.pwd.amount.toFixed(2)}
                    </span>
                  </div>
                )}
                {zReading.discountBreakdown.regular.count > 0 && (
                  <div className="flex justify-between">
                    <span>
                      Regular Discounts: {zReading.discountBreakdown.regular.count} transactions
                    </span>
                    <span className="font-mono">
                      ₱{zReading.discountBreakdown.regular.amount.toFixed(2)}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Cash Drawer Reconciliation */}
          <div className="bg-green-50 p-4 rounded-lg border-2 border-green-300">
            <h3 className="font-bold mb-3 border-b border-green-400 pb-2 text-green-900">
              CASH DRAWER RECONCILIATION
            </h3>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span>Beginning Cash:</span>
                <span className="font-mono">₱{zReading.beginningCash.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span>Cash Sales:</span>
                <span className="font-mono">
                  ₱{(zReading.paymentBreakdown.cash || 0).toFixed(2)}
                </span>
              </div>
              {zReading.cashIn > 0 && (
                <div className="flex justify-between text-green-700">
                  <span>Cash In:</span>
                  <span className="font-mono">+₱{zReading.cashIn.toFixed(2)}</span>
                </div>
              )}
              {zReading.cashOut > 0 && (
                <div className="flex justify-between text-red-700">
                  <span>Cash Out:</span>
                  <span className="font-mono">-₱{zReading.cashOut.toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between font-bold border-t-2 border-green-400 pt-2 mt-2">
                <span>System Cash (Expected):</span>
                <span className="font-mono">₱{zReading.systemCash.toFixed(2)}</span>
              </div>
              <div className="flex justify-between font-bold text-lg text-blue-900">
                <span>Actual Cash Counted:</span>
                <span className="font-mono">₱{zReading.endingCash.toFixed(2)}</span>
              </div>

              {/* Variance Display */}
              <div className="border-t-2 border-green-400 pt-2 mt-2">
                {zReading.cashOver > 0 && (
                  <div className="flex justify-between text-green-700 font-bold">
                    <span>Cash Over:</span>
                    <span className="font-mono">+₱{zReading.cashOver.toFixed(2)}</span>
                  </div>
                )}
                {zReading.cashShort > 0 && (
                  <div className="flex justify-between text-red-700 font-bold">
                    <span>Cash Short:</span>
                    <span className="font-mono">-₱{zReading.cashShort.toFixed(2)}</span>
                  </div>
                )}
                {zReading.cashOver === 0 && zReading.cashShort === 0 && (
                  <div className="flex justify-center text-green-700 font-bold">
                    <span>CASH BALANCED</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Cash Denomination */}
          {zReading.cashDenomination && (
            <div>
              <h3 className="font-bold mb-3 border-b pb-1">CASH DENOMINATION COUNT</h3>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="flex justify-between">
                  <span>₱1000 Bills:</span>
                  <span className="font-mono">
                    {zReading.cashDenomination.count1000} × 1000 = ₱
                    {(zReading.cashDenomination.count1000 * 1000).toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>₱500 Bills:</span>
                  <span className="font-mono">
                    {zReading.cashDenomination.count500} × 500 = ₱
                    {(zReading.cashDenomination.count500 * 500).toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>₱200 Bills:</span>
                  <span className="font-mono">
                    {zReading.cashDenomination.count200} × 200 = ₱
                    {(zReading.cashDenomination.count200 * 200).toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>₱100 Bills:</span>
                  <span className="font-mono">
                    {zReading.cashDenomination.count100} × 100 = ₱
                    {(zReading.cashDenomination.count100 * 100).toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>₱50 Bills:</span>
                  <span className="font-mono">
                    {zReading.cashDenomination.count50} × 50 = ₱
                    {(zReading.cashDenomination.count50 * 50).toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>₱20 Bills:</span>
                  <span className="font-mono">
                    {zReading.cashDenomination.count20} × 20 = ₱
                    {(zReading.cashDenomination.count20 * 20).toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>₱10 Coins:</span>
                  <span className="font-mono">
                    {zReading.cashDenomination.count10} × 10 = ₱
                    {(zReading.cashDenomination.count10 * 10).toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>₱5 Coins:</span>
                  <span className="font-mono">
                    {zReading.cashDenomination.count5} × 5 = ₱
                    {(zReading.cashDenomination.count5 * 5).toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>₱1 Coins:</span>
                  <span className="font-mono">
                    {zReading.cashDenomination.count1} × 1 = ₱
                    {(zReading.cashDenomination.count1 * 1).toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>₱0.25 Coins:</span>
                  <span className="font-mono">
                    {zReading.cashDenomination.count025} × 0.25 = ₱
                    {(zReading.cashDenomination.count025 * 0.25).toFixed(2)}
                  </span>
                </div>
              </div>
              <div className="flex justify-between font-bold border-t pt-2 mt-2">
                <span>Total from Denomination:</span>
                <span className="font-mono">₱{zReading.cashDenomination.totalAmount.toFixed(2)}</span>
              </div>
            </div>
          )}

          {/* Category Sales */}
          {Object.keys(zReading.categorySales).length > 0 && (
            <div>
              <h3 className="font-bold mb-3 border-b pb-1">SALES BY CATEGORY</h3>
              <div className="space-y-1 text-sm">
                {Object.entries(zReading.categorySales).map(([category, amount]: [string, any]) => (
                  <div key={category} className="flex justify-between">
                    <span>{category}:</span>
                    <span className="font-mono">₱{amount.toFixed(2)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Footer */}
          <div className="text-center text-xs text-muted-foreground pt-4 border-t-2 border-gray-300">
            <p className="font-bold text-lg text-red-600 mb-2">*** Z READING - SHIFT CLOSED ***</p>
            <p className="mb-1">This shift has been closed and cannot be reopened.</p>
            <p className="mb-1">All counters have been reset for the next shift.</p>
            <p className="text-xs mt-3 text-gray-500">
              For BIR compliance, keep this report with your daily sales records.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Print Instructions */}
      <div className="mt-4 p-4 bg-blue-50 rounded-lg border border-blue-200 print:hidden">
        <h4 className="font-medium text-blue-900 mb-2">Report Generated Successfully</h4>
        <ul className="text-sm text-blue-700 space-y-1">
          <li>This Z Reading is for closed shift: {zReading.shiftNumber}</li>
          <li>Print this report for your records and BIR compliance</li>
          <li>Keep with daily sales documentation</li>
          <li>
            {zReading.cashOver === 0 && zReading.cashShort === 0
              ? 'Cash is balanced - no discrepancies'
              : 'Cash variance detected - review and document reason'}
          </li>
        </ul>
      </div>
    </div>
  )
}
