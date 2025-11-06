/**
 * useUserPrimaryLocation Hook
 *
 * BULLETPROOF location detection for transaction pages.
 *
 * WHY THIS APPROACH:
 * - Session locationIds are stored in JWT (auth.simple.ts:213, 231, 251)
 * - Session is ALWAYS valid when user is logged in
 * - If session expires, user is logged out (cannot make transactions)
 * - Therefore: session.user.locationIds[0] is the MOST RELIABLE source
 *
 * USAGE:
 * Use this hook on ALL transaction pages to ensure inventory
 * deductions/additions happen at the CORRECT location:
 * - Purchase create
 * - Transfer create
 * - Sales/POS
 * - Inventory corrections
 * - Any page that modifies inventory
 *
 * CRITICAL FOR INVENTORY ACCURACY!
 */

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'

export interface UserPrimaryLocation {
  id: number
  name: string
  city?: string | null
  state?: string | null
}

export interface UseUserPrimaryLocationResult {
  /** The user's primary location ID (from session - INSTANT) */
  locationId: number | null

  /** The location details (name, city, state) - fetched once */
  location: UserPrimaryLocation | null

  /** True while fetching location details */
  loading: boolean

  /** Error if location fetch failed */
  error: string | null

  /** True if user has no location assigned */
  noLocationAssigned: boolean
}

export function useUserPrimaryLocation(): UseUserPrimaryLocationResult {
  const { data: session, status } = useSession()
  const [location, setLocation] = useState<UserPrimaryLocation | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Get location ID from session INSTANTLY (no API call)
  const locationId = session?.user?.locationIds?.[0] ?? null

  useEffect(() => {
    // If no session yet, wait for it
    if (status === 'loading') {
      setLoading(true)
      return
    }

    // If user is not authenticated
    if (status === 'unauthenticated') {
      setLoading(false)
      setError('Not authenticated')
      return
    }

    // If no location assigned to user
    if (!locationId) {
      setLoading(false)
      setError('No location assigned to your account')
      return
    }

    // Fetch location DETAILS (name, city, state) for display
    // Location ID is already known from session!
    async function fetchLocationDetails() {
      try {
        setLoading(true)
        setError(null)

        const response = await fetch(`/api/locations/${locationId}`)

        if (!response.ok) {
          throw new Error(`Failed to fetch location details: ${response.status}`)
        }

        const data = await response.json()

        setLocation({
          id: data.id,
          name: data.name,
          city: data.city || null,
          state: data.state || null,
        })
      } catch (err) {
        console.error('[useUserPrimaryLocation] Error fetching location details:', err)
        setError(err instanceof Error ? err.message : 'Failed to fetch location details')

        // Even if fetch fails, we still have the location ID from session
        // Set basic location object with ID only
        setLocation({
          id: locationId,
          name: 'Unknown Location',
          city: null,
          state: null,
        })
      } finally {
        setLoading(false)
      }
    }

    fetchLocationDetails()
  }, [locationId, status])

  return {
    locationId,
    location,
    loading,
    error,
    noLocationAssigned: !locationId && status === 'authenticated',
  }
}
