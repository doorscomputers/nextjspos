'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { toast } from 'sonner'
import { AlertTriangle, Trash2, RefreshCw, CheckCircle2 } from 'lucide-react'

export default function ClearSequencesPage() {
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState<any>(null)
  const [cleared, setCleared] = useState(false)

  const checkSequences = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/admin/clear-invoice-sequences', {
        method: 'GET',
      })
      const data = await response.json()

      if (data.success) {
        setStatus(data)
        toast.success(`Found ${data.count} sequence records`)
      } else {
        toast.error(data.error || 'Failed to check sequences')
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to check sequences')
    } finally {
      setLoading(false)
    }
  }

  const clearSequences = async () => {
    if (!confirm('Are you sure you want to clear all invoice sequences? This is safe - sequences will regenerate automatically on next sale.')) {
      return
    }

    try {
      setLoading(true)
      const response = await fetch('/api/admin/clear-invoice-sequences', {
        method: 'POST',
      })
      const data = await response.json()

      if (data.success) {
        setCleared(true)
        setStatus(null)
        toast.success(data.message)
        // Refresh status
        setTimeout(checkSequences, 1000)
      } else {
        toast.error(data.error || 'Failed to clear sequences')
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to clear sequences')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="container mx-auto py-8 px-4 max-w-4xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Clear Invoice Sequences</h1>
        <p className="text-muted-foreground mt-2">
          Fix unique constraint conflicts after schema changes
        </p>
      </div>

      <Card className="mb-6 border-yellow-200 bg-yellow-50 dark:bg-yellow-950 dark:border-yellow-800">
        <CardHeader>
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />
            <CardTitle className="text-yellow-800 dark:text-yellow-200">Problem</CardTitle>
          </div>
          <CardDescription className="text-yellow-700 dark:text-yellow-300">
            After adding the &quot;day&quot; column to invoice_sequences, existing records have day=1,
            causing conflicts when generating invoices for other days.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-yellow-700 dark:text-yellow-300">
          <p className="font-medium mb-2">Error you&apos;re seeing:</p>
          <code className="text-xs bg-yellow-100 dark:bg-yellow-900 p-2 rounded block">
            Unique constraint failed on fields: (business_id, invoice_number)
          </code>
        </CardContent>
      </Card>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Solution</CardTitle>
          <CardDescription>
            Clear the invoice_sequences table to resolve conflicts. This is <strong>100% safe</strong> because:
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="list-disc list-inside space-y-2 mb-6 text-sm text-muted-foreground">
            <li>Invoice sequences are just counters for generating new invoice numbers</li>
            <li>They do NOT affect existing sales records</li>
            <li>They regenerate automatically on next sale per location</li>
            <li>Each location maintains independent daily sequences</li>
          </ul>

          <div className="flex gap-3">
            <Button
              onClick={checkSequences}
              disabled={loading}
              variant="outline"
              className="gap-2"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              Check Status
            </Button>

            <Button
              onClick={clearSequences}
              disabled={loading}
              variant="destructive"
              className="gap-2"
            >
              <Trash2 className="h-4 w-4" />
              Clear Sequences
            </Button>
          </div>
        </CardContent>
      </Card>

      {status && (
        <Card>
          <CardHeader>
            <CardTitle>Current Status</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                <span className="font-medium">Total Sequence Records:</span>
                <span className="text-2xl font-bold">{status.count}</span>
              </div>

              {status.count === 0 && (
                <div className="flex items-center gap-2 p-3 bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-lg">
                  <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
                  <span className="text-green-700 dark:text-green-300 font-medium">
                    Sequences cleared! You can now create sales without conflicts.
                  </span>
                </div>
              )}

              {status.recentSequences && status.recentSequences.length > 0 && (
                <div>
                  <h4 className="font-medium mb-2">Recent Sequences:</h4>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left p-2">Location ID</th>
                          <th className="text-left p-2">Year</th>
                          <th className="text-left p-2">Month</th>
                          <th className="text-left p-2">Day</th>
                          <th className="text-left p-2">Sequence</th>
                        </tr>
                      </thead>
                      <tbody>
                        {status.recentSequences.map((seq: any) => (
                          <tr key={seq.id} className="border-b">
                            <td className="p-2">{seq.locationId}</td>
                            <td className="p-2">{seq.year}</td>
                            <td className="p-2">{seq.month}</td>
                            <td className="p-2">{seq.day}</td>
                            <td className="p-2">{seq.sequence}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {cleared && (
        <Card className="mt-6 border-green-200 bg-green-50 dark:bg-green-950 dark:border-green-800">
          <CardHeader>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
              <CardTitle className="text-green-800 dark:text-green-200">Success!</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="text-green-700 dark:text-green-300">
            <p className="mb-2">Invoice sequences have been cleared.</p>
            <p className="font-medium">Next steps:</p>
            <ol className="list-decimal list-inside space-y-1 mt-2">
              <li>Go back to POS</li>
              <li>Try creating your sale again</li>
              <li>Invoice number will generate correctly (e.g., InvTugue11_13_2025_0001)</li>
            </ol>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
