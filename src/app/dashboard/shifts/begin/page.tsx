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

export default function BeginShiftPage() {
  const { data: session } = useSession()
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [userLocation, setUserLocation] = useState<any>(null)
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
    try {
      const res = await fetch('/api/shifts?status=open')
      const data = await res.json()

      console.log('[BeginShift] Checking existing shifts:', data)

      if (data.shifts && data.shifts.length > 0) {
        const shift = data.shifts[0]
        console.log('[BeginShift] Found existing open shift:', shift.shiftNumber)
        console.log('[BeginShift] Redirecting to POS page...')
        // User already has an open shift - redirect immediately
        router.replace('/dashboard/pos')
      } else {
        console.log('[BeginShift] No open shifts found - ready to start new shift')
      }
    } catch (err) {
      console.error('[BeginShift] Error checking shift:', err)
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
        throw new Error(data.error || 'Failed to start shift')
      }

      // Redirect to POS page
      router.push('/dashboard/pos')
    } catch (err: any) {
      setError(err.message)
      setLoading(false)
    }
  }

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
