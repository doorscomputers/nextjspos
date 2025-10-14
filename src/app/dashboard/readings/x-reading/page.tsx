'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'

export default function XReadingPage() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [xReading, setXReading] = useState<any>(null)

  const generateReading = async () => {
    setLoading(true)
    setError('')

    try {
      const res = await fetch('/api/readings/x-reading')
      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Failed to generate X Reading')
      }

      setXReading(data.xReading)
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

  if (loading && !xReading) {
    return <div className="p-4">Loading X Reading...</div>
  }

  if (error) {
    return (
      <div className="container max-w-2xl mx-auto py-8">
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      </div>
    )
  }

  if (!xReading) return null

  return (
    <div className="container max-w-3xl mx-auto py-8 px-4">
      <div className="flex justify-between mb-4 print:hidden">
        <h1 className="text-2xl font-bold">X Reading</h1>
        <div className="flex gap-2">
          <Button onClick={generateReading}>Refresh</Button>
          <Button onClick={printReading} variant="outline">Print</Button>
        </div>
      </div>

      <Card className="print:shadow-none print:border-0">
        <CardHeader className="text-center border-b">
          <CardTitle>X READING (MID-SHIFT REPORT)</CardTitle>
          <div className="text-sm text-muted-foreground">
            <p>Shift: {xReading.shiftNumber}</p>
            <p>Cashier: {xReading.cashierName}</p>
            <p>Report Time: {new Date(xReading.readingTime).toLocaleString()}</p>
            <p>X Reading #{xReading.xReadingNumber}</p>
          </div>
        </CardHeader>

        <CardContent className="py-6 space-y-6">
          {/* Sales Summary */}
          <div>
            <h3 className="font-bold mb-3 border-b pb-1">SALES SUMMARY</h3>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span>Gross Sales:</span>
                <span className="font-mono">₱{xReading.grossSales.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-red-600">
                <span>Less: Discounts</span>
                <span className="font-mono">-₱{xReading.totalDiscounts.toFixed(2)}</span>
              </div>
              <div className="flex justify-between font-bold border-t pt-1">
                <span>NET SALES:</span>
                <span className="font-mono">₱{xReading.netSales.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-gray-600">
                <span>Void Amount:</span>
                <span className="font-mono">₱{xReading.voidAmount.toFixed(2)}</span>
              </div>
            </div>
          </div>

          {/* Transaction Count */}
          <div>
            <h3 className="font-bold mb-3 border-b pb-1">TRANSACTIONS</h3>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span>Completed:</span>
                <span className="font-mono">{xReading.transactionCount}</span>
              </div>
              <div className="flex justify-between">
                <span>Voided:</span>
                <span className="font-mono">{xReading.voidCount}</span>
              </div>
            </div>
          </div>

          {/* Payment Breakdown */}
          <div>
            <h3 className="font-bold mb-3 border-b pb-1">PAYMENT BREAKDOWN</h3>
            <div className="space-y-1 text-sm">
              {Object.entries(xReading.paymentBreakdown).map(([method, amount]: [string, any]) => (
                <div key={method} className="flex justify-between">
                  <span className="capitalize">{method}:</span>
                  <span className="font-mono">₱{amount.toFixed(2)}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Cash Movement */}
          <div>
            <h3 className="font-bold mb-3 border-b pb-1">CASH DRAWER</h3>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span>Beginning Cash:</span>
                <span className="font-mono">₱{xReading.beginningCash.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span>Cash Sales:</span>
                <span className="font-mono">₱{(xReading.paymentBreakdown.cash || 0).toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-green-600">
                <span>Cash In:</span>
                <span className="font-mono">+₱{xReading.cashIn.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-red-600">
                <span>Cash Out:</span>
                <span className="font-mono">-₱{xReading.cashOut.toFixed(2)}</span>
              </div>
              <div className="flex justify-between font-bold border-t pt-1">
                <span>Expected Cash in Drawer:</span>
                <span className="font-mono">₱{xReading.expectedCash.toFixed(2)}</span>
              </div>
            </div>
          </div>

          {/* Discounts */}
          {(xReading.discountBreakdown.senior > 0 || xReading.discountBreakdown.pwd > 0) && (
            <div>
              <h3 className="font-bold mb-3 border-b pb-1">DISCOUNT BREAKDOWN (BIR)</h3>
              <div className="space-y-1 text-sm">
                {xReading.discountBreakdown.senior > 0 && (
                  <div className="flex justify-between">
                    <span>Senior Citizen:</span>
                    <span className="font-mono">₱{xReading.discountBreakdown.senior.toFixed(2)}</span>
                  </div>
                )}
                {xReading.discountBreakdown.pwd > 0 && (
                  <div className="flex justify-between">
                    <span>PWD:</span>
                    <span className="font-mono">₱{xReading.discountBreakdown.pwd.toFixed(2)}</span>
                  </div>
                )}
                {xReading.discountBreakdown.regular > 0 && (
                  <div className="flex justify-between">
                    <span>Regular:</span>
                    <span className="font-mono">₱{xReading.discountBreakdown.regular.toFixed(2)}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="text-center text-xs text-muted-foreground pt-4 border-t">
            <p>*** X READING - NON-RESETTING ***</p>
            <p>This is a mid-shift report. Shift remains open.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
