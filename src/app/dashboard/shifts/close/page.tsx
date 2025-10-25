'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { ReadingDisplay } from '@/components/ReadingDisplay'
import { CheckCircle, Loader2, FileText, Calculator } from 'lucide-react'

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
  const [loadingReadings, setLoadingReadings] = useState(true)
  const [error, setError] = useState('')
  const [currentShift, setCurrentShift] = useState<any>(null)
  const [closingNotes, setClosingNotes] = useState('')
  const [managerPassword, setManagerPassword] = useState('')
  const [showPasswordDialog, setShowPasswordDialog] = useState(false)
  // Use empty strings as default for better UX (allows deletion without "0" reappearing)
  const [denominations, setDenominations] = useState<any>({
    count1000: '',
    count500: '',
    count200: '',
    count100: '',
    count50: '',
    count20: '',
    count10: '',
    count5: '',
    count1: '',
    count025: '',
  })

  // State for readings (generated BEFORE cash count)
  const [xReading, setXReading] = useState<any>(null)
  const [zReading, setZReading] = useState<any>(null)
  const [systemExpectedCash, setSystemExpectedCash] = useState<number>(0)

  // State for final success
  const [shiftClosed, setShiftClosed] = useState(false)
  const [variance, setVariance] = useState<any>(null)

  useEffect(() => {
    fetchShiftAndGenerateReadings()
  }, [])

  const fetchShiftAndGenerateReadings = async () => {
    try {
      setLoadingReadings(true)

      // Step 1: Fetch the shift
      const urlParams = new URLSearchParams(window.location.search)
      const shiftId = urlParams.get('shiftId')

      let shift = null
      if (shiftId) {
        const res = await fetch(`/api/shifts?shiftId=${shiftId}`)
        const data = await res.json()
        if (data.shifts && data.shifts.length > 0) {
          shift = data.shifts[0]
        } else {
          setError('Shift not found')
          setLoadingReadings(false)
          return
        }
      } else {
        const res = await fetch('/api/shifts?status=open')
        const data = await res.json()
        if (data.shifts && data.shifts.length > 0) {
          shift = data.shifts[0]
        } else {
          setError('No open shift found')
          setLoadingReadings(false)
          return
        }
      }

      setCurrentShift(shift)

      // Step 2: Generate X Reading (CRITICAL for cash calculation fallback)
      const xRes = await fetch(`/api/readings/x-reading?shiftId=${shift.id}`)
      const xData = await xRes.json()
      console.log('X Reading Response:', xData)
      if (!xRes.ok) {
        throw new Error(xData.error || 'Failed to generate X Reading')
      }
      // Extract xReading from response (API returns { xReading: <data> })
      const xReadingData = xData.xReading
      setXReading(xReadingData)

      // Step 3: Generate Z Reading (attempt, but don't fail if user lacks permission)
      let zReadingData = null
      let systemCash = 0

      const zRes = await fetch(`/api/readings/z-reading?shiftId=${shift.id}`)
      const zData = await zRes.json()
      console.log('Z Reading Response:', zData)

      if (zRes.ok && zData.cash) {
        // Z Reading succeeded - use Z Reading's system cash
        zReadingData = zData
        systemCash = zData.cash.systemCash
        setZReading(zReadingData)
        console.log('✅ Using Z Reading system cash:', systemCash)
      } else {
        // Z Reading failed (likely permission error) - CRITICAL FALLBACK
        console.warn('⚠️ Z Reading failed, using X Reading expected cash as fallback')
        console.warn('Error:', zData.error)

        // Use X Reading's expected cash (Beginning Cash + Cash Sales + Cash In - Cash Out)
        if (xReadingData && xReadingData.expectedCash !== undefined) {
          systemCash = xReadingData.expectedCash
          console.log('✅ Using X Reading expected cash:', systemCash)
        } else {
          // Last resort: calculate from shift beginning cash
          systemCash = parseFloat(shift.beginningCash) || 0
          console.warn('⚠️ Using beginning cash as last resort:', systemCash)
        }
      }

      // Step 4: Set system expected cash for variance calculation
      setSystemExpectedCash(systemCash)

      setLoadingReadings(false)
    } catch (err: any) {
      setError(err.message || 'Failed to load shift and readings')
      setLoadingReadings(false)
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

      // Convert denomination strings to numbers for API
      const cashDenominationNumbers = Object.keys(denominations).reduce((acc, key) => {
        acc[key] = parseInt(denominations[key]) || 0
        return acc
      }, {} as any)

      const res = await fetch(`/api/shifts/${currentShift.id}/close`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          endingCash: totalCash,
          closingNotes,
          cashDenomination: cashDenominationNumbers,
          managerPassword,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Failed to close shift')
      }

      // Store variance data (X/Z readings already displayed)
      setVariance(data.variance)
      setShiftClosed(true)
      setLoading(false)

      // Scroll to top to show success message
      window.scrollTo({ top: 0, behavior: 'smooth' })
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

  // Loading state while generating readings
  if (loadingReadings) {
    return (
      <div className="container max-w-3xl mx-auto py-8">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Loader2 className="w-6 h-6 animate-spin" />
              Preparing Shift Close...
            </CardTitle>
            <CardDescription>
              Generating BIR-compliant X and Z readings for your review
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4" />
                <span>Fetching shift details...</span>
              </div>
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4" />
                <span>Generating X Reading (Mid-Shift Summary)...</span>
              </div>
              <div className="flex items-center gap-2">
                <Calculator className="w-4 h-4" />
                <span>Generating Z Reading (End-of-Day Report)...</span>
              </div>
              <div className="flex items-center gap-2">
                <Calculator className="w-4 h-4" />
                <span>Calculating system expected cash...</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (error && !currentShift) {
    return (
      <div className="container max-w-2xl mx-auto py-8">
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
        <Button onClick={() => router.push('/dashboard')} className="mt-4">
          Return to Dashboard
        </Button>
      </div>
    )
  }

  const totalCash = calculateTotal()
  const cashVariance = totalCash - systemExpectedCash

  // Show success screen after shift is closed
  if (shiftClosed) {
    return (
      <div className="container max-w-5xl mx-auto py-8 px-4">
        <Card className="mb-6 bg-green-50 border-green-500">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-green-700">
              <CheckCircle className="w-6 h-6" />
              Shift Closed Successfully!
            </CardTitle>
            <CardDescription>
              Your shift has been closed. All BIR-compliant readings are displayed below.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {variance && (
              <div className="mb-4 p-4 bg-white rounded-lg border">
                <h4 className="font-medium mb-2">Cash Reconciliation:</h4>
                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div>
                    <div className="text-muted-foreground">System Expected:</div>
                    <div className="text-lg font-bold">₱{variance.systemCash.toFixed(2)}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Physical Count:</div>
                    <div className="text-lg font-bold">₱{variance.endingCash.toFixed(2)}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Variance:</div>
                    <div className={`text-lg font-bold ${
                      variance.isBalanced ? 'text-green-600' :
                      variance.cashOver > 0 ? 'text-yellow-600' : 'text-red-600'
                    }`}>
                      {variance.isBalanced ? '✓ Balanced' :
                       variance.cashOver > 0 ? `+₱${variance.cashOver.toFixed(2)} Over` :
                       `-₱${variance.cashShort.toFixed(2)} Short`}
                    </div>
                  </div>
                </div>
              </div>
            )}
            <div className="flex gap-4">
              <Button onClick={() => router.push('/dashboard')} size="lg">
                Return to Dashboard
              </Button>
              <Button onClick={() => window.print()} variant="outline" size="lg">
                🖨️ Print Readings
              </Button>
            </div>
          </CardContent>
        </Card>

        <ReadingDisplay
          xReading={xReading}
          zReading={zReading}
          variance={variance}
        />
      </div>
    )
  }

  return (
    <div className="container max-w-5xl mx-auto py-8 px-4 space-y-6">
      {/* Step 1 & 2: Display X and Z Readings FIRST */}
      <Card className="border-blue-300 bg-blue-50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-blue-900">
            <FileText className="w-6 h-6" />
            Step 1 & 2: Review Your Shift Readings
          </CardTitle>
          <CardDescription>
            Please review your X Reading and Z Reading before counting cash
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ReadingDisplay
            xReading={xReading}
            zReading={zReading}
            variance={null}
          />
        </CardContent>
      </Card>

      {/* Step 3: Cash Count Form */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calculator className="w-6 h-6" />
            Step 3: Count Your Cash
          </CardTitle>
          <CardDescription>
            Based on the Z Reading above, count your physical cash
          </CardDescription>
        </CardHeader>
        <CardContent>
          {error && (
            <Alert variant="destructive" className="mb-4">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* SECURITY: System Expected Cash is HIDDEN during counting to prevent fraud */}
          {/* Cashiers should count blind - variance shown only AFTER shift closes */}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <h3 className="text-lg font-medium mb-4">Count Cash Denominations</h3>
              <div className="grid grid-cols-2 gap-4">
                {DENOMINATIONS.map((denom) => (
                  <div key={denom.field} className="space-y-1">
                    <Label>{denom.label}</Label>
                    <div className="flex items-center gap-2">
                      <Input
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        placeholder="0"
                        value={denominations[denom.field]}
                        onChange={(e) => {
                          const value = e.target.value
                          // Allow empty string or numbers only
                          if (value === '' || /^\d+$/.test(value)) {
                            setDenominations({
                              ...denominations,
                              [denom.field]: value
                            })
                          }
                        }}
                        onFocus={(e) => e.target.select()}
                        className="w-20 text-center"
                      />
                      <span className="text-sm text-muted-foreground">
                        = ₱{((parseInt(denominations[denom.field]) || 0) * denom.value).toFixed(2)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Total Counted vs Expected */}
            <div className="space-y-3">
              <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                <div className="flex justify-between items-center">
                  <span className="text-lg font-medium">Total Counted Cash:</span>
                  <span className="text-2xl font-bold text-green-600">₱{totalCash.toFixed(2)}</span>
                </div>
              </div>

              {/* SECURITY: Variance is HIDDEN during counting to prevent fraud */}
              {/* Cashiers should not see if they're over/short until AFTER shift closes */}
              {/* This prevents adjusting count to match expected amount and hiding theft */}
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
                  onClick={() => router.push('/dashboard')}
                  className="border-2 hover:bg-gray-100 font-medium"
                >
                  Cancel
                </Button>
              </div>
            )}
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
