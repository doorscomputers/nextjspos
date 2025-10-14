'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Alert, AlertDescription } from '@/components/ui/alert'

const DENOMINATIONS = [
  { value: 1000, label: '₱1000 Bills', field: 'count1000' },
  { value: 500, label: '₱500 Bills', field: 'count500' },
  { value: 200, label: '₱200 Bills', field: 'count200' },
  { value: 100, label: '₱100 Bills', field: 'count100' },
  { value: 50, label: '₱50 Bills', field: 'count50' },
  { value: 20, label: '₱20 Bills', field: 'count20' },
  { value: 10, label: '₱10 Coins', field: 'count10' },
  { value: 5, label: '₱5 Coins', field: 'count5' },
  { value: 1, label: '₱1 Coins', field: 'count1' },
  { value: 0.25, label: '₱0.25 Coins', field: 'count025' },
]

export default function CloseShiftPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [currentShift, setCurrentShift] = useState<any>(null)
  const [closingNotes, setClosingNotes] = useState('')
  const [managerPassword, setManagerPassword] = useState('')
  const [showPasswordDialog, setShowPasswordDialog] = useState(false)
  const [denominations, setDenominations] = useState<any>({
    count1000: 0,
    count500: 0,
    count200: 0,
    count100: 0,
    count50: 0,
    count20: 0,
    count10: 0,
    count5: 0,
    count1: 0,
    count025: 0,
  })

  useEffect(() => {
    fetchCurrentShift()
  }, [])

  const fetchCurrentShift = async () => {
    try {
      const res = await fetch('/api/shifts?status=open')
      const data = await res.json()
      if (data.shifts && data.shifts.length > 0) {
        setCurrentShift(data.shifts[0])
      } else {
        setError('No open shift found')
      }
    } catch (err) {
      setError('Failed to fetch shift')
    }
  }

  const calculateTotal = () => {
    return DENOMINATIONS.reduce((total, denom) => {
      const count = parseInt(denominations[denom.field] || 0)
      return total + (count * denom.value)
    }, 0)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    // Show password dialog first
    if (!showPasswordDialog) {
      setShowPasswordDialog(true)
      return
    }

    // Validate password entered
    if (!managerPassword) {
      setError('Manager password is required to close shift')
      return
    }

    setLoading(true)
    setError('')

    try {
      const totalCash = calculateTotal()

      const res = await fetch(`/api/shifts/${currentShift.id}/close`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          endingCash: totalCash,
          closingNotes,
          cashDenomination: denominations,
          managerPassword, // Send password for verification
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Failed to close shift')
      }

      // Show results
      alert(`Shift Closed Successfully!

System Cash: ₱${data.variance.systemCash.toFixed(2)}
Actual Cash: ₱${data.variance.endingCash.toFixed(2)}
${data.variance.cashOver > 0 ? `Over: ₱${data.variance.cashOver.toFixed(2)}` : ''}
${data.variance.cashShort > 0 ? `Short: ₱${data.variance.cashShort.toFixed(2)}` : ''}
${data.variance.isBalanced ? 'Cash is balanced!' : 'Cash variance detected'}`)

      router.push('/dashboard')
    } catch (err: any) {
      setError(err.message)
      setLoading(false)
      setShowPasswordDialog(false)
      setManagerPassword('')
    }
  }

  const handleCancelPasswordDialog = () => {
    setShowPasswordDialog(false)
    setManagerPassword('')
    setError('')
  }

  if (!currentShift) {
    return (
      <div className="container max-w-2xl mx-auto py-8">
        <Alert>
          <AlertDescription>No open shift found. Please start a shift first.</AlertDescription>
        </Alert>
      </div>
    )
  }

  const totalCash = calculateTotal()

  return (
    <div className="container max-w-3xl mx-auto py-8 px-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">Close Shift</CardTitle>
          <CardDescription>
            Count your cash and close shift: {currentShift.shiftNumber}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {error && (
            <Alert variant="destructive" className="mb-4">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="mb-6 p-4 bg-blue-50 rounded-lg">
            <h3 className="font-medium mb-2">Shift Information</h3>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>Shift Number: <span className="font-bold">{currentShift.shiftNumber}</span></div>
              <div>Beginning Cash: <span className="font-bold">₱{parseFloat(currentShift.beginningCash).toFixed(2)}</span></div>
              <div>Opened At: <span className="font-bold">{new Date(currentShift.openedAt).toLocaleString()}</span></div>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <h3 className="text-lg font-medium mb-4">Count Cash Denominations</h3>
              <div className="grid grid-cols-2 gap-4">
                {DENOMINATIONS.map((denom) => (
                  <div key={denom.field} className="space-y-1">
                    <Label>{denom.label}</Label>
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        min="0"
                        value={denominations[denom.field]}
                        onChange={(e) => setDenominations({
                          ...denominations,
                          [denom.field]: parseInt(e.target.value) || 0
                        })}
                        className="w-20"
                      />
                      <span className="text-sm text-muted-foreground">
                        = ₱{(denominations[denom.field] * denom.value).toFixed(2)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
              <div className="flex justify-between items-center">
                <span className="text-lg font-medium">Total Counted Cash:</span>
                <span className="text-2xl font-bold text-green-600">₱{totalCash.toFixed(2)}</span>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="closingNotes">Closing Notes (Optional)</Label>
              <Textarea
                id="closingNotes"
                placeholder="Any notes about the shift closing..."
                value={closingNotes}
                onChange={(e) => setClosingNotes(e.target.value)}
                rows={3}
              />
            </div>

            {/* Password Dialog */}
            {showPasswordDialog && (
              <div className="p-6 border-2 border-red-300 rounded-lg bg-red-50 space-y-4">
                <div className="text-center">
                  <div className="text-4xl mb-2">🔐</div>
                  <h3 className="text-lg font-bold text-red-900">Manager Authorization Required</h3>
                  <p className="text-sm text-red-700 mt-2">
                    Enter Branch Manager or Admin password to close this shift
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="managerPassword" className="text-red-900 font-medium">
                    Manager/Admin Password <span className="text-red-600">*</span>
                  </Label>
                  <Input
                    id="managerPassword"
                    type="password"
                    placeholder="Enter password..."
                    value={managerPassword}
                    onChange={(e) => setManagerPassword(e.target.value)}
                    className="border-red-300 focus:border-red-500"
                    autoFocus
                  />
                  <p className="text-xs text-red-600">
                    Only Branch Managers or Admins can authorize shift closure
                  </p>
                </div>

                <div className="flex gap-3">
                  <Button
                    type="button"
                    onClick={handleCancelPasswordDialog}
                    variant="outline"
                    className="flex-1 border-2"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={loading || !managerPassword}
                    className="flex-1 bg-red-600 hover:bg-red-700 text-white font-bold shadow-lg"
                  >
                    {loading ? '🔒 Closing...' : '✅ Confirm & Close Shift'}
                  </Button>
                </div>
              </div>
            )}

            {/* Main Submit Button */}
            {!showPasswordDialog && (
              <div className="flex gap-4">
                <Button
                  type="submit"
                  className="flex-1 bg-red-600 hover:bg-red-700 text-white font-bold py-6 text-lg shadow-lg"
                  size="lg"
                >
                  🔒 Close Shift (Requires Authorization)
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => router.push('/dashboard/pos')}
                  className="border-2 hover:bg-gray-100 font-medium"
                >
                  Cancel
                </Button>
              </div>
            )}
          </form>

          <div className="mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
            <h4 className="font-medium text-yellow-800 mb-2">Important:</h4>
            <ul className="text-sm text-yellow-700 space-y-1">
              <li>• Count your cash carefully before submitting</li>
              <li>• The system will calculate any overage or shortage</li>
              <li>• Once closed, the shift cannot be reopened</li>
              <li>• A Z Reading will be available after closing</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
