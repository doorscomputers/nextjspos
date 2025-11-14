'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { BIRReadingDisplay } from '@/components/BIRReadingDisplay'
import { CheckCircle, Loader2, FileText, Calculator, CreditCard, Key } from 'lucide-react'
import { ExclamationTriangleIcon } from '@heroicons/react/24/outline'

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
  const [authMethod, setAuthMethod] = useState<'password' | 'rfid'>('password')
  const [rfidCode, setRfidCode] = useState('')
  const [rfidCodeActual, setRfidCodeActual] = useState('') // Store actual code for API
  const [rfidVerified, setRfidVerified] = useState(false)
  const [verifyingRfid, setVerifyingRfid] = useState(false)
  const [locationName, setLocationName] = useState('')
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

      // Check if shift is already closed
      if (shift.status === 'closed') {
        setError('This shift is already closed. Please start a new shift to continue.')
        setLoadingReadings(false)
        return
      }

      setCurrentShift(shift)

      // Declare xReadingData outside try block so it's accessible for fallback
      let xReadingData: any = null

      // Step 2: Generate X Reading (CRITICAL for cash calculation fallback)
      // Add timeout to prevent hanging on old/large shifts
      // INCREASED TIMEOUT: For Supabase/cloud DBs with network latency + old shifts with many transactions
      const xController = new AbortController()
      const xTimeout = setTimeout(() => xController.abort(), 120000) // 120 second (2 minute) timeout

      try {
        const xRes = await fetch(`/api/readings/x-reading?shiftId=${shift.id}`, {
          signal: xController.signal
        })
        clearTimeout(xTimeout)
        const xData = await xRes.json()
        console.log('X Reading Response:', xData)
        if (!xRes.ok) {
          throw new Error(xData.error || 'Failed to generate X Reading')
        }
        // Extract xReading from response (API returns { xReading: <data> })
        xReadingData = xData.xReading
        setXReading(xReadingData)
      } catch (err: any) {
        clearTimeout(xTimeout)
        if (err.name === 'AbortError') {
          throw new Error('X Reading timed out after 2 minutes. This shift may have too many transactions. Please use Force-Close or contact support.')
        }
        throw err
      }

      // Step 3: Generate Z Reading (attempt, but don't fail if user lacks permission)
      let zReadingData = null
      let systemCash = 0

      const zController = new AbortController()
      const zTimeout = setTimeout(() => zController.abort(), 120000) // 120 second (2 minute) timeout

      try {
        const zRes = await fetch(`/api/readings/z-reading?shiftId=${shift.id}`, {
          signal: zController.signal
        })
        clearTimeout(zTimeout)
        const zData = await zRes.json()
        console.log('Z Reading Response:', zData)

        if (zRes.ok && !zData.error) {
          // Z Reading succeeded - use Z Reading data
          // API returns the ZReadingData object directly
          zReadingData = zData
          systemCash = zData.expectedCash || parseFloat(shift.beginningCash) || 0
          setZReading(zReadingData)
          console.log('✅ Z Reading loaded successfully. System cash:', systemCash)
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
      } catch (err: any) {
        clearTimeout(zTimeout)
        if (err.name === 'AbortError') {
          console.warn('⚠️ Z Reading timed out after 2 minutes, using X Reading expected cash as fallback')
          // Use X Reading's expected cash as fallback
          if (xReadingData && xReadingData.expectedCash !== undefined) {
            systemCash = xReadingData.expectedCash
            console.log('✅ Using X Reading expected cash after Z timeout:', systemCash)
          } else {
            systemCash = parseFloat(shift.beginningCash) || 0
            console.warn('⚠️ Using beginning cash as last resort:', systemCash)
          }
        } else {
          // Other errors - still use fallback
          console.warn('⚠️ Z Reading error:', err.message)
          if (xReadingData && xReadingData.expectedCash !== undefined) {
            systemCash = xReadingData.expectedCash
          } else {
            systemCash = parseFloat(shift.beginningCash) || 0
          }
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

  const handleRfidScan = async (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && rfidCode.trim()) {
      e.preventDefault()
      setVerifyingRfid(true)
      setError('')

      const scannedCode = rfidCode.trim()

      try {
        const response = await fetch(`/api/locations/verify-code?code=${scannedCode}`)
        const data = await response.json()

        if (data.valid) {
          // Verify the RFID code matches the shift's location
          if (currentShift && currentShift.locationId === data.locationId) {
            setLocationName(data.locationName)
            setRfidCodeActual(scannedCode) // Store actual code for API
            setRfidCode('*'.repeat(scannedCode.length)) // Mask with asterisks
            setRfidVerified(true)
            console.log(`[ShiftClose] ✓ RFID verified: ${data.locationName}`)
          } else {
            setError('Invalid RFID code. This card does not match the shift location.')
            setRfidCode('')
            setRfidCodeActual('')
            setRfidVerified(false)
          }
        } else {
          setError(data.error || 'Invalid RFID code. Please scan the correct card for this location.')
          setRfidCode('')
          setRfidCodeActual('')
          setRfidVerified(false)
        }
      } catch (err: any) {
        setError('Failed to verify RFID code. Please try again.')
        setRfidCode('')
        setRfidCodeActual('')
        setRfidVerified(false)
      } finally {
        setVerifyingRfid(false)
      }
    }
  }

  const clearRfidScan = () => {
    setRfidCode('')
    setRfidCodeActual('')
    setLocationName('')
    setRfidVerified(false)
    setError('')
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    // Prevent submission if already closed or loading
    if (shiftClosed) {
      console.log('[ShiftClose] Shift already closed, ignoring submission')
      return
    }

    if (loading) {
      console.log('[ShiftClose] Already processing, ignoring submission')
      return
    }

    // Show authorization dialog first
    if (!showPasswordDialog) {
      setShowPasswordDialog(true)
      return
    }

    // Validate authorization - either password OR RFID required
    if (authMethod === 'password' && !managerPassword) {
      setError('Manager password is required to close shift')
      return
    }

    if (authMethod === 'rfid' && !rfidVerified) {
      setError('Please scan and verify the location RFID card')
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

      // Prepare authorization data based on selected method
      const authData: any = {
        endingCash: totalCash,
        closingNotes,
        cashDenomination: cashDenominationNumbers,
      }

      if (authMethod === 'password') {
        authData.managerPassword = managerPassword
      } else {
        authData.locationCode = rfidCodeActual // Use actual code, not masked version
      }

      console.log('[ShiftClose] Submitting close request for shift:', currentShift.id)
      console.log('[ShiftClose] Auth data:', authData)

      const res = await fetch(`/api/shifts/${currentShift.id}/close`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(authData),
      })

      console.log('[ShiftClose] Response status:', res.status)
      const data = await res.json()
      console.log('[ShiftClose] Response data:', data)

      if (!res.ok) {
        console.error('[ShiftClose] Close failed:', data.error)
        throw new Error(data.error || 'Failed to close shift')
      }

      // Store variance data and UPDATE Z Reading with actual cash count
      console.log('[ShiftClose] ✅ Shift closed successfully')
      setVariance(data.variance)

      // CRITICAL FIX: Update Z Reading with actual ending cash, variance, AND denominations
      if (data.zReading) {
        // Convert denomination strings to numbers for Z Reading
        const denominationNumbers = Object.keys(denominations).reduce((acc, key) => {
          acc[key] = parseInt(denominations[key]) || 0
          return acc
        }, {} as any)

        const updatedZReading = {
          ...data.zReading,
          endingCash: data.variance.endingCash,
          cashVariance: data.variance.endingCash - data.variance.systemCash,
          cashDenominations: denominationNumbers, // Add denomination breakdown
        }
        setZReading(updatedZReading)
        console.log('[ShiftClose] Updated Z Reading with actual cash:', updatedZReading.endingCash, 'Variance:', updatedZReading.cashVariance, 'Denominations:', denominationNumbers)
      }

      setShiftClosed(true)
      setLoading(false)
      setShowPasswordDialog(false) // Close authorization dialog

      // Scroll to top to show success message
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch (err: any) {
      console.error('[ShiftClose] ❌ Error during close:', err)
      setError(err.message)
      setLoading(false)
      setShowPasswordDialog(false)
      setManagerPassword('')
      setRfidCode('')
      setRfidCodeActual('')
      setRfidVerified(false)
    }
  }

  const handleCancelPasswordDialog = () => {
    setShowPasswordDialog(false)
    setManagerPassword('')
    setRfidCode('')
    setRfidCodeActual('')
    setRfidVerified(false)
    setLocationName('')
    setAuthMethod('password')
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
              <div className="space-y-4 mb-4">
                {/* Cash Reconciliation Summary */}
                <div className="p-4 bg-white rounded-lg border">
                  <h4 className="font-medium mb-3">Cash Reconciliation:</h4>
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

                {/* Cash Denomination Breakdown */}
                <div className="p-4 bg-white rounded-lg border">
                  <h4 className="font-medium mb-3">Cash Denomination Breakdown:</h4>
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-sm">
                    {DENOMINATIONS.map((denom) => {
                      const count = parseInt(denominations[denom.field]) || 0
                      const amount = count * denom.value
                      if (count === 0) return null
                      return (
                        <div key={denom.field} className="flex justify-between items-center p-2 bg-gray-50 rounded">
                          <span className="text-muted-foreground">{denom.label}:</span>
                          <div className="text-right">
                            <div className="font-semibold">{count}×</div>
                            <div className="text-xs text-muted-foreground">₱{amount.toFixed(2)}</div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                  <div className="mt-3 pt-3 border-t flex justify-between items-center">
                    <span className="font-semibold">Total Counted:</span>
                    <span className="text-xl font-bold text-green-600">₱{calculateTotal().toFixed(2)}</span>
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

        <BIRReadingDisplay
          xReading={xReading}
          zReading={zReading}
        />
      </div>
    )
  }

  return (
    <div className="container max-w-5xl mx-auto py-8 px-4 space-y-6">
      {/* Old shift warning - Simple and clean */}
      {currentShift && (() => {
        const hoursOpen = Math.floor((Date.now() - new Date(currentShift.openedAt).getTime()) / (1000 * 60 * 60))
        const daysOpen = Math.floor(hoursOpen / 24)
        const isOverdue = hoursOpen >= 24

        if (hoursOpen >= 9) {
          const message = isOverdue
            ? `⚠️ This shift is ${daysOpen} day${daysOpen > 1 ? 's' : ''} old - BIR requires daily closure`
            : `⚠️ This shift is ${hoursOpen} hours old - please close soon`

          return (
            <div className={`px-4 py-3 rounded-lg border-l-4 ${
              isOverdue
                ? 'bg-red-50 border-red-500 dark:bg-red-950/50 dark:border-red-500'
                : 'bg-orange-50 border-orange-500 dark:bg-orange-950/50 dark:border-orange-500'
            }`}>
              <p className={`text-sm font-medium ${isOverdue ? 'text-red-900 dark:text-red-200' : 'text-orange-900 dark:text-orange-200'}`}>
                {message}
              </p>
            </div>
          )
        }
        return null
      })()}

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
          <BIRReadingDisplay
            xReading={xReading}
            zReading={zReading}
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

            {/* Authorization Dialog */}
            {showPasswordDialog && (
              <div className="p-6 border-2 border-red-300 rounded-lg bg-red-50 space-y-4">
                <div className="text-center">
                  <div className="text-4xl mb-2">🔐</div>
                  <h3 className="text-lg font-bold text-red-900">Manager Authorization Required</h3>
                  <p className="text-sm text-red-700 mt-2">
                    Choose one of the two authorization methods to close this shift
                  </p>
                </div>

                {/* Authorization Method Tabs */}
                <div className="flex gap-2 p-1 bg-red-100 rounded-lg">
                  <button
                    type="button"
                    onClick={() => {
                      setAuthMethod('password')
                      setError('')
                    }}
                    className={`flex-1 py-2 px-4 rounded-md font-medium transition-all flex items-center justify-center gap-2 ${
                      authMethod === 'password'
                        ? 'bg-white text-red-900 shadow-md'
                        : 'text-red-700 hover:text-red-900'
                    }`}
                  >
                    <Key className="w-4 h-4" />
                    Manager Password
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setAuthMethod('rfid')
                      setError('')
                    }}
                    className={`flex-1 py-2 px-4 rounded-md font-medium transition-all flex items-center justify-center gap-2 ${
                      authMethod === 'rfid'
                        ? 'bg-white text-red-900 shadow-md'
                        : 'text-red-700 hover:text-red-900'
                    }`}
                  >
                    <CreditCard className="w-4 h-4" />
                    Location RFID
                  </button>
                </div>

                {/* Password Method */}
                {authMethod === 'password' && (
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
                      Enter the password of a Branch Manager or Admin
                    </p>
                  </div>
                )}

                {/* RFID Method */}
                {authMethod === 'rfid' && (
                  <div className="space-y-2">
                    <Label htmlFor="rfidAuth" className="text-red-900 font-medium flex items-center gap-2">
                      <CreditCard className="w-4 h-4" />
                      Location RFID Card <span className="text-red-600">*</span>
                    </Label>

                    {!rfidVerified ? (
                      <>
                        <Input
                          id="rfidAuth"
                          type="password"
                          className="font-mono text-lg border-red-300 focus:border-red-500"
                          placeholder="Scan RFID card here..."
                          value={rfidCode}
                          onChange={(e) => setRfidCode(e.target.value)}
                          onKeyDown={handleRfidScan}
                          disabled={verifyingRfid}
                          autoFocus
                        />
                        <p className="text-xs text-red-600">
                          📱 Scan the location's RFID card and press Enter to authorize
                        </p>
                      </>
                    ) : (
                      <div className="bg-green-50 border-2 border-green-500 rounded-lg p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="flex items-center justify-center w-10 h-10 bg-green-500 rounded-full">
                              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                              </svg>
                            </div>
                            <div>
                              <p className="text-sm text-gray-600">Verified Location:</p>
                              <p className="text-lg font-bold text-green-900">{locationName}</p>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={clearRfidScan}
                            className="px-3 py-1 bg-red-100 hover:bg-red-200 text-red-700 text-sm rounded-md transition-colors"
                          >
                            Clear
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}

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
                    disabled={
                      loading ||
                      (authMethod === 'password' && !managerPassword) ||
                      (authMethod === 'rfid' && !rfidVerified)
                    }
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
