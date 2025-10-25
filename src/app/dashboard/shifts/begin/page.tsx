'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { AlertCircle, Clock, MapPin, Calendar, ChevronRight } from 'lucide-react'

export default function BeginShiftPage() {
  const { data: session } = useSession()
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [checkingShift, setCheckingShift] = useState(true)
  const [error, setError] = useState('')
  const [userLocation, setUserLocation] = useState<any>(null)
  const [unclosedShift, setUnclosedShift] = useState<any>(null)
  const [formData, setFormData] = useState({
    beginningCash: '',
    openingNotes: '',
  })

  useEffect(() => {
    fetchUserLocation()
    checkExistingShift()
  }, [])

  const fetchUserLocation = async () => {
    try {
      // Get user's assigned location from session
      const res = await fetch('/api/user-locations/my-location')
      const data = await res.json()
      if (data.location) {
        setUserLocation(data.location)
      } else {
        setError('No location assigned to your account. Please contact your administrator.')
      }
    } catch (err) {
      console.error('Error fetching user location:', err)
      setError('Unable to fetch your assigned location.')
    }
  }

  const checkExistingShift = async () => {
    setCheckingShift(true)
    try {
      const res = await fetch('/api/shifts?status=open')
      const data = await res.json()

      console.log('[BeginShift] Checking existing shifts:', data)

      if (data.shifts && data.shifts.length > 0) {
        const shift = data.shifts[0]
        console.log('[BeginShift] Found existing open shift:', shift.shiftNumber)

        // Calculate duration
        const openedAt = new Date(shift.openedAt)
        const now = new Date()
        const hoursSinceOpen = Math.floor((now.getTime() - openedAt.getTime()) / (1000 * 60 * 60))
        const daysSinceOpen = Math.floor(hoursSinceOpen / 24)

        setUnclosedShift({
          ...shift,
          hoursSinceOpen,
          daysSinceOpen,
          isOverdue: daysSinceOpen >= 1
        })
      } else {
        console.log('[BeginShift] No open shifts found - ready to start new shift')
        setUnclosedShift(null)
      }
    } catch (err) {
      console.error('[BeginShift] Error checking shift:', err)
    } finally {
      setCheckingShift(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      if (!userLocation) {
        throw new Error('No location assigned to your account')
      }

      const res = await fetch('/api/shifts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          locationId: userLocation.id,
          beginningCash: parseFloat(formData.beginningCash),
          openingNotes: formData.openingNotes,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        // If there's an unclosed shift, show detailed error
        if (data.unclosedShift) {
          const shift = data.unclosedShift
          const errorMsg = `${data.error}\n\nShift: ${shift.shiftNumber}\nLocation: ${shift.locationName}\nOpened: ${new Date(shift.openedAt).toLocaleString()}\nDuration: ${shift.daysSinceOpen > 0 ? `${shift.daysSinceOpen} day(s)` : `${shift.hoursSinceOpen} hour(s)`}${shift.isOverdue ? '\n\n⚠️ THIS SHIFT IS OVERDUE! Please close it immediately.' : ''}`
          throw new Error(errorMsg)
        }
        throw new Error(data.error || 'Failed to start shift')
      }

      // Redirect to POS page
      router.push('/dashboard/pos')
    } catch (err: any) {
      setError(err.message)
      setLoading(false)
    }
  }

  // Show loading state while checking for unclosed shifts
  if (checkingShift) {
    return (
      <div className="container max-w-2xl mx-auto py-8 px-4">
        <Card>
          <CardContent className="py-12 text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-muted-foreground">Checking for open shifts...</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Show warning if user has an unclosed shift
  if (unclosedShift) {
    const openedDate = new Date(unclosedShift.openedAt)
    const formattedDate = openedDate.toLocaleDateString('en-PH', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })
    const formattedTime = openedDate.toLocaleTimeString('en-PH', {
      hour: '2-digit',
      minute: '2-digit',
    })

    return (
      <div className="container max-w-3xl mx-auto py-8 px-4">
        <Card className="border-yellow-500 border-2">
          <CardHeader className="bg-yellow-50 border-b border-yellow-200">
            <div className="flex items-start gap-4">
              <div className="p-3 bg-yellow-500 rounded-full">
                <AlertCircle className="h-8 w-8 text-white" />
              </div>
              <div className="flex-1">
                <CardTitle className="text-2xl text-yellow-900">
                  Cannot Start New Shift
                </CardTitle>
                <CardDescription className="text-yellow-700 mt-2">
                  You have an unclosed shift that must be closed before starting a new one
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="space-y-6">
              {/* Unclosed Shift Details */}
              <div className="bg-white rounded-lg border-2 border-yellow-300 p-6 space-y-4">
                <h3 className="font-semibold text-lg text-yellow-900 mb-4">
                  Unclosed Shift Details
                </h3>

                <div className="grid gap-4">
                  <div className="flex items-center gap-3 text-sm">
                    <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                      <span className="text-blue-600 font-bold">#</span>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">Shift Number</div>
                      <div className="font-semibold">{unclosedShift.shiftNumber}</div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 text-sm">
                    <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                      <MapPin className="h-4 w-4 text-green-600" />
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">Location</div>
                      <div className="font-semibold">{unclosedShift.location?.name || 'Unknown'}</div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 text-sm">
                    <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center">
                      <Calendar className="h-4 w-4 text-purple-600" />
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">Opened On</div>
                      <div className="font-semibold">{formattedDate} at {formattedTime}</div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 text-sm">
                    <div className="w-8 h-8 bg-orange-100 rounded-full flex items-center justify-center">
                      <Clock className="h-4 w-4 text-orange-600" />
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">Duration</div>
                      <div className="font-semibold">
                        {unclosedShift.daysSinceOpen > 0
                          ? `${unclosedShift.daysSinceOpen} day(s) and ${unclosedShift.hoursSinceOpen % 24} hour(s)`
                          : `${unclosedShift.hoursSinceOpen} hour(s)`}
                      </div>
                    </div>
                  </div>
                </div>

                {unclosedShift.isOverdue && (
                  <Alert variant="destructive" className="mt-4">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      <strong>OVERDUE:</strong> This shift has been open for more than 24 hours.
                      Please close it immediately to maintain accurate records.
                    </AlertDescription>
                  </Alert>
                )}
              </div>

              {/* Instructions */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
                <h4 className="font-medium text-blue-900 mb-3">What you need to do:</h4>
                <ol className="space-y-2 text-sm text-blue-800">
                  <li className="flex items-start gap-2">
                    <span className="font-bold">1.</span>
                    <span>Close your previous shift by counting cash and generating a Z-Reading</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="font-bold">2.</span>
                    <span>After closing, you can start a new shift</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="font-bold">3.</span>
                    <span>All sales must be tied to a shift for proper accounting</span>
                  </li>
                </ol>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-4 pt-4">
                <Button
                  onClick={() => router.push(`/dashboard/shifts/${unclosedShift.id}/close`)}
                  className="flex-1 bg-yellow-600 hover:bg-yellow-700 text-white font-semibold py-6 text-lg shadow-lg"
                  size="lg"
                >
                  Close Previous Shift
                  <ChevronRight className="ml-2 h-5 w-5" />
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => router.push('/dashboard')}
                  className="border-2 hover:bg-gray-100 font-medium"
                >
                  Go to Dashboard
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Help Card */}
        <Card className="mt-6 bg-gray-50 border-gray-200">
          <CardContent className="pt-6">
            <h3 className="font-medium mb-2 text-gray-900">Need Help?</h3>
            <p className="text-sm text-gray-600">
              If you believe this is an error or need assistance closing the shift,
              please contact your supervisor or system administrator.
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Show the normal begin shift form
  return (
    <div className="container max-w-2xl mx-auto py-8 px-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">Begin Shift</CardTitle>
          <CardDescription>
            Start your cashier shift by entering the beginning cash amount
          </CardDescription>
        </CardHeader>
        <CardContent>
          {error && (
            <Alert variant="destructive" className="mb-4">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Auto-assigned Location Display */}
            <div className="space-y-2 bg-blue-50 p-4 rounded-lg border border-blue-200">
              <Label className="text-sm font-medium text-blue-900">Your Assigned Location</Label>
              <div className="text-lg font-semibold text-blue-700">
                {userLocation ? userLocation.name : 'Loading...'}
              </div>
              <p className="text-xs text-blue-600">
                This shift will be assigned to your location automatically
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="beginningCash">Beginning Cash (₱)</Label>
              <Input
                id="beginningCash"
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                value={formData.beginningCash}
                onChange={(e) => setFormData(prev => ({ ...prev, beginningCash: e.target.value }))}
                required
                className="text-lg"
              />
              <p className="text-sm text-muted-foreground">
                Enter the total cash amount in your drawer to start the shift
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="openingNotes">Opening Notes (Optional)</Label>
              <Textarea
                id="openingNotes"
                placeholder="Any notes about the shift opening..."
                value={formData.openingNotes}
                onChange={(e) => setFormData(prev => ({ ...prev, openingNotes: e.target.value }))}
                rows={3}
              />
            </div>

            <div className="flex gap-4 pt-6">
              <Button
                type="submit"
                disabled={loading || !userLocation || !formData.beginningCash}
                className="flex-1 bg-green-600 hover:bg-green-700 text-white font-semibold py-6 text-lg shadow-lg"
                size="lg"
              >
                {loading ? 'Starting Shift...' : '🚀 Start Shift'}
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
          </form>
        </CardContent>
      </Card>

      <Card className="mt-6 bg-blue-50 border-blue-200">
        <CardContent className="pt-6">
          <h3 className="font-medium mb-2">Important Reminders:</h3>
          <ul className="text-sm space-y-1 text-muted-foreground">
            <li>• Count your cash carefully before entering the beginning amount</li>
            <li>• Make sure your drawer is locked when not in use</li>
            <li>• All sales will be tracked under this shift</li>
            <li>• You must close this shift at the end of your work period</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  )
}
